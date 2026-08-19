import React from 'react';
import { Smartphone, X, CheckCircle2, Download, Share2, MoreVertical, PlusSquare, ArrowRight } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNativeInstall?: () => void;
  hasNativePrompt?: boolean;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  onNativeInstall,
  hasNativePrompt = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a4635] to-[#125844] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
              <img src="/icon.png" alt="App Logo" className="w-10 h-10 object-contain rounded-xl" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              <Smartphone className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                মোবাইল অ্যাপ সংস্করণ
              </span>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight mt-0.5">
                অ্যাপ হিসেবে ইনস্টল করুন
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {hasNativePrompt && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <p className="text-xs text-emerald-900 font-bold mb-3">
                আপনার ব্রাউজার সরাসরি ইনস্টল সাপোর্ট করছে। নিচের বাটনে ক্লিক করে এক ক্লিকে ইনস্টল করুন:
              </p>
              <button
                onClick={() => {
                  if (onNativeInstall) onNativeInstall();
                }}
                className="w-full bg-[#0a4635] hover:bg-[#125844] text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer text-sm"
              >
                <Download size={18} className="stroke-[2.5]" />
                <span>সরাসরি অ্যাপ ইনস্টল করুন (Install Now)</span>
              </button>
            </div>
          )}

          {/* Android Chrome Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 font-black text-slate-800 text-xs sm:text-sm mb-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">১</span>
              <span>অ্যান্ড্রয়েড (Google Chrome / Samsung) এর জন্য:</span>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li className="flex items-start gap-2">
                <MoreVertical size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <span>ক্রোম ব্রাউজারের একেবারে উপরে ডানে <strong>৩টি ডট (⋮)</strong> মেনু বাটনে চাপুন।</span>
              </li>
              <li className="flex items-start gap-2">
                <Download size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>মেনু থেকে <strong>"Install app"</strong> অথবা <strong>"Add to Home screen" (হোম স্ক্রিনে যোগ করুন)</strong> চাপুন।</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>পপ-আপে <strong>"Install" (ইনস্টল)</strong> ক্লিক করলে আপনার ফোনের হোমস্ক্রিনে অ্যাপ আইকন চলে আসবে।</span>
              </li>
            </ol>
          </div>

          {/* iPhone / Safari Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 font-black text-slate-800 text-xs sm:text-sm mb-3">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs">২</span>
              <span>আইফোন / আইপ্যাড (iOS Safari) এর জন্য:</span>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li className="flex items-start gap-2">
                <Share2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>সাফারি ব্রাউজারের নিচে থাকা <strong>Share (শেয়ার)</strong> বাটনে চাপুন।</span>
              </li>
              <li className="flex items-start gap-2">
                <PlusSquare size={16} className="text-slate-700 shrink-0 mt-0.5" />
                <span>নিচে স্ক্রল করে <strong>"Add to Home Screen"</strong> চাপুন।</span>
              </li>
            </ol>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed font-semibold">
            💡 <strong>টিপস:</strong> একবার ইনস্টল করলে ইন্টারনেট ছাড়াও অ্যাপটি দ্রুত ওপেন হবে এবং ব্রাউজারের অ্যাড্রেস বার ছাড়া ফুল-স্ক্রিনে কাজ করবে।
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition"
          >
            বুঝেছি, বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
