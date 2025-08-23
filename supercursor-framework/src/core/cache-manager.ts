/**
 * キャッシュマネージャー
 */

import { writeFile, readFile, existsSync, mkdirSync, unlink } from 'fs-extra';
import { join } from 'path';
import { CacheConfiguration, CacheProvider, EvictionPolicy, CacheError } from '../types';
import { getLogger } from './logger';

export interface CacheEntry<T = any> {
  value: T;
  timestamp: Date;
  ttl?: number;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  memory: number;
}

export abstract class CacheAdapter<T = any> {
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    memory: 0,
  };

  public abstract get(key: string): Promise<T | null>;
  public abstract set(key: string, value: T, ttl?: number): Promise<void>;
  public abstract delete(key: string): Promise<boolean>;
  public abstract clear(): Promise<void>;
  public abstract keys(): Promise<string[]>;
  public abstract has(key: string): Promise<boolean>;

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  protected incrementStat(stat: keyof Omit<CacheStats, 'size' | 'memory'>): void {
    this.stats[stat]++;
  }

  protected updateSize(delta: number): void {
    this.stats.size = Math.max(0, this.stats.size + delta);
  }

  protected updateMemory(delta: number): void {
    this.stats.memory = Math.max(0, this.stats.memory + delta);
  }
}

/**
 * メモリキャッシュアダプター
 */
export class MemoryCacheAdapter<T = any> extends CacheAdapter<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfiguration;

  constructor(config: CacheConfiguration) {
    super();
    this.config = config;
  }

  public async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.incrementStat('misses');
      return null;
    }

    // TTLチェック
    if (this.isExpired(entry)) {
      await this.delete(key);
      this.incrementStat('misses');
      return null;
    }

    // アクセス情報を更新
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    this.incrementStat('hits');
    return entry.value;
  }

  public async set(key: string, value: T, ttl?: number): Promise<void> {
    const existingEntry = this.cache.get(key);
    const isUpdate = !!existingEntry;

    const entry: CacheEntry<T> = {
      value,
      timestamp: new Date(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: new Date(),
    };

    // メモリ使用量の計算
    const sizeEstimate = this.estimateSize(value);
    
    // サイズ制限チェック
    if (this.stats.memory + sizeEstimate > this.config.maxSize) {
      await this.evict(sizeEstimate);
    }

    this.cache.set(key, entry);
    
    if (!isUpdate) {
      this.updateSize(1);
      this.incrementStat('sets');
    }
    
    this.updateMemory(sizeEstimate);
  }

  public async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.updateSize(-1);
    this.updateMemory(-this.estimateSize(entry.value));
    this.incrementStat('deletes');
    
    return true;
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.memory = 0;
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  public async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    return !this.isExpired(entry);
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) {
      return false;
    }
    return Date.now() - entry.timestamp.getTime() > entry.ttl * 1000;
  }

  private async evict(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
        break;
      case 'lfu':
        entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
        break;
      case 'ttl':
        entries.sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
        break;
    }

    let freedSpace = 0;
    let evicted = 0;

    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break;
      }
      
      await this.delete(key);
      freedSpace += this.estimateSize(entry.value);
      evicted++;
    }

    this.stats.evictions += evicted;
    getLogger().debug(`キャッシュから${evicted}個のエントリを削除しました`, { freedSpace, requiredSpace });
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16で概算
    } catch {
      return 1024; // デフォルト値
    }
  }
}

/**
 * ファイルキャッシュアダプター
 */
export class FileCacheAdapter<T = any> extends CacheAdapter<T> {
  private cacheDir: string;
  private config: CacheConfiguration;

