import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isPwaInstalledOrAppMode, markPwaAsInstalled, subscribeToPwaInstallChanges } from '../lib/pwaUtils';
import { PwaInstallModal } from './PwaInstallModal';

export const PwaFloatingButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredInstallPrompt || null);
  const [isInstalledOrApp, setIsInstalledOrApp] = useState(() => isPwaInstalledOrAppMode());
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // If already detected as installed / standalone, do nothing
    if (isPwaInstalledOrAppMode()) {
      setIsInstalledOrApp(true);
      return;
    }

    // Subscribe to install changes (appinstalled event, media query transitions)
    const unsubscribe = subscribeToPwaInstallChanges(() => {
      setIsInstalledOrApp(true);
    });

    // Check if early event was already captured
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    const handler = (e: any) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const readyHandler = () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('pwa_prompt_ready', readyHandler);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa_prompt_ready', readyHandler);
    };
  }, []);

  const handleClick = async () => {
    const promptEvent = (window as any).deferredInstallPrompt || deferredPrompt;

    // Check if running inside an iframe (like AI Studio preview)
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      window.open(window.location.href, '_blank');
      return;
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          // Immediately mark as installed so button never shows again
          markPwaAsInstalled();
          setIsInstalledOrApp(true);
          setDeferredPrompt(null);
          (window as any).deferredInstallPrompt = null;
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else {
      // If native prompt is not directly available, show the installation modal
      setShowModal(true);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch (err) {}
  };

  // Crucial: When already installed or running as an app, do NOT render the install button
  if (isInstalledOrApp || isDismissed) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex items-center group">
        <button
          type="button"
          id="pwa-floating-install-btn"
          onClick={handleClick}
          className="bg-[#0a4635] hover:bg-[#125844] text-white py-2.5 pl-3.5 pr-2 rounded-full shadow-2xl border-2 border-emerald-400 flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-xs font-black animate-bounce hover:animate-none"
          title="সরাসরি অ্যাপ ইনস্টল করুন"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-400 text-[#0a4635] flex items-center justify-center font-bold shrink-0">
            <Download size={14} className="stroke-[3]" />
          </div>
          <span className="hidden sm:inline">সরাসরি অ্যাপ ইনস্টল করুন</span>
          <span className="sm:hidden">অ্যাপ ইনস্টল</span>
          
          <span
            onClick={handleDismiss}
            className="w-5 h-5 rounded-full hover:bg-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center ml-1 cursor-pointer transition-colors"
            title="লুকিয়ে রাখুন"
          >
            <X size={12} />
          </span>
        </button>
      </div>

      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onNativeInstall={handleClick}
        hasNativePrompt={!!(window as any).deferredInstallPrompt || !!deferredPrompt}
      />
    </>
  );
};
