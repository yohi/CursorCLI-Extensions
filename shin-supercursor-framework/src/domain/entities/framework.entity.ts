/**
 * SuperCursor Framework - フレームワークエンティティ
 * Framework-2のSuperCursorFrameworkクラスをベースに、
 * Framework-1のインターフェース設計とDDDパターンを適用
 */

import {
  CommandId,
  SessionId,
  PersonaId,
  UserId,
  Timestamp,
  FrameworkError,
  ConfigurationError,
  ValidationError,
  CommandExecutionError,
  LogLevel,
  DeepReadonly,
  BaseEntity
} from '../types/index.js';

import { randomUUID } from 'node:crypto';

import {
  Command,
  CommandResult,
  ExecutionContext,
  CommandHandler,
  CommandRouter,
  CommandExecutionEngine
} from '../types/commands.js';

import {
  AIPersona,
  PersonaManager,
  PersonaSelectionResult,
  PersonaActivationResult
} from '../types/personas.js';

import {
  ProjectContext,
  UserContext,
  SessionContext
} from '../types/context.js';

// ==========================================
// フレームワーク設定
// ==========================================

export interface FrameworkConfiguration {
  readonly logLevel: LogLevel;
  readonly enableCaching: boolean;
  readonly cacheTimeout: number;
  readonly maxHistorySize: number;
  readonly enableValidation: boolean;
  readonly workingDirectory?: string;
  readonly personas: PersonaConfiguration;
  readonly security: SecurityConfiguration;
  readonly performance: PerformanceConfiguration;
}

export interface PersonaConfiguration {
  readonly enableAutoSelection: boolean;
  readonly enableLearning: boolean;
  readonly confidenceThreshold: number;
  readonly maxConcurrentPersonas: number;
}

export interface SecurityConfiguration {
  readonly enableAuthentication: boolean;
  readonly enableAuthorization: boolean;
  readonly rateLimiting: RateLimitingConfig;
  readonly encryption: EncryptionConfig;
}

export interface RateLimitingConfig {
  readonly enabled: boolean;
  readonly maxRequestsPerMinute: number;
  readonly maxRequestsPerHour: number;
}

export interface EncryptionConfig {
  readonly enabled: boolean;
  readonly algorithm: string;
  readonly keyLength: number;
}

export interface PerformanceConfiguration {
  readonly enableMetrics: boolean;
  readonly enableProfiling: boolean;
  readonly maxMemoryUsage: number;
  readonly commandTimeout: number;
}

// ==========================================
// フレームワーク初期化オプション
// ==========================================

export interface FrameworkInitOptions {
  readonly configPath?: string;
  readonly logLevel?: LogLevel;
  readonly enableCaching?: boolean;
  readonly autoLoadConfig?: boolean;
  readonly enableMetrics?: boolean;
}

// ==========================================
// フレームワーク状態
// ==========================================

export enum FrameworkState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  SUSPENDED = 'suspended',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error'
}

export interface FrameworkStatus {
  readonly state: FrameworkState;
  readonly version: string;
  readonly uptime: number;
  readonly activeCommands: number;
  readonly activeSessions: number;
  readonly memoryUsage: number;
  readonly lastError?: FrameworkError;
}

// ==========================================
// フレームワーク統計情報
// ==========================================

export interface FrameworkStatistics {
  readonly commandsExecuted: number;
  readonly averageExecutionTime: number;
  readonly successRate: number;
  readonly errorRate: number;
  readonly personaUsage: Record<PersonaId, number>;
  readonly memoryUsage: MemoryUsageStats;
  readonly performance: PerformanceStats;
}

export interface MemoryUsageStats {
  readonly current: number;
  readonly peak: number;
  readonly average: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
}

export interface PerformanceStats {
  readonly averageResponseTime: number;
  readonly p95ResponseTime: number;
  readonly p99ResponseTime: number;
  readonly throughput: number;
  readonly errorRate: number;
}

// ==========================================
// フレームワークイベント
// ==========================================

export interface FrameworkEvent {
  readonly id: string;
  readonly type: FrameworkEventType;
  readonly timestamp: Timestamp;
  readonly data: DeepReadonly<Record<string, unknown>>;
  readonly source: string;
}

export enum FrameworkEventType {
  INITIALIZED = 'initialized',
  CONFIGURATION_CHANGED = 'configuration_changed',
  COMMAND_EXECUTED = 'command_executed',
  PERSONA_SELECTED = 'persona_selected',
  ERROR_OCCURRED = 'error_occurred',
  PERFORMANCE_THRESHOLD_EXCEEDED = 'performance_threshold_exceeded',
  SECURITY_ALERT = 'security_alert'
}

