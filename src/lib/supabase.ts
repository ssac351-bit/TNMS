import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default / standard keys from environment or localStorage
const getStoredSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('tanzil_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('tanzil_supabase_anon_key') || '' : '';

  return {
    url: localUrl || envUrl || 'https://placeholder-project.supabase.co',
    anonKey: localKey || envKey || 'placeholder-anon-key'
  };
};

const config = getStoredSupabaseConfig();

export const isSupabaseConfigured = (): boolean => {
  const currentConfig = getStoredSupabaseConfig();
  return Boolean(
    currentConfig.url && 
    currentConfig.url !== 'https://placeholder-project.supabase.co' && 
    currentConfig.anonKey && 
    currentConfig.anonKey !== 'placeholder-anon-key'
  );
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const cfg = getStoredSupabaseConfig();
  if (!cfg.url || cfg.url === 'https://placeholder-project.supabase.co') return null;
  try {
    return createClient(cfg.url, cfg.anonKey);
  } catch (e) {
    console.warn('Failed to create Supabase client:', e);
    return null;
  }
};

export const supabase = getSupabaseClient();

/**
 * Universal helper to save/upsert data to Supabase table
 */
export async function saveToSupabase(table: string, id: string, data: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }

  try {
    const payload = {
      id: id,
      data: data,
      updated_at: new Date().toISOString()
    };

    let { error } = await client
      .from(table)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn(`Supabase upsert warning for table ${table}:`, error.message);
      // Fallback 1: Try lowercase table name (e.g., syncdata instead of SyncData)
      const lowerTable = table.toLowerCase();
      const resLower = await client.from(lowerTable).upsert(payload, { onConflict: 'id' });
      if (!resLower.error) {
        console.log(`[Supabase Dual-Sync Success] Saved to lowercase table '${lowerTable}' (id: ${id})`);
        return true;
      }

      // Fallback 2: if table accepts raw data keys directly
      const directPayload = { id, ...data, updated_at: new Date().toISOString() };
      const { error: err2 } = await client.from(table).upsert(directPayload, { onConflict: 'id' });
      if (!err2) {
        console.log(`[Supabase Dual-Sync Success] Saved with direct payload to '${table}' (id: ${id})`);
        return true;
      }

      const { error: err3 } = await client.from(lowerTable).upsert(directPayload, { onConflict: 'id' });
      if (!err3) {
        console.log(`[Supabase Dual-Sync Success] Saved with direct payload to lowercase '${lowerTable}' (id: ${id})`);
        return true;
      }

      return false;
    }
    console.log(`[Supabase Dual-Sync Success] Saved to table '${table}' (id: ${id})`);
    return true;
  } catch (err) {
    console.error(`Error saving to Supabase (${table}):`, err);
    return false;
  }
}

/**
 * Universal helper to delete record from Supabase
 */
export async function deleteFromSupabase(table: string, id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`Supabase delete warning for table ${table}:`, error.message);
      return false;
    }
    console.log(`[Supabase Dual-Sync Success] Deleted from table '${table}' (id: ${id})`);
    return true;
  } catch (err) {
    console.error(`Error deleting from Supabase (${table}):`, err);
    return false;
  }
}

/**
 * Universal helper to load/get data from Supabase
 */
export async function getFromSupabase(table: string, id?: string): Promise<any> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    if (id) {
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data?.data || data;
    } else {
      const { data, error } = await client.from(table).select('*');
      if (error) throw error;
      return data?.map((row: any) => row.data || row) || [];
    }
  } catch (err) {
    console.warn(`Supabase fetch warning for table ${table}:`, err);
    return null;
  }
}

/**
 * Diagnostic tool to verify Supabase connection
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const cfg = getStoredSupabaseConfig();
  if (!cfg.url || cfg.url === 'https://placeholder-project.supabase.co') {
    return {
      success: false,
      message: 'Supabase URL কনফিগার করা হয়নি! অনুগ্রহ করে "Supabase সেটিংস"-এ Project URL প্রদান করুন।'
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase ক্লায়েন্ট ইনিশিয়ালাইজেশন ব্যর্থ হয়েছে। URL এবং Anon Key সঠিক কিনা পরীক্ষা করুন।'
    };
  }

  try {
    // Try sending a test ping save directly to get detailed error if any
    const testId = 'connection_test_ping';
    const payload = {
      id: testId,
      data: { ping: 'ok', time: new Date().toISOString() },
      updated_at: new Date().toISOString()
    };
    
    let res = await client.from('SyncData').upsert(payload, { onConflict: 'id' });
    if (res.error) {
      // Try lowercase 'syncdata'
      res = await client.from('syncdata').upsert(payload, { onConflict: 'id' });
    }

    if (!res.error) {
      return {
        success: true,
        message: 'Supabase-এর সাথে সফলভাবে ডাটা আদান-প্রদান (Read/Write) নিশ্চিত করা হয়েছে!'
      };
    } else {
      console.warn('Supabase test ping error:', res.error);
      return {
        success: false,
        message: `Supabase ত্রুটি (${res.error.code || 'ERR'}): ${res.error.message}। এটি সমাধান করতে Supabase SQL Editor-এ 'GRANT ALL' ও 'DISABLE RLS' কমান্ডটি পুনরায় রান করুন।`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Supabase ত্রুটি: ${err.message || 'নেটওয়ার্ক সংযোগ পরীক্ষা করুন'}`
    };
  }
}

