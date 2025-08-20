/**
 * SuperCursor Framework - 基本型定義
 * Framework-1とFramework-2の型定義を統合し、NestJSベストプラクティスを適用
 */

import { randomBytes } from 'node:crypto';

// ==========================================
// ブランド型定義 (型安全性強化)
// ==========================================

export type CommandId = string & { readonly __brand: unique symbol };
export type PersonaId = string & { readonly __brand: unique symbol };
export type SessionId = string & { readonly __brand: unique symbol };
export type UserId = string & { readonly __brand: unique symbol };
export type ProjectId = string & { readonly __brand: unique symbol };
export type Timestamp = number & { readonly __brand: unique symbol };

// ==========================================
// ユーティリティ型
// ==========================================

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NonEmptyArray<T> = [T, ...T[]];

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// ==========================================
// 基本列挙型
// ==========================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  STREAM_JSON = 'stream-json',
  MARKDOWN = 'markdown',
  YAML = 'yaml'
}

export enum VerbosityLevel {
  MINIMAL = 'minimal',
  NORMAL = 'normal',
  VERBOSE = 'verbose',
  DEBUG = 'debug'
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  FILE_PATH = 'file_path',
  DIRECTORY_PATH = 'directory_path'
}

// ==========================================
// ベース抽象エラークラス
// ==========================================

export abstract class FrameworkError extends Error {
  abstract readonly code: string;
  abstract readonly severity: ErrorSeverity;
  abstract readonly recoverable: boolean;
  
  public readonly timestamp: Timestamp;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string, 
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now() as Timestamp;
    this.context = context;
    
    // Error.captureStackTrace が存在する場合（Node.js環境）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

// ==========================================
// 具体的エラークラス
// ==========================================

export class ConfigurationError extends FrameworkError {
  public readonly code = 'CONFIGURATION_ERROR';
  public readonly severity = ErrorSeverity.HIGH;
  public readonly recoverable = true;
}

export class ValidationError extends FrameworkError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly severity = ErrorSeverity.MEDIUM;
  public readonly recoverable = true;
}

export class CommandExecutionError extends FrameworkError {
  public readonly code = 'COMMAND_EXECUTION_ERROR';
  public readonly severity = ErrorSeverity.HIGH;
  public readonly recoverable = false;
}

export class PersonaSelectionError extends FrameworkError {
  public readonly code = 'PERSONA_SELECTION_ERROR';
  public readonly severity = ErrorSeverity.MEDIUM;
  public readonly recoverable = true;
}

export class CacheError extends FrameworkError {
  public readonly code = 'CACHE_ERROR';
  public readonly severity = ErrorSeverity.LOW;
  public readonly recoverable = true;
}

export class SecurityError extends FrameworkError {
  public readonly code = 'SECURITY_ERROR';
  public readonly severity = ErrorSeverity.CRITICAL;
  public readonly recoverable = false;
}

// ==========================================
// ベースインターフェース
// ==========================================

export interface BaseEntity<T = string> {
  readonly id: T;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BaseValueObject {
  equals(other: this): boolean;
  toString(): string;
}

export interface Identifiable<T = string> {
  readonly id: T;
}

export interface Timestamped {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Versionable {
  readonly version: string;
}

export interface Cacheable {
  readonly cacheKey: string;
  readonly ttl?: number;
}

// ==========================================
// 検証関連
// ==========================================

export interface ValidationRule {
  readonly pattern?: string | RegExp;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly enum?: readonly unknown[];
  readonly custom?: (value: unknown) => boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly suggestion?: string;
}

// ==========================================
// リソース使用量
// ==========================================

export interface ResourceUsage {
  readonly memory: number;
  readonly cpu: number;
  readonly diskIO: number;
  readonly networkIO: number;
}

// ==========================================
// パフォーマンス指標
// ==========================================

export interface PerformanceMetrics {
  readonly startTime: Timestamp;
  readonly endTime?: Timestamp;
  readonly duration?: number;
  readonly resourceUsage?: ResourceUsage;
  readonly cacheHits?: number;
  readonly cacheMisses?: number;
}

// ==========================================
// 型ガード
// ==========================================

export function isCommandId(value: unknown): value is CommandId {
  return typeof value === 'string' && /^cmd_[a-zA-Z0-9]{16}$/.test(value);
}

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && /^persona_[a-zA-Z0-9]{12}$/.test(value);
}

export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && /^session_[a-zA-Z0-9]{20}$/.test(value);
}

export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && /^user_[a-zA-Z0-9]{12}$/.test(value);
}

export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'number' && value > 0 && Number.isInteger(value);
}

export function isNonEmptyArray<T>(value: T[]): value is NonEmptyArray<T> {
  return Array.isArray(value) && value.length > 0;
}

// ==========================================
// 型ファクトリー関数
// ==========================================

/**
 * 暗号学的に安全な乱数文字列を生成
 * @param len 生成する文字列の長さ
 * @returns hex文字列（[a-f0-9]で構成され、[a-zA-Z0-9]の部分集合として許容される）
 */
function randomString(len: number): string {
  // hexは[a-f0-9]で、正規表現[a-zA-Z0-9]の部分集合として許容されます
  return randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

export function createCommandId(): CommandId {
  return `cmd_${randomString(16)}` as CommandId;
}

export function createPersonaId(): PersonaId {
  return `persona_${randomString(12)}` as PersonaId;
}

export function createSessionId(): SessionId {
  return `session_${randomString(20)}` as SessionId;
}

export function createUserId(): UserId {
  return `user_${randomString(12)}` as UserId;
}

export function createTimestamp(): Timestamp {
  return Date.now() as Timestamp;
}