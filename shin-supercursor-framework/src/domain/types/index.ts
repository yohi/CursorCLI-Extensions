/**
 * SuperCursor Framework - 統合型定義エクスポート
 * Framework-1とFramework-2の型定義を統合し、NestJSベストプラクティスを適用
 */

// ==========================================
// ベース型定義
// ==========================================
export * from './base.js';

// ==========================================
// コマンド関連型定義
// ==========================================
export * from './commands.js';

// ==========================================
// ペルソナ関連型定義
// ==========================================
export * from './personas.js';

// ==========================================
// コンテキスト関連型定義
// ==========================================
export * from './context.js';

// ==========================================
// 統合型定義の名前空間
// ==========================================

/**
 * SuperCursor Framework の主要な型定義を含む名前空間
 * 型安全性とコードの整理を向上させるために使用
 */
export namespace SuperCursor {
  // Framework-1 インターフェース継承
  export interface Command extends import('./commands.js').Command {}
  export interface CommandResult extends import('./commands.js').CommandResult {}
  export interface AIPersona extends import('./personas.js').AIPersona {}
  export interface ProjectContext extends import('./context.js').ProjectContext {}
  export interface UserContext extends import('./context.js').UserContext {}
  export interface SessionContext extends import('./context.js').SessionContext {}

  // ブランド型
  export type CommandId = import('./base.js').CommandId;
  export type PersonaId = import('./base.js').PersonaId;
  export type SessionId = import('./base.js').SessionId;
  export type UserId = import('./base.js').UserId;
  export type ProjectId = import('./base.js').ProjectId;
  export type Timestamp = import('./base.js').Timestamp;

  // ユーティリティ型
  export type DeepReadonly<T> = import('./base.js').DeepReadonly<T>;
  export type Optional<T, K extends keyof T> = import('./base.js').Optional<T, K>;
  export type NonEmptyArray<T> = import('./base.js').NonEmptyArray<T>;
  export type Result<T, E = Error> = import('./base.js').Result<T, E>;

  // エラークラス
  export const FrameworkError = import('./base.js').FrameworkError;
  export const ConfigurationError = import('./base.js').ConfigurationError;
  export const ValidationError = import('./base.js').ValidationError;
  export const CommandExecutionError = import('./base.js').CommandExecutionError;
  export const PersonaSelectionError = import('./base.js').PersonaSelectionError;
  export const CacheError = import('./base.js').CacheError;
  export const SecurityError = import('./base.js').SecurityError;
}

/**
 * ドメイン固有の型定義名前空間
 */
export namespace Domain {
  // コマンド関連
  export type CommandCategory = import('./commands.js').CommandCategory;
  export type CommandPriority = import('./commands.js').CommandPriority;
  export type ExecutionStatus = import('./commands.js').ExecutionStatus;
  export type AttachmentType = import('./commands.js').AttachmentType;

  // ペルソナ関連
  export type PersonaType = import('./personas.js').PersonaType;
  export type ExpertiseLevel = import('./personas.js').ExpertiseLevel;
  export type CapabilityCategory = import('./personas.js').CapabilityCategory;
  export type ResponseTone = import('./personas.js').ResponseTone;
  export type ResponseFormat = import('./personas.js').ResponseFormat;

  // プロジェクト関連
  export type ProjectType = import('./context.js').ProjectType;
  export type FrameworkType = import('./context.js').FrameworkType;
  export type DatabaseType = import('./context.js').DatabaseType;
  export type ToolCategory = import('./context.js').ToolCategory;
  export type PlatformType = import('./context.js').PlatformType;

  // セッション関連
  export type SessionStatus = import('./context.js').SessionStatus;
  export type Theme = import('./context.js').Theme;
  export type ExperienceLevel = import('./context.js').ExperienceLevel;
}

/**
 * インフラストラクチャ層で使用される型定義
 */
export namespace Infrastructure {
  // 設定関連
  export type ConfigurationType = import('./context.js').ConfigurationType;
  export type ConfigurationFormat = import('./context.js').ConfigurationFormat;
  
  // セキュリティ関連
  export type PermissionAction = import('./context.js').PermissionAction;
  export type PermissionScope = import('./context.js').PermissionScope;
  export type VulnerabilitySeverity = import('./context.js').VulnerabilitySeverity;
  
  // 品質関連
  export type SecurityRating = import('./context.js').SecurityRating;
  export type ReliabilityRating = import('./context.js').ReliabilityRating;
  export type MaintainabilityRating = import('./context.js').MaintainabilityRating;
}

/**
 * アプリケーション層で使用される型定義
 */
export namespace Application {
  // コマンド処理関連
  export interface CommandHandler extends import('./commands.js').CommandHandler {}
  export interface CommandRouter extends import('./commands.js').CommandRouter {}
  export interface CommandExecutionEngine extends import('./commands.js').CommandExecutionEngine {}
  
  // ペルソナ管理関連
  export interface PersonaManager extends import('./personas.js').PersonaManager {}
  export interface PersonaFactory extends import('./personas.js').PersonaFactory {}
  
