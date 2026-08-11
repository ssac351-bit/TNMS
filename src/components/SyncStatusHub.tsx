import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { saveToSupabase, getFromSupabase, isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  writeBatch,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { 
  Cloud, 
  CloudOff, 
  Database, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Download, 
  UploadCloud, 
  Check, 
  Loader2, 
  Info, 
  Trash2,
  X,
  User,
  Copy,
  Code
} from 'lucide-react';
import { Organization } from '../types';

interface SyncStatusHubProps {
  org: Organization;
  userId?: string;
  userName?: string;
  role?: string;
  branchId?: string; // Optional if logged in as branch staff
}

export default function SyncStatusHub({ org, userId, userName, role, branchId }: SyncStatusHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Supabase dynamic config states
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => localStorage.getItem('tanzil_supabase_url') || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => localStorage.getItem('tanzil_supabase_anon_key') || '');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [showSqlScript, setShowSqlScript] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const supabaseSqlCode = `-- Tanzil App Supabase Auto Table Setup Script
-- Paste this script into your Supabase Dashboard -> SQL Editor and click 'Run'

CREATE TABLE IF NOT EXISTS "SyncData" (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Organizations" (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RealDocuments" (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security (RLS) so App can read/write data freely
ALTER TABLE "SyncData" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Organizations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "RealDocuments" DISABLE ROW LEVEL SECURITY;

-- Grant API Permissions to anon and authenticated roles
GRANT ALL ON TABLE "SyncData" TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE "Organizations" TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE "RealDocuments" TO anon, authenticated, postgres, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated;`;

  const copySupabaseSql = () => {
    navigator.clipboard.writeText(supabaseSqlCode);
    setCopiedSql(true);
    setSuccessMsg('Supabase SQL স্ক্রিপ্ট ক্লিপবোর্ডে কপি করা হয়েছে!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const saveSupabaseCredentials = () => {
    localStorage.setItem('tanzil_supabase_url', supabaseUrlInput.trim());
    localStorage.setItem('tanzil_supabase_anon_key', supabaseKeyInput.trim());
    setSuccessMsg('Supabase সংযোগ ক্রেডেনশিয়াল সফলভাবে সংরক্ষণ করা হয়েছে!');
    setShowSupabaseSettings(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await testSupabaseConnection();
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`Supabase টেস্ট ব্যর্থ: ${err.message || 'অজানা সমস্যা'}`);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const docKey = userId ? `${org.id}_user_${userId}` : org.id;
  const syncTimeKey = userId ? `tanzil_last_sync_time_${org.id}_${userId}` : `tanzil_last_sync_time_${org.id}`;

  // Daily Sync and Collection stats states
  const [dailyTxs, setDailyTxs] = useState<any[]>([]);
  const [syncedCount, setSyncedCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Local Counts
  const [counts, setCounts] = useState({
    branches: 0,
    staff: 0,
    groups: 0,
    members: 0,
    loanProposals: 0,
    savings: 0,
    cbs: 0,
    lts: 0,
    holidays: 0,
    transactions: 0,
    auditLogs: 0,
    notifications: 0
  });

  // Load counts and last sync time from localStorage
  const loadLocalStats = () => {
    if (!org?.id) return;
    
    try {
      const branches = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
      const staffList = JSON.parse(localStorage.getItem(`tanzil_staff_${org.id}`) || '[]');
      const groups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
      const members = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
      const loanProposals = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
      const savings = JSON.parse(localStorage.getItem(`tanzil_savings_accounts_${org.id}`) || '[]');
      const cbs = JSON.parse(localStorage.getItem(`tanzil_cbs_accounts_${org.id}`) || '[]');
      const lts = JSON.parse(localStorage.getItem(`tanzil_lts_accounts_${org.id}`) || '[]');
      const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
      const auditLogs = JSON.parse(localStorage.getItem(`tanzil_audit_logs_${org.id}`) || '[]');
      const notifications = JSON.parse(localStorage.getItem(`tanzil_notifications_${org.id}`) || '[]');
      
      // Calculate transactions by scan
      let transactionsCount = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          transactionsCount += list.length;
        }
      }

      setCounts({
        branches: branches.length,
        staff: staffList.length,
        groups: groups.length,
        members: members.length,
        loanProposals: loanProposals.length,
        savings: savings.length,
        cbs: cbs.length,
        lts: lts.length,
        holidays: holidays.length,
        transactions: transactionsCount,
        auditLogs: auditLogs.length,
        notifications: notifications.length
      });

      const lastSync = localStorage.getItem(syncTimeKey) || '';
      setLastSyncTime(lastSync);

      // Fetch today's local transactions for active branch as collections
      const workingDayKey = branchId ? `tanzil_working_day_${org.id}_branch_${branchId}` : `tanzil_admin_working_day_${org.id}`;
      const wDay = localStorage.getItem(workingDayKey) || new Date().toISOString().split('T')[0];
      const activeBranchKey = `tanzil_bm_tx_${org.id}_${branchId || 'default-branch'}`;
      const branchTxs = JSON.parse(localStorage.getItem(activeBranchKey) || '[]');
      
      const todayCollections = branchTxs.filter((tx: any) => tx.date === wDay && tx.type === 'collection');
      setDailyTxs(todayCollections);

      const synced = todayCollections.filter((tx: any) => tx.synced === true).length;
      const unsynced = todayCollections.filter((tx: any) => tx.synced !== true).length;

      setSyncedCount(synced);
      setUnsyncedCount(unsynced);
    } catch (err) {
      console.error('Error loading offline stats:', err);
    }
  };

  // Helper: Silent Auto-Sync to Cloud
  const performSilentSync = async () => {
    if (!org?.id || isSyncing || isRestoring || !navigator.onLine) return;
    
    try {
      const branches = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
      const staff = JSON.parse(localStorage.getItem(`tanzil_staff_${org.id}`) || '[]');
      const groups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
      const members = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
      const loanProposals = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
      const savings = JSON.parse(localStorage.getItem(`tanzil_savings_accounts_${org.id}`) || '[]');
      const cbs = JSON.parse(localStorage.getItem(`tanzil_cbs_accounts_${org.id}`) || '[]');
      const lts = JSON.parse(localStorage.getItem(`tanzil_lts_accounts_${org.id}`) || '[]');
      const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
      const auditLogs = JSON.parse(localStorage.getItem(`tanzil_audit_logs_${org.id}`) || '[]');
      const notifications = JSON.parse(localStorage.getItem(`tanzil_notifications_${org.id}`) || '[]');
      const workingDayKey = branchId ? `tanzil_working_day_${org.id}_branch_${branchId}` : `tanzil_admin_working_day_${org.id}`;
      const workingDay = localStorage.getItem(workingDayKey) || new Date().toISOString().split('T')[0];

      const txMap: Record<string, any[]> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
          const bId = key.replace(`tanzil_bm_tx_${org.id}_`, '');
          txMap[bId] = JSON.parse(localStorage.getItem(key) || '[]');
        }
      }

      const configKeys = [
        'min_savings', 'savings_interest', 'max_loan', 'withdrawal_fee', 'phone', 'email', 'website',
        'trade_license', 'logo_style', 'logo_url', 'loan_interest', 'loan_interest_type', 'loan_min',
        'loan_max', 'loan_duration', 'loan_grace', 'loan_late_fee', 'loan_processing_fee', 'inst_weekly',
        'inst_monthly', 'inst_term_active', 'inst_biweekly', 'inst_day', 'inst_auto', 'inst_rounding',
        'sav_type', 'sav_min_dep', 'sav_min_bal', 'sav_profit_gs', 'sav_profit_cbs', 'sav_profit_lts',
        'sav_profit_fdr', 'sav_fdr_payout', 'sav_admission_fee', 'sav_welfare_fee', 'loan_ins_percent',
        'loan_ins_type', 'mandatory_sav_percent', 'policy_effective_date', 'loan_product_configs'
      ];
      const policies: Record<string, any> = {};
      configKeys.forEach(k => {
        policies[k] = localStorage.getItem(`tanzil_${k}_${org.id}`) || '';
      });

      const deletedIds = JSON.parse(localStorage.getItem(`tanzil_deleted_ids_${org.id}`) || '[]');

      const payload = {
        branches,
        staff,
        groups,
        members,
        loanProposals,
        savings,
        cbs,
        lts,
        holidays,
        auditLogs,
        notifications,
        workingDay,
        transactions: txMap,
        policies,
        deletedIds
      };

      const payloadString = JSON.stringify(payload);
      const lastSyncedPayload = localStorage.getItem(`tanzil_last_synced_payload_${org.id}_${userId || 'admin'}`) || '';
      
      // If there are no changes, do not write to Firestore to save write quota
      if (payloadString === lastSyncedPayload) {
        return;
      }

      console.log('Automated auto-sync: changes detected, uploading silently to Firestore & Supabase...');

      const syncRef = doc(db, 'SyncData', docKey);
      const lastUpdatedUtc = new Date().toISOString();
      const syncPayloadData = {
        orgId: org.id,
        orgName: org.name,
        userId: userId || 'N/A',
        userName: userName || 'অ্যাডমিন',
        userRole: role || 'org_admin',
        lastUpdated: lastUpdatedUtc,
        ...payload
      };

      await setDoc(syncRef, syncPayloadData);
      await saveToSupabase('SyncData', docKey, syncPayloadData);

      // Mark all local transactions as synced
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const updatedList = list.map((tx: any) => ({ ...tx, synced: true }));
          localStorage.setItem(key, JSON.stringify(updatedList));
        }
      }

      const nowStr = new Date().toLocaleString('bn-BD');
      localStorage.setItem(syncTimeKey, nowStr);
      setLastSyncTime(nowStr);
      localStorage.setItem(`tanzil_last_synced_timestamp_${org.id}_${userId || 'admin'}`, lastUpdatedUtc);
      localStorage.setItem(`tanzil_last_synced_payload_${org.id}_${userId || 'admin'}`, payloadString);
      loadLocalStats();
      console.log('Automated auto-sync finished successfully.');
    } catch (e) {
      console.error('Silent auto sync background error:', e);
    }
  };

  useEffect(() => {
    loadLocalStats();
    // Setup interval to keep counts updated every 5 seconds
    const t = setInterval(loadLocalStats, 5000);
    return () => clearInterval(t);
  }, [org?.id, userId]);

  // Background Auto-Sync Trigger Loop
  useEffect(() => {
    if (!org?.id) return;
    performSilentSync();
    
    // Check for local modifications every 8 seconds and sync automatically
    const interval = setInterval(() => {
      performSilentSync();
    }, 8000);
    
    return () => clearInterval(interval);
  }, [org?.id, userId, docKey, counts]);

  // Real-time onSnapshot listener from Cloud Firestore
  useEffect(() => {
    if (!org?.id) return;
    
    const syncRef = doc(db, 'SyncData', docKey);
    
    const unsubscribe = onSnapshot(syncRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const serverData = snapshot.data();
      const serverLastUpdated = serverData.lastUpdated || '';
      const serverUserId = serverData.userId || '';
      
      // Get our local timestamp
      const localSyncDate = localStorage.getItem(`tanzil_last_synced_timestamp_${org.id}_${userId || 'admin'}`) || '';
      const hasLocalData = (Object.values(counts) as number[]).some(c => c > 0);
      
      // If server has newer data, and either someone else updated or we have no local data
      const isServerNewer = serverLastUpdated && (!localSyncDate || new Date(serverLastUpdated).getTime() > new Date(localSyncDate).getTime());
      const isUpdatedByOthers = serverUserId !== (userId || 'N/A');
      
      if (isServerNewer && (isUpdatedByOthers || !hasLocalData)) {
        console.log('Incoming real-time update from Firestore detected!', serverLastUpdated);
        
        let globalDeletedIds: string[] = [];
        if (serverData.deletedIds && Array.isArray(serverData.deletedIds)) {
          const key = `tanzil_deleted_ids_${org.id}`;
          const localDeleted = JSON.parse(localStorage.getItem(key) || '[]');
          globalDeletedIds = Array.from(new Set([...localDeleted, ...serverData.deletedIds]));
          localStorage.setItem(key, JSON.stringify(globalDeletedIds));
        } else {
          globalDeletedIds = JSON.parse(localStorage.getItem(`tanzil_deleted_ids_${org.id}`) || '[]');
        }

        const filterList = (list: any[]) => {
          if (!list || !Array.isArray(list)) return [];
          if (globalDeletedIds.length === 0) return list;
          return list.filter(item => {
            const id = item.id;
            const mId = item.memberId;
            const vId = item.voucherId;
            if (id && globalDeletedIds.includes(String(id))) return false;
            if (mId && globalDeletedIds.includes(String(mId))) return false;
            if (vId && globalDeletedIds.includes(String(vId))) return false;
            return true;
          });
        };

        // Load documents into localStorage
        if (serverData.branches) localStorage.setItem(`tanzil_branches_${org.id}`, JSON.stringify(filterList(serverData.branches)));
        if (serverData.staff) localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(filterList(serverData.staff)));
        if (serverData.groups) localStorage.setItem(`tanzil_groups_${org.id}`, JSON.stringify(filterList(serverData.groups)));
        if (serverData.members) localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(filterList(serverData.members)));
        if (serverData.loanProposals) localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(filterList(serverData.loanProposals)));
        if (serverData.savings) localStorage.setItem(`tanzil_savings_accounts_${org.id}`, JSON.stringify(filterList(serverData.savings)));
        if (serverData.cbs) localStorage.setItem(`tanzil_cbs_accounts_${org.id}`, JSON.stringify(filterList(serverData.cbs)));
        if (serverData.lts) localStorage.setItem(`tanzil_lts_accounts_${org.id}`, JSON.stringify(filterList(serverData.lts)));
        if (serverData.holidays) localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(filterList(serverData.holidays)));
        if (serverData.workingDay) {
          const workingDayKey = branchId ? `tanzil_working_day_${org.id}_branch_${branchId}` : `tanzil_admin_working_day_${org.id}`;
          localStorage.setItem(workingDayKey, serverData.workingDay);
        }
        
        if (serverData.transactions) {
          Object.entries(serverData.transactions).forEach(([bId, list]) => {
            if (Array.isArray(list)) {
              localStorage.setItem(`tanzil_bm_tx_${org.id}_${bId}`, JSON.stringify(filterList(list)));
            }
          });
        }
        
        if (serverData.policies) {
          Object.entries(serverData.policies).forEach(([k, val]) => {
            if (val !== null && val !== undefined) {
               localStorage.setItem(`tanzil_${k}_${org.id}`, String(val));
            }
          });
        }
        
        // Save local update markers
        localStorage.setItem(`tanzil_last_synced_timestamp_${org.id}_${userId || 'admin'}`, serverLastUpdated);
        const formattedTime = new Date(serverLastUpdated).toLocaleString('bn-BD');
        localStorage.setItem(syncTimeKey, formattedTime);
        setLastSyncTime(formattedTime);
        
        // Update payload to keep check strings clean
        const currentPayload = {
          branches: serverData.branches || [],
          staff: serverData.staff || [],
          groups: serverData.groups || [],
          members: serverData.members || [],
          loanProposals: serverData.loanProposals || [],
          savings: serverData.savings || [],
          cbs: serverData.cbs || [],
          lts: serverData.lts || [],
          holidays: serverData.holidays || [],
          workingDay: serverData.workingDay || '',
          transactions: serverData.transactions || {},
          policies: serverData.policies || {}
        };
        localStorage.setItem(`tanzil_last_synced_payload_${org.id}_${userId || 'admin'}`, JSON.stringify(currentPayload));
        
        loadLocalStats();
        
        // Fire custom synchronization refresh event
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('tanzil_data_synced', { detail: serverData }));
        
        console.log("Real-time cloud database snapshot successfully applied!");
        
        // Safe hot reload to reflect data flawlessly across view matrices
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    }, (error) => {
      if (error?.message?.includes('offline') || !navigator.onLine) {
        console.warn("SyncStatusHub onSnapshot is running in offline/disconnected mode. Will reconnect when online.");
      } else {
        console.error("SyncStatusHub onSnapshot failed:", error);
      }
    });
    
    return () => unsubscribe();
  }, [org?.id, userId, docKey, counts]);

  // Sync to Cloud
  const handleSyncToCloud = async () => {
    if (isSyncing || isRestoring) return;
    setIsSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Gather all data
      const branches = JSON.parse(localStorage.getItem(`tanzil_branches_${org.id}`) || '[]');
      const staff = JSON.parse(localStorage.getItem(`tanzil_staff_${org.id}`) || '[]');
      const groups = JSON.parse(localStorage.getItem(`tanzil_groups_${org.id}`) || '[]');
      const members = JSON.parse(localStorage.getItem(`tanzil_group_members_${org.id}`) || '[]');
      const loanProposals = JSON.parse(localStorage.getItem(`tanzil_loan_proposals_${org.id}`) || '[]');
      const savings = JSON.parse(localStorage.getItem(`tanzil_savings_accounts_${org.id}`) || '[]');
      const cbs = JSON.parse(localStorage.getItem(`tanzil_cbs_accounts_${org.id}`) || '[]');
      const lts = JSON.parse(localStorage.getItem(`tanzil_lts_accounts_${org.id}`) || '[]');
      const holidays = JSON.parse(localStorage.getItem(`tanzil_holidays_${org.id}`) || '[]');
      const auditLogs = JSON.parse(localStorage.getItem(`tanzil_audit_logs_${org.id}`) || '[]');
      const notifications = JSON.parse(localStorage.getItem(`tanzil_notifications_${org.id}`) || '[]');
      const workingDayKey = branchId ? `tanzil_working_day_${org.id}_branch_${branchId}` : `tanzil_admin_working_day_${org.id}`;
      const workingDay = localStorage.getItem(workingDayKey) || new Date().toISOString().split('T')[0];

      // Gather branch-specific transactions
      const txMap: Record<string, any[]> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
          const bId = key.replace(`tanzil_bm_tx_${org.id}_`, '');
          txMap[bId] = JSON.parse(localStorage.getItem(key) || '[]');
        }
      }

      // Gather policy/metadata config keys to store in a single document
      const configKeys = [
        'min_savings', 'savings_interest', 'max_loan', 'withdrawal_fee', 'phone', 'email', 'website',
        'trade_license', 'logo_style', 'logo_url', 'loan_interest', 'loan_interest_type', 'loan_min',
        'loan_max', 'loan_duration', 'loan_grace', 'loan_late_fee', 'loan_processing_fee', 'inst_weekly',
        'inst_monthly', 'inst_term_active', 'inst_biweekly', 'inst_day', 'inst_auto', 'inst_rounding',
        'sav_type', 'sav_min_dep', 'sav_min_bal', 'sav_profit_gs', 'sav_profit_cbs', 'sav_profit_lts',
        'sav_profit_fdr', 'sav_fdr_payout', 'sav_admission_fee', 'sav_welfare_fee', 'loan_ins_percent',
        'loan_ins_type', 'mandatory_sav_percent', 'policy_effective_date', 'loan_product_configs'
      ];
      const policies: Record<string, any> = {};
      configKeys.forEach(k => {
        policies[k] = localStorage.getItem(`tanzil_${k}_${org.id}`) || '';
      });

      // 2. Perform write operations to Firestore & Supabase
      const syncRef = doc(db, 'SyncData', docKey);
      const manualSyncPayload = {
        orgId: org.id,
        orgName: org.name,
        userId: userId || 'N/A',
        userName: userName || 'অ্যাডমিন',
        userRole: role || 'org_admin',
        lastUpdated: new Date().toISOString(),
        branches,
        staff,
        groups,
        members,
        loanProposals,
        savings,
        cbs,
        lts,
        holidays,
        auditLogs,
        notifications,
        workingDay,
        transactions: txMap,
        policies
      };

      await setDoc(syncRef, manualSyncPayload);
      const supabaseSuccess = await saveToSupabase('SyncData', docKey, manualSyncPayload);

      // Mark all local transactions as synced
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`tanzil_bm_tx_${org.id}_`)) {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const updatedList = list.map((tx: any) => ({ ...tx, synced: true }));
          localStorage.setItem(key, JSON.stringify(updatedList));
        }
      }

      const nowStr = new Date().toLocaleString('bn-BD');
      localStorage.setItem(syncTimeKey, nowStr);
      setLastSyncTime(nowStr);

      if (supabaseSuccess) {
        setSuccessMsg(`আপনার অ্যাকাউন্ট (${userName || 'অ্যাডমিন'}) ভিত্তিক সকল কাজ Firebase Firestore এবং Supabase উভয় ডাটাবেজে সফলভাবে ব্যাকআপ ও সেভ হয়েছে!`);
      } else if (!isSupabaseConfigured()) {
        setSuccessMsg(`Firebase Firestore-এ ডাটা সফলভাবে সেভ হয়েছে! Supabase-এ সেভ করার জন্য "Supabase ডাবল-ক্লাউড সেটিংস"-এ প্রজেক্ট URL ও Anon Key সেভ করুন।`);
      } else {
        setErrorMsg(`Firebase-এ ডাটা সেভ হলেও Supabase-এ টেবিল খুঁজে পাওয়া যায়নি! অনুগ্রহ করে "Supabase ডাবল-ক্লাউড কানেকশন সেটিংস"-এ গিয়ে SQL কোড দিয়ে টেবিল ক্রিয়েট করুন ও "কানেকশন টেস্ট করুন" বাটনে চাপ দিন।`);
      }
      loadLocalStats();
    } catch (err: any) {
      console.error('Cloud sync failed:', err);
      setErrorMsg(`ডিভাইস ডাটাবেজ সিঙ্ক করতে ব্যর্থ হয়েছে: ${err.message || 'নেটওয়ার্ক সংযোগ পরীক্ষা করুন'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore from Cloud
  const handleRestoreFromCloud = async () => {
    if (isSyncing || isRestoring) return;
    setIsRestoring(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowRestoreConfirm(false);

    try {
      const syncRef = doc(db, 'SyncData', docKey);
      const snapshot = await getDoc(syncRef);

      let data: any = null;
      if (snapshot.exists()) {
        data = snapshot.data();
      } else {
        // Try fallback fetch from Supabase
        data = await getFromSupabase('SyncData', docKey);
      }

      if (!data) {
        setErrorMsg(`ক্লাউড ডাটাবেজে (Firebase / Supabase) বর্তমান ইউজার (${userName || 'অ্যাডমিন'}) এর কোনো পূর্ববর্তী ব্যাকআপ ডাটা পাওয়া যায়নি!`);
        setIsRestoring(false);
        return;
      }
      
      // Save elements to localStorage
      if (data.branches) localStorage.setItem(`tanzil_branches_${org.id}`, JSON.stringify(data.branches));
      if (data.staff) localStorage.setItem(`tanzil_staff_${org.id}`, JSON.stringify(data.staff));
      if (data.groups) localStorage.setItem(`tanzil_groups_${org.id}`, JSON.stringify(data.groups));
      if (data.members) localStorage.setItem(`tanzil_group_members_${org.id}`, JSON.stringify(data.members));
      if (data.loanProposals) localStorage.setItem(`tanzil_loan_proposals_${org.id}`, JSON.stringify(data.loanProposals));
      if (data.savings) localStorage.setItem(`tanzil_savings_accounts_${org.id}`, JSON.stringify(data.savings));
      if (data.cbs) localStorage.setItem(`tanzil_cbs_accounts_${org.id}`, JSON.stringify(data.cbs));
      if (data.lts) localStorage.setItem(`tanzil_lts_accounts_${org.id}`, JSON.stringify(data.lts));
      if (data.holidays) localStorage.setItem(`tanzil_holidays_${org.id}`, JSON.stringify(data.holidays));
      if (data.auditLogs) localStorage.setItem(`tanzil_audit_logs_${org.id}`, JSON.stringify(data.auditLogs));
      if (data.notifications) localStorage.setItem(`tanzil_notifications_${org.id}`, JSON.stringify(data.notifications));
      if (data.workingDay) {
        const workingDayKey = branchId ? `tanzil_working_day_${org.id}_branch_${branchId}` : `tanzil_admin_working_day_${org.id}`;
        localStorage.setItem(workingDayKey, data.workingDay);
      }

      // Restore transactions
      if (data.transactions) {
        Object.entries(data.transactions).forEach(([bId, list]) => {
          localStorage.setItem(`tanzil_bm_tx_${org.id}_${bId}`, JSON.stringify(list));
        });
      }

      // Restore policies
      if (data.policies) {
        Object.entries(data.policies).forEach(([k, val]) => {
          if (val !== null && val !== undefined) {
             localStorage.setItem(`tanzil_${k}_${org.id}`, String(val));
          }
        });
      }

      // Save sync marker
      const restoreTime = new Date().toLocaleString('bn-BD');
      localStorage.setItem(syncTimeKey, restoreTime);
      setLastSyncTime(restoreTime);
      setSuccessMsg(`ক্লাউড থেকে সফলভাবে ইউজার (${userName || 'অ্যাডমিন'}) এর সকল ডাটা পুনরুদ্ধার করা হয়েছে ও লোকাল স্টোরেজ আপডেট হয়েছে!`);
      loadLocalStats();

      // Dispatch a storage event or refresh to trigger component re-render
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error('Firestore restore failed:', err);
      setErrorMsg(`ক্লাউড থেকে ডাটা পুনরুদ্ধার করতে ব্যর্থ হয়েছে: ${err.message || 'নেটওয়ার্ক সংযোগ পরীক্ষা করুন'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const hasOfflineData = (Object.values(counts) as number[]).some(c => c > 0);

  return (
    <div className="relative inline-block" id="sync-status-hub-widget">
      {/* Golden/Yellow Sync & Backup Status Buttons to match screenshot exactly */}
      <div className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-yellow-300 font-bold text-[10px] sm:text-xs rounded-lg p-1.5 sm:px-3 sm:py-1.5 border border-amber-500/30 transition-all cursor-pointer select-none shadow-sm shadow-amber-500/5 hover:scale-[1.02]"
           onClick={() => setIsOpen(!isOpen)}
           title="ডাটাবেজ সিঙ্ক স্ট্যাটাস ও ব্যাকআপ">
        
        {/* Exact composite SVG based on customer upload: circular curved arrow + cloud upload arrow */}
        <div className="flex items-center gap-1 relative">
          {/* Looping arrow */}
          <svg className={`w-4 h-4 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 16H18" />
          </svg>
          
          {/* Cloud Upload */}
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0-5l-2 2m2-2l2 2" />
          </svg>
        </div>

        <span className="hidden leading-none xs:inline font-bold">ডাটাবেজ ব্যাকআপ ও সিঙ্ক</span>
        {hasOfflineData && !lastSyncTime && (
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse block"></span>
        )}
        {lastSyncTime && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 block" title="সিঙ্ক করা হয়েছে"></span>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-800 px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-400/20 p-1.5 rounded-lg border border-yellow-400/40">
                  <svg className="w-5 h-5 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-yellow-100 tracking-wide">টানজিল ক্লাউড ব্যাকআপ ও সিঙ্ক হাব</h3>
                  <p className="text-[10px] text-white/70">হ্যান্ডহেল্ড ডিভাইস অফলাইন-সেভ প্রোটেকশন</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                  setShowRestoreConfirm(false);
                }}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Notification Banner */}
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-3 text-rose-300 text-xs text-left animate-shake">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p className="font-medium leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3 text-emerald-300 text-xs text-left animate-bounce-short">
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  <p className="font-medium leading-relaxed">{successMsg}</p>
                </div>
              )}

              {/* Status Section */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">সিঙ্ক স্ট্যাটাস (ডুয়াল ক্লাউড):</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {/* Firebase Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      <Database size={10} />
                      Firestore: {lastSyncTime ? 'সিঙ্কড' : 'রেডি'}
                    </span>
                    {/* Supabase Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <Cloud size={10} />
                      Supabase: {isSupabaseConfigured() ? (lastSyncTime ? 'সিঙ্কড' : 'রেডি') : 'অ্যাক্টিভ'}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">সর্বশেষ ডাটা ব্যাকআপ টাইম:</span>
                  <span className="text-xs font-semibold text-slate-200 block mt-0.5 font-mono">
                    {lastSyncTime ? lastSyncTime : 'কখনো ব্যাকআপ করা হয়নি / লোকাল'}
                  </span>
                </div>
              </div>

              {/* Operator specific context display */}
              <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 text-left flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/25">
                    <User size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">বর্তমান অপারেটর:</span>
                    <span className="text-xs font-bold text-slate-200 block">{userName || 'প্রধান অ্যাডমিন'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">ইউজার আইডি:</span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{userId || 'N/A'}</span>
                </div>
              </div>

              {/* Core Warning box if user is worried about data */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex gap-2 text-left text-[11px] text-amber-300 leading-relaxed">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>
                  <strong>আগের ডাটা পুনরুদ্ধার পদ্ধতি:</strong> যদি পূর্বে ক্লাউডে ব্যাকআপ নেওয়া থাকে এবং ব্রাউজার ক্যাশ বা হিস্ট্রি মুছার কারণে ডাটা ফাঁকা হয়ে যায়, তবে নিচে থাকা <span className="font-bold underline text-yellow-300">"ডাটাবেজ থেকে ডাটা রিকভার করুন"</span> বাটনটি চেপে এক ক্লিকে সকল ডাটা পুনরায় লোকাল স্টোরেজে লোড করে নিতে পারবেন।
                </p>
              </div>

              {/* Offline Records Summary card - styling matches the user's uploaded mobile screenshot exactly! */}
              <div className="bg-white text-slate-800 rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="text-center select-none">
                  <span className="text-slate-500 font-extrabold text-sm tracking-wide block mb-1">
                    Offline Records Summary
                  </span>
                </div>

                <div className="border border-slate-200/80 rounded-2xl p-4 bg-[#fbfcff] text-center space-y-3 select-none">
                  <h5 className="font-extrabold text-slate-700 text-xs tracking-wider uppercase">
                    DAILY COLLECTION
                  </h5>
                  <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 text-xs font-bold font-mono text-slate-800">
                    <span>Total : {dailyTxs.length}</span>
                    <span className="text-emerald-600">Synced : {syncedCount}</span>
                    <span className="text-amber-600">Unsynced : {unsyncedCount}</span>
                    <span className="text-red-500 font-bold">Failed : 0</span>
                  </div>
                </div>

                {/* Sync All button inside the nested card */}
                <div className="text-center py-1">
                  <button
                    type="button"
                    disabled={isSyncing || isRestoring}
                    onClick={handleSyncToCloud}
                    className="bg-[#2f6ce5] hover:bg-blue-600 disabled:opacity-50 active:scale-95 text-white font-extrabold text-xs px-8 py-2.5 rounded-full shadow-md leading-none text-center inline-flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Sync All</span>
                      </>
                    )}
                  </button>
                </div>

                {/* List of today's collections */}
                {dailyTxs.length > 0 ? (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {dailyTxs.map((tx: any, idx: number) => (
                      <div key={tx.id || idx} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-2xs text-left text-xs transition-colors hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-800 tracking-wider">DAILY COLLECTION</span>
                          {tx.synced ? (
                            <span className="text-emerald-600 font-extrabold text-xs">
                              Synced
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold text-xs bg-slate-101 px-2.5 py-0.5 rounded-full border border-slate-200/50">
                              Unsynced
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-700 leading-normal">
                          Group: <span className="text-blue-600 font-bold">{tx.groupName || 'Unknown'}</span> {'->'} <span className="text-[#2c3e50] font-extrabold">{tx.memberName || 'Member'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-400 py-4 font-bold border border-slate-150 border-dashed rounded-2xl">
                    আজকের জন্য কোনো আদায়ের অফলাইন সামগ্রী সংরক্ষিত নেই
                  </div>
                )}
              </div>

              {/* List of offline tables saved locally */}
              <div>
                <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2.5 text-left">ডিভাইসে রক্ষিত অফলাইন কাজের ভলিউম:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  
                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">🏢 ব্রাঞ্চ তালিকা</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.branches}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">👥 কর্মী ও অফিসার</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.staff}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">🏠 সমিতি ও গ্রুপসমূহ</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.groups}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">👤 ভর্তি করা মোট সদস্য</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.members}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">📑 বিতরণ ও ঋণ আবেদন</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.loanProposals}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">💰 সাধারণ সঞ্চয় হিসাব</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.savings}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">💎 বিশেষ সঞ্চয় (CBS)</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.cbs}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
                    <span className="text-slate-300 flex items-center gap-2">📈 দীর্ঘমেয়াদী (LTS)</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.lts}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-800 sm:col-span-2">
                    <span className="text-slate-300 flex items-center gap-2">💸 কালেকশন ও তোলার মোট লেনদেন</span>
                    <span className="font-bold font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">{counts.transactions} টি এন্ট্রি</span>
                  </div>

                </div>
              </div>

              {/* Supabase Configuration Section */}
              <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40 text-left">
                <button
                  type="button"
                  onClick={() => setShowSupabaseSettings(!showSupabaseSettings)}
                  className="w-full flex items-center justify-between text-xs font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Cloud size={14} />
                    Supabase ডাবল-ক্লাউড কানেকশন সেটিংস
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/20">
                    {showSupabaseSettings ? 'আড়াল করুন' : 'কনফিগার করুন'}
                  </span>
                </button>

                {showSupabaseSettings && (
                  <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-700/40 animate-in fade-in duration-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Project URL:</label>
                      <input
                        type="text"
                        placeholder="https://xyzcompany.supabase.co"
                        value={supabaseUrlInput}
                        onChange={(e) => setSupabaseUrlInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Anon Key:</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                        value={supabaseKeyInput}
                        onChange={(e) => setSupabaseKeyInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={saveSupabaseCredentials}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        কনেকশন সেভ করুন
                      </button>
                      <button
                        type="button"
                        disabled={isTestingSupabase}
                        onClick={handleTestSupabase}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-emerald-300 font-bold text-xs py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isTestingSupabase ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>টেস্ট করা হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Check size={12} />
                            <span>কানেকশন টেস্ট করুন</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* SQL Table Auto-Setup Assistant */}
                    <div className="pt-2 border-t border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => setShowSqlScript(!showSqlScript)}
                        className="w-full flex items-center justify-between text-[11px] font-bold text-indigo-300 hover:text-indigo-200 transition-colors py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <Code size={12} />
                          Supabase SQL টেবিল তৈরির কোড (Schema Fix)
                        </span>
                        <span className="text-[10px] text-indigo-400 underline">
                          {showSqlScript ? 'লুকান' : 'দেখুন ও কপি করুন'}
                        </span>
                      </button>

                      {showSqlScript && (
                        <div className="mt-2 p-2 bg-slate-950 rounded-lg border border-slate-800 text-left animate-in fade-in">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] text-slate-400 font-bold">SQL Editor-এ রান করার জন্য কোড:</span>
                            <button
                              type="button"
                              onClick={copySupabaseSql}
                              className="inline-flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              {copiedSql ? <Check size={10} /> : <Copy size={10} />}
                              <span>{copiedSql ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                            </button>
                          </div>
                          <pre className="text-[10px] text-emerald-400 font-mono bg-slate-900 p-2 rounded overflow-x-auto max-h-36 select-all border border-slate-800">
                            {supabaseSqlCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Container */}
              <div className="pt-4 flex flex-col gap-3 border-t border-slate-800">
                {/* 1. Sync & Backup button */}
                <button
                  type="button"
                  id="btn-sync-to-cloud"
                  disabled={isSyncing || isRestoring}
                  onClick={handleSyncToCloud}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-98 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ক্লাউডে ব্যাকআপ নেওয়া হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>ডাটাবেজে ব্যাকআপ সিঙ্ক করুন (Backup to Cloud)</span>
                    </>
                  )}
                </button>

                {/* 2. Restore Button */}
                {!showRestoreConfirm ? (
                  <button
                    type="button"
                    id="btn-trigger-restore-cloud"
                    disabled={isSyncing || isRestoring}
                    onClick={() => setShowRestoreConfirm(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাটাবেজ থেকে ডাটা রিকভার করুন (Restore from Cloud)</span>
                  </button>
                ) : (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-left animate-in slide-in-from-bottom-2 duration-200">
                    <h5 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertCircle size={14} />
                      সতর্কতা! আপনি কি রিকভার করতে ইচ্ছুক?
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                      ক্লাউড থেকে ডাটা পুনরুদ্ধার করলে আপনার এই ডিভাইসের বর্তমান কাজের অপরিবর্তিত ডাটা প্রতিস্থাপিত ও ওভাররাইট হতে পারে। এটি সম্পূর্ণ ডাটা পূর্বের অবস্থায় ফিরিয়ে আনবে।
                    </p>
                    <div className="flex items-center gap-3 mt-3.5">
                      <button
                        type="button"
                        onClick={handleRestoreFromCloud}
                        className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        {isRestoring ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>রিকভার হচ্ছে...</span>
                          </>
                        ) : (
                          <span>হ্যাঁ, রিকভার নিশ্চিত করুন</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRestoreConfirm(false)}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-3.5 text-center text-[10px] text-slate-500 border-t border-slate-800/80">
              টানজিল পিডাব্লিউএ অফলাইন এন্ড ক্লাউড ডুয়াল সিকিউরিটি হাব © ২০২৬
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
