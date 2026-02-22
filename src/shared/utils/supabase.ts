import { createClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

class ExpoSQLiteStorage {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDb() {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync('supabase-storage');
      await this.db.execAsync(
        'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT);'
      );
    }
    return this.db;
  }

  async getItem(key: string): Promise<string | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM storage WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
      [key, value]
    );
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM storage WHERE key = ?;', [key]);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new ExpoSQLiteStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
