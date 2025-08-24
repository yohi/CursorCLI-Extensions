/**
 * SuperCursor Framework - Cursor API アダプター
 * Framework-2のCursor API統合をアダプターパターンで実装
 */

import { spawn, SpawnOptions } from 'child_process';
import { promises as fsPromises } from 'fs';

import { Injectable, Logger } from '@nestjs/common';

import {
  FrameworkError,
  DeepReadonly,
  ErrorSeverity
} from '../../domain/types/index.js';

/**
 * Cursor API 設定
 */
export interface CursorApiConfig {
  readonly cursorPath: string;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly workingDirectory: string;
  readonly enableLogging: boolean;
}

/**
 * Cursor コマンドオプション
 */
export interface CursorCommandOptions {
  readonly timeout?: number;
  readonly workingDirectory?: string;
  readonly environment?: DeepReadonly<Record<string, string>>;
  readonly encoding?: BufferEncoding;
}

/**
 * Cursor コマンド結果
 */
export interface CursorCommandResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly metadata: {
    readonly executionTime: number;
    readonly tokensUsed: number;
    readonly model: string;
    readonly exitCode?: number;
  };
}

/**
 * Cursor API エラー
 */
export class CursorApiError extends FrameworkError {
  public readonly code = 'CURSOR_API_ERROR';
  public readonly severity = ErrorSeverity.HIGH;
  public readonly recoverable = true;

  constructor(
    message: string,
    public readonly commandOutput?: string,
    public readonly exitCode?: number
  ) {
    super(message);
  }
}

export class CursorTimeoutError extends FrameworkError {
  public readonly code = 'CURSOR_TIMEOUT_ERROR';
  public readonly severity = ErrorSeverity.HIGH;
  public readonly recoverable = false;
  
  constructor(message: string, public readonly timeout: number) {
    super(message);
  }
}

export class CursorNotFoundError extends FrameworkError {
  public readonly code = 'CURSOR_NOT_FOUND_ERROR';
  public readonly severity = ErrorSeverity.CRITICAL;
  public readonly recoverable = false;
}

/**
 * Cursor API アダプター
 * 
 * Framework-2のCursorAPIIntegrationをNestJSアーキテクチャに適合させ、
 * 外部システムとの統合ポイントとして機能
 */
@Injectable()
export class CursorApiAdapter {
  private readonly logger = new Logger(CursorApiAdapter.name);
  private readonly config: CursorApiConfig;

  constructor(config: Partial<CursorApiConfig> = {}) {
    this.config = {
      cursorPath: process.env.CURSOR_PATH ?? 'cursor',
      timeout: parseInt(process.env.CURSOR_TIMEOUT ?? '30000'),
      retryAttempts: parseInt(process.env.CURSOR_RETRY_ATTEMPTS ?? '3'),
      workingDirectory: process.cwd(),
      enableLogging: process.env.CURSOR_ENABLE_LOGGING !== 'false',
      ...config
    };
  }

