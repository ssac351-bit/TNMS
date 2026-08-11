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

    const { error } = await client
      .from(table)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn(`Supabase upsert warning for table ${table}:`, error.message);
      // Fallback attempt: if table accepts raw data keys directly
      const directPayload = { id, ...data, updated_at: new Date().toISOString() };
      const { error: err2 } = await client.from(table).upsert(directPayload, { onConflict: 'id' });
      if (err2) {
        console.warn(`Supabase direct upsert warning for table ${table}:`, err2.message);
        return false;
      }
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
