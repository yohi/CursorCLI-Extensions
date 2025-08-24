/**
 * SuperCursor Framework - 統合型定義エクスポート
 * Framework-1とFramework-2の型定義を統合し、NestJSベストプラクティスを適用
 */

// ==========================================
// 型定義のインポート（名前空間用）
// ==========================================
import {
  FrameworkError,
  ConfigurationError,
  ValidationError,
  CommandExecutionError,
  PersonaSelectionError,
  CacheError,
  SecurityError
} from './base.js';
import type {
  CommandId as CommandIdType,
  PersonaId as PersonaIdType,
  SessionId as SessionIdType,
  UserId as UserIdType,
  ProjectId as ProjectIdType,
  Timestamp as TimestampType,
  DeepReadonly as DeepReadonlyType,
  Optional as OptionalType,
  NonEmptyArray as NonEmptyArrayType,
  Result as ResultType,
  ValidationResult as ValidationResultType
} from './base.js';
import type { 
  Command as CommandType, 
  CommandResult as CommandResultType,
  CommandHandler as CommandHandlerType,
  CommandRouter as CommandRouterType,
  CommandExecutionEngine as CommandExecutionEngineType
} from './commands.js';
import type { 
  ProjectContext as ProjectContextType,
  UserContext as UserContextType,
  SessionContext as SessionContextType,
  PersonaManager as PersonaManagerType,
  PersonaFactory as PersonaFactoryType,
  PersonaSelectionResult as PersonaSelectionResultType,
  PersonaActivationResult as PersonaActivationResultType
} from './context.js';
import type { 
  AIPersona as AIPersonaType
} from './personas.js';

/**
 * SuperCursor Framework の主要な型定義
 * 型安全性とコードの整理を向上させるために使用
 */
export interface SuperCursorTypes {
  // Framework-1 インターフェース継承
  Command: CommandType;
  CommandResult: CommandResultType;
  AIPersona: AIPersonaType;
  ProjectContext: ProjectContextType;
  UserContext: UserContextType;
  SessionContext: SessionContextType;

  // ブランド型
  CommandId: CommandIdType;
  PersonaId: PersonaIdType;
  SessionId: SessionIdType;
  UserId: UserIdType;
  ProjectId: ProjectIdType;
  Timestamp: TimestampType;
}

/**
 * SuperCursor Framework のエラークラス集合
 */
export const SuperCursorErrors = {
  FrameworkError,
  ConfigurationError,
  ValidationError,
  CommandExecutionError,
  PersonaSelectionError,
  CacheError,
  SecurityError
} as const;

/**
 * ユーティリティ型のヘルパー
 */
export type DeepReadonly<T> = DeepReadonlyType<T>;
export type Optional<T, K extends keyof T> = OptionalType<T, K>;
export type NonEmptyArray<T> = NonEmptyArrayType<T>;
export type Result<T, E = Error> = ResultType<T, E>;

/**
 * ドメイン固有の型定義
 */
export interface DomainTypes {
  // コマンド関連
  CommandCategory: import('./commands.js').CommandCategory;
  CommandPriority: import('./commands.js').CommandPriority;
  ExecutionStatus: import('./commands.js').ExecutionStatus;
  AttachmentType: import('./commands.js').AttachmentType;

  // ペルソナ関連
  PersonaType: import('./personas.js').PersonaType;
  ExpertiseLevel: import('./personas.js').ExpertiseLevel;
  CapabilityCategory: import('./personas.js').CapabilityCategory;
  ResponseTone: import('./personas.js').ResponseTone;
  ResponseFormat: import('./personas.js').ResponseFormat;

  // プロジェクト関連
  ProjectType: import('./context.js').ProjectType;
  FrameworkType: import('./context.js').FrameworkType;
  DatabaseType: import('./context.js').DatabaseType;
  ToolCategory: import('./context.js').ToolCategory;
  PlatformType: import('./context.js').PlatformType;

  // セッション関連
  SessionStatus: import('./context.js').SessionStatus;
  Theme: import('./context.js').Theme;
  ExperienceLevel: import('./context.js').ExperienceLevel;
}

// ドメイン型のエクスポート
export type CommandCategory = import('./commands.js').CommandCategory;
export type CommandPriority = import('./commands.js').CommandPriority;
export type ExecutionStatus = import('./commands.js').ExecutionStatus;
export type AttachmentType = import('./commands.js').AttachmentType;
export type PersonaType = import('./personas.js').PersonaType;
export type ExpertiseLevel = import('./personas.js').ExpertiseLevel;
export type CapabilityCategory = import('./personas.js').CapabilityCategory;
export type ResponseTone = import('./personas.js').ResponseTone;
export type ResponseFormat = import('./personas.js').ResponseFormat;
export type ProjectType = import('./context.js').ProjectType;
export type FrameworkType = import('./context.js').FrameworkType;
export type DatabaseType = import('./context.js').DatabaseType;
export type ToolCategory = import('./context.js').ToolCategory;
export type PlatformType = import('./context.js').PlatformType;
export type SessionStatus = import('./context.js').SessionStatus;
export type Theme = import('./context.js').Theme;
export type ExperienceLevel = import('./context.js').ExperienceLevel;

/**
 * インフラストラクチャ層で使用される型定義
 */
export interface InfrastructureTypes {
  // 設定関連
  ConfigurationType: import('./context.js').ConfigurationType;
  ConfigurationFormat: import('./context.js').ConfigurationFormat;
  
