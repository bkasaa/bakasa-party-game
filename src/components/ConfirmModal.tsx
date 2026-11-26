import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { RichIconBadge } from './RichGameIcons';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/60 backdrop-blur-md animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl qada-glass-modal animate-modal-in p-6 text-center">
        <div className="flex justify-center mb-4">
          <RichIconBadge tone="crimson" size="md">
            <AlertTriangle className="w-7 h-7 text-white drop-shadow" />
          </RichIconBadge>
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
              soundManager.play('whoosh');
              onCancel();
            }}
            className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('whoosh');
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
