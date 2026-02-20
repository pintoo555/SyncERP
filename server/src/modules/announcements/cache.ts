/**
 * Simple in-memory TTL cache for the Announcements module.
 * Reduces DB pressure on frequently-read, slowly-changing data
 * like categories, unread counts, and emergency announcements.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemCache {
  private store = new Map<string, CacheEntry<any>>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evict(), 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern?: string): void {
    if (!pattern) { this.store.clear(); return; }
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) this.store.delete(key);
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const cache = new MemCache();

export const TTL = {
  CATEGORIES:   120_000,  // 2 min — rarely changes
  UNREAD_COUNT:  15_000,  // 15 sec — acceptable staleness
  EMERGENCY:     10_000,  // 10 sec — near-real-time for urgency
};
