/**
 * SuperCursor Framework - ファイルシステムアダプター
 * Framework-2のFileSystemHandlerをアダプターパターンで実装
 */

import { promises as fs, constants as fsConstants, Stats, watch, FSWatcher, realpathSync } from 'fs';
import { join, resolve, relative, dirname, isAbsolute } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import {
  FrameworkError
} from '../../domain/types/index.js';

/**
 * ファイルシステム設定
 */
export interface FileSystemConfig {
  readonly allowedPaths: readonly string[];
  readonly deniedPaths: readonly string[];
  readonly maxFileSize: number;
  readonly enableWatching: boolean;
  readonly watchIgnorePatterns: readonly string[];
  readonly maxWatchers: number;
}

/**
 * ディレクトリエントリ
 */
export interface DirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly type: 'file' | 'directory' | 'symlink';
  readonly size: number;
  readonly lastModified: Date;
  readonly permissions: FilePermissions;
}

/**
 * ディレクトリリスト
 */
export interface DirectoryListing {
  readonly path: string;
  readonly entries: readonly DirectoryEntry[];
  readonly totalSize: number;
  readonly fileCount: number;
  readonly directoryCount: number;
}

/**
 * ファイル権限
 */
export interface FilePermissions {
  readonly readable: boolean;
  readonly writable: boolean;
  readonly executable: boolean;
  readonly mode: number;
}

/**
 * ファイル変更イベント
 * 
 * 注意: Node.jsのfs.watchは'rename'イベントをファイルの作成、削除、リネームで発生させるため、
 * 実装では'renamed'タイプが包括的なファイルシステム変更を表します。
 * より詳細な判定が必要な場合は、呼び出し元で追加の検証を行ってください。
 */
export interface FileChangeEvent {
  readonly type: 'created' | 'modified' | 'deleted' | 'renamed';
  readonly path: string;
  readonly timestamp: Date;
  readonly oldPath?: string; // renamed の場合
}

/**
 * ファイル監視コールバック
 */
export type FileWatchCallback = (event: FileChangeEvent) => void;

/**
 * ファイルシステムエラー
 */
export class FileSystemError extends FrameworkError {
  public readonly code = 'FILE_SYSTEM_ERROR';
  public readonly severity = 'medium' as const;
  public readonly recoverable = true;
}

export class FilePermissionError extends FileSystemError {
  public readonly code = 'FILE_PERMISSION_ERROR';
  public readonly severity = 'high' as const;
}

export class FileNotFoundError extends FileSystemError {
  public readonly code = 'FILE_NOT_FOUND_ERROR';
}

export class FileSizeExceededError extends FileSystemError {
  public readonly code = 'FILE_SIZE_EXCEEDED_ERROR';
}

export class PathNotAllowedError extends FileSystemError {
  public readonly code = 'PATH_NOT_ALLOWED_ERROR';
  public readonly severity = 'high' as const;
}

/**
 * ファイルシステムアダプター
 * 
 * Framework-2のFileSystemHandlerをNestJSアーキテクチャに適合させ、
 * セキュリティとパフォーマンスを強化した実装
 */
@Injectable()
export class FileSystemAdapter {
  private readonly logger = new Logger(FileSystemAdapter.name);
  private readonly config: FileSystemConfig;
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly watchCallbacks = new Map<string, FileWatchCallback>();

  constructor(config: Partial<FileSystemConfig> = {}) {
    this.config = {
      allowedPaths: [process.cwd()],
      deniedPaths: ['/etc', '/usr', '/bin', '/sbin', '/var'],
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760'), // 10MB
      enableWatching: process.env.ENABLE_FILE_WATCHING !== 'false',
      watchIgnorePatterns: ['node_modules', '.git', 'dist', 'build'],
      maxWatchers: parseInt(process.env.MAX_FILE_WATCHERS ?? '100'),
      ...config
    };
  }