  constructor(config: CacheConfiguration, cacheDir: string = '.cache') {
    super();
    this.config = config;
    this.cacheDir = cacheDir;
    
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public async get(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    
    if (!existsSync(filePath)) {
      this.incrementStat('misses');
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(content);
      
      if (this.isExpired(entry)) {
        await this.delete(key);
        this.incrementStat('misses');
        return null;
      }

      // アクセス情報を更新
      entry.accessCount++;
      entry.lastAccessed = new Date();
      await writeFile(filePath, JSON.stringify(entry), 'utf8');
      
      this.incrementStat('hits');
      return entry.value;
    } catch (error) {
      getLogger().error(`キャッシュファイルの読み込みに失敗しました: ${key}`, { error });
      this.incrementStat('misses');
      return null;
    }
  }

  public async set(key: string, value: T, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    const entry: CacheEntry<T> = {
      value,
      timestamp: new Date(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: new Date(),
    };

    try {
      await writeFile(filePath, JSON.stringify(entry), 'utf8');
      this.updateSize(1);
      this.incrementStat('sets');
    } catch (error) {
      throw new CacheError(`キャッシュファイルの書き込みに失敗しました: ${key}`, { key, error });
    }
  }

  public async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      await unlink(filePath);
      this.updateSize(-1);
      this.incrementStat('deletes');
      return true;
    } catch (error) {
      getLogger().error(`キャッシュファイルの削除に失敗しました: ${key}`, { error });
      return false;
    }
  }

  public async clear(): Promise<void> {
    const keys = await this.keys();
    await Promise.all(keys.map(key => this.delete(key)));
    this.stats.size = 0;
    this.stats.memory = 0;
  }

  public async keys(): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      if (!existsSync(this.cacheDir)) {
        return [];
      }
      
      const files = await fs.readdir(this.cacheDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      this.logger.error('Failed to read cache directory:', error);
      return [];
    }
  }

  public async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.cacheDir, `${safeKey}.cache`);
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) {
      return false;
    }
    return Date.now() - entry.timestamp.getTime() > entry.ttl * 1000;
  }
}

/**
 * キャッシュマネージャー
 */
export class CacheManager {
  private adapters = new Map<CacheProvider, CacheAdapter>();
  private config: CacheConfiguration;

  constructor(config: CacheConfiguration) {
    this.config = config;
    this.initializeAdapters();
  }

  public async get<T>(key: string): Promise<T | null> {
    for (const provider of this.config.providers) {
      const adapter = this.adapters.get(provider);
      if (!adapter) continue;

      const value = await adapter.get(key);
      if (value !== null) {
        return value as T;
      }
    }
    return null;
  }

  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const promises = this.config.providers.map(async provider => {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        await adapter.set(key, value, ttl);
      }
    });

    await Promise.all(promises);
  }

  public async delete(key: string): Promise<boolean> {
    let deleted = false;
    
    for (const provider of this.config.providers) {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        const result = await adapter.delete(key);
        deleted = deleted || result;
      }
    }
    
    return deleted;
  }

  public async clear(): Promise<void> {
    const promises = this.config.providers.map(async provider => {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        await adapter.clear();
      }
    });

    await Promise.all(promises);
  }

  public async invalidate(pattern: string): Promise<void> {
    // 安全性のためにパターンの長さを制限
    if (pattern.length > 100) {
      this.logger.warn('Pattern too long, truncating to 100 characters');
      pattern = pattern.substring(0, 100);
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      this.logger.error('Invalid regex pattern, using escaped literal match:', error);
      // エスケープしてリテラル文字列として扱う
      const escapeRegex = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      regex = new RegExp(escapeRegex(pattern));
    }
    
    for (const provider of this.config.providers) {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        const keys = await adapter.keys();
        const keysToDelete = keys.filter(key => regex.test(key));
        
        await Promise.all(keysToDelete.map(key => adapter.delete(key)));
      }
    }
  }

  public getStats(): Record<CacheProvider, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    
    for (const [provider, adapter] of this.adapters) {
      stats[provider] = adapter.getStats();
    }
    
    return stats as Record<CacheProvider, CacheStats>;
  }

  private initializeAdapters(): void {
    for (const provider of this.config.providers) {
      switch (provider) {
        case 'memory':
          this.adapters.set(provider, new MemoryCacheAdapter(this.config));
          break;
        case 'file':
          this.adapters.set(provider, new FileCacheAdapter(this.config));
          break;
        case 'redis':
          // Redis実装は別途必要
          getLogger().warn('Redisキャッシュアダプターは未実装です');
          break;
      }
    }
  }
}