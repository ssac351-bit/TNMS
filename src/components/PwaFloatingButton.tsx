import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export const PwaFloatingButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredInstallPrompt || null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone / installed mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
      return;
    }

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
          setDeferredPrompt(null);
          (window as any).deferredInstallPrompt = null;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else {
      // Show brief floating toast if browser is still initializing WebAPK
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
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

      {showToast && (
        <div className="fixed bottom-16 right-4 z-50 bg-slate-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-xs">
          <p className="font-bold text-emerald-400 mb-0.5">অ্যান্ড্রয়েড ইনস্টল ডায়ালগ</p>
          <p className="text-slate-300 text-[11px]">
            ব্রাউজার মেনুর <strong>৩টি ডট (⋮)</strong> থেকে <strong>"Install app"</strong> চাপলেও সরাসরি ফোনে লোগোসহ ইনস্টল হবে।
          </p>
        </div>
      )}
    </>
  );
};
