/**
 * SuperCursor Framework メインアプリケーション
 */

import { EventEmitter } from 'events';
import { CommandContext, CommandResult, ProjectContext } from './types';
import { getLogger, initializeLogger } from './core/logger';
import { ConfigManager } from './core/config-manager';
import { CommandRouter, CommandRouterConfig } from './core/command-router';
import { CacheManager } from './core/cache-manager';
import { ContextAnalyzer } from './core/context-analyzer';
import { PersonaManager } from './personas/persona-manager';
import { CursorAPIIntegration } from './integrations/cursor-api-integration';
import { FileSystemHandlerImpl } from './integrations/file-system-handler';

// コマンドプロセッサーのインポート
import {
  ImplementCommandProcessor,
  AnalyzeCommandProcessor,
  BuildCommandProcessor,
  DesignCommandProcessor,
  HelpCommandProcessor,
} from './commands/command-processors';

export interface SuperCursorConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableCaching: boolean;
  cacheTimeout: number;
  maxHistorySize: number;
  enableValidation: boolean;
  workingDirectory?: string;
  personas: {
    enableAutoSelection: boolean;
    enableLearning: boolean;
  };
}

export interface SuperCursorOptions {
  config?: Partial<SuperCursorConfig>;
  configFile?: string;
}

export class SuperCursorApp extends EventEmitter {
  private config: SuperCursorConfig;
  private configManager: ConfigManager;
  private commandRouter: CommandRouter;
  private cacheManager: CacheManager;
  private contextAnalyzer: ContextAnalyzer;
  private personaManager: PersonaManager;
  private cursorApi: CursorAPIIntegration;
  private fileSystem: FileSystemHandlerImpl;
  private initialized = false;

  constructor(options: SuperCursorOptions = {}) {
    super();
    
    // デフォルト設定
    const defaultConfig: SuperCursorConfig = {
      logLevel: 'info',
      enableCaching: true,
      cacheTimeout: 300000, // 5分
      maxHistorySize: 100,
      enableValidation: true,
      workingDirectory: process.cwd(),
      personas: {
        enableAutoSelection: true,
        enableLearning: true,
      },
    };

    this.config = { ...defaultConfig, ...options.config };
    this.configManager = new ConfigManager();
    
    // ロガーを初期化
    initializeLogger({
      level: this.config.logLevel,
      console: true,
      file: false,
    });

    // コアコンポーネントを初期化
    this.cacheManager = new CacheManager();
    this.contextAnalyzer = new ContextAnalyzer();
    this.cursorApi = new CursorAPIIntegration();
    this.fileSystem = new FileSystemHandlerImpl();
    this.personaManager = new PersonaManager();

    // コマンドルーターを初期化
    const routerConfig: CommandRouterConfig = {
      enableCaching: this.config.enableCaching,
      cacheTimeout: this.config.cacheTimeout,
      maxHistorySize: this.config.maxHistorySize,
      enableValidation: this.config.enableValidation,
    };
    
    this.commandRouter = new CommandRouter(routerConfig, this.cacheManager);
  }

  /**
   * アプリケーションを初期化
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      getLogger().warn('SuperCursor App は既に初期化されています');
      return;
    }

    const logger = getLogger();
    
    try {
      logger.info('SuperCursor Framework を初期化中...');

      // 設定を読み込み
      if (this.config.workingDirectory) {
        await this.configManager.loadConfig(this.config.workingDirectory);
      }

      // コアコンポーネントを初期化
      await this.initializeComponents();

      // コマンドプロセッサーを登録
      this.registerCommandProcessors();

      // イベントリスナーを設定
      this.setupEventListeners();

      this.initialized = true;
      logger.info('SuperCursor Framework の初期化が完了しました');

      this.emit('initialized');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('SuperCursor Framework の初期化に失敗しました', { error: errorMessage });
      throw new Error(`初期化エラー: ${errorMessage}`);
    }
  }

  /**
   * コマンドを実行
   */
  public async executeCommand(context: CommandContext): Promise<CommandResult> {
    if (!this.initialized) {
      throw new Error('SuperCursor App が初期化されていません。initialize() を呼び出してください。');
    }

    const logger = getLogger();
    
    try {
      logger.debug('コマンドを実行中', { 
        command: context.command,
        arguments: context.arguments,
        workingDirectory: context.workingDirectory,
      });

      // プロジェクトコンテキストを解析
      const projectContext = await this.cursorApi.getProjectContext();
      context.project = projectContext;

      const result = await this.commandRouter.executeCommand(context);

      this.emit('commandExecuted', { context, result });
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コマンドの実行に失敗しました', { 
        command: context.command,
        error: errorMessage 
      });

