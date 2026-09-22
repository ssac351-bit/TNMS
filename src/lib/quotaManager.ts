/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Key for storing quota exhaustion status in localStorage
const QUOTA_EXHAUSTED_KEY = 'tanzil_firestore_quota_exhausted_timestamp';
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown before next retry

/**
 * Checks whether Firebase Firestore is currently in a quota-exhausted state
 */
export function isFirestoreQuotaExhausted(): boolean {
  try {
    const raw = localStorage.getItem(QUOTA_EXHAUSTED_KEY);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    if (isNaN(timestamp)) return false;
    
    // Check if cooldown has expired
    if (Date.now() - timestamp > QUOTA_COOLDOWN_MS) {
      localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Marks Firestore quota as exhausted and notifies listeners
 */
export function markFirestoreQuotaExhausted(error?: any): void {
  try {
    const now = Date.now();
    localStorage.setItem(QUOTA_EXHAUSTED_KEY, String(now));
    console.warn('[FirestoreQuotaManager] Firestore quota exceeded. Activated Offline & Supabase fallbacks. Cooldown: 15 minutes.');
    
    // Dispatch custom event for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore_quota_status_changed', {
        detail: { exhausted: true, timestamp: now, error: error?.message || 'Quota exceeded' }
      }));
    }
  } catch (e) {
    console.warn('Failed to set quota exhaustion flag:', e);
  }
}

/**
 * Manually resets or clears the quota exhaustion cooldown (e.g., when user clicks "Recheck")
 */
export function resetFirestoreQuotaCooldown(): void {
  try {
    localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
    console.log('[FirestoreQuotaManager] Firestore quota status manually reset.');
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore_quota_status_changed', {
        detail: { exhausted: false }
      }));
    }
  } catch (e) {
    console.warn('Failed to clear quota flag:', e);
  }
}

/**
 * Gets remaining cooldown in minutes/seconds or formatted string
 */
export function getQuotaCooldownRemaining(): string {
  try {
    const raw = localStorage.getItem(QUOTA_EXHAUSTED_KEY);
    if (!raw) return '';
    const timestamp = parseInt(raw, 10);
    if (isNaN(timestamp)) return '';
    
    const elapsed = Date.now() - timestamp;
    const remainingMs = QUOTA_COOLDOWN_MS - elapsed;
    if (remainingMs <= 0) return '';
    
    const mins = Math.ceil(remainingMs / 60000);
    return `${mins} মিনিট`;
  } catch {
    return '';
  }
}

/**
 * Inspects any caught error to see if it is a Firestore quota-exhausted error
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota exceeded') ||
    code.includes('RESOURCE_EXHAUSTED')
  );
}

/**
 * Safe wrapper for Firestore asynchronous operations.
 * If quota is already exhausted, skips the call immediately.
 * If the call fails with a quota error, marks quota exhausted and falls back cleanly.
 */
export async function safeFirestoreOp<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  opName = 'FirestoreOp'
): Promise<{ result: T; success: boolean; isQuotaExceeded: boolean }> {
  if (isFirestoreQuotaExhausted()) {
    return { result: fallbackValue, success: false, isQuotaExceeded: true };
  }

  try {
    const res = await operation();
    return { result: res, success: true, isQuotaExceeded: false };
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
      return { result: fallbackValue, success: false, isQuotaExceeded: true };
    }
    console.warn(`[FirestoreOp] ${opName} warning:`, err?.message || err);
    return { result: fallbackValue, success: false, isQuotaExceeded: false };
  }
}
