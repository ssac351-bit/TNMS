import React, { useEffect, useState } from 'react';
import { Smartphone, X, Download, HelpCircle, Sparkles } from 'lucide-react';
import { PwaInstallModal } from './PwaInstallModal';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsOpen(false);
      }
    } else {
      setShowModal(true);
    }
  };

  // If already installed and launched inside app, don't show the web install banner
  if (isStandalone || !isOpen) {
    return (
      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onNativeInstall={handleInstall}
        hasNativePrompt={!!deferredPrompt}
      />
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-[#0a4635] via-[#0d5943] to-[#0a4635] text-white rounded-2xl p-4 sm:p-5 shadow-xl mb-6 border border-emerald-600/50 w-full max-w-md mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
            <img src="/icon.png" alt="Logo" className="w-9 h-9 rounded-xl object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            <Smartphone className="w-6 h-6 text-emerald-300" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} /> অ্যান্ড্রয়েড মোবাইল অ্যাপ
              </span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base mt-1 text-white leading-tight">
              মোবাইলে অ্যাপ হিসেবে ইনস্টল করুন
            </h3>
            <p className="text-emerald-100/80 text-xs mt-1 leading-relaxed">
              হোম স্ক্রিনে লোগো ও নামসহ সরাসরি অ্যাপ আইকন যোগ করতে নিচের বাটনে চাপ দিন।
            </p>
          </div>

          <button 
            onClick={() => setIsOpen(false)} 
            className="text-emerald-200/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="লুকিয়ে রাখুন"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3.5 pt-3 border-t border-emerald-700/60 flex items-center gap-2">
          <button 
            type="button"
            onClick={handleInstall} 
            className="flex-1 bg-emerald-400 hover:bg-emerald-300 text-[#062c21] font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer text-xs sm:text-sm"
          >
            <Download size={16} className="stroke-[2.5]" />
            <span>অ্যাপ ইনস্টল করুন (Install App)</span>
          </button>
          
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="p-2.5 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="ইনস্টল সহায়িকা"
          >
            <HelpCircle size={16} />
            <span className="hidden sm:inline">নিয়মাবলী</span>
          </button>
        </div>
      </div>

      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onNativeInstall={handleInstall}
        hasNativePrompt={!!deferredPrompt}
      />
    </>
  );
};
