/**
 * エラー関連の型定義
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export abstract class FrameworkError extends Error {
  abstract readonly code: string;
  abstract readonly severity: ErrorSeverity;
  abstract readonly recoverable: boolean;
  
  public readonly timestamp: Date;
  public readonly context?: Record<string, any> | undefined;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): ErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

export interface ErrorJSON {
  name: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: string;
  context?: Record<string, any> | undefined;
  stack?: string | undefined;
}

export class CommandError extends FrameworkError {
  readonly code = 'COMMAND_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;
}

export class PersonaError extends FrameworkError {
  readonly code = 'PERSONA_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export class IntegrationError extends FrameworkError {
  readonly code = 'INTEGRATION_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = false;
}

export class ConfigurationError extends FrameworkError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;
}

export class ValidationError extends FrameworkError {
  readonly code = 'VALIDATION_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export class PermissionError extends FrameworkError {
  readonly code = 'PERMISSION_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = false;
}

export class CacheError extends FrameworkError {
  readonly code = 'CACHE_ERROR';
  readonly severity = 'low' as const;
  readonly recoverable = true;
}

export class NetworkError extends FrameworkError {
  readonly code = 'NETWORK_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export class FileSystemError extends FrameworkError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;
}

export class TimeoutError extends FrameworkError {
  readonly code = 'TIMEOUT_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export interface ErrorHandler {
  handle(error: FrameworkError): Promise<ErrorHandlingResult>;
  canHandle(error: FrameworkError): boolean;
}

export interface ErrorHandlingResult {
  handled: boolean;
  recovery?: RecoveryAction;
  userMessage?: string;
  logMessage?: string;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'ignore' | 'escalate';
  details?: Record<string, any>;
}

export interface ErrorReport {
  error: FrameworkError;
  context: ErrorContext;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface ErrorContext {
  command?: string;
  persona?: string;
  projectPath?: string;
  userId?: string;
  sessionId?: string;
  version: string;
}

// ペルソナ関連エラー
export class PersonaRegistrationError extends FrameworkError {
  readonly code = 'PERSONA_REGISTRATION_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export class PersonaSelectionError extends FrameworkError {
  readonly code = 'PERSONA_SELECTION_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;
}

export class PersonaActivationError extends FrameworkError {
  readonly code = 'PERSONA_ACTIVATION_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;
}