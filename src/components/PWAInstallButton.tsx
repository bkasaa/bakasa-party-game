import React, { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundManager } from '../utils/soundManager';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          soundManager.unlock();
          soundManager.play('click');
          install();
        }}
        className={`flex items-center justify-center gap-2 rounded-2xl qada-btn-amber text-[#1E293B] font-black transition-all whitespace-nowrap shrink-0 ${
          compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[46px] px-4 py-2 text-sm w-full'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>تثبيت التطبيق أوفلاين</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            soundManager.unlock();
            soundManager.play('click');
            setShowIOSGuide(true);
          }}
          className={`flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] font-black transition-all whitespace-nowrap shrink-0 ${
            compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[44px] px-4 py-2 text-sm w-full'
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span>تثبيت على الآيفون</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/82 p-4 animate-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl qada-glass-modal p-6 text-right">
              <div className="w-12 h-12 mb-3 rounded-2xl bg-[#ECFEFF] dark:bg-teal-950/60 border-2 border-[#A5F3FC] dark:border-teal-800 flex items-center justify-center text-[#0D9488] dark:text-[#2DD4BF]">
                <Share className="w-6 h-6" />
              </div>
              <h3 id="ios-install-title" className="text-xl font-black text-[#1E293B] dark:text-white mb-2">
                تثبيت قعدة الشلة على الآيفون
              </h3>
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed mb-5">
                1. اضغط على زر <strong className="text-[#0D9488] dark:text-[#2DD4BF]">المشاركة (Share)</strong> في شريط
                سفاري السفلي.
                <br />
                2. انزل لتحت واختار{' '}
                <strong className="text-[#059669] dark:text-emerald-400">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  soundManager.play('whoosh');
                  setShowIOSGuide(false);
                }}
                className="w-full min-h-[48px] rounded-2xl bakasa-btn-green text-white font-black text-base"
              >
                فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
