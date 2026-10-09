import React from 'react';
import { ScanHistoryRecord } from '../types';
import { History, X, Trash2, Calendar, ChevronRight, Tag } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: ScanHistoryRecord[];
  onSelectRecord: (record: ScanHistoryRecord) => void;
  onClearHistory: () => void;
  onDeleteRecord: (id: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  records,
  onSelectRecord,
  onClearHistory,
  onDeleteRecord,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Sticky Header with high z-index and clear, prominent Xóa hết and Close buttons */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="font-bold text-white text-sm sm:text-base truncate">
              Lịch Sử Quét &amp; Dịch
            </h3>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {records.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs font-semibold text-red-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/80 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Xóa tất cả lịch sử"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Xóa hết</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0 shadow-xs cursor-pointer"
              title="Đóng bảng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {records.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center">
              <History className="w-10 h-10 stroke-[1.5]" />
              <p className="text-sm font-medium">Chưa có ảnh nào được lưu</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Mỗi khi bạn dơ camera quét chữ, kết quả dịch sẽ tự động được lưu lại tại đây để bạn tra cứu khi cần.
              </p>
            </div>
          ) : (
            records.map((rec) => {
              const dateStr = new Date(rec.timestamp).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              });

              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    onSelectRecord(rec);
                    onClose();
                  }}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/50 rounded-xl p-3 cursor-pointer transition-all flex items-start gap-3 group relative"
                >
                  <img
                    src={rec.imageUrl}
                    alt="Scan thumbnail"
                    className="w-16 h-16 rounded-lg object-cover bg-slate-950 border border-slate-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 truncate">
                        {rec.result.detected_language}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {dateStr}
                      </span>
                    </div>

                    <p className="text-xs text-slate-100 line-clamp-3 leading-snug font-medium break-words">
                      {rec.result.summary_translation}
                    </p>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>{rec.result.items.length} từ đã dịch</span>
                      {rec.result.detected_prices && rec.result.detected_prices.length > 0 && (
                        <span className="flex items-center gap-0.5 text-cyan-400 font-semibold">
                          <Tag className="w-3 h-3" />
                          {rec.result.detected_prices[0].estimated_vnd}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecord(rec.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                    title="Xóa mục này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
