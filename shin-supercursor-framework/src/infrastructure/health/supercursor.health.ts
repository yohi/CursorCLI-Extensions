/**
 * SuperCursor Framework - ヘルスチェック
 * NestJSのTerminusヘルスチェック機能を使用した監視
 */

import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError
} from '@nestjs/terminus';

import { CursorApiAdapter } from '../adapters/cursor-api.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';

/**
 * SuperCursor フレームワークヘルスチェック
 */
@Injectable()
export class SuperCursorHealthIndicator extends HealthIndicator {
  constructor(
    private readonly cursorApi: CursorApiAdapter,
    private readonly fileSystem: FileSystemAdapter
  ) {
    super();
  }

  /**
   * 全体的なヘルスチェック
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      
      // 並行してヘルスチェック実行
      const [cursorHealth, fileSystemHealth, memoryHealth] = await Promise.allSettled([
        this.checkCursorApi(),
        this.checkFileSystem(),
        this.checkMemoryUsage()
      ]);

      const checkTime = Date.now() - startTime;
      
      const result = {
        timestamp: new Date().toISOString(),
        checkTime,
        cursor: cursorHealth.status === 'fulfilled' ? cursorHealth.value : { status: 'error', error: cursorHealth.reason },
        fileSystem: fileSystemHealth.status === 'fulfilled' ? fileSystemHealth.value : { status: 'error', error: fileSystemHealth.reason },
        memory: memoryHealth.status === 'fulfilled' ? memoryHealth.value : { status: 'error', error: memoryHealth.reason },
        overall: this.calculateOverallHealth([cursorHealth, fileSystemHealth, memoryHealth])
      };

      if (result.overall === 'unhealthy') {
        throw new HealthCheckError('SuperCursor health check failed', result);
      }

      return this.getStatus(key, true, result);
    } catch (error) {
      throw new HealthCheckError('SuperCursor health check failed', error);
    }
  }

  /**
   * Cursor API のヘルスチェック
   */
  private async checkCursorApi(): Promise<any> {
    try {
      const health = await this.cursorApi.healthCheck();
      
      return {
        status: health.available ? 'healthy' : 'degraded',
        available: health.available,
        version: health.version,
        error: health.error,
        config: {
          path: this.cursorApi.getConfig().cursorPath,
          timeout: this.cursorApi.getConfig().timeout
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        available: false,
        error: error.message
      };
    }
  }

  /**
   * ファイルシステムのヘルスチェック
   */
  private async checkFileSystem(): Promise<any> {
    try {
      const config = this.fileSystem.getConfig();
      
      // 基本的な読み書きテスト
      const testPath = '/tmp/supercursor_health_test.txt';
      const testContent = `health check ${Date.now()}`;
      
      await this.fileSystem.writeFile(testPath, testContent);
      const readContent = await this.fileSystem.readFile(testPath);
      await this.fileSystem.delete(testPath);
      
      const isWorking = readContent === testContent;
      
      return {
        status: isWorking ? 'healthy' : 'unhealthy',
        working: isWorking,
        config: {
          maxFileSize: config.maxFileSize,
          watchingEnabled: config.enableWatching,
          allowedPaths: config.allowedPaths.length,
          activeWatchers: 0 // TODO: 実際のwatcher数を取得
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        working: false,
        error: error.message
      };
    }
  }

  /**
   * メモリ使用量のチェック
   */
  private async checkMemoryUsage(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const systemMemoryUsedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // メモリ使用率が90%を超えたら警告
    const status = heapUsedPercent > 90 || systemMemoryUsedPercent > 90 ? 'degraded' : 'healthy';
    
    return {
      status,
      heap: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        usedPercent: Math.round(heapUsedPercent)
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
        usedPercent: Math.round(systemMemoryUsedPercent)
      },
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024) // MB
    };
  }

  /**
   * 全体的なヘルス状態を計算
   */
  private calculateOverallHealth(results: PromiseSettledResult<any>[]): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value.status);
    
    if (statuses.length === 0 || statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.some(status => status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

/**
 * データベースヘルスチェック
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // SQLite の場合はファイルアクセスをチェック
      const dbPath = process.env.DATABASE_PATH || 'supercursor.db';
      
      if (dbPath === ':memory:') {
        // インメモリDBの場合は常に健全
        return this.getStatus(key, true, {
          type: 'memory',
          status: 'healthy'
        });
      }
      
      // ファイルベースDBの場合
      const fs = require('fs').promises;
      
      try {
        await fs.access(dbPath);
        const stats = await fs.stat(dbPath);
        
        return this.getStatus(key, true, {
          type: 'file',
          path: dbPath,
          size: stats.size,
          lastModified: stats.mtime,
          status: 'healthy'
        });
      } catch (error) {
        throw new HealthCheckError('Database file not accessible', {
          path: dbPath,
          error: error.message
        });
      }
    } catch (error) {
      throw new HealthCheckError('Database health check failed', error);
    }
  }
}

/**
 * フレームワーク統計ヘルスチェック
 */
@Injectable()
export class FrameworkStatsHealthIndicator extends HealthIndicator {
  
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const uptime = process.uptime();
      const version = require('../../../package.json').version;
      
      const stats = {
        version,
        uptime: Math.round(uptime),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        timestamp: new Date().toISOString()
      };
      
      return this.getStatus(key, true, stats);
    } catch (error) {
      throw new HealthCheckError('Framework stats check failed', error);
    }
  }
}