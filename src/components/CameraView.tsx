import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  RotateCcw,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Play,
  Pause,
  Upload,
  Radio,
  Scan,
  Key,
  Trash2,
} from 'lucide-react';
import { TRAVEL_SAMPLES } from '../data/travelSamples';
import { POPULAR_LANGUAGE_PACKS } from '../data/offlineLanguagePacksData';
import { TravelSample } from '../types';

interface CameraViewProps {
  onLiveFrame: (imageDataUrl: string, isManualSnap?: boolean) => void;
  isAnalyzing: boolean;
  isLiveTranslating: boolean;
  setIsLiveTranslating: (val: boolean) => void;
  staticImageUrl: string | null;
  onSelectSample: (sample: TravelSample) => void;
  onClearStaticImage: () => void;
  onClearResult?: () => void;
  detectedCount: number;
  isOnline?: boolean;
  onOpenOfflinePacks?: () => void;
  activePackId?: string;
  isMissingApiKey?: boolean;
  isQuotaExhausted?: boolean;
  onOpenApiKeyModal?: () => void;
  children?: React.ReactNode;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onLiveFrame,
  isAnalyzing,
  isLiveTranslating,
  setIsLiveTranslating,
  staticImageUrl,
  onSelectSample,
  onClearStaticImage,
  onClearResult,
  detectedCount,
  isOnline = true,
  onOpenOfflinePacks,
  activePackId = 'zh',
  isMissingApiKey = false,
  isQuotaExhausted = false,
  onOpenApiKeyModal,
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stable refs to prevent effect re-trigger churn
  const isAnalyzingRef = useRef(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;
  const isLiveTranslatingRef = useRef(isLiveTranslating);
  isLiveTranslatingRef.current = isLiveTranslating;
  const onLiveFrameRef = useRef(onLiveFrame);
  onLiveFrameRef.current = onLiveFrame;

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [videoBoxStyle, setVideoBoxStyle] = useState<React.CSSProperties>({});

  const updateVideoBox = useCallback(() => {
    const parent = viewportRef.current;
    const v = videoRef.current;
    if (!parent || !v || v.videoWidth <= 0 || v.videoHeight <= 0) return;
    const aspect = v.videoWidth / v.videoHeight;
    setVideoAspect(aspect);

    const pW = parent.clientWidth;
    const pH = parent.clientHeight;
    if (pW <= 0 || pH <= 0) return;

    const parentAspect = pW / pH;
    if (aspect > parentAspect) {
      const w = pW;
      const h = Math.round(pW / aspect);
      setVideoBoxStyle({ width: `${w}px`, height: `${h}px` });
    } else {
      const h = pH;
      const w = Math.round(pH * aspect);
      setVideoBoxStyle({ width: `${w}px`, height: `${h}px` });
    }
  }, []);

  const updateVideoAspect = useCallback(() => {
    updateVideoBox();
  }, [updateVideoBox]);

  useEffect(() => {
    updateVideoBox();
    window.addEventListener('resize', updateVideoBox);
    return () => window.removeEventListener('resize', updateVideoBox);
  }, [updateVideoBox]);

  // Stop active media stream tracks cleanly
  const stopExistingStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
  }, []);

  // Start camera stream safely without leaving abandoned tracks
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopExistingStream();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = mediaStream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video auto-play deferred:', playErr);
        }
      }

      setCameraReady(true);
      setIsRestarting(false);

      // Check for torch capability
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && capabilities.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraReady(false);
      setIsRestarting(false);
      if (err.name === 'NotAllowedError') {
        setCameraError('Bạn chưa cấp quyền Camera trên trình duyệt. Vui lòng cho phép quyền truy cập camera.');
      } else {
        setCameraError('Không thể mở Camera trên thiết bị này. Bạn có thể chọn ảnh mẫu du lịch bên dưới để thử nghiệm.');
      }
    }
  }, [facingMode, stopExistingStream]);

  // Restart camera stream (used for manual refresh or recovering from freezes)
  const restartCamera = useCallback(() => {
    setIsRestarting(true);
    setCameraReady(false);
    setTimeout(() => {
      startCamera();
    }, 150);
  }, [startCamera]);

  useEffect(() => {
    if (!staticImageUrl) {
      startCamera();
    }

    return () => {
      stopExistingStream();
    };
  }, [facingMode, staticImageUrl, startCamera, stopExistingStream]);

  // Hardware watchdog: Auto-detect if video playback gets stalled/frozen by browser
  useEffect(() => {
    if (staticImageUrl) return;

    let lastProgressTime = -1;
    let frozenCount = 0;

    const watchdog = setInterval(() => {
      const video = videoRef.current;
      if (!video || !cameraReady || !streamRef.current) return;

      // Check if playback currentTime is advancing
      if (video.currentTime === lastProgressTime && !video.paused) {
        frozenCount++;
        if (frozenCount >= 2) {
          // Video decoder stalled; nudge playback
          video.play().catch(() => {});
        }
        if (frozenCount >= 4) {
          // Re-attach stream to video element to kick-start decoder
          if (streamRef.current) {
            video.srcObject = streamRef.current;
            video.play().catch(() => {});
          }
          frozenCount = 0;
        }
      } else {
        frozenCount = 0;
        lastProgressTime = video.currentTime;
      }
    }, 1500);

    return () => clearInterval(watchdog);
  }, [cameraReady, staticImageUrl]);

  // Auto-resume playback if mobile browser unexpectedly pauses the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onUnexpectedPause = () => {
      if (isLiveTranslatingRef.current && !staticImageUrl) {
        video.play().catch(() => {});
      }
    };

    video.addEventListener('pause', onUnexpectedPause);
    video.addEventListener('stalled', onUnexpectedPause);

    return () => {
      video.removeEventListener('pause', onUnexpectedPause);
      video.removeEventListener('stalled', onUnexpectedPause);
    };
  }, [staticImageUrl]);

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  // Flip camera between environment (rear) and user (front)
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // High-performance, non-blocking frame capture directly from video element
  const captureFrame = useCallback(() => {
    if (staticImageUrl) {
      return staticImageUrl;
    }
    const video = videoRef.current;
    if (!video || !cameraReady) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const targetW = Math.round(video.videoWidth * scale);
    const targetH = Math.round(video.videoHeight * scale);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    // 0.58 JPEG produces crisp OCR with tiny ~35KB payload for true 1-second latency
    return canvas.toDataURL('image/jpeg', 0.58);
  }, [cameraReady, staticImageUrl]);

  // SMOOTH LIVE TRANSLATION LOOP (Completely non-blocking, leaves video stream uninterrupted at 60fps)
  useEffect(() => {
    if (!isLiveTranslating || staticImageUrl || !cameraReady) return;

    let isMounted = true;
    let timeoutId: any = null;

    const runLiveLoop = async () => {
      if (!isMounted || !isLiveTranslatingRef.current) return;

      const video = videoRef.current;
      if (
        !isAnalyzingRef.current &&
        video &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const frameData = captureFrame();
        if (frameData && onLiveFrameRef.current) {
          onLiveFrameRef.current(frameData);
        }
      }

      // Throttle interval to 8 seconds if shared quota is exhausted to avoid rate-limit spamming
      const loopInterval = isQuotaExhausted ? 8000 : 750;
      timeoutId = setTimeout(runLiveLoop, loopInterval);
    };

    timeoutId = setTimeout(runLiveLoop, 100);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLiveTranslating, staticImageUrl, cameraReady, captureFrame, isQuotaExhausted]);

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onLiveFrame(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const activePack =
    POPULAR_LANGUAGE_PACKS.find((p) => p.id === activePackId) || POPULAR_LANGUAGE_PACKS[0];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Viewport Container */}
      <div
        ref={viewportRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950"
      >
        {/* Missing API Key helper banner */}
        {isMissingApiKey && !staticImageUrl && (
          <div className="absolute top-14 inset-x-3 sm:inset-x-8 max-w-md mx-auto z-30 bg-slate-950/95 border border-amber-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-slate-100 flex items-start gap-2.5 pointer-events-auto animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                Chưa có Gemini API Key trên Vercel
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Camera đang tự động dịch bằng gói ngoại tuyến <strong>{activePack.shortName}</strong>. Để dịch AI trực tuyến đa ngôn ngữ, hãy nhập Key miễn phí:
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {onOpenApiKeyModal && (
                  <button
                    onClick={onOpenApiKeyModal}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition"
                  >
                    <Key className="w-3 h-3" />
                    <span>Nhập Key miễn phí (30s)</span>
                  </button>
                )}
                {onOpenOfflinePacks && (
                  <button
                    onClick={onOpenOfflinePacks}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                  >
                    <span>Quản lý gói ngoại tuyến</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quota limit helper banner */}
        {!isMissingApiKey && isQuotaExhausted && !staticImageUrl && (
          <div className="absolute top-14 inset-x-3 sm:inset-x-8 max-w-md mx-auto z-30 bg-slate-950/95 border border-amber-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-slate-100 flex items-start gap-2.5 pointer-events-auto animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                AI dùng chung đã hết 20 lượt miễn phí hôm nay
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Ứng dụng đang dịch bằng gói từ điển <strong>{activePack.shortName}</strong>. Bạn có thể dán Gemini API Key miễn phí từ Google AI Studio để tiếp tục dùng AI tốc độ cao:
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {onOpenApiKeyModal && (
                  <button
                    onClick={onOpenApiKeyModal}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition"
                  >
                    <Key className="w-3 h-3" />
                    <span>Nhập Key riêng (30s)</span>
                  </button>
                )}
                {onOpenOfflinePacks && (
                  <button
                    onClick={onOpenOfflinePacks}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                  >
                    <span>Đổi gói ngoại tuyến</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {staticImageUrl ? (
          // Static Preset Image Mode: shrinkwrap wrapper guarantees exact coordinate alignment
          <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
            <img
              src={staticImageUrl}
              alt="Scanned frame"
              className="max-w-full max-h-full w-auto h-auto block select-none object-contain"
            />
            {/* AR Overlay rendered directly on top of the image */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {children}
            </div>
          </div>
        ) : (
          // CONTINUOUS LIVE CAMERA STREAM: Wrapper matches exact aspect ratio of video frame
          <div
            className="relative flex items-center justify-center max-w-full max-h-full overflow-hidden"
            style={
              videoBoxStyle.width
                ? videoBoxStyle
                : videoAspect
                ? { aspectRatio: `${videoAspect}` }
                : { width: '100%', height: '100%' }
            }
          >
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              onLoadedMetadata={updateVideoBox}
              onCanPlay={updateVideoBox}
              className={`w-full h-full block object-fill ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Viewfinder Target Reticle / Corner brackets */}
            <div className="absolute inset-6 sm:inset-14 pointer-events-none flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="w-7 h-7 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg shadow-sm" />
                <div className="w-7 h-7 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg shadow-sm" />
              </div>
              <div className="flex justify-between">
                <div className="w-7 h-7 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg shadow-sm" />
                <div className="w-7 h-7 border-b-2 border-r-2 border-emerald-400 rounded-br-lg shadow-sm" />
              </div>
            </div>

            {/* Real-time laser scanning line during live analysis */}
            {isLiveTranslating && (
              <div className="absolute inset-x-6 sm:inset-x-14 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-pulse pointer-events-none top-1/2 -translate-y-1/2" />
            )}

            {/* AR Overlay rendered directly on top of the live video */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {children}
            </div>
          </div>
        )}

        {/* Camera Permission / Error Dialog */}
        {cameraError && !staticImageUrl && (
          <div className="absolute inset-x-4 top-20 sm:top-24 max-w-lg mx-auto bg-slate-900/95 border border-amber-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-30 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Chế độ Thử nghiệm Du lịch</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải ảnh lên</span>
              </button>
              <button
                onClick={() => onSelectSample(TRAVEL_SAMPLES[0])}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
              >
                <span>🇯🇵 Thử Menu Nhật Bản</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Floating Action Bar */}
      <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between z-30 pointer-events-none">
        {/* Left: Live status pill or back button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {staticImageUrl ? (
            <button
              onClick={onClearStaticImage}
              className="py-1.5 px-3 bg-slate-900/90 hover:bg-slate-900 border border-slate-700/80 text-white rounded-xl text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-colors"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Quay lại Camera Trực Tiếp</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-700/80 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-lg">
                <span className={`w-2.5 h-2.5 rounded-full ${!isOnline ? 'bg-amber-400' : isLiveTranslating ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold text-white">
                  {!isOnline ? '⚡ Ngoại tuyến' : isLiveTranslating ? 'Đang Dịch Trực Tiếp' : 'Đã Tạm Dừng'}
                </span>
                {detectedCount > 0 && (
                  <span className="text-[10px] text-emerald-300 font-medium bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80">
                    {detectedCount} chữ
                  </span>
                )}
              </div>
              {onOpenOfflinePacks && (
                <button
                  onClick={onOpenOfflinePacks}
                  className="py-1.5 px-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-emerald-300 rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 shadow-lg"
                  title="Đổi gói ngôn ngữ (Trung, Nhật, Hàn, Anh, Thái, Pháp)"
                >
                  <span>{activePack.flag}</span>
                  <span className="text-xs">{activePack.shortName}</span>
                  <span className="text-[10px] text-slate-400">▾</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Camera controls (flip, torch, freeze) */}
        {!staticImageUrl && (
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
            {/* Live / Pause Toggle Button */}
            <button
              onClick={() => setIsLiveTranslating(!isLiveTranslating)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-lg transition-colors ${
                isLiveTranslating
                  ? 'bg-slate-900/85 border-slate-700/80 text-slate-200 hover:text-white'
                  : 'bg-emerald-600 border-emerald-500 text-white'
              }`}
              title={isLiveTranslating ? 'Tạm dừng để giữ khung hình' : 'Tiếp tục dịch trực tiếp'}
            >
              {isLiveTranslating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isLiveTranslating ? 'Giữ hình' : 'Dịch live'}</span>
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl border backdrop-blur-md transition-colors shadow-lg ${
                  torchOn
                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-900/85 border-slate-700/80 text-slate-300 hover:text-white'
                }`}
                title="Bật/Tắt Đèn Flash"
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={switchCamera}
              className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition-colors shadow-lg"
              title="Đổi camera trước/sau"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Quick Unfreeze / Reset Camera */}
            <button
              onClick={restartCamera}
              disabled={isRestarting}
              className={`p-2 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition-colors shadow-lg ${
                isRestarting ? 'animate-spin text-emerald-400' : ''
              }`}
              title="Làm mới camera (nếu camera bị đứng)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Floating Bar */}
      <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 flex flex-col items-center gap-2 z-30 pointer-events-none">
        {/* Quick Sample Selector Strip */}
        <div className="w-full max-w-xl flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto py-1 px-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 bg-slate-950/80 px-2 py-1 rounded-lg backdrop-blur-xs border border-slate-800">
            Mẫu du lịch:
          </span>
          {TRAVEL_SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectSample(s)}
              className="shrink-0 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-[11px] font-medium backdrop-blur-md shadow-md flex items-center gap-1 transition-all active:scale-95"
              title={s.description}
            >
              <span>{s.flag}</span>
              <span>{s.country}</span>
            </button>
          ))}
        </div>

        {/* Controls strip */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-4 pointer-events-auto">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-3.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 backdrop-blur-md shadow-lg text-xs font-medium transition-transform active:scale-95"
            title="Tải ảnh từ thư viện"
          >
            <ImageIcon className="w-4 h-4 text-sky-400" />
            <span>Tải ảnh</span>
          </button>

          {/* Clear Stale Translation Boxes Button */}
          {detectedCount > 0 && onClearResult && (
            <button
              onClick={onClearResult}
              className="h-10 px-3 rounded-full bg-slate-900/90 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/60 text-slate-300 hover:text-rose-200 flex items-center gap-1.5 backdrop-blur-md shadow-lg text-xs font-medium transition-transform active:scale-95"
              title="Xóa chữ dịch cũ khi lia camera sang bảng mới"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Xóa chữ cũ</span>
            </button>
          )}

          {/* Snap / Scan Now Button (forces an immediate clean live scan) */}
          <button
            onClick={() => {
              const frame = captureFrame();
              if (frame) {
                onLiveFrame(frame, true);
              }
            }}
            className="h-11 px-4.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl border border-emerald-400/50 backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
            title="Dịch ngay hình ảnh này"
          >
            <Scan className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Đang dịch...' : 'Quét ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