// ==========================================
// フレームワークエンティティ
// ==========================================

export class FrameworkEntity extends BaseEntity {
  private _state: FrameworkState = FrameworkState.UNINITIALIZED;
  private _configuration: FrameworkConfiguration;
  private _startTime: Timestamp;
  private _statistics: FrameworkStatistics;
  private _eventHistory: FrameworkEvent[] = [];

  // 依存コンポーネント
  private _commandRouter?: CommandRouter;
  private _commandEngine?: CommandExecutionEngine;
  private _personaManager?: PersonaManager;

  constructor(
    private readonly options: FrameworkInitOptions = {}
  ) {
    super();
    this._startTime = Date.now() as Timestamp;
    this._configuration = this.createDefaultConfiguration();
    this._statistics = this.createInitialStatistics();
  }

  // ==========================================
  // プロパティアクセサー
  // ==========================================

  public get state(): FrameworkState {
    return this._state;
  }

  public get configuration(): DeepReadonly<FrameworkConfiguration> {
    return this._configuration;
  }

  public get statistics(): DeepReadonly<FrameworkStatistics> {
    return this._statistics;
  }

  public get uptime(): number {
    return Date.now() - this._startTime;
  }

  public get isInitialized(): boolean {
    return this._state !== FrameworkState.UNINITIALIZED;
  }

  public get isReady(): boolean {
    return this._state === FrameworkState.READY || this._state === FrameworkState.RUNNING;
  }

  // ==========================================
  // フレームワーク初期化
  // ==========================================

  public async initialize(): Promise<void> {
    if (this._state !== FrameworkState.UNINITIALIZED) {
      throw new ConfigurationError('フレームワークは既に初期化されています');
    }

    try {
      this._state = FrameworkState.INITIALIZING;
      
      // 設定の読み込み
      await this.loadConfiguration();
      
      // 依存コンポーネントの初期化
      await this.initializeDependencies();
      
      // 検証
      await this.validateConfiguration();
      
      this._state = FrameworkState.READY;
      
      this.emitEvent({
        type: FrameworkEventType.INITIALIZED,
        data: {
          configuration: this._configuration,
          uptime: this.uptime
        }
      });

    } catch (error) {
      this._state = FrameworkState.ERROR;
      const frameworkError = error instanceof FrameworkError 
        ? error 
        : new ConfigurationError(`初期化に失敗しました: ${error.message}`);
      
      this.emitEvent({
        type: FrameworkEventType.ERROR_OCCURRED,
        data: { error: frameworkError.toJSON() }
      });
      
      throw frameworkError;
    }
  }

  // ==========================================
  // コマンド実行
  // ==========================================

