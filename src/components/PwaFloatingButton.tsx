import React, { useEffect, useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { PwaInstallModal } from './PwaInstallModal';

export const PwaFloatingButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowModal(true);
    }
  };

  // Do not show if already running inside installed standalone app
  if (isStandalone) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-4 right-4 z-40 bg-[#0a4635] hover:bg-[#125844] text-white py-2.5 px-4 rounded-full shadow-2xl border-2 border-emerald-400 flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-xs font-black animate-bounce group"
        title="অ্যাপ হিসেবে ইনস্টল করুন"
      >
        <div className="w-6 h-6 rounded-full bg-emerald-400 text-[#0a4635] flex items-center justify-center font-bold">
          <Download size={14} className="stroke-[3]" />
        </div>
        <span className="hidden sm:inline">অ্যাপ ইনস্টল করুন (Install App)</span>
        <span className="sm:hidden">অ্যাপ ইনস্টল</span>
      </button>

      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onNativeInstall={handleClick}
        hasNativePrompt={!!deferredPrompt}
      />
    </>
  );
};