  // セキュリティ関連
  PermissionAction: import('./context.js').PermissionAction;
  PermissionScope: import('./context.js').PermissionScope;
  VulnerabilitySeverity: import('./context.js').VulnerabilitySeverity;
  
  // 品質関連
  SecurityRating: import('./context.js').SecurityRating;
  ReliabilityRating: import('./context.js').ReliabilityRating;
  MaintainabilityRating: import('./context.js').MaintainabilityRating;
}

// インフラストラクチャ型のエクスポート
export type ConfigurationType = import('./context.js').ConfigurationType;
export type ConfigurationFormat = import('./context.js').ConfigurationFormat;
export type PermissionAction = import('./context.js').PermissionAction;
export type PermissionScope = import('./context.js').PermissionScope;
export type VulnerabilitySeverity = import('./context.js').VulnerabilitySeverity;
export type SecurityRating = import('./context.js').SecurityRating;
export type ReliabilityRating = import('./context.js').ReliabilityRating;
export type MaintainabilityRating = import('./context.js').MaintainabilityRating;
export type PackageManager = import('./context.js').PackageManager;
export type OperatingSystem = import('./context.js').OperatingSystem;

// enumのエクスポート
export {
  ProjectType,
  SecurityRating,
  ReliabilityRating,
  MaintainabilityRating,
  PackageManager,
  OperatingSystem
} from './context.js';

/**
 * アプリケーション層で使用される型定義
 */
export interface ApplicationTypes {
  // コマンド処理関連
  CommandHandler: CommandHandlerType;
  CommandRouter: CommandRouterType;
  CommandExecutionEngine: CommandExecutionEngineType;
  
  // ペルソナ管理関連
  PersonaManager: PersonaManagerType;
  PersonaFactory: PersonaFactoryType;
  
  // 結果型
  ValidationResult: ValidationResultType;
  PersonaSelectionResult: PersonaSelectionResultType;
  PersonaActivationResult: PersonaActivationResultType;
}

// アプリケーション型のエクスポート
export type CommandHandler = CommandHandlerType;
export type CommandRouter = CommandRouterType;
export type CommandExecutionEngine = CommandExecutionEngineType;
export type PersonaManager = PersonaManagerType;
export type PersonaFactory = PersonaFactoryType;
export type ValidationResult = ValidationResultType;
export type PersonaSelectionResult = PersonaSelectionResultType;
export type PersonaActivationResult = PersonaActivationResultType;

/**
 * プレゼンテーション層で使用される型定義
 */
export interface PresentationTypes {
  // 出力関連
  OutputFormat: import('./base.js').OutputFormat;
  VerbosityLevel: import('./base.js').VerbosityLevel;
  LogLevel: import('./base.js').LogLevel;
  
  // UI関連
  Theme: import('./context.js').Theme;
  NotificationType: import('./context.js').NotificationType;
}

// プレゼンテーション型のエクスポート
export type OutputFormat = import('./base.js').OutputFormat;
export type VerbosityLevel = import('./base.js').VerbosityLevel;
export type LogLevel = import('./base.js').LogLevel;
export type NotificationType = import('./context.js').NotificationType;

// ==========================================
// ベース型定義の再エクスポート（export * は除外して個別エクスポート）
// ==========================================

// ベース型
export type {
  CommandId,
  PersonaId,
  SessionId,
  UserId,
  ProjectId,
  Timestamp,
  DeepReadonly,
  Optional,
  NonEmptyArray,
  Result
} from './base.js';

// 列挙型エクスポート
export {
  ParameterType,
  OutputFormat,
  LogLevel,
  ErrorSeverity,
  VerbosityLevel
} from './base.js';

// エラークラスとインターフェース
export {
  FrameworkError,
  ConfigurationError,
  ValidationError,
  CommandExecutionError,
  PersonaSelectionError,
  CacheError,
  SecurityError
} from './base.js';

export type {
  ValidationResult,
  ValidationWarning,
  BaseEntity
} from './base.js';

// コマンド型
export type {
  Command,
  CommandResult,
  CommandHandler,
  CommandParameter,
  ParsedCommand
} from './commands.js';

// コマンド列挙型
export {
  CommandCategory,
  CommandPriority,
  ExecutionStatus,
  AttachmentType,
  BuildMode
} from './commands.js';

// ペルソナ型
export type {
  AIPersona,
  PersonaResponseStyle,
  ResponseStyle
} from './personas.js';

// コンテキスト型
export type {
  ProjectContext,
  UserContext,
  SessionContext
} from './context.js';

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
  isParameterType,
  isOutputFormat,
  isLogLevel,
  isErrorSeverity,
  isVerbosityLevel,
  // ファクトリー関数
  createCommandId,
  createPersonaId,
  createSessionId,
  createUserId,
  createTimestamp
} from './base.js';

export {
  // コマンド型チェック
  isCommandResult,
  isAnalyzeCommand,
  isImplementCommand,
  isBuildCommand,
  isCommandCategory,
  isCommandPriority,
  isBuildMode,
  isExecutionStatus,
  isAttachmentType,
  // ファクトリー関数
  createExecutionContext
} from './commands.js';

export {
  // ペルソナ型チェック
  isAIPersona,
  hasCapability,
  hasExpertise,
  calculatePersonaMatch
} from './personas.js';

export {
  // コンテキスト型チェック
  isProjectContext,
  isUserContext,
  isSessionContext
} from './context.js';

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