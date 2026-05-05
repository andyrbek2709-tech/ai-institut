import { logger } from '../utils/logger.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number = 30): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
    logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return entry.data as T;
  }

  clear(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
      logger.debug(`Cache CLEAR: pattern=${pattern}`);
    } else {
      this.cache.clear();
      logger.debug('Cache CLEAR: all');
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const cache = new InMemoryCache();