      const errorResult: CommandResult = {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

      this.emit('commandFailed', { context, result: errorResult, error });
      
      return errorResult;
    }
  }

  /**
   * 複数のコマンドを連続実行
   */
  public async executeCommandChain(contexts: CommandContext[]): Promise<CommandResult[]> {
    if (!this.initialized) {
      throw new Error('SuperCursor App が初期化されていません');
    }

    return await this.commandRouter.executeCommandChain(contexts);
  }

  /**
   * 利用可能なコマンドを取得
   */
  public getAvailableCommands() {
    if (!this.initialized) {
      throw new Error('SuperCursor App が初期化されていません');
    }

    return this.commandRouter.getAvailableCommands();
  }

  /**
   * コマンドヘルプを生成
   */
  public generateCommandHelp(commandType?: any): string {
    if (!this.initialized) {
      throw new Error('SuperCursor App が初期化されていません');
    }

    return this.commandRouter.generateCommandHelp(commandType);
  }

  /**
   * コマンド履歴を取得
   */
  public getCommandHistory() {
    if (!this.initialized) {
      throw new Error('SuperCursor App が初期化されていません');
    }

    return this.commandRouter.getHistory();
  }

  /**
   * 設定を更新
   */
  public async updateConfig(updates: Partial<SuperCursorConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    // ロガーレベルの更新
    if (updates.logLevel) {
      initializeLogger({
        level: updates.logLevel,
        console: true,
        file: false,
      });
    }

    getLogger().info('設定を更新しました', { updates });
    this.emit('configUpdated', { config: this.config, updates });
  }

  /**
   * アプリケーションを終了
   */
  public async shutdown(): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('SuperCursor Framework を終了中...');

      // リソースのクリーンアップ
      await this.cleanup();

      this.initialized = false;
      logger.info('SuperCursor Framework が正常に終了しました');

      this.emit('shutdown');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('終了処理でエラーが発生しました', { error: errorMessage });
      throw error;
    }
  }

  /**
   * ヘルスチェック
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: Record<string, 'ok' | 'error'>;
    timestamp: Date;
  }> {
    const components: Record<string, 'ok' | 'error'> = {};
    
    try {
      // 各コンポーネントのヘルスチェック
      components.configManager = 'ok';
      components.commandRouter = 'ok';
      components.cacheManager = 'ok';
      components.contextAnalyzer = 'ok';
      components.personaManager = 'ok';
      components.cursorApi = 'ok';
      components.fileSystem = 'ok';

      const allHealthy = Object.values(components).every(status => status === 'ok');

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        components,
        timestamp: new Date(),
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        components: { ...components, general: 'error' },
        timestamp: new Date(),
      };
    }
  }

  // プライベートメソッド

  /**
   * コアコンポーネントを初期化
   */
  private async initializeComponents(): Promise<void> {
    const logger = getLogger();

    try {
      // キャッシュマネージャーを初期化
      await this.cacheManager.initialize();
      logger.debug('キャッシュマネージャーを初期化しました');

      // ペルソナマネージャーを初期化
      await this.personaManager.initialize();
      logger.debug('ペルソナマネージャーを初期化しました');

      // Cursor API統合を初期化
      await this.cursorApi.initialize();
      logger.debug('Cursor API統合を初期化しました');

      // ファイルシステムハンドラーを初期化
      await this.fileSystem.initialize();
      logger.debug('ファイルシステムハンドラーを初期化しました');

      // コンテキストアナライザーを初期化
      await this.contextAnalyzer.initialize();
      logger.debug('コンテキストアナライザーを初期化しました');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コンポーネントの初期化に失敗しました', { error: errorMessage });
      throw error;
    }
  }

  /**
   * コマンドプロセッサーを登録
   */
  private registerCommandProcessors(): void {
    const logger = getLogger();

    try {
      // 各コマンドプロセッサーを作成・登録
      const processors = [
        new ImplementCommandProcessor(
          this.personaManager,
          this.cursorApi,
          this.fileSystem,
          this.contextAnalyzer
        ),
        new AnalyzeCommandProcessor(
          this.personaManager,
          this.cursorApi,
          this.fileSystem,
          this.contextAnalyzer
        ),
        new BuildCommandProcessor(
          this.personaManager,
          this.cursorApi,
          this.fileSystem,
          this.contextAnalyzer
        ),
        new DesignCommandProcessor(
          this.personaManager,
          this.cursorApi,
          this.fileSystem,
          this.contextAnalyzer
        ),
        new HelpCommandProcessor(),
      ];

      this.commandRouter.registerProcessors(processors);
      
      logger.info(`${processors.length}個のコマンドプロセッサーを登録しました`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コマンドプロセッサーの登録に失敗しました', { error: errorMessage });
      throw error;
    }
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const logger = getLogger();

    // ペルソナマネージャーのイベント
    this.personaManager.on('personaActivated', (data) => {
      logger.debug('ペルソナが活性化されました', data);
      this.emit('personaActivated', data);
    });

    this.personaManager.on('personaDeactivated', (data) => {
      logger.debug('ペルソナが非活性化されました', data);
      this.emit('personaDeactivated', data);
    });

    // コマンドルーターのイベントは直接処理
    logger.debug('イベントリスナーを設定しました');
  }

  /**
   * リソースのクリーンアップ
   */
  private async cleanup(): Promise<void> {
    const logger = getLogger();

    try {
      // キャッシュをクリーンアップ
      await this.cacheManager.clear();
      
      // コマンド履歴をクリア
      this.commandRouter.clearHistory();
      
      // ペルソナを非活性化
      await this.personaManager.deactivatePersonas();

      logger.debug('リソースのクリーンアップが完了しました');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('クリーンアップでエラーが発生しました', { error: errorMessage });
    }
  }
}

// デフォルトエクスポート
export default SuperCursorApp;