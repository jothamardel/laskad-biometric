'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 2500);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari: show manual instructions
    if (ios) setTimeout(() => setVisible(true), 2500);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;
  if (!isIOS && !deferredPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  };

  return (
    <div
      role="complementary"
      aria-label="Install app"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,400px)] flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-blue-500/20 bg-slate-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]"
      style={{
        // Inline keyframe since Tailwind arbitrary keyframes need @keyframes in CSS
      }}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Laskad Auth" className="w-full h-full object-cover" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[13px] font-semibold text-white leading-tight">Add Laskad Auth</p>
        {isIOS ? (
          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
            Tap <strong className="text-slate-300">Share</strong> → <strong className="text-slate-300">Add to Home Screen</strong>
          </p>
        ) : (
          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
            Install for quick access from your home screen
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!isIOS && (
          <button
            id="pwa-install-btn"
            onClick={handleInstall}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold transition-opacity hover:opacity-90"
            aria-label="Install app"
          >
            Install
          </button>
        )}
        <button
          id="pwa-dismiss-btn"
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 text-[15px] leading-none"
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
