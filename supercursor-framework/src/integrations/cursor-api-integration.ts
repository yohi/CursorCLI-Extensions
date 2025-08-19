/**
 * Cursor API統合
 */

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { promisify } from 'util';
import { access, readFile, writeFile } from 'fs-extra';
import { 
  CursorIntegration,
  CursorOptions,
  CursorResult,
  FileContent,
  WriteOptions,
  WriteResult,
  SearchScope,
  SearchResult,
  ProjectContext,
  IntegrationError,
  TimeoutError,
  FileSystemError
} from '../types';
import { getLogger } from '../core/logger';

export interface CursorAPIConfig {
  cursorPath: string;
  timeout: number;
  retryAttempts: number;
  workingDirectory?: string;
}

export class CursorAPIIntegration implements CursorIntegration {
  private config: CursorAPIConfig;

  constructor(config: Partial<CursorAPIConfig> = {}) {
    this.config = {
      cursorPath: 'cursor',
      timeout: 30000,
      retryAttempts: 3,
      workingDirectory: process.cwd(),
      ...config,
    };
  }

  /**
   * Cursorコマンドを実行
   */
  public async executeCommand(command: string, options: CursorOptions = {}): Promise<CursorResult> {
    const startTime = Date.now();
    const logger = getLogger();
    
    const timeout = options.timeout || this.config.timeout;
    const maxRetries = this.config.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Cursorコマンドを実行中', { command, options, attempt, maxRetries });

        const result = await this.runCursorCommand(command, timeout);

        if (result.success) {
          const executionTime = Date.now() - startTime;
          
          logger.info('Cursorコマンドの実行が完了', { 
            command, 
            success: result.success, 
            executionTime,
            attempt 
          });

          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: {
              executionTime,
              tokensUsed: this.estimateTokenUsage(command, result.output),
              model: 'cursor-cli',
            },
          };
        } else {
          // コマンドは実行されたが失敗した場合、リトライせずに即座に結果を返す
          const executionTime = Date.now() - startTime;
          return {
            success: false,
            output: result.output,
            error: result.error,
            metadata: {
              executionTime,
              tokensUsed: 0,
              model: 'cursor-cli',
            },
          };
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const baseDelay = 300; // 300ms
          const delay = baseDelay * Math.pow(2, attempt);
          logger.warn('Cursorコマンドが失敗しました。リトライします', { 
            command, 
            attempt: attempt + 1, 
            maxRetries: maxRetries + 1,
            delay,
            error: lastError.message 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 全てのリトライが失敗した場合
    const executionTime = Date.now() - startTime;
    const errorMessage = lastError?.message || 'Unknown error';

    logger.error('Cursorコマンドの実行に失敗（リトライ終了）', { command, error: errorMessage });

    return {
      success: false,
      output: '',
      error: errorMessage,
      metadata: {
        executionTime,
        tokensUsed: 0,
        model: 'cursor-cli',
      },
    };
  }

  /**
   * ファイルを読み込み
   */
  public async readFile(path: string): Promise<FileContent> {
    const logger = getLogger();
    
    try {
      logger.debug('ファイルを読み込み中', { path });

      // ファイルの存在確認
      await access(path);

      // ファイル情報を取得
      const { stat } = await import('fs-extra');
      const stats = await stat(path);
      
      if (stats.size > 10 * 1024 * 1024) { // 10MB制限
        throw new FileSystemError(`ファイルサイズが制限を超えています: ${path}`);
      }

      // ファイル内容を読み込み
      const content = await readFile(path, 'utf8');

      return {
        path,
        content,
        encoding: 'utf8',
        size: stats.size,
        lastModified: stats.mtime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ファイル読み込みに失敗', { path, error: errorMessage });
      throw new FileSystemError(`ファイル読み込みに失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * ファイルを書き込み
   */
  public async writeFile(
    path: string, 
    content: string, 
    options: WriteOptions = {}
  ): Promise<WriteResult> {
    const logger = getLogger();
    
    try {
      logger.debug('ファイルを書き込み中', { path, contentLength: content.length });

      const writeOptions: {encoding: BufferEncoding} = {
        encoding: (options.encoding as BufferEncoding) || 'utf8',
      };

      // ディレクトリが存在しない場合は作成
      if (options.createDirs) {
        const { dirname } = await import('path');
        const { ensureDir } = await import('fs-extra');
        await ensureDir(dirname(path));
      }

      // バックアップの作成
      if (options.backup) {
        try {
          await access(path);
          const backupPath = `${path}.backup.${Date.now()}`;
          const { copyFile } = await import('fs-extra');
          await copyFile(path, backupPath);
          logger.debug('バックアップを作成', { originalPath: path, backupPath });
        } catch {
          // ファイルが存在しない場合は無視
        }
      }

      // ファイルを書き込み
      await writeFile(path, content, writeOptions);

      // 書き込み結果を取得
      const { stat } = await import('fs-extra');
      const stats = await stat(path);

      const result: WriteResult = {
        success: true,
        path,
        size: stats.size,
        checksum: this.calculateChecksum(content),
      };

      logger.info('ファイル書き込み完了', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ファイル書き込みに失敗', { path, error: errorMessage });
      throw new FileSystemError(`ファイル書き込みに失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * コードを検索
   */
  public async searchCode(query: string, scope: SearchScope = {}): Promise<SearchResult[]> {
    const logger = getLogger();
    
    try {
      logger.debug('コード検索中', { query, scope });

      // grep または ripgrepを使用した検索
      const searchCommand = await this.buildSearchCommand(query, scope);
      const result = await this.runShellCommand(searchCommand, this.config.timeout);

      if (!result.success) {
        logger.warn('検索コマンドが失敗', { query, error: result.error });
        return [];
      }

      // 検索結果をパース
      const searchResults = this.parseSearchResults(result.output, query);
      
      logger.info('コード検索完了', { 
        query, 
        resultsCount: searchResults.length 
      });

      return searchResults;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コード検索に失敗', { query, error: errorMessage });
      return [];
    }
  }

  /**
   * プロジェクトコンテキストを取得
   */
  public async getProjectContext(): Promise<ProjectContext> {
    const logger = getLogger();
    
    try {
      logger.debug('プロジェクトコンテキストを取得中');

      // ContextAnalyzerを使用してプロジェクト分析を実行
      const { ContextAnalyzer } = await import('../core/context-analyzer');
      const analyzer = new ContextAnalyzer();
      
      const workingDir = this.config.workingDirectory || process.cwd();
      const context = await analyzer.analyzeProject(workingDir);

      logger.info('プロジェクトコンテキスト取得完了', {
        projectName: context.name,
        projectType: context.type,
        technologiesCount: context.technologies.languages.length
      });

      return context;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('プロジェクトコンテキスト取得に失敗', { error: errorMessage });
      throw new IntegrationError(`プロジェクトコンテキストの取得に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * Cursorコマンドを実行
   */
  private async runCursorCommand(
    command: string, 
    timeout: number
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const args = command.split(' ');
      const childProcess = spawn(this.config.cursorPath, args, {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      } as SpawnOptionsWithoutStdio);

      let stdout = '';
      let stderr = '';

      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        childProcess.kill();
        reject(new TimeoutError(`コマンドがタイムアウトしました: ${command}`));
      }, timeout);

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `コマンドが終了コード ${code} で終了しました`,
          });
        }
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new IntegrationError(`コマンド実行エラー: ${error.message}`));
      });
    });
  }

  /**
   * シェルコマンドを実行
   */
  private async runShellCommand(
    command: string, 
    timeout: number
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellArgs = process.platform === 'win32' ? ['/c'] : ['-c'];
      
      const childProcess = spawn(shell, [...shellArgs, command], {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      } as SpawnOptionsWithoutStdio);

      let stdout = '';
      let stderr = '';

      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        childProcess.kill();
        reject(new TimeoutError(`シェルコマンドがタイムアウトしました: ${command}`));
      }, timeout);

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `シェルコマンドが終了コード ${code} で終了しました`,
          });
        }
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new IntegrationError(`シェルコマンド実行エラー: ${error.message}`));
      });
    });
  }

  /**
   * 検索コマンドを構築
   */
  private async buildSearchCommand(query: string, scope: SearchScope): Promise<string> {
    const parts = ['grep', '-r', '-n', '-H'];

    // 検索対象ディレクトリ
    if (scope.directories && scope.directories.length > 0) {
      parts.push(...scope.directories);
    } else {
      parts.push('.');
    }

    // ファイルタイプフィルタ
    if (scope.fileTypes && scope.fileTypes.length > 0) {
      for (const fileType of scope.fileTypes) {
        parts.push('--include', `*.${fileType}`);
      }
    }

    // 除外パターン
    if (scope.excludePatterns && scope.excludePatterns.length > 0) {
      for (const pattern of scope.excludePatterns) {
        parts.push('--exclude', pattern);
      }
    }

    // 検索クエリ
    parts.push(query);

    return parts.join(' ');
  }

  /**
   * 検索結果をパース
   */
  private parseSearchResults(output: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        const [, file, lineNumber, content] = match;
        const lineNum = parseInt(lineNumber, 10);
        const matchIndex = content.toLowerCase().indexOf(query.toLowerCase());

        if (matchIndex !== -1) {
          results.push({
            file,
            line: lineNum,
            column: matchIndex + 1,
            match: query,
            context: content.trim(),
            score: this.calculateRelevanceScore(content, query),
          });
        }
      }
    }

    // スコアでソート（降順）
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * トークン使用量を推定
   */
  private estimateTokenUsage(input: string, output: string): number {
    // 簡易的な推定（実際の実装では、より正確な計算が必要）
    const inputTokens = Math.ceil(input.length / 4);
    const outputTokens = Math.ceil(output.length / 4);
    return inputTokens + outputTokens;
  }

  /**
   * チェックサムを計算
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content, 'utf8').digest('hex');
  }

  /**
   * 関連性スコアを計算
   */
  private calculateRelevanceScore(content: string, query: string): number {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // 基本スコア：完全一致の場合は高スコア
    let score = 0;
    if (lowerContent.includes(lowerQuery)) {
      score += 10;
    }

    // 単語の境界でのマッチング
    const wordBoundaryRegex = new RegExp(`\\b${lowerQuery}\\b`);
    if (wordBoundaryRegex.test(lowerContent)) {
      score += 5;
    }

    // コンテキストの長さでペナルティ（短いマッチの方が関連性が高い）
    score -= Math.floor(content.length / 100);

    return Math.max(0, score);
  }
}