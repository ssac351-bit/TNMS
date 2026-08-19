import React, { useEffect, useState } from 'react';
import { Smartphone, X, Download, HelpCircle, CheckCircle2 } from 'lucide-react';

export const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone PWA
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
      setShowManualGuide(true);
    }
  };

  // If already installed and running inside app, don't show banner
  if (isStandalone || !isOpen) return null;

  return (
    <div className="bg-gradient-to-br from-[#0a4635] to-[#062c21] text-white rounded-2xl p-4 sm:p-5 shadow-xl mb-6 border border-emerald-700/60 w-full max-w-md mx-auto animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
          <img src="/icon.png" alt="App Logo" className="w-8 h-8 rounded-lg object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          <Smartphone className="w-6 h-6 text-emerald-300" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
              অ্যান্ড্রয়েড মোবাইল অ্যাপ
            </span>
          </div>
          <h3 className="font-extrabold text-sm sm:text-base mt-1 text-white">
            হোম স্ক্রিনে অ্যাপ হিসেবে ডাউনলোড করুন
          </h3>
          <p className="text-emerald-100/80 text-xs mt-0.5 leading-relaxed">
            মোবাইলে অ্যাপ আইকন ও পূর্ণ স্ক্রিন ব্যবহারের জন্য হোমস্ক্রিনে যুক্ত করুন।
          </p>
        </div>

        <button 
          onClick={() => setIsOpen(false)} 
          className="text-emerald-300/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="বন্ধ করুন"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-3.5 pt-3 border-t border-emerald-800/80 flex items-center gap-2">
        <button 
          onClick={handleInstall} 
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-[#062c21] font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer text-xs sm:text-sm"
        >
          <Download size={16} className="stroke-[2.5]" />
          <span>{deferredPrompt ? 'অ্যাপ ইনস্টল করুন (Install App)' : 'কিভাবে ডাউনলোড করবেন?'}</span>
        </button>
        
        <button
          onClick={() => setShowManualGuide(!showManualGuide)}
          className="p-2.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded-xl transition cursor-pointer"
          title="ইনস্টল করার নিয়ম"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showManualGuide && (
        <div className="mt-3 p-3 bg-black/30 rounded-xl border border-emerald-700/50 text-[11px] text-emerald-100 space-y-2 animate-in fade-in">
          <p className="font-bold text-amber-300 flex items-center gap-1">
            <CheckCircle2 size={13} /> মোবাইলে অ্যাপ যুক্ত করার সহজ ৩টি ধাপ:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-200 font-medium">
            <li>মোবাইলে <strong>Google Chrome</strong> ব্রাউজারে Vercel লিংকটি খুলুন।</li>
            <li>উপরে ডানে <strong>তিনটি ডট (⋮)</strong> মেনু বাটনে চাপুন।</li>
            <li>মেনু থেকে <strong>"Install app"</strong> অথবা <strong>"Add to Home screen" (হোম স্ক্রিনে যোগ করুন)</strong> চাপুন।</li>
          </ol>
          <p className="text-[10px] text-emerald-300 italic pt-1 border-t border-emerald-800/40">
            তাহলেই স্ক্রিনশটের মতো আপনার ফোনের হোম স্ক্রিনে লোগোসহ সরাসরি অ্যাপ তৈরি হয়ে যাবে।
          </p>
        </div>
      )}
    </div>
  );
};