  /**
   * ファイルを読み取り
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const absolutePath = this.resolvePath(filePath);
    
    // セキュリティチェック
    this.validatePath(absolutePath);
    
    try {
      // ファイル存在・権限チェック
      await this.checkFileAccess(absolutePath, fsConstants.R_OK);
      
      // ファイルサイズチェック
      const stats = await fs.stat(absolutePath);
      if (stats.size > this.config.maxFileSize) {
        throw new FileSizeExceededError(`File size exceeds limit: ${stats.size} > ${this.config.maxFileSize}`);
      }
      
      const content = await fs.readFile(absolutePath, encoding);
      
      this.logger.debug(`File read successfully: ${filePath} (${stats.size} bytes)`);
      return content;
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      const nodeError = error as NodeJS.ErrnoException | undefined;
      if (nodeError?.code === 'ENOENT') {
        throw new FileNotFoundError(`File not found: ${filePath}`);
      } else if (nodeError?.code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${filePath}`);
      } else {
        throw new FileSystemError(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * ファイルに書き込み
   */
  async writeFile(
    filePath: string,
    content: string,
    options: {
      encoding?: BufferEncoding;
      createDirectories?: boolean;
      backup?: boolean;
    } = {}
  ): Promise<void> {
    const absolutePath = this.resolvePath(filePath);
    
    // セキュリティチェック
    this.validatePath(absolutePath);
    
    const {
      encoding = 'utf8',
      createDirectories = false,
      backup = false
    } = options;

    try {
      // ディレクトリ作成
      if (createDirectories) {
        const dir = dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });
      }

      // バックアップ作成
      if (backup && await this.exists(absolutePath)) {
        const backupPath = `${absolutePath}.bak.${Date.now()}`;
        await fs.copyFile(absolutePath, backupPath);
        this.logger.debug(`Backup created: ${backupPath}`);
      }

      // サイズチェック
      const contentSize = Buffer.byteLength(content, encoding);
      if (contentSize > this.config.maxFileSize) {
        throw new FileSizeExceededError(`Content size exceeds limit: ${contentSize} > ${this.config.maxFileSize}`);
      }

      await fs.writeFile(absolutePath, content, encoding);
      
