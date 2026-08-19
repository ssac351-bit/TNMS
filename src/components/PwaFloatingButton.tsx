import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { PwaInstallModal } from './PwaInstallModal';

export const PwaFloatingButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredInstallPrompt || null);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone / installed mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
      return;
    }

    // Check if early event was already caught
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
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa_prompt_ready', readyHandler);
    };
  }, []);

  const handleClick = async () => {
    const promptEvent = (window as any).deferredInstallPrompt || deferredPrompt;

    // Check if running inside an iframe (like AI Studio preview)
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      // In an iframe, browser security blocks direct PWA installation prompt.
      // Open the direct full-screen tab so native installation prompt triggers immediately!
      window.open(window.location.href, '_blank');
      return;
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          (window as any).deferredInstallPrompt = null;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
        setShowModal(true);
      }
    } else {
      // If native prompt is not yet ready, show help modal
      setShowModal(true);
    }
  };

  // Do not show button if already installed and running standalone
  if (isStandalone) return null;

  return (
    <>
      <button
        type="button"
        id="pwa-floating-install-btn"
        onClick={handleClick}
        className="fixed bottom-4 right-4 z-40 bg-[#0a4635] hover:bg-[#125844] text-white py-2.5 px-4 rounded-full shadow-2xl border-2 border-emerald-400 flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-xs font-black group animate-bounce"
        title="সরাসরি অ্যাপ ইনস্টল করুন"
      >
        <div className="w-6 h-6 rounded-full bg-emerald-400 text-[#0a4635] flex items-center justify-center font-bold">
          <Download size={14} className="stroke-[3]" />
        </div>
        <span className="hidden sm:inline">সরাসরি অ্যাপ ইনস্টল করুন</span>
        <span className="sm:hidden">অ্যাপ ইনস্টল</span>
      </button>

      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onNativeInstall={handleClick}
        hasNativePrompt={!!(deferredPrompt || (window as any).deferredInstallPrompt)}
      />
    </>
  );
};
