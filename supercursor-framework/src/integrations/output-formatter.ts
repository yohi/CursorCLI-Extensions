/**
 * 出力フォーマッター - Cursor互換性
 */

import { Transform, Readable } from 'stream';
import { EventEmitter } from 'events';
import { OutputFormat } from '../types';
import { getLogger } from '../core/logger';

export interface OutputFormatterConfig {
  format: OutputFormat;
  enableColors: boolean;
  indentSize: number;
  maxLineLength: number;
  enableProgressIndicators: boolean;
}

export interface ProgressOptions {
  total?: number;
  current?: number;
  message?: string;
  percentage?: number;
}

export interface FormatOptions {
  includeMetadata?: boolean;
  includeTimestamp?: boolean;
  compact?: boolean;
  highlightErrors?: boolean;
}

export class OutputFormatter extends EventEmitter {
  private config: OutputFormatterConfig;
  private progressSpinner: NodeJS.Timeout | null = null;

  constructor(config: Partial<OutputFormatterConfig> = {}) {
    super();
    this.config = {
      format: 'text',
      enableColors: true,
      indentSize: 2,
      maxLineLength: 120,
      enableProgressIndicators: true,
      ...config,
    };
  }

  /**
   * データをフォーマット
   */
  public format(data: any, options: FormatOptions = {}): string {
    const logger = getLogger();
    
    try {
      logger.debug('データをフォーマット中', { 
        format: this.config.format, 
        dataType: typeof data 
      });

      switch (this.config.format) {
        case 'json':
          return this.formatAsJSON(data, options);
        case 'stream-json':
          return this.formatAsStreamJSON(data, options);
        case 'text':
        default:
          return this.formatAsText(data, options);
      }
    } catch (error) {
      logger.error('データフォーマットに失敗', { error });
      return `Error formatting output: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * ストリーム形式で出力
   */
  public createOutputStream(): Transform {
    const formatter = this;
    
    return new Transform({
      objectMode: true,
      transform(chunk: any, encoding: BufferEncoding, callback: Function) {
        try {
          const formatted = formatter.format(chunk);
          this.push(formatted + '\n');
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * プログレス表示を開始
   */
  public startProgress(message: string, options: ProgressOptions = {}): void {
    if (!this.config.enableProgressIndicators) {
      return;
    }

    const logger = getLogger();
    logger.debug('プログレス表示を開始', { message, options });

    this.stopProgress(); // 既存のプログレスを停止

    if (this.config.format === 'text' && process.stdout.isTTY) {
      this.startSpinner(message);
    } else if (this.config.format === 'json' || this.config.format === 'stream-json') {
      this.emitProgress(message, options);
    }
  }

  /**
   * プログレスを更新
   */
  public updateProgress(message: string, options: ProgressOptions = {}): void {
    if (!this.config.enableProgressIndicators) {
      return;
    }

    if (this.config.format === 'json' || this.config.format === 'stream-json') {
      this.emitProgress(message, options);
    } else if (this.config.format === 'text' && process.stdout.isTTY) {
      // スピナーメッセージを更新（実装簡略化）
      process.stdout.write(`\r${this.formatProgressMessage(message, options)}`);
    }
  }

  /**
   * プログレス表示を停止
   */
  public stopProgress(): void {
    if (this.progressSpinner) {
      clearInterval(this.progressSpinner);
      this.progressSpinner = null;
      
      if (this.config.format === 'text' && process.stdout.isTTY) {
        process.stdout.write('\r\x1b[K'); // カーソルを先頭に移動してラインをクリア
      }
    }
  }

  /**
   * エラーメッセージをフォーマット
   */
  public formatError(error: Error | string, context?: Record<string, any>): string {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    switch (this.config.format) {
      case 'json':
      case 'stream-json':
        return JSON.stringify({
          type: 'error',
          message: errorMessage,
          stack: errorStack,
          context,
          timestamp: new Date().toISOString(),
        }, null, this.config.format === 'json' ? this.config.indentSize : undefined);

      case 'text':
      default:
        let formatted = this.config.enableColors 
          ? `\x1b[31mError:\x1b[0m ${errorMessage}`
          : `Error: ${errorMessage}`;

        if (context && Object.keys(context).length > 0) {
          formatted += `\nContext: ${JSON.stringify(context, null, this.config.indentSize)}`;
        }

        if (errorStack && process.env.NODE_ENV === 'development') {
          formatted += `\n${errorStack}`;
        }

        return formatted;
    }
  }

  /**
   * 成功メッセージをフォーマット
   */
  public formatSuccess(message: string, data?: any): string {
    switch (this.config.format) {
      case 'json':
      case 'stream-json':
        return JSON.stringify({
          type: 'success',
          message,
          data,
          timestamp: new Date().toISOString(),
        }, null, this.config.format === 'json' ? this.config.indentSize : undefined);

      case 'text':
      default:
        let formatted = this.config.enableColors 
          ? `\x1b[32m✓\x1b[0m ${message}`
          : `✓ ${message}`;

        if (data) {
          formatted += `\n${this.formatAsText(data)}`;
        }

        return formatted;
    }
  }

  /**
   * テキスト形式でフォーマット
   */
  private formatAsText(data: any, options: FormatOptions = {}): string {
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }

    if (data === null || data === undefined) {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => `${index + 1}. ${this.formatAsText(item)}`).join('\n');
    }

    if (typeof data === 'object') {
      const lines: string[] = [];
      
      if (options.includeTimestamp) {
        lines.push(`Timestamp: ${new Date().toISOString()}`);
      }

      for (const [key, value] of Object.entries(data)) {
        const formattedValue = this.formatAsText(value);
        const indentedValue = formattedValue.replace(/\n/g, '\n' + ' '.repeat(this.config.indentSize));
        lines.push(`${key}: ${indentedValue}`);
      }

      return lines.join('\n');
    }

    return String(data);
  }

  /**
   * JSON形式でフォーマット
   */
  private formatAsJSON(data: any, options: FormatOptions = {}): string {
    const output: any = {};

    if (options.includeTimestamp) {
      output.timestamp = new Date().toISOString();
    }

    if (options.includeMetadata) {
      output.metadata = {
        format: 'json',
        version: '1.0.0',
      };
    }

    output.data = data;

    return JSON.stringify(
      output,
      null,
      options.compact ? undefined : this.config.indentSize
    );
  }

  /**
   * Stream JSON形式でフォーマット
   */
  private formatAsStreamJSON(data: any, options: FormatOptions = {}): string {
    const output: any = {
      type: 'data',
      data,
      timestamp: new Date().toISOString(),
    };

    if (options.includeMetadata) {
      output.metadata = {
        format: 'stream-json',
        version: '1.0.0',
      };
    }

    return JSON.stringify(output);
  }

  /**
   * スピナーを開始
   */
  private startSpinner(message: string): void {
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let currentChar = 0;

    this.progressSpinner = setInterval(() => {
      const spinner = this.config.enableColors 
        ? `\x1b[36m${spinnerChars[currentChar]}\x1b[0m`
        : spinnerChars[currentChar];
      
      process.stdout.write(`\r${spinner} ${message}`);
      currentChar = (currentChar + 1) % spinnerChars.length;
    }, 100);
  }

  /**
   * プログレスイベントを発出
   */
  private emitProgress(message: string, options: ProgressOptions): void {
    const progressData = {
      type: 'progress',
      message,
      timestamp: new Date().toISOString(),
      ...options,
    };

    this.emit('progress', progressData);

    if (this.config.format === 'stream-json') {
      console.log(JSON.stringify(progressData));
    }
  }

  /**
   * プログレスメッセージをフォーマット
   */
  private formatProgressMessage(message: string, options: ProgressOptions): string {
    let formatted = message;

    if (options.percentage !== undefined) {
      const percentage = Math.min(100, Math.max(0, options.percentage));
      const progressBar = this.createProgressBar(percentage);
      formatted += ` ${progressBar} ${percentage.toFixed(1)}%`;
    } else if (options.current !== undefined && options.total !== undefined) {
      const percentage = (options.current / options.total) * 100;
      const progressBar = this.createProgressBar(percentage);
      formatted += ` ${progressBar} ${options.current}/${options.total}`;
    }

    return formatted;
  }

  /**
   * プログレスバーを作成
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const filledChar = this.config.enableColors ? '\x1b[42m \x1b[0m' : '█';
    const emptyChar = this.config.enableColors ? '\x1b[40m \x1b[0m' : '░';
    
    return '[' + filledChar.repeat(filled) + emptyChar.repeat(empty) + ']';
  }
}