      this.logger.debug(`File written successfully: ${filePath} (${contentSize} bytes)`);
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      const nodeError = error as NodeJS.ErrnoException | undefined;
      if (nodeError?.code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${filePath}`);
      } else if (nodeError?.code === 'ENOENT') {
        throw new FileSystemError(`Directory not found: ${dirname(filePath)}`);
      } else {
        throw new FileSystemError(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * ディレクトリをリスト
   */
  async listDirectory(dirPath: string, options: {
    recursive?: boolean;
    includeHidden?: boolean;
    sortBy?: 'name' | 'size' | 'modified';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<DirectoryListing> {
    const absolutePath = this.resolvePath(dirPath);
    
    // セキュリティチェック
    this.validatePath(absolutePath);
    
    const {
      recursive = false,
      includeHidden = false,
      sortBy = 'name',
      sortOrder = 'asc'
    } = options;

    try {
      await this.checkFileAccess(absolutePath, fsConstants.R_OK);
      
      const entries: DirectoryEntry[] = [];
      const items = await fs.readdir(absolutePath);
      
      for (const item of items) {
        // 隠しファイルのスキップ
        if (!includeHidden && item.startsWith('.')) {
          continue;
        }
        
        const itemPath = join(absolutePath, item);
        const stats = await fs.lstat(itemPath);
        const permissions = await this.getFilePermissions(itemPath, stats);
        
        const entry: DirectoryEntry = {
          name: item,
          path: relative(process.cwd(), itemPath),
          type: this.getFileType(stats),
          size: stats.size,
          lastModified: stats.mtime,
          permissions
        };
        
        entries.push(entry);
        
        // 再帰的な処理 (シンボリックリンクは無限ループ防止のためスキップ)
        if (recursive && stats.isDirectory() && !stats.isSymbolicLink() && permissions.readable) {
          try {
            const subListing = await this.listDirectory(itemPath, { ...options, recursive: true });
            entries.push(...subListing.entries);
          } catch (error) {
            this.logger.warn(`Failed to list subdirectory: ${itemPath}`, error instanceof Error ? error.message : String(error));
          }
        }
      }
      
      // ソート
      this.sortEntries(entries, sortBy, sortOrder);
      
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      const fileCount = entries.filter(entry => entry.type === 'file').length;
      const directoryCount = entries.filter(entry => entry.type === 'directory').length;
      
      return {
        path: relative(process.cwd(), absolutePath),
        entries,
        totalSize,
        fileCount,
        directoryCount
      };
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      const nodeError = error as NodeJS.ErrnoException | undefined;
      if (nodeError?.code === 'ENOENT') {
        throw new FileNotFoundError(`Directory not found: ${dirPath}`);
      } else if (nodeError?.code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${dirPath}`);
      } else {
        throw new FileSystemError(`Failed to list directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * ファイル・ディレクトリ削除
   */
  async delete(
    path: string,
    options: {
      recursive?: boolean;
      force?: boolean;
    } = {}
  ): Promise<void> {
    const absolutePath = this.resolvePath(path);
    
    // セキュリティチェック
    this.validatePath(absolutePath);
    
    const { recursive = false, force = false } = options;

    try {
      const stats = await fs.lstat(absolutePath);
      
      if (stats.isSymbolicLink()) {
        await fs.unlink(absolutePath);
      } else if (stats.isDirectory()) {
        if (recursive) {
          await fs.rm(absolutePath, { recursive: true, force });
        } else {
          await fs.rm(absolutePath, { recursive: false });
        }
      } else {
        await fs.unlink(absolutePath);
      }
      
      this.logger.debug(`Deleted successfully: ${path}`);
      
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      
      if (code === 'ENOENT' && force) {
        // forceモードでファイルが存在しない場合は成功とみなす
        return;
      }
      
      if (code === 'ENOENT') {
        throw new FileNotFoundError(`Path not found: ${path}`);
      } else if (code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${path}`);
      } else if (code === 'ENOTEMPTY') {
        throw new FileSystemError(`Directory not empty: ${path}. Use recursive option.`);
      } else {
        throw new FileSystemError(`Failed to delete: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * ディレクトリ作成
   */
  async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    const absolutePath = this.resolvePath(dirPath);
    
    // セキュリティチェック
    this.validatePath(absolutePath);
    
    try {
      await fs.mkdir(absolutePath, { recursive });
      this.logger.debug(`Directory created: ${dirPath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException | undefined;
      if (nodeError?.code === 'EEXIST') {
        // ディレクトリが既に存在する場合は成功とみなす
        return;
      }
      
      if (nodeError?.code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${dirPath}`);
      } else {
        throw new FileSystemError(`Failed to create directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * ファイル・ディレクトリの存在確認
   */
  async exists(path: string): Promise<boolean> {
    try {
      const absolutePath = this.resolvePath(path);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイル監視を開始
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async watchFile(
    path: string,
    callback: FileWatchCallback,
    options: {
      recursive?: boolean;
      ignorePatterns?: string[];
    } = {}
  ): Promise<string> {
    if (!this.config.enableWatching) {
      throw new FileSystemError('File watching is disabled');
    }
    
    if (this.watchers.size >= this.config.maxWatchers) {
      throw new FileSystemError(`Maximum number of watchers exceeded: ${this.config.maxWatchers}`);
    }
    
    const absolutePath = this.resolvePath(path);
    this.validatePath(absolutePath);
    
    const watchId = `${absolutePath}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const { recursive = false, ignorePatterns = [] } = options;
    
    try {
      const watcher = watch(absolutePath, { recursive }, (eventType, filename) => {
        if (!filename) return;
        
        // パターンマッチング
        const shouldIgnore = [...this.config.watchIgnorePatterns, ...ignorePatterns]
          .some(pattern => filename.includes(pattern));
          
        if (shouldIgnore) return;
        
        const event: FileChangeEvent = {
          type: eventType === 'rename' ? 'renamed' : 'modified',
          path: join(absolutePath, filename),
          timestamp: new Date()
        };
        
        callback(event);
      });
      
      this.watchers.set(watchId, watcher);
      this.watchCallbacks.set(watchId, callback);
      
      // 重要: errorイベントのハンドリング（未処理でプロセス落ち防止）
      watcher.on('error', (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`File watcher error (${watchId}): ${msg}`);
        // ベストエフォートでクリーンアップ
        this.unwatchFile(watchId).catch(() => {});
      });
      
      this.logger.debug(`File watcher started: ${path} (${watchId})`);
      return watchId;
      
    } catch (error) {
      throw new FileSystemError(`Failed to start file watcher: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * ファイル監視を停止
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async unwatchFile(watchId: string): Promise<boolean> {
    const watcher = this.watchers.get(watchId);
    
    if (!watcher) {
      return false;
    }
    
    try {
      watcher.close();
      this.watchers.delete(watchId);
      this.watchCallbacks.delete(watchId);
      
      this.logger.debug(`File watcher stopped: ${watchId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop file watcher: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * すべてのファイル監視を停止
   */
  async stopAllWatchers(): Promise<void> {
    const watchIds = Array.from(this.watchers.keys());
    
    for (const watchId of watchIds) {
      await this.unwatchFile(watchId);
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): Readonly<FileSystemConfig> {
    return this.config;
  }

  // プライベートメソッド

  private resolvePath(path: string): string {
    return resolve(path);
  }

  private validatePath(absolutePath: string): void {
    const norm = (p: string) => resolve(p);
    const safeReal = (p: string) => {
      try { return realpathSync(p); } catch { return p; } // 未存在パスはそのまま
    };
    const target = norm(absolutePath);
    const targetReal = safeReal(target);

    const isWithin = (base: string, p: string) => {
      const baseNorm = norm(base);
      const rel = relative(baseNorm, p);
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    };
    const isWithinRealBase = (base: string, p: string) => {
      const baseReal = safeReal(norm(base));
      const rel = relative(baseReal, p);
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    };

    // 許可チェック
    const isAllowedByPath = this.config.allowedPaths.some(base => isWithin(base, target));
    const isAllowedByReal = this.config.allowedPaths.some(base => isWithinRealBase(base, targetReal));
    // realpathが解決できた（=既存パス等）場合は実パス側の包含も必須
    const requireRealCheck = targetReal !== target;
    const isAllowed = isAllowedByPath && (!requireRealCheck || isAllowedByReal);
    if (!isAllowed) {
      throw new PathNotAllowedError(`Path not allowed: ${absolutePath}`);
    }

    // 拒否チェック（論理 or 実パスのどちらかがマッチで拒否）
    const isDenied = this.config.deniedPaths.some(base =>
      isWithin(base, target) || isWithinRealBase(base, targetReal)
    );
    if (isDenied) {
      throw new PathNotAllowedError(`Path denied: ${absolutePath}`);
    }
  }

  private async checkFileAccess(path: string, mode: number): Promise<void> {
    try {
      await fs.access(path, mode);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException | undefined;
      if (nodeError?.code === 'ENOENT') {
        throw new FileNotFoundError(`Path not found: ${path}`);
      } else if (nodeError?.code === 'EACCES') {
        throw new FilePermissionError(`Permission denied: ${path}`);
      } else {
        throw new FileSystemError(`Access check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async getFilePermissions(path: string, stats?: Stats): Promise<FilePermissions> {
    if (!stats) {
      stats = await fs.stat(path);
    }
    
    const mode = stats.mode;
    
    return {
      readable: !!(mode & fsConstants.S_IRUSR),
      writable: !!(mode & fsConstants.S_IWUSR),
      executable: !!(mode & fsConstants.S_IXUSR),
      mode
    };
  }

  private getFileType(stats: Stats): 'file' | 'directory' | 'symlink' {
    if (stats.isSymbolicLink()) return 'symlink';
    if (stats.isDirectory()) return 'directory';
    return 'file';
  }

  private sortEntries(
    entries: DirectoryEntry[],
    sortBy: 'name' | 'size' | 'modified',
    sortOrder: 'asc' | 'desc'
  ): void {
    entries.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = a.lastModified.getTime() - b.lastModified.getTime();
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}