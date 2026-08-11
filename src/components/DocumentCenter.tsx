/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  CloudOff, 
  CloudLightning,
  Loader2, 
  User, 
  Eye,
  FileDown,
  X
} from 'lucide-react';
import { db } from '../lib/firebase';
import { saveToSupabase, deleteFromSupabase } from '../lib/supabase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { Organization, Staff, RealDocument } from '../types';

interface DocumentCenterProps {
  org: Organization;
  staff: Staff;
  workingDay: string;
  memberId?: string;       // If provided, runs in member-specific KYC mode
  memberName?: string;     // If provided, preset member name
  branchMembers?: any[];   // List of members to associate documents with (in general mode)
  onClose?: () => void;
}

export default function DocumentCenter({ 
  org, 
  staff, 
  workingDay, 
  memberId, 
  memberName, 
  branchMembers = [],
  onClose 
}: DocumentCenterProps) {
  const isMemberMode = !!memberId;
  const branchId = staff.branchId || 'default-branch';

  // Component States
  const [documents, setDocuments] = useState<RealDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form States
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'NID' | 'Photo' | 'Signature' | 'Admission Form' | 'Notice' | 'Register' | 'Audit' | 'Resolution' | 'Audit Return' | 'Other'>('NID');
  const [selectedMemberId, setSelectedMemberId] = useState(memberId || '');
  const [selectedMemberName, setSelectedMemberName] = useState(memberName || '');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // UI States
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<RealDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Network Status Monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Documents
  const fetchDocs = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // 1. Read local documents from LocalStorage
      const localKey = `tanzil_real_documents_${org.id}`;
      const savedLocal = localStorage.getItem(localKey);
      let localDocs: RealDocument[] = savedLocal ? JSON.parse(savedLocal) : [];

      if (navigator.onLine) {
        // 2. Fetch from Cloud Firestore
        const q = query(
          collection(db, 'RealDocuments'), 
          where('orgId', '==', org.id),
          where('branchId', '==', branchId)
        );
        const snapshot = await getDocs(q);
        const cloudDocs: RealDocument[] = [];
        snapshot.forEach((d) => {
          cloudDocs.push(d.data() as RealDocument);
        });

        // 3. Merge Local Unsynced files with Cloud files
        const unsyncedDocs = localDocs.filter((d: any) => d.synced === false);
        
        // Combine keeping cloud ones + unsynced ones
        const cloudMap = new Map<string, RealDocument>();
        cloudDocs.forEach(d => cloudMap.set(d.id, d));
        unsyncedDocs.forEach(d => cloudMap.set(d.id, d));
        
        const merged = Array.from(cloudMap.values());
        
        // Sort by upload date descending
        merged.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        
        setDocuments(merged);
        localStorage.setItem(localKey, JSON.stringify(merged));
      } else {
        // Offline: just use local docs
        localDocs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        setDocuments(localDocs);
      }
    } catch (err: any) {
      console.error('Error loading real documents:', err);
      // Fallback
      const savedLocal = localStorage.getItem(`tanzil_real_documents_${org.id}`);
      if (savedLocal) {
        setDocuments(JSON.parse(savedLocal));
      }
      setErrorMsg('সার্ভার থেকে ফাইলসমূহ লোড করা যায়নি। অফলাইন কপি দেখানো হচ্ছে।');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // Set listener for global sync refreshes
    const handleSync = () => {
      fetchDocs();
    };
    window.addEventListener('tanzil_data_synced', handleSync);
    return () => window.removeEventListener('tanzil_data_synced', handleSync);
  }, [org.id, branchId, memberId]);

  // Handle Drag & Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMsg('');
    setSuccessMsg('');
    
    // File size restriction: 800 KB (819200 bytes)
    const MAX_SIZE = 800 * 1024; 
    if (selectedFile.size > MAX_SIZE) {
      setErrorMsg(`ফাইল সাইজ অত্যন্ত বড় (${(selectedFile.size / 1024).toFixed(1)} KB)। ক্লাউড ব্যাকআপের স্বার্থে সর্বোচ্চ 800 KB সাইজের ফাইল আপলোড করুন। (পরামর্শ: ইমেজ হলে সাইজ রিসাইজ বা কম্প্রেস করুন)`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    if (!title) {
      // Set default title based on filename without extension
      const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
      setTitle(baseName);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Upload document
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('দয়া করে একটি ফাইল নির্বাচন বা ড্র্যাগ করুন।');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('দয়া করে দলিলের একটি শিরোনাম লিখুন।');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const base64Content = await fileToBase64(file);
      
      let assocMemberName = selectedMemberName;
      if (!isMemberMode && selectedMemberId) {
        const found = branchMembers.find(m => m.id === selectedMemberId || m.memberId === selectedMemberId);
        if (found) assocMemberName = found.name;
      }

      const newDoc: RealDocument & { synced?: boolean } = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        orgId: org.id,
        branchId: branchId,
        memberId: selectedMemberId || undefined,
        memberName: selectedMemberId ? assocMemberName : undefined,
        title: title.trim(),
        category: category,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: staff.name,
        content: base64Content,
        synced: false
      };

      // 1. Save to cloud Firestore and Supabase if online
      if (navigator.onLine) {
        try {
          const docRef = doc(db, 'RealDocuments', newDoc.id);
          const uploadPayload = { ...newDoc };
          delete uploadPayload.synced; // Do not save sync metadata field
          await setDoc(docRef, uploadPayload);
          await saveToSupabase('RealDocuments', newDoc.id, uploadPayload);
          newDoc.synced = true;
        } catch (dbErr) {
          console.warn('Direct cloud write failed, saving locally first:', dbErr);
          newDoc.synced = false;
        }
      }

      // 2. Save locally
      const localKey = `tanzil_real_documents_${org.id}`;
      const savedLocal = localStorage.getItem(localKey);
      const localDocs: RealDocument[] = savedLocal ? JSON.parse(savedLocal) : [];
      const updatedDocs = [newDoc as RealDocument, ...localDocs];
      localStorage.setItem(localKey, JSON.stringify(updatedDocs));

      // Update state
      setDocuments(updatedDocs);
      
      // Reset Form
      setFile(null);
      setTitle('');
      if (!isMemberMode) {
        setSelectedMemberId('');
        setSelectedMemberName('');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';

      setSuccessMsg(`"${newDoc.title}" দলিলটি সফলভাবে সংরক্ষণ করা হয়েছে ${newDoc.synced ? '(ক্লাউড ব্যাকআপ সহ)' : '(শুধুমাত্র লোকাল, পরবর্তীতে সিঙ্ক হবে)'}!`);
      
      // Fire global storage update event
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setErrorMsg(`ফাইল আপলোড করতে সমস্যা হয়েছে: ${err.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Sync Unsynced Documents manually
  const syncUnsyncedDocs = async () => {
    if (!navigator.onLine) {
      alert('ডিভাইসটি বর্তমানে অফলাইনে আছে। দয়া করে ইন্টারনেট সংযোগ সক্রিয় করুন।');
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    try {
      const localKey = `tanzil_real_documents_${org.id}`;
      const savedLocal = localStorage.getItem(localKey);
      const localDocs: (RealDocument & { synced?: boolean })[] = savedLocal ? JSON.parse(savedLocal) : [];
      
      const unsynced = localDocs.filter(d => d.synced === false);
      if (unsynced.length === 0) {
        alert('সিঙ্ক করার মতো কোনো অফলাইন ফাইল পাওয়া যায়নি!');
        setIsLoading(false);
        return;
      }

      for (const d of unsynced) {
        try {
          const docRef = doc(db, 'RealDocuments', d.id);
          const uploadPayload = { ...d };
          delete uploadPayload.synced;
          await setDoc(docRef, uploadPayload);
          await saveToSupabase('RealDocuments', d.id, uploadPayload);
          d.synced = true;
          successCount++;
        } catch (e) {
          console.error(`Failed syncing document ${d.id}`, e);
        }
      }

      localStorage.setItem(localKey, JSON.stringify(localDocs));
      setDocuments(localDocs as RealDocument[]);
      setSuccessMsg(`মোট ${successCount} টি অফলাইন ফাইল সফলভাবে ক্লাউডে আপলোড ও সিঙ্ক করা হয়েছে!`);
    } catch (err) {
      console.error(err);
      setErrorMsg('অফলাইন ফাইল সিঙ্ক করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string, docTitle: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${docTitle}" দলিলটি মুছে ফেলতে চান?`)) return;

    try {
      // 1. Delete from Firestore & Supabase if online
      if (navigator.onLine) {
        try {
          await deleteDoc(doc(db, 'RealDocuments', docId));
          await deleteFromSupabase('RealDocuments', docId);
        } catch (cloudErr) {
          console.warn('Could not delete from cloud:', cloudErr);
        }
      }

      // 2. Delete from LocalStorage
      const localKey = `tanzil_real_documents_${org.id}`;
      const savedLocal = localStorage.getItem(localKey);
      const localDocs: RealDocument[] = savedLocal ? JSON.parse(savedLocal) : [];
      const filtered = localDocs.filter(d => d.id !== docId);
      localStorage.setItem(localKey, JSON.stringify(filtered));

      setDocuments(filtered);
      setSuccessMsg('দলিলটি সফলভাবে মুছে ফেলা হয়েছে।');
      
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
      
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
      setErrorMsg('দলিলটি মুছতে সমস্যা হয়েছে।');
    }
  };

  // Download File helper (converts base64 back to file and downloads)
  const handleDownload = (docItem: RealDocument) => {
    try {
      const link = document.createElement('a');
      link.href = docItem.content;
      link.download = docItem.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('ফাইলটি ডাউনলোড করা যায়নি।');
    }
  };

  // Filter Documents based on selections
  const filteredDocuments = documents.filter(d => {
    const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;
    const matchesMember = !isMemberMode || d.memberId === memberId;
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (d.memberName && d.memberName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesMember && matchesSearch;
  });

  const getCategoryBadgeColor = (cat: string) => {
    switch(cat) {
      case 'NID': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Photo': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Signature': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Admission Form': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Notice': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Register': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Audit': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Resolution': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Audit Return': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'NID': return 'জাতীয় পরিচয়পত্র';
      case 'Photo': return 'সদস্যের ছবি';
      case 'Signature': return 'সদস্যের স্বাক্ষর';
      case 'Admission Form': return 'ভর্তি ফর্ম';
      case 'Notice': return 'অফিস নোটিশ';
      case 'Register': return 'রেজিস্টার বই';
      case 'Audit': return 'অডিট রিপোর্ট';
      case 'Resolution': return 'রেজুলেশন বই / প্রস্তাব';
      case 'Audit Return': return 'অডিট রিটার্ন ফরম';
      default: return 'অন্যান্য দলিল';
    }
  };

  // Display Friendly file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasUnsynced = documents.some((d: any) => d.synced === false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs select-none">
      
      {/* Title & Network Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 font-sans leading-tight">
            <FileText className="text-blue-600" size={20} />
            {isMemberMode ? `সদস্যের সংযুক্ত ফাইল ও ডকুমেন্ট (KYC)` : 'প্রকৃত ফাইল ও ডকুমেন্ট স্টোরেজ হাব'}
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {isMemberMode 
              ? `সদস্য: ${memberName} (${memberId}) এর ফাইলসমূহ` 
              : 'প্রতিষ্ঠানের রেজুলেশন রেজিস্টার, অডিট রিটার্ন, উপ-আইন নথি ও সদস্যদের কেওয়াইসি (KYC) দলিলের কেন্দ্রীয় ক্লাউড স্টোরেজ'}
          </p>
        </div>
        
        {/* Network & Sync status */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {isOnline ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <CloudLightning size={12} className="animate-pulse text-emerald-500" />
              অনলাইন ব্যাকআপ সচল
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <CloudOff size={12} className="text-amber-500" />
              অফলাইন (লোকাল মোড)
            </span>
          )}

          {hasUnsynced && isOnline && (
            <button
              onClick={syncUnsyncedDocs}
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
            >
              <Upload size={12} />
              সিঙ্ক করুন
            </button>
          )}

          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {!isMemberMode && (
        <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-3.5 flex items-start gap-3 text-indigo-950 text-xs">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-extrabold text-indigo-900 block text-xs">
              📜 সমবায় সমিতি রেজুলেশন রেজিস্টার ও অডিট রিটার্ন ডকুমেন্ট সংরক্ষণ:
            </span>
            <p className="text-[11px] leading-relaxed text-indigo-800">
              সমবায় আইন অনুযায়ী ব্যবস্থাপনা কমিটির বার্ষিক/সাধারণ সভার <strong>রেজুলেশন বই স্ক্যান কপি</strong>, <strong>অডিট রিটার্ন ফরম</strong>, উপজেলা সমবায় অফিসারের অনুমোদিত নিবন্ধিত উপ-আইন ও নোটিশসমূহ এখানে স্থায়ীভাবে সুরক্ষিত ও ক্লাউডে ব্যাকআপ রাখতে পারবেন।
            </p>
          </div>
        </div>
      )}

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-bold flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-bold flex items-start gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Layout: Upload Area (Left/Top) & Documents Explorer (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Upload Form Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4 border-r border-slate-100 pr-0 lg:pr-6">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">নতুন ফাইল আপলোড করুন</h4>
          
          <form onSubmit={handleUpload} className="space-y-4">
            
            {/* Drag & Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/30' 
                  : file 
                  ? 'border-emerald-300 bg-emerald-50/10' 
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden" 
                accept="image/*,application/pdf"
              />
              
              {file ? (
                <>
                  <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                    {file.type.startsWith('image/') ? <ImageIcon size={24} /> : <FileText size={24} />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800 truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      সাইজ: {formatSize(file.size)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <Upload size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">ফাইল এখানে ড্র্যাগ করুন অথবা ক্লিক করুন</p>
                    <p className="text-[10px] text-slate-400 font-semibold">সমর্থিত ফাইল: JPG, PNG, PDF (সর্বোচ্চ 800 KB)</p>
                  </div>
                </>
              )}
            </div>

            {/* Document Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-600 block">দলিল বা ফাইলের শিরোনাম:</label>
              <input 
                type="text"
                placeholder="যেমন: রহিম মিয়ার জাতীয় পরিচয়পত্র"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-600 block">দলিলের ধরণ (Category):</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                {isMemberMode ? (
                  <>
                    <option value="NID">জাতীয় পরিচয়পত্র (NID Card)</option>
                    <option value="Photo">সদস্যের ছবি (Profile Photo)</option>
                    <option value="Signature">সদস্যের স্বাক্ষর (KYC Signature)</option>
                    <option value="Admission Form">ভর্তি ফর্ম স্ক্যান (Admission Form)</option>
                    <option value="Other">অন্যান্য দলিল (Other Docs)</option>
                  </>
                ) : (
                  <>
                    <option value="NID">জাতীয় পরিচয়পত্র (NID Card)</option>
                    <option value="Photo">সদস্যের ছবি (Profile Photo)</option>
                    <option value="Signature">সদস্যের স্বাক্ষর (Signature)</option>
                    <option value="Admission Form">ভর্তি ফর্ম স্ক্যান (Admission Form)</option>
                    <option value="Notice">অফিস নোটিশ ও সার্কুলার (Notice)</option>
                    <option value="Register">রেজিস্টার বই স্ক্যান (Register)</option>
                    <option value="Audit">অডিট ও ফাইন্যান্স রিপোর্ট (Audit)</option>
                    <option value="Resolution">রেজুলেশন বই / মিটিং প্রস্তাব (Resolution Register)</option>
                    <option value="Audit Return">অডিট রিটার্ন ও বার্ষিক বিবরণী (Audit Return Form)</option>
                    <option value="Other">অন্যান্য দলিল (Other)</option>
                  </>
                )}
              </select>
            </div>

            {/* Member Association (if General Mode) */}
            {!isMemberMode && (
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-600 block">সদস্যের সাথে সংযুক্ত করুন (ঐচ্ছিক):</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">কোনো সদস্যের সাথে সংযুক্ত নয় (সাধারণ ফাইল)</option>
                  {branchMembers.map(m => (
                    <option key={m.id || m.memberId} value={m.id || m.memberId}>
                      {m.name} ({m.memberId || m.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Upload Button */}
            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>দলিল সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Documents Explorer Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Search, Filter and Actions Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="দলিল বা ফাইলের নাম দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-9 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="text-slate-400" size={14} />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">সকল ক্যাটাগরি</option>
                <option value="NID">জাতীয় পরিচয়পত্র</option>
                <option value="Photo">সদস্যের ছবি</option>
                <option value="Signature">সদস্যের স্বাক্ষর</option>
                <option value="Admission Form">ভর্তি ফর্ম স্ক্যান</option>
                {!isMemberMode && (
                  <>
                    <option value="Notice">অফিস নোটিশ</option>
                    <option value="Register">রেজিস্টার বই</option>
                    <option value="Audit">অডিট রিপোর্ট</option>
                    <option value="Resolution">রেজুলেশন বই / প্রস্তাব</option>
                    <option value="Audit Return">অডিট রিটার্ন ফরম</option>
                  </>
                )}
                <option value="Other">অন্যান্য</option>
              </select>

              <button 
                onClick={fetchDocs}
                className="p-2 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 bg-white cursor-pointer transition-colors"
                title="রিফ্রেশ করুন"
              >
                <Eye size={13} />
              </button>
            </div>
          </div>

          {/* Documents Table / Grid view */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="text-xs text-slate-500 font-bold">ফাইলসমূহ লোড হচ্ছে...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed border-slate-150 bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center gap-2">
              <FileText className="text-slate-350" size={36} />
              <p className="text-xs text-slate-500 font-extrabold">কোনো সংরক্ষিত দলিল বা সংযুক্ত ফাইল পাওয়া যায়নি।</p>
              <p className="text-[10px] text-slate-400 font-semibold">নতুন ফাইল সংযুক্ত করতে বাম পাশের ফর্মটি ব্যবহার করুন।</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {filteredDocuments.map(docItem => {
                const isImage = docItem.fileType.startsWith('image/');
                return (
                  <div 
                    key={docItem.id} 
                    className="border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 justify-between hover:shadow-xs transition-shadow bg-white text-left text-xs font-sans relative"
                  >
                    
                    {/* File Thumbnail & Meta details */}
                    <div className="flex items-start gap-3">
                      
                      {/* Thumbnail container */}
                      <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                        {isImage ? (
                          <img 
                            src={docItem.content} 
                            alt={docItem.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileText className="text-blue-500" size={24} />
                        )}
                      </div>

                      {/* Header details */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${getCategoryBadgeColor(docItem.category)}`}>
                            {getCategoryLabel(docItem.category)}
                          </span>
                          
                          {/* Sync Indicator */}
                          {(docItem as any).synced === false && (
                            <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <CloudOff size={8} /> অফলাইন
                            </span>
                          )}
                        </div>

                        <h5 className="font-extrabold text-slate-800 leading-tight truncate" title={docItem.title}>
                          {docItem.title}
                        </h5>
                        
                        <p className="text-[10px] text-slate-400 font-semibold truncate" title={docItem.fileName}>
                          {docItem.fileName} ({formatSize(docItem.fileSize)})
                        </p>
                      </div>
                    </div>

                    {/* Member Association Link if General Mode */}
                    {!isMemberMode && docItem.memberName && (
                      <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-1.5 text-[10px] text-slate-600 font-bold border border-slate-100">
                        <User size={12} className="text-slate-400" />
                        <span>সদস্য: <strong className="text-slate-800">{docItem.memberName}</strong> ({docItem.memberId})</span>
                      </div>
                    )}

                    {/* Footer actions & details */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-semibold">
                      <span>{new Date(docItem.uploadedAt).toLocaleDateString('bn-BD')}</span>
                      
                      <div className="flex items-center gap-1">
                        
                        {/* View Button */}
                        <button
                          onClick={() => setPreviewDoc(docItem)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer transition-colors"
                          title="দলিলটি দেখুন"
                        >
                          <Eye size={13} />
                        </button>

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(docItem)}
                          className="p-1.5 hover:bg-slate-100 text-blue-600 hover:text-blue-800 rounded-lg cursor-pointer transition-colors"
                          title="ডাউনলোড করুন"
                        >
                          <Download size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(docItem.id, docItem.title)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            
            {/* Modal Header */}
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-100 leading-tight">
                  {previewDoc.title}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  {previewDoc.fileName} ({formatSize(previewDoc.fileSize)}) | আপলোড: {previewDoc.uploadedBy}
                </p>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex items-center justify-center bg-slate-950/40 min-h-[300px] max-h-[70vh] overflow-auto">
              {previewDoc.fileType.startsWith('image/') ? (
                <img 
                  src={previewDoc.content} 
                  alt={previewDoc.title} 
                  className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : previewDoc.fileType === 'application/pdf' ? (
                <div className="text-center p-8 space-y-4">
                  <FileText className="text-rose-400 mx-auto" size={48} />
                  <div>
                    <p className="text-xs font-bold text-slate-300">এটি একটি পিডিএফ (PDF) ডকুমেন্ট ফাইল</p>
                    <p className="text-[10px] text-slate-500">নিচের বাটনটি চেপে পিডিএফ ফাইলটি ডাউনলোড করুন।</p>
                  </div>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-4 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <FileDown size={14} />
                    পিডিএফ ডাউনলোড করুন
                  </button>
                </div>
              ) : (
                <div className="text-center p-8 space-y-4">
                  <FileText className="text-blue-400 mx-auto" size={48} />
                  <div>
                    <p className="text-xs font-bold text-slate-300">অসমর্থিত ফাইল ফরম্যাট প্রিভিউ</p>
                    <p className="text-[10px] text-slate-500">ফাইলটি ডাউনলোড করে আপনার ডিভাইসের বাইরে থেকে ওপেন করুন।</p>
                  </div>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Download size={14} />
                    ফাইল ডাউনলোড করুন
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-800/80 px-6 py-4 flex items-center justify-between border-t border-slate-700 text-xs text-slate-400">
              <span>ক্যাটাগরি: <strong className="text-yellow-400">{getCategoryLabel(previewDoc.category)}</strong></span>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Download size={12} />
                  ডাউনলোড করুন
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
