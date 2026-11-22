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

  // Suppress button when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          soundManager.unlock();
          soundManager.play('click');
          install();
        }}
        className={`flex items-center justify-center gap-2 rounded-2xl bg-[#3c8ac4] hover:brightness-110 active:scale-95 text-white font-black shadow-[0_4px_0_#245e8c] transition-all whitespace-nowrap shrink-0 ${
          compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[46px] px-4 py-2 text-sm w-full'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>تثبيت التطبيق أوفلاين</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
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
          className={`flex items-center justify-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-black transition-all whitespace-nowrap shrink-0 ${
            compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[44px] px-4 py-2 text-sm w-full'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>تثبيت على الآيفون</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#271047] border border-white/20 p-6 shadow-2xl text-right">
              <div className="w-12 h-12 mb-3 rounded-2xl bg-[#3c8ac4]/25 border border-[#3c8ac4]/50 flex items-center justify-center text-sky-300">
                <Share className="w-6 h-6" />
              </div>
              <h3 id="ios-install-title" className="text-xl font-black text-white mb-2">
                تثبيت بكاسة على الآيفون
              </h3>
              <p className="text-sm font-bold text-white/85 leading-relaxed mb-5">
                ١. اضغط على زر <strong className="text-sky-300">المشاركة (Share)</strong> في شريط
                سفاري السفلي.
                <br />
                ٢. انزل لتحت واختار{' '}
                <strong className="text-emerald-300">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  soundManager.play('click');
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