  public async executeCommand(
    input: string,
    executionContext: ExecutionContext
  ): Promise<CommandResult> {
    this.ensureReady();
    
    const startTime = Date.now() as Timestamp;
    let command: Command;
    let result: CommandResult;

    try {
      this._state = FrameworkState.RUNNING;

      // 1. コマンド解析
      const parsedCommand = await this._commandRouter!.parseCommand(input);
      
      // 2. バリデーション
      const validationResult = await this._commandRouter!.validateCommand(parsedCommand);
      if (!validationResult.valid) {
        throw new ValidationError(
          `コマンドの検証に失敗しました: ${validationResult.errors.map(e => e.message).join(', ')}`
        );
      }

      // 3. コマンドオブジェクト構築
      command = this.buildCommand(parsedCommand, executionContext);

      // 4. ペルソナ選択
      const personaResult = await this.selectPersona(command, executionContext);
      if (personaResult.success && personaResult.selectedPersona) {
        // ペルソナをコンテキストに追加
        executionContext = {
          ...executionContext,
          persona: personaResult.selectedPersona.id
        };
      }

      // 5. コマンド実行
      result = await this._commandEngine!.execute(command);

      // 6. 統計更新
      this.updateStatistics(command, result, Date.now() - startTime);

      this._state = FrameworkState.READY;
      return result;

    } catch (error) {
      const frameworkError = error instanceof FrameworkError 
        ? error 
        : new CommandExecutionError(`コマンド実行に失敗しました: ${error.message}`);

      // エラー結果を構築
      result = {
        commandId: command?.id || ('' as CommandId),
        success: false,
        output: { data: null },
        format: 'text' as const,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          resourcesUsed: { memory: 0, cpu: 0, diskIO: 0, networkIO: 0 }
        },
        errors: [frameworkError],
        performance: {
          startTime,
          endTime: Date.now() as Timestamp,
          duration: Date.now() - startTime
        }
      };

      this._state = FrameworkState.READY;
      
      this.emitEvent({
        type: FrameworkEventType.ERROR_OCCURRED,
        data: { error: frameworkError.toJSON(), command: command?.name }
      });

      return result;
    }
  }

  // ==========================================
  // セッション管理
  // ==========================================

  public async createSession(
    userId: UserId,
    userContext: UserContext
  ): Promise<SessionContext> {
    this.ensureReady();

    const sessionId = this.generateSessionId();
    const session: SessionContext = {
      id: sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
      environment: {
        ip: '127.0.0.1',
        userAgent: 'SuperCursor Framework',
        platform: process.platform,
        workingDirectory: process.cwd()
      },
      history: [],
      cache: {
        entries: new Map(),
        maxSize: this._configuration.maxHistorySize,
        ttl: this._configuration.cacheTimeout,
        hits: 0,
        misses: 0
      },
      state: {
        variables: {},
        flags: [],
        bookmarks: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return session;
  }

  // ==========================================
  // ペルソナ管理
  // ==========================================

  public async selectPersona(
    command: Command,
    context: ExecutionContext
  ): Promise<PersonaSelectionResult> {
    this.ensureReady();

    if (!this._personaManager) {
      return {
        success: false,
        confidence: 0,
        reasoning: 'ペルソナマネージャーが初期化されていません',
        alternatives: [],
        selectionTime: 0
      };
    }

    const startTime = Date.now();
    
    try {
      const personaContext = await this._personaManager.analyzeContext(context);
      const result = await this._personaManager.selectPersona(personaContext);

      this.emitEvent({
        type: FrameworkEventType.PERSONA_SELECTED,
        data: {
          personaId: result.selectedPersona?.id,
          confidence: result.confidence,
          commandName: command.name
        }
      });

      return {
        ...result,
        selectionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        confidence: 0,
        reasoning: `ペルソナ選択に失敗しました: ${error.message}`,
        alternatives: [],
        selectionTime: Date.now() - startTime
      };
    }
  }

  // ==========================================
  // 状態管理
  // ==========================================

  public getStatus(): FrameworkStatus {
    return {
      state: this._state,
      version: '1.0.0',
      uptime: this.uptime,
      activeCommands: 0, // TODO: 実装
      activeSessions: 0, // TODO: 実装
      memoryUsage: process.memoryUsage().heapUsed,
      lastError: this.getLastError()
    };
  }

  public async shutdown(): Promise<void> {
    this._state = FrameworkState.SHUTTING_DOWN;

    try {
      // リソースのクリーンアップ
      await this.cleanup();
      
      this._state = FrameworkState.SHUTDOWN;

    } catch (error) {
      this._state = FrameworkState.ERROR;
      throw new FrameworkError(`シャットダウンに失敗しました: ${error.message}`);
    }
  }

  // ==========================================
  // プライベートメソッド
  // ==========================================

  private async loadConfiguration(): Promise<void> {
    // 設定ファイルから設定を読み込む（実装待ち）
    // この実装では、デフォルト設定とオプションをマージ
    this._configuration = {
      ...this._configuration,
      logLevel: this.options.logLevel || this._configuration.logLevel,
      enableCaching: this.options.enableCaching ?? this._configuration.enableCaching
    };
  }

  private async initializeDependencies(): Promise<void> {
    try {
      // TODO: 具体的な実装クラスが利用可能になったら置き換える
      // 現在は仮の実装で初期化（実際の実装では具体的なクラスを使用）
      
      // CommandRouter の初期化
      // this._commandRouter = new CommandRouterImpl(logger, config);
      
      // CommandExecutionEngine の初期化  
      // this._commandEngine = new CommandExecutionEngineImpl(logger, config, this);
      
      // PersonaManager の初期化
      // this._personaManager = new PersonaManagerImpl(logger, config, personaRepository, this);
      
      // 現在は初期化をスキップ（具体的な実装が必要）
      console.warn('依存コンポーネントの初期化がスキップされました。具体的な実装クラスが必要です。');
      
    } catch (error) {
      throw new ConfigurationError(`依存コンポーネントの初期化に失敗しました: ${error.message}`);
    }
  }

  private async validateConfiguration(): Promise<void> {
    if (this._configuration.cacheTimeout < 0) {
      throw new ValidationError('キャッシュタイムアウトは0以上である必要があります');
    }

    if (this._configuration.maxHistorySize < 1) {
      throw new ValidationError('履歴最大サイズは1以上である必要があります');
    }
  }

  private createDefaultConfiguration(): FrameworkConfiguration {
    return {
      logLevel: LogLevel.INFO,
      enableCaching: true,
      cacheTimeout: 300000, // 5分
      maxHistorySize: 1000,
      enableValidation: true,
      personas: {
        enableAutoSelection: true,
        enableLearning: true,
        confidenceThreshold: 0.7,
        maxConcurrentPersonas: 3
      },
      security: {
        enableAuthentication: false,
        enableAuthorization: false,
        rateLimiting: {
          enabled: false,
          maxRequestsPerMinute: 60,
          maxRequestsPerHour: 1000
        },
        encryption: {
          enabled: false,
          algorithm: 'AES-256-GCM',
          keyLength: 256
        }
      },
      performance: {
        enableMetrics: true,
        enableProfiling: false,
        maxMemoryUsage: 1000000000, // 1GB
        commandTimeout: 30000 // 30秒
      }
    };
  }

  private createInitialStatistics(): FrameworkStatistics {
    return {
      commandsExecuted: 0,
      averageExecutionTime: 0,
      successRate: 0,
      errorRate: 0,
      personaUsage: {},
      memoryUsage: {
        current: 0,
        peak: 0,
        average: 0,
        heapUsed: 0,
        heapTotal: 0
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0
      }
    };
  }

  private buildCommand(
    parsedCommand: any,
    executionContext: ExecutionContext
  ): Command {
    return {
      id: this.generateCommandId(),
      sessionId: executionContext.sessionId,
      name: parsedCommand.name,
      arguments: parsedCommand.arguments,
      options: parsedCommand.options,
      raw: parsedCommand.raw,
      executionContext,
      metadata: {
        priority: 'normal',
        timeout: this._configuration.performance.commandTimeout,
        retryable: false,
        maxRetries: 0,
        tags: [],
        dependencies: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private updateStatistics(command: Command, result: CommandResult, duration: number): void {
    const prevCount = this._statistics.commandsExecuted;
    const newCount = prevCount + 1;
    const prevSuccesses = this._statistics.successRate * prevCount;
    const prevErrors = this._statistics.errorRate * prevCount;
    
    const newSuccesses = prevSuccesses + (result.success ? 1 : 0);
    const newErrors = prevErrors + (result.success ? 0 : 1);
    
    this._statistics = {
      ...this._statistics,
      commandsExecuted: newCount,
      averageExecutionTime: (this._statistics.averageExecutionTime * prevCount + duration) / newCount,
      successRate: newSuccesses / newCount,
      errorRate: newErrors / newCount
    };
  }

  private ensureReady(): void {
    if (!this.isReady) {
      throw new ConfigurationError(`フレームワークが準備できていません。現在の状態: ${this._state}`);
    }
  }

  /**
   * 暗号学的に安全なID生成ユーティリティ
   * @param prefix IDのプレフィックス
   * @returns プレフィックス付きのUUID
   */
  private generatePrefixedId(prefix: string): string {
    const uuid = randomUUID();
    return `${prefix}_${uuid}`;
  }

  private generateCommandId(): CommandId {
    return this.generatePrefixedId('cmd') as CommandId;
  }

  private generateSessionId(): SessionId {
    return this.generatePrefixedId('session') as SessionId;
  }

  private emitEvent(eventData: {
    type: FrameworkEventType;
    data: DeepReadonly<Record<string, unknown>>;
  }): void {
    const event: FrameworkEvent = {
      id: Math.random().toString(36).substring(2, 18),
      type: eventData.type,
      timestamp: Date.now() as Timestamp,
      data: eventData.data,
      source: 'FrameworkEntity'
    };

    this._eventHistory.push(event);

    // 履歴サイズ制限
    if (this._eventHistory.length > this._configuration.maxHistorySize) {
      this._eventHistory.shift();
    }

    // イベント発行（実装待ち）
    // this.eventEmitter.emit(event.type, event);
  }

  private getLastError(): FrameworkError | undefined {
    const errorEvent = this._eventHistory
      .reverse()
      .find(event => event.type === FrameworkEventType.ERROR_OCCURRED);

    return errorEvent?.data.error as FrameworkError | undefined;
  }

  private async cleanup(): Promise<void> {
    // リソースクリーンアップ（実装待ち）
    this._eventHistory = [];
  }
}