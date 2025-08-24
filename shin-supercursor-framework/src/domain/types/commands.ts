/**
 * SuperCursor Framework - コマンド関連型定義
 * Framework-1とFramework-2のコマンド型を統合し、CQRS対応
 */

import {
  CommandId,
  SessionId,
  PersonaId,
  UserId,
  Timestamp,
  OutputFormat,
  ParameterType,
  FrameworkError,
  ValidationResult,
  PerformanceMetrics,
  ResourceUsage,
  DeepReadonly,
  BaseEntity
} from './base.js';
import { ProjectContext, UserContext } from './context.js';

// ==========================================
// コマンド基本定義
// ==========================================

export interface Command extends BaseEntity<CommandId> {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly arguments: readonly string[];
  readonly options: DeepReadonly<Record<string, unknown>>;
  readonly raw: string;
  readonly executionContext: ExecutionContext;
  readonly metadata: CommandMetadata;
}

export interface ExecutionContext {
  readonly sessionId: SessionId;
  readonly workingDirectory: string;
  readonly user: UserContext;
  readonly project: ProjectContext;
  readonly environment: EnvironmentContext;
  readonly persona?: PersonaId;
}

export interface EnvironmentContext {
  readonly platform: string;
  readonly nodeVersion: string;
  readonly userAgent?: string;
  readonly timestamp: Timestamp;
  readonly variables: DeepReadonly<Record<string, string | undefined>>;
}

export interface CommandMetadata {
  readonly priority: CommandPriority;
  readonly timeout: number;
  readonly retryable: boolean;
  readonly maxRetries: number;
  readonly tags: readonly string[];
  readonly dependencies: readonly CommandId[];
}

export enum CommandPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ==========================================
// コマンド結果
// ==========================================

export interface CommandResult {
  readonly commandId: CommandId;
  readonly success: boolean;
  readonly output: OutputData;
  readonly format: OutputFormat;
  readonly metadata: ExecutionMetadata;
  readonly errors?: readonly FrameworkError[];
  readonly performance: PerformanceMetrics;
}

export interface OutputData {
  readonly data: unknown;
  readonly summary?: string;
  readonly details?: unknown;
  readonly attachments?: readonly Attachment[];
}

export interface Attachment {
  readonly name: string;
  readonly type: AttachmentType;
  readonly content: string | Buffer;
  readonly metadata?: Record<string, unknown>;
}

export enum AttachmentType {
  FILE = 'file',
  IMAGE = 'image',
  LOG = 'log',
  REPORT = 'report',
  CONFIG = 'config'
}

export interface ExecutionMetadata {
  readonly executionTime: number;
  readonly persona?: PersonaId;
  readonly cacheHit: boolean;
  readonly resourcesUsed: ResourceUsage;
  readonly stepResults?: readonly StepResult[];
}

export interface StepResult {
  readonly stepName: string;
  readonly success: boolean;
  readonly duration: number;
  readonly output?: unknown;
  readonly error?: FrameworkError;
}

// ==========================================
// コマンドハンドラー
// ==========================================

export interface CommandHandler {
  readonly name: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly parameters: readonly CommandParameter[];
  readonly category: CommandCategory;
  readonly version: string;
  
  execute(command: Command): Promise<CommandResult>;
  validate?(command: Command): Promise<ValidationResult>;
  canHandle(command: ParsedCommand): boolean;
  getHelpText(): string;
}

export interface CommandParameter {
  readonly name: string;
  readonly type: ParameterType;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: unknown;
  readonly validation?: CommandParameterValidation;
}

export interface CommandParameterValidation {
  readonly pattern?: RegExp;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly allowedValues?: readonly unknown[];
  readonly customValidator?: (value: unknown) => boolean;
}

export enum CommandCategory {
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  BUILD = 'build',
  DEPLOYMENT = 'deployment',
  MAINTENANCE = 'maintenance',
  UTILITY = 'utility'
}

// ==========================================
// コマンド解析
// ==========================================

export interface ParsedCommand {
  readonly name: string;
  readonly subcommand?: string;
  readonly arguments: readonly string[];
  readonly options: DeepReadonly<Record<string, unknown>>;
  readonly raw: string;
  readonly parseMetadata: ParseMetadata;
}

export interface ParseMetadata {
  readonly parser: string;
  readonly version: string;
  readonly timestamp: Timestamp;
  readonly confidence: number;
  readonly alternatives?: readonly ParsedCommand[];
}

// ==========================================
// コマンドルーティング
// ==========================================

export interface CommandRouter {
  parseCommand(input: string): Promise<ParsedCommand>;
  validateCommand(command: ParsedCommand): Promise<ValidationResult>;
  routeCommand(command: ParsedCommand, context: ExecutionContext): Promise<CommandResult>;
  registerHandler(handler: CommandHandler): Promise<void>;
  unregisterHandler(name: string): Promise<boolean>;
  getRegisteredHandlers(): Promise<readonly CommandHandler[]>;
  getCommandHistory(sessionId: SessionId): Promise<readonly CommandHistoryEntry[]>;
}

export interface CommandHistoryEntry {
  readonly id: CommandId;
  readonly command: string;
  readonly timestamp: Timestamp;
  readonly duration: number;
  readonly success: boolean;
  readonly personaId?: PersonaId;
  readonly output?: OutputData;
  readonly error?: FrameworkError;
}

