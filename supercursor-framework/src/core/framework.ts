/**
 * SuperCursor Framework メインクラス
 */

import { ConfigManager } from './config-manager';
import { Logger, getLogger, setLogger } from './logger';
import { CacheManager } from './cache-manager';
import { CommandRouter } from './command-router';
import { ContextAnalyzer } from './context-analyzer';
import { FrameworkConfig, FrameworkError, ConfigurationError } from '../types';

export interface FrameworkInitOptions {
  configPath?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  enableCaching?: boolean;
  autoLoadConfig?: boolean;
}

export class SuperCursorFramework {
  private config!: ConfigManager;
  private logger!: Logger;
  private cache!: CacheManager;
  private commandRouter!: CommandRouter;
  private contextAnalyzer!: ContextAnalyzer;
  private initialized = false;

  constructor(private options: FrameworkInitOptions = {}) {
    this.options = {
      autoLoadConfig: true,
      enableCaching: true,
      logLevel: 'info',
      ...options,
    };
  }

  /**
   * フレームワークを初期化
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      throw new ConfigurationError('フレームワークは既に初期化されています');
    }

    try {
      // 設定マネージャーを初期化
      this.config = new ConfigManager(this.options.configPath);
      
      if (this.options.autoLoadConfig) {
        await this.config.loadConfig();
      }

      // ロガーを初期化
      const frameworkConfig = this.config.getConfig();
      this.logger = new Logger({
        level: this.options.logLevel || frameworkConfig.logLevel,
        outputToConsole: true,
        colorOutput: true,
        includeTimestamp: true,
        includeContext: true,
      });
      setLogger(this.logger);

      this.logger.info('SuperCursor Frameworkの初期化を開始しています');

      // キャッシュマネージャーを初期化
      if (this.options.enableCaching) {
        this.cache = new CacheManager(frameworkConfig.cache);
        this.logger.debug('キャッシュマネージャーが初期化されました', {
          providers: frameworkConfig.cache.providers,
        });
      }

      // コマンドルーターを初期化
      this.commandRouter = new CommandRouter(
        {
          enableCaching: this.options.enableCaching || false,
          cacheTimeout: frameworkConfig.cache.defaultTTL,
          maxHistorySize: 1000,
          enableValidation: true,
        },
        this.cache
      );

      // コンテキストアナライザーを初期化
      this.contextAnalyzer = new ContextAnalyzer({
        includeNodeModules: false,
        includeDotFiles: false,
        maxFileSize: frameworkConfig.permissions.maxFileSize,
        analysisDepth: 5,
        cacheResults: this.options.enableCaching || false,
      });

      // 設定変更の監視を開始
      this.config.watchConfig((newConfig) => {
        this.handleConfigChange(newConfig);
      });

      this.initialized = true;
      this.logger.info('SuperCursor Frameworkの初期化が完了しました', {
        version: frameworkConfig.version,
        cacheEnabled: this.options.enableCaching,
        logLevel: this.logger.getConfig().level,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('フレームワークの初期化に失敗しました:', errorMessage);
      throw new ConfigurationError(`フレームワークの初期化に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * フレームワークを停止
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('SuperCursor Frameworkを停止しています');

    try {
      // ログバッファをフラッシュ
      await this.logger.flush();

      // キャッシュをクリア
      if (this.cache) {
        await this.cache.clear();
      }

      // リソースをクリーンアップ
      this.logger.destroy();

      this.initialized = false;
      console.log('SuperCursor Frameworkが正常に停止されました');

    } catch (error) {
      console.error('フレームワークの停止中にエラーが発生しました:', error);
    }
  }

  /**
   * 設定マネージャーを取得
   */
  public getConfigManager(): ConfigManager {
    this.ensureInitialized();
    return this.config;
  }

  /**
   * ロガーを取得
   */
  public getLogger(): Logger {
    this.ensureInitialized();
    return this.logger;
  }

  /**
   * キャッシュマネージャーを取得
   */
  public getCacheManager(): CacheManager {
    this.ensureInitialized();
    return this.cache;
  }

  /**
   * コマンドルーターを取得
   */
  public getCommandRouter(): CommandRouter {
    this.ensureInitialized();
    return this.commandRouter;
  }

  /**
   * コンテキストアナライザーを取得
   */
  public getContextAnalyzer(): ContextAnalyzer {
    this.ensureInitialized();
    return this.contextAnalyzer;
  }

  /**
   * フレームワークの状態を取得
   */
  public getStatus(): {
    initialized: boolean;
    version: string;
    config: FrameworkConfig | null;
    uptime: number;
  } {
    const startTime = Date.now();
    
    return {
      initialized: this.initialized,
      version: this.initialized ? this.config.getConfig().version : 'unknown',
      config: this.initialized ? this.config.getConfig() : null,
      uptime: this.initialized ? Date.now() - startTime : 0,
    };
  }

  /**
   * ヘルスチェック
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  }> {
    const checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string | undefined;
    }> = [];

    // 初期化チェック
    const initCheck: {
      name: string;
      status: 'pass' | 'fail';
      message?: string | undefined;
    } = {
      name: 'initialization',
      status: this.initialized ? 'pass' : 'fail',
    };
    
    if (!this.initialized) {
      initCheck.message = 'フレームワークが初期化されていません';
    }
    
    checks.push(initCheck);

    // 設定チェック
    if (this.initialized) {
      try {
        const config = this.config.getConfig();
        checks.push({
          name: 'configuration',
          status: 'pass' as const,
        });
      } catch (error) {
        checks.push({
          name: 'configuration',
          status: 'fail' as const,
          message: `設定の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      // キャッシュチェック
      if (this.cache) {
        try {
          const stats = this.cache.getStats();
          checks.push({
            name: 'cache',
            status: 'pass' as const,
          });
        } catch (error) {
          checks.push({
            name: 'cache',
            status: 'fail' as const,
            message: `キャッシュの状態確認に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
    }

    const allPassed = checks.every(check => check.status === 'pass');

    return {
      status: allPassed ? 'healthy' : 'unhealthy',
      checks,
    };
  }

  /**
   * 初期化状態を確認
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ConfigurationError('フレームワークが初期化されていません。initialize()を呼び出してください。');
    }
  }

  /**
   * 設定変更を処理
   */
  private handleConfigChange(newConfig: FrameworkConfig): void {
    this.logger.info('設定が変更されました', {
      logLevel: newConfig.logLevel,
      cacheProviders: newConfig.cache.providers,
    });

    // ロガーの設定を更新
    this.logger.updateConfig({
      level: newConfig.logLevel,
    });

    // 他のコンポーネントの設定更新は必要に応じて実装
  }
}

/**
 * フレームワークを初期化（便利関数）
 */
export async function initializeFramework(options: FrameworkInitOptions = {}): Promise<SuperCursorFramework> {
  const framework = new SuperCursorFramework(options);
  await framework.initialize();
  return framework;
}

/**
 * グローバルフレームワークインスタンス
 */
let globalFramework: SuperCursorFramework | null = null;

/**
 * グローバルフレームワークを取得
 */
export function getFramework(): SuperCursorFramework {
  if (!globalFramework) {
    throw new ConfigurationError('フレームワークが初期化されていません。initializeFramework()を呼び出してください。');
  }
  return globalFramework;
}

/**
 * グローバルフレームワークを設定
 */
export function setFramework(framework: SuperCursorFramework): void {
  globalFramework = framework;
}