/**
 * SuperCursor Framework - 統合モジュール
 * 外部システム統合機能をまとめたモジュール
 */

import { Module } from '@nestjs/common';

// アダプター
import { CursorApiAdapter } from '../adapters/cursor-api.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';

/**
 * 統合モジュール設定
 */
export interface IntegrationModuleOptions {
  // Cursor API 設定
  readonly cursorApi?: {
    readonly enabled?: boolean;
    readonly cursorPath?: string;
    readonly timeout?: number;
    readonly retryAttempts?: number;
    readonly enableLogging?: boolean;
  };
  
  // ファイルシステム設定
  readonly fileSystem?: {
    readonly enableWatching?: boolean;
    readonly maxFileSize?: number;
    readonly allowedPaths?: readonly string[];
    readonly deniedPaths?: readonly string[];
    readonly watchIgnorePatterns?: readonly string[];
    readonly maxWatchers?: number;
  };
}

/**
 * 統合モジュール
 * 
 * Framework-2の外部統合機能をNestJSアーキテクチャに適合させ、
 * アダプターパターンで実装した外部システム統合を提供
 */
@Module({
  providers: [
    // デフォルトオプション + アダプター（forRoot/Async で上書き可能）
    {
      provide: 'INTEGRATION_MODULE_OPTIONS',
      useValue: {},
    },
    {
      provide: CursorApiAdapter,
      useFactory: (opts: IntegrationModuleOptions) => new CursorApiAdapter({
        cursorPath: opts.cursorApi?.cursorPath ?? process.env.CURSOR_PATH ?? 'cursor',
        timeout: opts.cursorApi?.timeout ?? parseInt(process.env.CURSOR_TIMEOUT ?? '30000', 10),
        retryAttempts: opts.cursorApi?.retryAttempts ?? parseInt(process.env.CURSOR_RETRY_ATTEMPTS ?? '3', 10),
        workingDirectory: process.cwd(),
        enableLogging: opts.cursorApi?.enableLogging ?? (process.env.CURSOR_ENABLE_LOGGING !== 'false'),
      }),
      inject: ['INTEGRATION_MODULE_OPTIONS'],
    },
    {
      provide: FileSystemAdapter,
      useFactory: (opts: IntegrationModuleOptions) => new FileSystemAdapter({
        allowedPaths: opts.fileSystem?.allowedPaths ?? [process.cwd()],
        deniedPaths: opts.fileSystem?.deniedPaths ?? ['/etc', '/usr', '/bin'],
        maxFileSize: opts.fileSystem?.maxFileSize ?? 10_485_760,
        enableWatching: opts.fileSystem?.enableWatching ?? true,
        watchIgnorePatterns: opts.fileSystem?.watchIgnorePatterns ?? ['node_modules', '.git', 'dist', 'build'],
        maxWatchers: opts.fileSystem?.maxWatchers ?? 100,
      }),
      inject: ['INTEGRATION_MODULE_OPTIONS'],
    },
    
    // 統合アグリゲート（便利なラッパー）
    {
      provide: 'INTEGRATION_SERVICES',
      useFactory: (
        cursorApi: CursorApiAdapter,
        fileSystem: FileSystemAdapter
      ) => ({
        cursorApi,
        fileSystem,
        
        // 便利メソッド
        async healthCheck() {
          const [cursorHealth, fileSystemHealth] = await Promise.allSettled([
            cursorApi.healthCheck(),
            Promise.resolve({ available: true }) // FileSystemは常に利用可能とみなす
          ]);
          
          return {
            cursor: cursorHealth.status === 'fulfilled' ? cursorHealth.value : { available: false, error: (cursorHealth.reason as Error)?.message },
            fileSystem: fileSystemHealth.status === 'fulfilled' ? fileSystemHealth.value : { available: false }
          };
        },
        
        async openProjectInCursor(projectPath: string) {
          return cursorApi.openProject(projectPath);
        },
        
        async createAndOpenFile(filePath: string, content?: string) {
          if (content !== undefined) {
            await fileSystem.writeFile(filePath, content, { createDirectories: true });
          }
          return cursorApi.openFile(filePath);
        },
        
        async getProjectStructure(projectPath: string) {
          return fileSystem.listDirectory(projectPath, { recursive: true });
        }
      }),
      inject: [CursorApiAdapter, FileSystemAdapter]
    }
  ],
  
  exports: [
    CursorApiAdapter,
    FileSystemAdapter,
    'INTEGRATION_SERVICES'
  ]
})
export class IntegrationModule {
  
  /**
   * 動的設定でモジュールを構成
   */
  static forRoot(options: IntegrationModuleOptions = {}) {
    return {
      module: IntegrationModule,
      providers: [
        {
          provide: 'INTEGRATION_MODULE_OPTIONS',
          useValue: options
        }
      ]
    };
  }
  
  /**
   * 非同期設定でモジュールを構成
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<IntegrationModuleOptions> | IntegrationModuleOptions;
    inject?: unknown[];
  }) {
    return {
      module: IntegrationModule,
      providers: [
        {
          provide: 'INTEGRATION_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject ?? []
        }
      ]
    };
  }
}