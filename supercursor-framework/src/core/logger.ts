/**
 * ログシステム
 */

import { writeFile, existsSync, mkdirSync } from 'fs-extra';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { LogLevel } from '../types';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  outputToFile: boolean;
  filePath?: string;
  outputToConsole: boolean;
  colorOutput: boolean;
  includeTimestamp: boolean;
  includeContext: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private logLevels = ['error', 'warn', 'info', 'debug', 'verbose'] as const;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      outputToFile: false,
      outputToConsole: true,
      colorOutput: true,
      includeTimestamp: true,
      includeContext: true,
      ...config,
    };

    if (this.config.outputToFile && this.config.filePath) {
      this.setupFileLogging();
    }

    // バッファーを定期的にフラッシュ
    this.flushInterval = setInterval(() => {
      this.flushBuffer().catch(error => {
        console.error('ログバッファのフラッシュに失敗しました:', error);
      });
    }, 5000);
  }

  /**
   * エラーレベルのログ
   */
  public error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * 警告レベルのログ
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * 情報レベルのログ
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * デバッグレベルのログ
   */
  public debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * 詳細レベルのログ
   */
  public verbose(message: string, context?: Record<string, any>): void {
    this.log('verbose', message, context);
  }

  /**
   * ログレベルを設定
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * ログ設定を更新
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.outputToFile && this.config.filePath) {
      this.setupFileLogging();
    }
  }

  /**
   * ログバッファを強制フラッシュ
   */
  public async flush(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * ロガーのクリーンアップ
   */
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.flushBuffer().catch(error => {
      console.error('最終ログフラッシュに失敗しました:', error);
    });
  }

  /**
   * メインのログ処理
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    const levelIndex = this.logLevels.indexOf(level);
    const configLevelIndex = this.logLevels.indexOf(this.config.level);

    // ログレベルをチェック
    if (levelIndex > configLevelIndex) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: context || undefined,
      error: error || undefined,
    };

    // コンソール出力
    if (this.config.outputToConsole) {
      this.outputToConsole(logEntry);
    }

    // ファイル出力のためにバッファに追加
    if (this.config.outputToFile) {
      this.logBuffer.push(logEntry);
    }
  }

  /**
   * コンソールに出力
   */
  private outputToConsole(entry: LogEntry): void {
    let output = '';

    // タイムスタンプ
    if (this.config.includeTimestamp) {
      const timestamp = entry.timestamp.toISOString();
      output += this.config.colorOutput ? chalk.gray(`[${timestamp}]`) : `[${timestamp}]`;
      output += ' ';
    }

    // レベル
    const levelStr = entry.level.toUpperCase().padEnd(7);
    if (this.config.colorOutput) {
      switch (entry.level) {
        case 'error':
          output += chalk.red(levelStr);
          break;
        case 'warn':
          output += chalk.yellow(levelStr);
          break;
        case 'info':
          output += chalk.blue(levelStr);
          break;
        case 'debug':
          output += chalk.magenta(levelStr);
          break;
        case 'verbose':
          output += chalk.gray(levelStr);
          break;
      }
    } else {
      output += levelStr;
    }

    output += ' ';

    // メッセージ
    output += entry.message;

    // コンテキスト
    if (this.config.includeContext && entry.context) {
      const contextStr = JSON.stringify(entry.context, null, 2);
      output += '\\n' + (this.config.colorOutput ? chalk.gray(contextStr) : contextStr);
    }

    // エラー
    if (entry.error) {
      output += '\\n' + (this.config.colorOutput ? chalk.red(entry.error.stack || entry.error.message) : entry.error.stack || entry.error.message);
    }

    console.log(output);
  }

  /**
   * ファイルログの設定
   */
  private setupFileLogging(): void {
    if (!this.config.filePath) {
      return;
    }

    const logDir = dirname(this.config.filePath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * ログバッファをファイルにフラッシュ
   */
  private async flushBuffer(): Promise<void> {
    if (!this.config.outputToFile || !this.config.filePath || this.logBuffer.length === 0) {
      return;
    }

    let savedEntries: LogEntry[] = [];
    try {
      savedEntries = this.logBuffer.splice(0, this.logBuffer.length);
      const logLines = savedEntries.map(entry => this.formatLogEntryForFile(entry));
      const logContent = logLines.join('\n') + '\n';

      // ファイルに追記
      await writeFile(this.config.filePath, logContent, { flag: 'a', encoding: 'utf8' });
    } catch (error) {
      console.error('ログファイルの書き込みに失敗しました:', error);
      // ログエントリを戻す（次回のフラッシュで再試行）
      this.logBuffer.unshift(...savedEntries);
    }
  }

  /**
   * ログエントリをファイル用にフォーマット
   */
  private formatLogEntryForFile(entry: LogEntry): string {
    const parts: string[] = [];

    parts.push(`[${entry.timestamp.toISOString()}]`);
    parts.push(`[${entry.level.toUpperCase().padEnd(7)}]`);
    parts.push(entry.message);

    if (entry.context) {
      parts.push(`Context: ${JSON.stringify(entry.context)}`);
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.stack || entry.error.message}`);
    }

    return parts.join(' ');
  }
}

// グローバルロガーインスタンス
let globalLogger: Logger | null = null;

/**
 * グローバルロガーを取得
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * グローバルロガーを設定
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}