  // 結果型
  export interface ValidationResult extends import('./base.js').ValidationResult {}
  export interface PersonaSelectionResult extends import('./personas.js').PersonaSelectionResult {}
  export interface PersonaActivationResult extends import('./personas.js').PersonaActivationResult {}
}

/**
 * プレゼンテーション層で使用される型定義
 */
export namespace Presentation {
  // 出力関連
  export type OutputFormat = import('./base.js').OutputFormat;
  export type VerbosityLevel = import('./base.js').VerbosityLevel;
  export type LogLevel = import('./base.js').LogLevel;
  
  // UI関連
  export type Theme = import('./context.js').Theme;
  export type NotificationType = import('./context.js').NotificationType;
}

// ==========================================
// 型チェック用ユーティリティ関数の再エクスポート
// ==========================================

export {
  // ベース型チェック
  isCommandId,
  isPersonaId,
  isSessionId,
  isUserId,
  isTimestamp,
  isNonEmptyArray,
  
  // エンティティ型チェック
  isCommandResult,
  isAIPersona,
  isProjectContext,
  isUserContext,
  isSessionContext,
  
  // コマンド型チェック
  isAnalyzeCommand,
  isImplementCommand,
  isBuildCommand,
  
  // ペルソナ型チェック
  hasCapability,
  hasExpertise
} from './base.js';

export {
  calculatePersonaMatch
} from './personas.js';

// ==========================================
// ファクトリー関数の再エクスポート
// ==========================================

export {
  createCommandId,
  createPersonaId,
  createSessionId,
  createUserId,
  createTimestamp
} from './base.js';

export {
  createExecutionContext
} from './commands.js';

// ==========================================
// 定数定義
// ==========================================

/**
 * フレームワーク全体で使用される定数
 */
export const FRAMEWORK_CONSTANTS = {
  VERSION: '1.0.0',
  NAME: 'SuperCursor Framework',
  
  // タイムアウト設定
  DEFAULT_COMMAND_TIMEOUT: 30000, // 30秒
  MAX_COMMAND_TIMEOUT: 300000,    // 5分
  SESSION_TIMEOUT: 3600000,       // 1時間
  
  // キャッシュ設定
  DEFAULT_CACHE_TTL: 300,         // 5分
  MAX_CACHE_SIZE: 1000,
  
  // 制限設定
  MAX_CONCURRENT_COMMANDS: 10,
  MAX_HISTORY_ENTRIES: 1000,
  MAX_SESSION_VARIABLES: 100,
  
  // パフォーマンス閾値
  SLOW_COMMAND_THRESHOLD: 5000,   // 5秒
  HIGH_MEMORY_THRESHOLD: 1000000000, // 1GB
  
  // セキュリティ設定
  MAX_INPUT_LENGTH: 10000,
  ALLOWED_FILE_EXTENSIONS: ['.ts', '.js', '.json', '.md', '.txt'],
  
  // 品質しきい値
  MIN_CONFIDENCE_THRESHOLD: 0.7,
  MIN_PERSONA_MATCH_SCORE: 0.5
} as const;

/**
 * エラーコード定義
 */
export const ERROR_CODES = {
  // 設定エラー
  INVALID_CONFIGURATION: 'E001',
  MISSING_CONFIGURATION: 'E002',
  
  // バリデーションエラー
  INVALID_INPUT: 'E101',
  MISSING_REQUIRED_FIELD: 'E102',
  INVALID_FORMAT: 'E103',
  
  // コマンドエラー
  COMMAND_NOT_FOUND: 'E201',
  COMMAND_EXECUTION_FAILED: 'E202',
  COMMAND_TIMEOUT: 'E203',
  
  // ペルソナエラー
  PERSONA_NOT_FOUND: 'E301',
  PERSONA_ACTIVATION_FAILED: 'E302',
  NO_SUITABLE_PERSONA: 'E303',
  
  // セキュリティエラー
  UNAUTHORIZED_ACCESS: 'E401',
  INSUFFICIENT_PERMISSIONS: 'E402',
  SECURITY_VIOLATION: 'E403',
  
  // システムエラー
  SYSTEM_ERROR: 'E501',
  RESOURCE_EXHAUSTED: 'E502',
  SERVICE_UNAVAILABLE: 'E503'
} as const;

/**
 * イベント名定義
 */
export const EVENT_NAMES = {
  // コマンドイベント
  COMMAND_STARTED: 'command.started',
  COMMAND_COMPLETED: 'command.completed',
  COMMAND_FAILED: 'command.failed',
  
  // ペルソナイベント
  PERSONA_SELECTED: 'persona.selected',
  PERSONA_ACTIVATED: 'persona.activated',
  PERSONA_SWITCHED: 'persona.switched',
  
  // セッションイベント
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',
  SESSION_EXPIRED: 'session.expired',
  
  // システムイベント
  FRAMEWORK_INITIALIZED: 'framework.initialized',
  CONFIGURATION_CHANGED: 'configuration.changed',
  ERROR_OCCURRED: 'error.occurred'
} as const;