/**
 * ファイルシステムハンドラー
 */

import { 
  readdir, 
  stat, 
  readFile, 
  writeFile, 
  unlink, 
  mkdir, 
  rmdir,
  access,
  watch,
  FSWatcher,
  Stats
} from 'fs-extra';
import { join, resolve, relative, dirname, basename } from 'path';
import { EventEmitter } from 'events';
import {
  FileSystemHandler,
  DirectoryListing,
  DirectoryEntry,
  FileChange,
  FileWatchCallback,
  FileWatcher,
  DeleteOptions,
  FilePermissions,
  PermissionError,
  FileSystemError,
  ValidationError
} from '../types';
import { getLogger } from '../core/logger';

export interface FileSystemConfig {
  allowedPaths: string[];
  deniedPaths: string[];
  maxFileSize: number;
  enableWatching: boolean;
  watchIgnorePatterns: string[];
}


export class FileSystemHandlerImpl implements FileSystemHandler {
  private config: FileSystemConfig;
  private watchers = new Map<string, FSWatcher>();
  private watchCallbacks = new Map<string, FileWatchCallback>();

  constructor(config: Partial<FileSystemConfig> = {}) {
    this.config = {
      allowedPaths: ['.'],
      deniedPaths: ['node_modules', '.git', '.DS_Store'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      enableWatching: true,
      watchIgnorePatterns: ['*.tmp', '*.log', 'node_modules/**'],
      ...config,
    };
  }

  /**
   * ディレクトリを読み込み
   */
  public async readDirectory(path: string, recursive: boolean = false): Promise<DirectoryListing> {
    const logger = getLogger();
    
    try {
      logger.debug('ディレクトリを読み込み中', { path, recursive });

      // パーミッションチェック
      this.checkPathPermission(path, 'read');

      const resolvedPath = resolve(path);
      const entries: DirectoryEntry[] = [];

      await this.readDirectoryRecursive(resolvedPath, entries, recursive, 0);

      const result: DirectoryListing = {
        path: resolvedPath,
        entries,
        totalItems: entries.length,
        totalSize: entries.reduce((sum, entry) => sum + (entry.size || 0), 0),
      };

      logger.info('ディレクトリ読み込み完了', {
        path,
        entriesCount: entries.length,
        totalSize: result.totalSize
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ディレクトリ読み込みに失敗', { path, error: errorMessage });
      throw new FileSystemError(`ディレクトリ読み込みに失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * ファイルを作成
   */
  public async createFile(
    path: string, 
    content: string, 
    permissions: FilePermissions = {}
  ): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.debug('ファイルを作成中', { path, contentLength: content.length });

      // パーミッションチェック
      this.checkPathPermission(path, 'write');

      const resolvedPath = resolve(path);

      // ファイルサイズチェック
      if (Buffer.byteLength(content, 'utf8') > this.config.maxFileSize) {
        throw new ValidationError('ファイルサイズが制限を超えています');
      }

      // ディレクトリの作成（必要に応じて）
      const dirPath = dirname(resolvedPath);
      await this.ensureDirectory(dirPath);

      // ファイル書き込み
      await writeFile(resolvedPath, content, 'utf8');

      // パーミッション設定
      if (permissions.mode) {
        const { chmod } = await import('fs-extra');
        await chmod(resolvedPath, permissions.mode);
      }

      logger.info('ファイル作成完了', { path: resolvedPath });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ファイル作成に失敗', { path, error: errorMessage });
      
      if (error instanceof PermissionError || error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(`ファイル作成に失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * ファイルを更新
   */
  public async updateFile(path: string, changes: FileChange[]): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.debug('ファイルを更新中', { path, changesCount: changes.length });

      // パーミッションチェック
      this.checkPathPermission(path, 'write');

      const resolvedPath = resolve(path);

      // 既存ファイルの読み込み
      let content = '';
      try {
        content = await readFile(resolvedPath, 'utf8');
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          logger.warn('ファイルが存在しないため、新規作成します', { path });
        } else {
          throw error;
        }
      }

      // 変更を適用
      let modifiedContent = content;
      const lines = content.split('\n');

      for (const change of changes) {
        switch (change.status) {
          case 'added':
            // 行の追加（実装簡略化）
            modifiedContent += `\n${change.path}`;
            break;
          case 'modified':
            // ファイル全体を変更（実装簡略化）
            modifiedContent = change.path;
            break;
          case 'deleted':
            // 特定行の削除（実装簡略化）
            const lineIndex = parseInt(change.path, 10) - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
              lines.splice(lineIndex, 1);
              modifiedContent = lines.join('\n');
            }
            break;
        }
      }

      // ファイルサイズチェック
      if (Buffer.byteLength(modifiedContent, 'utf8') > this.config.maxFileSize) {
        throw new ValidationError('更新後のファイルサイズが制限を超えています');
      }

      // ファイル書き込み
      await writeFile(resolvedPath, modifiedContent, 'utf8');

      logger.info('ファイル更新完了', { path: resolvedPath });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ファイル更新に失敗', { path, error: errorMessage });
      
      if (error instanceof PermissionError || error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(`ファイル更新に失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * ファイル・ディレクトリを削除
   */
  public async deleteFile(path: string, options: DeleteOptions = {}): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.debug('ファイル削除中', { path, options });

      // パーミッションチェック
      this.checkPathPermission(path, 'delete');

      const resolvedPath = resolve(path);

      // ファイル・ディレクトリの存在確認
      const stats = await stat(resolvedPath);

      if (stats.isDirectory()) {
        if (options.recursive) {
          const { remove } = await import('fs-extra');
          await remove(resolvedPath);
        } else {
          await rmdir(resolvedPath);
        }
      } else {
        await unlink(resolvedPath);
      }

      logger.info('削除完了', { path: resolvedPath, isDirectory: stats.isDirectory() });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('削除に失敗', { path, error: errorMessage });
      
      if (error instanceof PermissionError) {
        throw error;
      }
      throw new FileSystemError(`削除に失敗しました: ${path} - ${errorMessage}`);
    }
  }

  /**
   * ファイル監視を開始
   */
  public async watchFiles(
    patterns: string[], 
    callback: FileWatchCallback
  ): Promise<FileWatcher> {
    const logger = getLogger();
    
    if (!this.config.enableWatching) {
      throw new ValidationError('ファイル監視が無効になっています');
    }

    try {
      logger.debug('ファイル監視を開始', { patterns });

      const watchId = this.generateWatchId();
      const watchPaths = patterns.map(pattern => resolve(pattern));

      // 監視対象のパスをチェック
      for (const watchPath of watchPaths) {
        this.checkPathPermission(watchPath, 'read');
      }

      // ファイルウォッチャーを作成
      const watchers: FSWatcher[] = [];
      
      for (const watchPath of watchPaths) {
        try {
          const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
            if (filename && !this.shouldIgnoreFile(filename)) {
              logger.debug('ファイル変更を検出', { 
                eventType, 
                filename, 
                watchPath 
              });

              callback({
                type: eventType === 'rename' ? 'renamed' : 'changed',
                path: join(watchPath, filename),
                timestamp: new Date(),
              });
            }
          });

          watchers.push(watcher);
          
          watcher.on('error', (error) => {
            logger.error('ファイル監視エラー', { watchPath, error });
          });

        } catch (error) {
          logger.warn('監視対象を追加できませんでした', { watchPath, error });
        }
      }

      // ウォッチャー情報を保存
      this.watchers.set(watchId, watchers[0]); // 簡略化のため最初のウォッチャーのみ保存
      this.watchCallbacks.set(watchId, callback);

      const fileWatcher: FileWatcher = {
        id: watchId,
        patterns,
        isActive: true,
        stop: () => this.stopWatching(watchId),
      };

      logger.info('ファイル監視を開始しました', { 
        watchId, 
        patterns,
        watchersCount: watchers.length 
      });

      return fileWatcher;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ファイル監視の開始に失敗', { patterns, error: errorMessage });
      throw new FileSystemError(`ファイル監視の開始に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * パーミッションチェック
   */
  private checkPathPermission(
    path: string, 
    operation: 'read' | 'write' | 'delete'
  ): void {
    const resolvedPath = resolve(path);

    // 許可されたパスかチェック
    const isAllowed = this.config.allowedPaths.some(allowedPath => {
      const resolvedAllowed = resolve(allowedPath);
      return resolvedPath.startsWith(resolvedAllowed);
    });

    if (!isAllowed) {
      throw new PermissionError(`アクセスが許可されていないパスです: ${path}`);
    }

    // 拒否されたパスかチェック
    const isDenied = this.config.deniedPaths.some(deniedPath => {
      return resolvedPath.includes(deniedPath);
    });

    if (isDenied) {
      throw new PermissionError(`アクセスが拒否されたパスです: ${path}`);
    }
  }

  /**
   * ディレクトリを再帰的に読み込み
   */
  private async readDirectoryRecursive(
    path: string, 
    entries: DirectoryEntry[], 
    recursive: boolean,
    depth: number
  ): Promise<void> {
    if (depth > 10) { // 深度制限
      return;
    }

    try {
      const items = await readdir(path);

      for (const item of items) {
        const itemPath = join(path, item);
        const stats = await stat(itemPath);

        const entry: DirectoryEntry = {
          name: item,
          path: itemPath,
          type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
          size: stats.isFile() ? stats.size : undefined,
          lastModified: stats.mtime,
          permissions: this.formatPermissions(stats),
        };

        entries.push(entry);

        // 再帰的にディレクトリを処理
        if (recursive && stats.isDirectory() && !this.shouldSkipDirectory(item)) {
          await this.readDirectoryRecursive(itemPath, entries, recursive, depth + 1);
        }
      }
    } catch (error) {
      // アクセスできないディレクトリは無視
      getLogger().warn('ディレクトリにアクセスできません', { path, error });
    }
  }

  /**
   * ディレクトリを確実に作成
   */
  private async ensureDirectory(path: string): Promise<void> {
    try {
      await access(path);
    } catch {
      await mkdir(path, { recursive: true });
    }
  }

  /**
   * 監視を停止
   */
  private stopWatching(watchId: string): void {
    const watcher = this.watchers.get(watchId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchId);
      this.watchCallbacks.delete(watchId);
      
      getLogger().info('ファイル監視を停止しました', { watchId });
    }
  }

  /**
   * 監視IDを生成
   */
  private generateWatchId(): string {
    return `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ファイルを無視すべきかチェック
   */
  private shouldIgnoreFile(filename: string): boolean {
    return this.config.watchIgnorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    });
  }

  /**
   * ディレクトリをスキップすべきかチェック
   */
  private shouldSkipDirectory(dirname: string): boolean {
    return this.config.deniedPaths.includes(dirname);
  }

  /**
   * パーミッションを文字列にフォーマット
   */
  private formatPermissions(stats: Stats): string {
    const mode = stats.mode;
    let permissions = '';

    // オーナー権限
    permissions += (mode & 0o400) ? 'r' : '-';
    permissions += (mode & 0o200) ? 'w' : '-';
    permissions += (mode & 0o100) ? 'x' : '-';

    // グループ権限
    permissions += (mode & 0o040) ? 'r' : '-';
    permissions += (mode & 0o020) ? 'w' : '-';
    permissions += (mode & 0o010) ? 'x' : '-';

    // その他権限
    permissions += (mode & 0o004) ? 'r' : '-';
    permissions += (mode & 0o002) ? 'w' : '-';
    permissions += (mode & 0o001) ? 'x' : '-';

    return permissions;
  }
}

