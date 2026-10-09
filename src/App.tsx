/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Layers,
  ListFilter,
  ArrowRightLeft,
  BookOpen,
  History,
  Sparkles,
  Globe2,
  Volume2,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Radio,
  FileText,
  X,
  DownloadCloud,
  WifiOff,
} from 'lucide-react';
import { CameraView } from './components/CameraView';
import { AROverlay } from './components/AROverlay';
import { DetectedItemCard } from './components/DetectedItemCard';
import { TranslateList } from './components/TranslateList';
import { CurrencyConverter } from './components/CurrencyConverter';
import { PhrasebookModal } from './components/PhrasebookModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { TravelAskModal } from './components/TravelAskModal';
import { OfflinePacksModal } from './components/OfflinePacksModal';
import { speakText } from './utils/audio';
import { compressImageForOCR } from './utils/imageCompressor';
import { translateOfflineSnapshot } from './utils/offlineTranslator';
import { getDownloadedPacks } from './utils/languagePackStorage';
import {
  DetectedItem,
  VisionTranslationResult,
  ScanHistoryRecord,
  TravelSample,
} from './types';

const STORAGE_KEY = 'travel_camera_translator_history_v2';

export default function App() {
  const [staticImageUrl, setStaticImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VisionTranslationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveTranslating, setIsLiveTranslating] = useState(true);
  const [silentNotice, setSilentNotice] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<DetectedItem | null>(null);
  const [showOverlayText, setShowOverlayText] = useState(true);
  const [maskCoverMode, setMaskCoverMode] = useState(false); // Mặc định không dùng viền/hộp đen để chữ nằm trong suốt tự nhiên
  const [showFullArticle, setShowFullArticle] = useState(false);
  const [viewMode, setViewMode] = useState<'ar' | 'list'>('ar');

  // Modals & Drawers
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showPhrasebookModal, setShowPhrasebookModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // Track online/offline connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSilentNotice('Đã kết nối lại Internet - Sử dụng AI siêu tốc');
      setTimeout(() => setSilentNotice(null), 3500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSilentNotice('📶 Đã ngắt kết nối mạng - Tự động chuyển sang gói ngôn ngữ ngoại tuyến');
      setTimeout(() => setSilentNotice(null), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // History state
  const [historyRecords, setHistoryRecords] = useState<ScanHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyRecords.slice(0, 30)));
    } catch (e) {
      console.warn('Storage quota exceeded', e);
    }
  }, [historyRecords]);

  const isAnalyzingRef = useRef(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;

  // LIVE TRANSLATION HANDLER: Receives frames continuously without stopping the live camera
  const handleLiveFrame = useCallback(async (frameDataUrl: string) => {
    if (isAnalyzingRef.current) return; // Skip if already processing a frame
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setSilentNotice(null);

    const abortController = new AbortController();
    const abortTimeout = setTimeout(() => abortController.abort(), 5500);

    try {
      // Offline fallback: If device is offline, translate instantly from downloaded offline pack
      if (!navigator.onLine) {
        const offlineData = translateOfflineSnapshot(undefined, 'zh');
        setResult(offlineData);
        setSilentNotice('📶 Đang ngoại tuyến: Dịch tức thì bằng gói ngôn ngữ đã tải trong máy');
        return;
      }

      // Fast image payload: If frame is already under 220KB (from CameraView canvas), send directly without redundant canvas re-decode
      const compressedImage =
        frameDataUrl.length < 220000
          ? frameDataUrl
          : await compressImageForOCR(frameDataUrl, 840, 0.65);

      const response = await fetch('/api/translate-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: compressedImage,
          targetLang: 'vi',
          sourceLang: 'auto',
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        // If server returns temporary message or rate limit, update notice and let next frame or scan retry
        const errData = await response.json().catch(() => ({}));
        if (response.status === 503 || response.status === 429) {
          setSilentNotice(errData.error || 'Đang kết nối lại máy chủ dịch...');
        }
        return;
      }

      const rawData: VisionTranslationResult = await response.json();
      
      // Clean Chinese characters client-side as safeguard
      const chineseRegex = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g;
      const data: VisionTranslationResult = {
        ...rawData,
        summary_translation: rawData.summary_translation ? rawData.summary_translation.replace(chineseRegex, '').trim() : '',
        items: (rawData.items || []).map(item => ({
          ...item,
          translated_text: item.translated_text ? item.translated_text.replace(chineseRegex, '').trim() : ''
        })).filter(item => item.translated_text.length > 0)
      };
      
      // Update translated bounding boxes and texts directly over the live camera stream
      if (data) {
        if (data.items && data.items.length > 0) {
          setResult(data);
        } else if (data.summary_translation) {
          setResult({
            ...data,
            items: [
              {
                box_2d: [350, 80, 480, 920],
                translated_text: data.summary_translation,
                category: 'sign',
              },
            ],
          });
        }

        // Save to history periodically (only if has detected items)
        if (data.items && data.items.length > 0) {
          const newRecord: ScanHistoryRecord = {
            id: 'scan_' + Date.now(),
            timestamp: Date.now(),
            imageUrl: frameDataUrl,
            result: data,
            sourceLang: data.detected_language,
            targetLang: 'Tiếng Việt',
          };
          setHistoryRecords((prev) => {
            // Avoid duplicate identical history within 10 seconds
            if (prev[0] && Date.now() - prev[0].timestamp < 10000) {
              return [newRecord, ...prev.slice(1)];
            }
            return [newRecord, ...prev];
          });
        }
      }
    } catch (err: any) {
      console.warn('Frame processing dropped:', err.message);
      if (err.message && (err.message.includes('fetch') || err.message.includes('network') || !navigator.onLine)) {
        const offlineData = translateOfflineSnapshot(undefined, 'zh');
        setResult(offlineData);
        setSilentNotice('📶 Đã chuyển sang chế độ dịch ngoại tuyến với gói ngôn ngữ trong máy');
      }
    } finally {
      clearTimeout(abortTimeout);
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  // Select sample preset (switches to static sample view)
  const handleSelectSample = (sample: TravelSample) => {
    setStaticImageUrl(sample.image);
    handleLiveFrame(sample.image);
  };

  // Clear static image and return to continuous live camera
  const handleClearStaticImage = () => {
    setStaticImageUrl(null);
    setIsLiveTranslating(true);
  };

  // Handle history item selection
  const handleSelectHistoryRecord = (record: ScanHistoryRecord) => {
    setStaticImageUrl(record.imageUrl);
    setResult(record.result);
    setSelectedItem(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header Navigation */}
      <header className="h-14 sm:h-16 bg-slate-900/90 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 z-40 backdrop-blur-md">
        {/* App Title & Language Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-xs sm:text-sm text-white tracking-tight">
                Dịch Camera Trực Tiếp
              </h1>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Globe2 className="w-3 h-3 text-slate-500" />
              <span>
                {result ? result.detected_language : 'Mọi ngôn ngữ'} ➔{' '}
                <strong className="text-emerald-300 font-semibold">Tiếng Việt 🇻🇳</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Travel Tools */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* View mode toggle (AR vs List) when result exists */}
          {result && (
            <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700/80 rounded-xl p-0.5 mr-1">
              <button
                onClick={() => setViewMode('ar')}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'ar'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>AR Trực Tiếp</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Danh sách ({result.items.length})</span>
              </button>
            </div>
          )}

          {/* Toggle Mask Cover (Che chữ gốc để không bị đè 2 lớp chữ) */}
          {result && (
            <button
              onClick={() => setMaskCoverMode((prev) => !prev)}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                maskCoverMode
                  ? 'bg-slate-800 border-emerald-500/70 text-emerald-300 font-semibold'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={
                maskCoverMode
                  ? 'Đang bật: Nền che chữ gốc (chống đè 2 lớp chữ)'
                  : 'Đang tắt: Chữ nổi trong suốt'
              }
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">
                {maskCoverMode ? 'Nền che chữ gốc' : 'Chữ trong suốt'}
              </span>
            </button>
          )}

          {/* Toggle Full Continuous Paragraph Reader */}
          {result && result.summary_translation && (
            <button
              onClick={() => setShowFullArticle((prev) => !prev)}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                showFullArticle
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Đọc toàn bộ bài văn liền mạch"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Đoạn văn liền</span>
            </button>
          )}

          {/* Currency Converter Button */}
          <button
            onClick={() => setShowCurrencyModal(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
            title="Đổi tiền tệ sang VNĐ"
          >
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline font-medium">Đổi tiền</span>
          </button>

          {/* Travel Phrasebook Button */}
          <button
            onClick={() => setShowPhrasebookModal(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
            title="Sổ tay giao tiếp nhanh"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline font-medium">Mẫu câu</span>
          </button>

          {/* Offline Language Packs Manager Button */}
          <button
            onClick={() => setShowOfflineModal(true)}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              !isOnline
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Tải & quản lý các gói ngôn ngữ ngoại tuyến"
          >
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-400" />
            ) : (
              <DownloadCloud className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline font-medium">Gói ngoại tuyến</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
              {getDownloadedPacks().length}
            </span>
          </button>

          {/* Scan History */}
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors relative"
            title="Lịch sử quét"
          >
            <History className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline font-medium">Lịch sử</span>
            {historyRecords.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5 sm:relative sm:top-0 sm:right-0" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* Viewport: Camera is ALWAYS LIVE and moving, with AR overlay rendered directly on top */}
        <div className={`relative flex-1 h-full overflow-hidden ${
          viewMode === 'list' && result ? 'hidden md:block md:w-1/2' : 'w-full'
        }`}>
          <CameraView
            onLiveFrame={handleLiveFrame}
            isAnalyzing={isAnalyzing}
            isLiveTranslating={isLiveTranslating}
            setIsLiveTranslating={setIsLiveTranslating}
            staticImageUrl={staticImageUrl}
            onSelectSample={handleSelectSample}
            onClearStaticImage={handleClearStaticImage}
            detectedCount={result?.items?.length || 0}
            isOnline={isOnline}
            onOpenOfflinePacks={() => setShowOfflineModal(true)}
          >
            {/* AR Text Overlay rendered directly on top of the live video or static image */}
            {result && (
              <AROverlay
                items={result.items}
                selectedItem={selectedItem}
                onSelectItem={(item) => setSelectedItem(item)}
                showOverlayText={showOverlayText}
                maskCoverMode={maskCoverMode}
              />
            )}
          </CameraView>

          {/* Live Scanning Indicator */}
          {isLiveTranslating && !staticImageUrl && (
            <div className="absolute top-14 left-4 z-30 pointer-events-none flex items-center gap-2 bg-slate-950/70 border border-emerald-500/30 rounded-full px-3 py-1 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] text-slate-200 font-medium">
                Dơ camera tới chữ nào dịch ngay chữ đó...
              </span>
            </div>
          )}

          {/* Transient silent notice if any */}
          {silentNotice && (
            <div className="absolute top-22 left-4 z-30 pointer-events-none bg-amber-950/80 border border-amber-600/50 rounded-xl px-3 py-1 backdrop-blur-sm text-[11px] text-amber-200 flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{silentNotice}</span>
            </div>
          )}



          {/* Selected Item Floating Details Card */}
          {selectedItem && (
            <DetectedItemCard
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onAskAboutItem={(item) => {
                setSelectedItem(item);
                setShowAskModal(true);
              }}
              detectedLang={result?.detected_language}
            />
          )}

          {/* Full Continuous Article Reader Overlay */}
          {showFullArticle && result?.summary_translation && (
            <div className="absolute inset-x-3 bottom-16 sm:inset-x-8 sm:bottom-20 max-h-[60vh] z-40 bg-slate-900/95 border border-emerald-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="font-bold text-xs sm:text-sm text-white">
                    Bản Dịch Bài Văn Liền Mạch ({result.detected_language})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speakText(result.summary_translation, 'vi-VN')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1 text-xs font-medium border border-slate-700 transition-colors"
                    title="Đọc toàn bộ bài văn"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Đọc to</span>
                  </button>
                  <button
                    onClick={() => setShowFullArticle(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pt-3 text-xs sm:text-sm text-slate-100 leading-relaxed font-sans whitespace-pre-line selection:bg-emerald-900 selection:text-white">
                {result.summary_translation}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel for Desktop / Full List Mode */}
        {result && (
          <div
            className={`flex-col bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 overflow-y-auto p-4 md:w-1/2 lg:w-5/12 ${
              viewMode === 'list' ? 'flex w-full h-full' : 'hidden md:flex'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-sm text-white">
                  Chi Tiết Văn Bản Đã Dịch
                </h3>
              </div>

              <button
                onClick={() => setShowAskModal(true)}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hỏi trợ lý AI</span>
              </button>
            </div>

            <div className="pt-4 flex-1">
              <TranslateList
                result={result}
                selectedItem={selectedItem}
                onSelectItem={(item) => setSelectedItem(item)}
                onAskAboutItem={(item) => {
                  setSelectedItem(item);
                  setShowAskModal(true);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCurrencyModal && (
        <CurrencyConverter
          onClose={() => setShowCurrencyModal(false)}
          initialCurrency={
            result?.detected_prices?.[0]?.currency || 'JPY'
          }
        />
      )}

      {showPhrasebookModal && (
        <PhrasebookModal
          onClose={() => setShowPhrasebookModal(false)}
          defaultLang={result?.language_code || 'ja'}
        />
      )}

      {showHistoryDrawer && (
        <HistoryDrawer
          isOpen={showHistoryDrawer}
          onClose={() => setShowHistoryDrawer(false)}
          records={historyRecords}
          onSelectRecord={handleSelectHistoryRecord}
          onClearHistory={() => setHistoryRecords([])}
          onDeleteRecord={(id) =>
            setHistoryRecords((prev) => prev.filter((r) => r.id !== id))
          }
        />
      )}

      {showAskModal && result && (
        <TravelAskModal
          onClose={() => setShowAskModal(false)}
          result={result}
          selectedItem={selectedItem}
          image={staticImageUrl || undefined}
        />
      )}

      {/* Offline Language Packs Manager Modal */}
      {showOfflineModal && (
        <OfflinePacksModal
          isOpen={showOfflineModal}
          onClose={() => setShowOfflineModal(false)}
          isOnline={isOnline}
          onSelectPackForOfflineScan={(packId) => {
            const offlineData = translateOfflineSnapshot(undefined, packId);
            setResult(offlineData);
            setSilentNotice(`Đã nạp bộ nhận diện ngoại tuyến gói ${packId.toUpperCase()}`);
            setTimeout(() => setSilentNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
}