  /**
   * Cursor コマンドを実行
   */
  async executeCommand(
    command: string,
    options: CursorCommandOptions = {}
  ): Promise<CursorCommandResult> {
    const startTime = Date.now();
    
    if (this.config.enableLogging) {
      this.logger.log(`Executing Cursor command: ${command}`);
    }

    const timeout = options.timeout ?? this.config.timeout;
    const maxRetries = this.config.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.runSingleCommand(command, options, timeout);
        
        if (result.success) {
          const executionTime = Date.now() - startTime;
          
          if (this.config.enableLogging) {
            this.logger.log(`Cursor command completed successfully in ${executionTime}ms`);
          }

          return {
            ...result,
            metadata: {
              ...result.metadata,
              executionTime
            }
          };
        } else {
          // コマンドは実行されたが失敗した場合、即座に結果を返す
          return result;
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.warn(`Cursor command failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${lastError.message}`);
          await this.sleep(delay);
        }
      }
    }

    // すべてのリトライが失敗した場合
    const executionTime = Date.now() - startTime;
    const errorMessage = `Cursor command failed after ${maxRetries + 1} attempts (${executionTime}ms): ${lastError?.message ?? 'Unknown error'}`;
    
    this.logger.error(errorMessage);
    throw new CursorApiError(errorMessage, lastError?.message);
  }

  /**
   * Cursor の利用可能性をチェック
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const result = await this.executeCommand('--version', { timeout: 5000 });
      return result.success;
    } catch (error) {
      if (error instanceof CursorNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * ファイルを開く
   */
  async openFile(filePath: string, options: CursorCommandOptions = {}): Promise<CursorCommandResult> {
    const command = `"${filePath}"`;
    return this.executeCommand(command, options);
  }

  /**
   * プロジェクトを開く
   */
  async openProject(projectPath: string, options: CursorCommandOptions = {}): Promise<CursorCommandResult> {
    const command = `"${projectPath}"`;
    return this.executeCommand(command, options);
  }

  /**
   * 新しいファイルを作成
   */
  async createFile(filePath: string, content?: string, options: CursorCommandOptions = {}): Promise<CursorCommandResult> {
    try {
      if (content !== undefined) {
        // ファイルに内容を書き込み
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fsPromises.writeFile(filePath, content, { encoding: options.encoding ?? 'utf8' });
      }
      
      // Cursorでファイルを開く
      return this.openFile(filePath, options);
    } catch (error) {
      throw new CursorApiError(`Failed to create file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): DeepReadonly<CursorApiConfig> {
    return this.config;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const result = await this.executeCommand('--version', { timeout: 5000 });
      
      return {
        available: result.success,
        version: result.output.trim(),
        error: result.error
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // プライベートメソッド

  private async runSingleCommand(
    command: string,
    options: CursorCommandOptions,
    timeout: number
  ): Promise<CursorCommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const spawnOptions: SpawnOptions = {
        cwd: options.workingDirectory ?? this.config.workingDirectory,
        env: {
          ...process.env,
          ...options.environment
        },
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      };

      // コマンドを分割
      const args = this.parseCommand(command);
      const child = spawn(this.config.cursorPath, args, spawnOptions);

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killTimeoutId: NodeJS.Timeout | undefined;

      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        
        killTimeoutId = setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // 出力の収集
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString(options.encoding ?? 'utf8');
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString(options.encoding ?? 'utf8');
        });
      }

      // エラーハンドリング
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);
        
        if (error.message.includes('ENOENT')) {
          reject(new CursorNotFoundError(`Cursor executable not found: ${this.config.cursorPath}`));
        } else {
          reject(new CursorApiError(`Process error: ${error.message}`));
        }
      });

      // プロセス終了時の処理
      child.on('close', (code, _signal) => {
        clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);
        
        if (timedOut) {
          reject(new CursorTimeoutError(`Command timed out after ${timeout}ms`, timeout));
          return;
        }

        const executionTime = Date.now() - startTime;
        const success = code === 0;
        
        resolve({
          success,
          output: stdout,
          error: success ? undefined : stderr ?? `Process exited with code ${code}`,
          metadata: {
            executionTime,
            tokensUsed: this.estimateTokenUsage(command, stdout),
            model: 'cursor-cli',
            exitCode: code ?? 0
          }
        });
      });
    });
  }

  private parseCommand(command: string): string[] {
    // シンプルなコマンド解析（実際のシェル解析より簡略化）
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const char = command[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          args.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  private calculateRetryDelay(attempt: number): number {
    // 指数バックオフ（上限5秒）
    const baseDelay = 300;
    const maxDelay = 5000;
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private estimateTokenUsage(command: string, output: string): number {
    // トークン使用量の概算（実際のAPIトークンではないため簡易計算）
    const commandTokens = Math.ceil(command.length / 4);
    const outputTokens = Math.ceil(output.length / 4);
    return commandTokens + outputTokens;
  }
}