import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'نعم، خروج',
  cancelLabel = 'استمرار اللعب',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-[6px] border-b-[#D5C7B2] dark:border-b-[#0B1120] p-6 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#FFF1F2] dark:bg-rose-950/50 border-2 border-[#FECDD3] dark:border-rose-800/60 flex items-center justify-center text-[#E11D48] dark:text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 id="confirm-modal-title" className="text-xl font-black text-[#1E293B] dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-sm sm:text-base font-bold text-[#64748B] dark:text-[#94A3B8] mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              onCancel();
            }}
            className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              onConfirm();
            }}
            className="w-full min-h-[48px] rounded-2xl bakasa-btn-red text-white font-black text-base transition-transform"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
