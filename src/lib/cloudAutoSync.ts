/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFromSupabase, getSupabaseClient } from './supabase';
import { isFirestoreQuotaExhausted, markFirestoreQuotaExhausted, isQuotaError } from './quotaManager';
import { Organization } from '../types';

/**
 * Helper to safely parse JSON from localStorage
 */
function getLocalJson<T = any>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

/**
 * Hydrates and automatically restores an Organization's complete data from
 * Firebase Firestore & Supabase directly into localStorage on app open / startup.
 */
export async function hydrateOrgFromCloud(orgId: string, userId?: string): Promise<{ success: boolean; source?: string; recordsCount?: number }> {
  if (!orgId) return { success: false };

  console.log(`[AutoCloudSync] Initializing auto-load for organization ${orgId}...`);

  let fetchedData: any = null;
  let source = 'none';

  try {
    // 1. Try fetching directly by exact document keys in Firebase Firestore (if quota available)
    if (!isFirestoreQuotaExhausted()) {
      const candidateDocKeys = [
        userId ? `${orgId}_user_${userId}` : orgId,
        orgId
      ];

      for (const key of candidateDocKeys) {
        try {
          const docRef = doc(db, 'SyncData', key);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const d = snap.data();
            if (d && (d.branches || d.members || d.staff || d.transactions || d.groups || d.savings)) {
              fetchedData = d;
              source = 'firebase-direct';
              break;
            }
          }
        } catch (e: any) {
          if (isQuotaError(e)) {
            markFirestoreQuotaExhausted(e);
            break;
          }
          console.warn(`[AutoCloudSync] Firebase direct fetch error for key ${key}:`, e);
        }
      }

      // 2. If not found, try Firestore Query where orgId == orgId
      if (!fetchedData && !isFirestoreQuotaExhausted()) {
        try {
          const syncCol = collection(db, 'SyncData');
          const q = query(syncCol, where('orgId', '==', orgId));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            // Find the newest document by lastUpdated
            let newestDoc: any = null;
            let newestTime = 0;
            querySnap.docs.forEach(dSnap => {
              const d = dSnap.data();
              const time = d.lastUpdated ? new Date(d.lastUpdated).getTime() : 0;
              if (time >= newestTime) {
                newestTime = time;
                newestDoc = d;
              }
            });
            if (newestDoc) {
              fetchedData = newestDoc;
              source = 'firebase-query';
            }
          }
        } catch (e: any) {
          if (isQuotaError(e)) {
            markFirestoreQuotaExhausted(e);
          } else {
            console.warn(`[AutoCloudSync] Firebase query fetch error for org ${orgId}:`, e);
          }
        }
      }
    }

    // 3. If still not found or Supabase might have newer data, try Supabase
    try {
      const supabaseData = await getFromSupabase('SyncData', userId ? `${orgId}_user_${userId}` : orgId) ||
                           await getFromSupabase('SyncData', orgId);
      
      if (supabaseData) {
        const sbTime = supabaseData.lastUpdated ? new Date(supabaseData.lastUpdated).getTime() : 0;
        const fbTime = fetchedData?.lastUpdated ? new Date(fetchedData.lastUpdated).getTime() : 0;
        
        if (!fetchedData || sbTime > fbTime) {
          fetchedData = supabaseData;
          source = 'supabase';
        }
      }
    } catch (e) {
      console.warn(`[AutoCloudSync] Supabase fetch error for org ${orgId}:`, e);
    }

    // If no cloud data found at all, return gracefully
    if (!fetchedData) {
      console.log(`[AutoCloudSync] No cloud data found for organization ${orgId}.`);
      return { success: false, source: 'not_found' };
    }

    // --- APPLY DATA SAFELY TO LOCAL STORAGE ---
    let globalDeletedIds: string[] = [];
    if (fetchedData.deletedIds && Array.isArray(fetchedData.deletedIds)) {
      const localDel = getLocalJson<string[]>(`tanzil_deleted_ids_${orgId}`, []);
      globalDeletedIds = Array.from(new Set([...localDel, ...fetchedData.deletedIds]));
      localStorage.setItem(`tanzil_deleted_ids_${orgId}`, JSON.stringify(globalDeletedIds));
    } else {
      globalDeletedIds = getLocalJson<string[]>(`tanzil_deleted_ids_${orgId}`, []);
    }

    const filterList = (list: any[]) => {
      if (!list || !Array.isArray(list)) return [];
      if (globalDeletedIds.length === 0) return list;
      return list.filter(item => {
        const id = item?.id;
        const mId = item?.memberId;
        const vId = item?.voucherId;
        const sId = item?.staffId;
        if (id && globalDeletedIds.includes(String(id))) return false;
        if (mId && globalDeletedIds.includes(String(mId))) return false;
        if (vId && globalDeletedIds.includes(String(vId))) return false;
        if (sId && globalDeletedIds.includes(String(sId))) return false;
        return true;
      });
    };

    let count = 0;

    if (fetchedData.branches) {
      localStorage.setItem(`tanzil_branches_${orgId}`, JSON.stringify(filterList(fetchedData.branches)));
      count += (fetchedData.branches?.length || 0);
    }
    if (fetchedData.staff) {
      localStorage.setItem(`tanzil_staff_${orgId}`, JSON.stringify(filterList(fetchedData.staff)));
      count += (fetchedData.staff?.length || 0);
    }
    if (fetchedData.groups) {
      localStorage.setItem(`tanzil_groups_${orgId}`, JSON.stringify(filterList(fetchedData.groups)));
      count += (fetchedData.groups?.length || 0);
    }
    if (fetchedData.members) {
      localStorage.setItem(`tanzil_group_members_${orgId}`, JSON.stringify(filterList(fetchedData.members)));
      count += (fetchedData.members?.length || 0);
    }
    if (fetchedData.loanProposals) {
      localStorage.setItem(`tanzil_loan_proposals_${orgId}`, JSON.stringify(filterList(fetchedData.loanProposals)));
      count += (fetchedData.loanProposals?.length || 0);
    }
    if (fetchedData.savings) {
      localStorage.setItem(`tanzil_savings_accounts_${orgId}`, JSON.stringify(filterList(fetchedData.savings)));
      count += (fetchedData.savings?.length || 0);
    }
    if (fetchedData.cbs) {
      localStorage.setItem(`tanzil_cbs_accounts_${orgId}`, JSON.stringify(filterList(fetchedData.cbs)));
      count += (fetchedData.cbs?.length || 0);
    }
    if (fetchedData.lts) {
      localStorage.setItem(`tanzil_lts_accounts_${orgId}`, JSON.stringify(filterList(fetchedData.lts)));
      count += (fetchedData.lts?.length || 0);
    }
    if (fetchedData.holidays) {
      localStorage.setItem(`tanzil_holidays_${orgId}`, JSON.stringify(filterList(fetchedData.holidays)));
    }
    if (fetchedData.auditLogs) {
      localStorage.setItem(`tanzil_audit_logs_${orgId}`, JSON.stringify(fetchedData.auditLogs));
    }
    if (fetchedData.notifications) {
      localStorage.setItem(`tanzil_notifications_${orgId}`, JSON.stringify(fetchedData.notifications));
    }

    if (fetchedData.workingDay) {
      localStorage.setItem(`tanzil_admin_working_day_${orgId}`, fetchedData.workingDay);
      if (fetchedData.branches && Array.isArray(fetchedData.branches)) {
        fetchedData.branches.forEach((b: any) => {
          if (b.id) {
            localStorage.setItem(`tanzil_working_day_${orgId}_branch_${b.id}`, fetchedData.workingDay);
          }
        });
      }
    }

    // Restore transactions per branch
    if (fetchedData.transactions && typeof fetchedData.transactions === 'object') {
      Object.entries(fetchedData.transactions).forEach(([bId, list]) => {
        if (Array.isArray(list)) {
          const filtered = filterList(list);
          localStorage.setItem(`tanzil_bm_tx_${orgId}_${bId}`, JSON.stringify(filtered));
          count += filtered.length;
        }
      });
    }

    // Restore policies
    if (fetchedData.policies && typeof fetchedData.policies === 'object') {
      Object.entries(fetchedData.policies).forEach(([k, val]) => {
        if (val !== null && val !== undefined) {
          localStorage.setItem(`tanzil_${k}_${orgId}`, String(val));
        }
      });
    }

    // Save sync marker
    const syncTimeKey = userId ? `tanzil_last_sync_time_${orgId}_${userId}` : `tanzil_last_sync_time_${orgId}`;
    const formattedDate = new Date().toLocaleString('bn-BD');
    localStorage.setItem(syncTimeKey, formattedDate);
    if (fetchedData.lastUpdated) {
      localStorage.setItem(`tanzil_last_synced_timestamp_${orgId}_${userId || 'admin'}`, fetchedData.lastUpdated);
    }

    console.log(`[AutoCloudSync] Successfully auto-hydrated ${count} records for org ${orgId} from ${source}!`);

    // Dispatch global events so all components render live
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('tanzil_data_synced', { detail: fetchedData }));

    return { success: true, source, recordsCount: count };
  } catch (err: any) {
    console.error(`[AutoCloudSync] Auto-hydrate exception for org ${orgId}:`, err);
    return { success: false };
  }
}

/**
 * Hydrates all active organizations on initial app boot
 */
export async function hydrateAllOrgsFromCloud(orgs: Organization[]): Promise<void> {
  if (!orgs || orgs.length === 0) return;
  console.log(`[AutoCloudSync] Starting background auto-hydration for ${orgs.length} organizations...`);
  
  for (const org of orgs) {
    if (org?.id) {
      await hydrateOrgFromCloud(org.id);
    }
  }
}
