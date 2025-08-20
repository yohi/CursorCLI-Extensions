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

// Import types for namespace declarations
import type { 
  Command as CommandType, 
  CommandResult as CommandResultType 
} from './commands.js';
import type { 
  AIPersona as AIPersonaType 
} from './personas.js';
import type { 
  ProjectContext as ProjectContextType,
  UserContext as UserContextType,
  SessionContext as SessionContextType 
} from './context.js';
import type {
  CommandId as CommandIdType,
  PersonaId as PersonaIdType,
  SessionId as SessionIdType,
  UserId as UserIdType,
  ProjectId as ProjectIdType,
  Timestamp as TimestampType,
  DeepReadonly,
  Optional,
  NonEmptyArray,
  Result
} from './base.js';

// Import error classes for runtime access
import {
  FrameworkError,
  ConfigurationError,
  ValidationError,
  CommandExecutionError,
  PersonaSelectionError,
  CacheError,
  SecurityError
} from './base.js';

/**
 * SuperCursor Framework の主要な型定義を含む名前空間
 * 型安全性とコードの整理を向上させるために使用
 */
export namespace SuperCursor {
  // Framework-1 インターフェース継承
  export type Command = CommandType;
  export type CommandResult = CommandResultType;
  export type AIPersona = AIPersonaType;
  export type ProjectContext = ProjectContextType;
  export type UserContext = UserContextType;
  export type SessionContext = SessionContextType;

  // ブランド型
  export type CommandId = CommandIdType;
  export type PersonaId = PersonaIdType;
  export type SessionId = SessionIdType;
  export type UserId = UserIdType;
  export type ProjectId = ProjectIdType;
  export type Timestamp = TimestampType;

  // ユーティリティ型 - re-export the types
  export type { DeepReadonly, Optional, NonEmptyArray, Result };
}

// Export error classes under namespace
export namespace SuperCursor {
  export const Errors = {
    FrameworkError,
    ConfigurationError,
    ValidationError,
    CommandExecutionError,
    PersonaSelectionError,
    CacheError,
    SecurityError
  };
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

// Import application layer types
import type {
  CommandHandler as CommandHandlerType,
  CommandRouter as CommandRouterType,
  CommandExecutionEngine as CommandExecutionEngineType
} from './commands.js';
import type {
  PersonaManager as PersonaManagerType,
  PersonaFactory as PersonaFactoryType,
  PersonaSelectionResult as PersonaSelectionResultType,
  PersonaActivationResult as PersonaActivationResultType
} from './personas.js';
import type {
  ValidationResult as ValidationResultType
} from './base.js';

/**
 * アプリケーション層で使用される型定義
 */
export namespace Application {
  // コマンド処理関連
  export type CommandHandler = CommandHandlerType;
  export type CommandRouter = CommandRouterType;
  export type CommandExecutionEngine = CommandExecutionEngineType;
  
  // ペルソナ管理関連
  export type PersonaManager = PersonaManagerType;
  export type PersonaFactory = PersonaFactoryType;
  
  // 結果型
  export type ValidationResult = ValidationResultType;
  export type PersonaSelectionResult = PersonaSelectionResultType;
  export type PersonaActivationResult = PersonaActivationResultType;
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
  isNonEmptyArray
} from './base.js';

export {
  // コマンド型チェック
  isCommandResult,
  isAnalyzeCommand,
  isImplementCommand,
  isBuildCommand
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