// ==========================================
// 特化コマンド (Framework-1由来)
// ==========================================

export interface AnalyzeCommand extends Command {
  readonly name: 'analyze';
  readonly analysisOptions: AnalysisOptions;
}

export interface AnalysisOptions {
  readonly deep: boolean;
  readonly includeTests: boolean;
  readonly includeDependencies: boolean;
  readonly outputFormat: OutputFormat;
  readonly patterns?: readonly string[];
  readonly excludePatterns?: readonly string[];
}

export interface ImplementCommand extends Command {
  readonly name: 'implement';
  readonly implementationOptions: ImplementationOptions;
}

export interface ImplementationOptions {
  readonly template?: string;
  readonly generateTests: boolean;
  readonly generateDocs: boolean;
  readonly followBestPractices: boolean;
  readonly targetFramework?: string;
}

export interface BuildCommand extends Command {
  readonly name: 'build';
  readonly buildOptions: BuildOptions;
}

export interface BuildOptions {
  readonly mode: BuildMode;
  readonly optimization: boolean;
  readonly sourceMaps: boolean;
  readonly outputPath?: string;
  readonly target?: string;
}

export enum BuildMode {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test'
}

// ==========================================
// コマンド実行エンジン
// ==========================================

export interface CommandExecutionEngine {
  execute(command: Command): Promise<CommandResult>;
  executeAsync(command: Command): Promise<AsyncCommandExecution>;
  cancel(commandId: CommandId): Promise<boolean>;
  getExecutionStatus(commandId: CommandId): Promise<ExecutionStatus>;
  getActiveExecutions(): Promise<readonly ActiveExecution[]>;
}

export interface AsyncCommandExecution {
  readonly commandId: CommandId;
  readonly status: ExecutionStatus;
  readonly progress?: ExecutionProgress;
  readonly promise: Promise<CommandResult>;
}

export interface ExecutionProgress {
  readonly current: number;
  readonly total: number;
  readonly message?: string;
  readonly percentage: number;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface ActiveExecution {
  readonly commandId: CommandId;
  readonly status: ExecutionStatus;
  readonly startTime: Timestamp;
  readonly progress?: ExecutionProgress;
  readonly estimatedCompletion?: Timestamp;
}

// ==========================================
// コマンドキュー
// ==========================================

export interface CommandQueue {
  enqueue(command: Command): Promise<void>;
  dequeue(): Promise<Command | null>;
  peek(): Promise<Command | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
  prioritize(commandId: CommandId): Promise<boolean>;
}

export interface PriorityCommandQueue extends CommandQueue {
  enqueuePriority(command: Command, priority: CommandPriority): Promise<void>;
  getByPriority(priority: CommandPriority): Promise<readonly Command[]>;
}

// ==========================================
// コマンドミドルウェア
// ==========================================

export interface CommandMiddleware {
  readonly name: string;
  readonly order: number;
  
  beforeExecution?(command: Command, context: ExecutionContext): Promise<Command>;
  afterExecution?(command: Command, result: CommandResult): Promise<CommandResult>;
  onError?(command: Command, error: FrameworkError): Promise<FrameworkError>;
}

export interface CommandMiddlewareChain {
  add(middleware: CommandMiddleware): void;
  remove(name: string): boolean;
  execute(command: Command, context: ExecutionContext): Promise<CommandResult>;
}

// ==========================================
// 型ガード
// ==========================================

export function isAnalyzeCommand(command: Command): command is AnalyzeCommand {
  return command.name === 'analyze';
}

export function isImplementCommand(command: Command): command is ImplementCommand {
  return command.name === 'implement';
}

export function isBuildCommand(command: Command): command is BuildCommand {
  return command.name === 'build';
}

export function isCommandResult(value: unknown): value is CommandResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'commandId' in value &&
    'success' in value &&
    'output' in value &&
    typeof (value as CommandResult).success === 'boolean'
  );
}

export function isCommandCategory(value: unknown): value is CommandCategory {
  return typeof value === 'string' && Object.values(CommandCategory).includes(value as CommandCategory);
}

export function isCommandPriority(value: unknown): value is CommandPriority {
  return typeof value === 'string' && Object.values(CommandPriority).includes(value as CommandPriority);
}

export function isBuildMode(value: unknown): value is BuildMode {
  return typeof value === 'string' && Object.values(BuildMode).includes(value as BuildMode);
}

export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return typeof value === 'string' && Object.values(ExecutionStatus).includes(value as ExecutionStatus);
}

export function isAttachmentType(value: unknown): value is AttachmentType {
  return typeof value === 'string' && Object.values(AttachmentType).includes(value as AttachmentType);
}

// ==========================================
// ファクトリー関数
// ==========================================

export function createExecutionContext(
  sessionId: SessionId,
  workingDirectory: string,
  user: UserContext,
  project: ProjectContext
): ExecutionContext {
  // Create a safe copy of process.env with proper typing
  const envVariables: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    envVariables[key] = value;
  }
  
  return {
    sessionId,
    workingDirectory,
    user,
    project,
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: Date.now() as Timestamp,
      variables: Object.freeze(envVariables) as DeepReadonly<Record<string, string | undefined>>
    }
  };
}