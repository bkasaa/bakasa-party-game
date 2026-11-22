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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#271047] border border-white/20 p-6 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#cf5b54]/20 border border-[#cf5b54]/40 flex items-center justify-center text-[#f88a84]">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 id="confirm-modal-title" className="text-xl font-black text-white mb-2">
          {title}
        </h2>
        <p className="text-sm sm:text-base font-semibold text-white/80 mb-6 leading-relaxed">
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
