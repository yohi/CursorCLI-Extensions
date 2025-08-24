/**
 * SuperCursor Framework - 統合モジュール
 * 外部システム統合機能をまとめたモジュール
 */

import { Module } from '@nestjs/common';

// アダプター
import { CursorApiAdapter } from '../adapters/cursor-api.adapter.js';
import { FileSystemAdapter } from '../adapters/file-system.adapter.js';

/**
 * 統合サービス型定義
 */
export interface IntegrationServices {
  cursorApi: CursorApiAdapter;
  fileSystem: FileSystemAdapter;
  healthCheck(): Promise<{ status: string; services: Record<string, boolean> }>;
  validateEnvironment(): Promise<{ valid: boolean; issues: string[] }>;
  openProjectInCursor(projectPath: string): Promise<void>;
  createAndOpenFile(filePath: string, content?: string): Promise<void>;
  getProjectStructure(projectPath: string): Promise<import('../../domain/types/context.js').Directory[]>;
}

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
      useFactory: (opts: IntegrationModuleOptions): CursorApiAdapter => new CursorApiAdapter({
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
      useFactory: (opts: IntegrationModuleOptions): FileSystemAdapter => new FileSystemAdapter({
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
      ): IntegrationServices => ({
        cursorApi,
        fileSystem,
        
        // 便利メソッド
        async healthCheck(): Promise<{ status: string; services: Record<string, boolean> }> {
          const [cursorHealth, fileSystemHealth] = await Promise.allSettled([
            cursorApi.healthCheck(),
            Promise.resolve({ available: true }) // FileSystemは常に利用可能とみなす
          ]);
          
          return {
            status: 'ok',
            services: {
              cursor: cursorHealth.status === 'fulfilled',
              fileSystem: fileSystemHealth.status === 'fulfilled'
            }
          };
        },

        async validateEnvironment(): Promise<{ valid: boolean; issues: string[] }> {
          const issues: string[] = [];
          
          try {
            await cursorApi.healthCheck();
          } catch (error) {
            issues.push(`Cursor API not available: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          return {
            valid: issues.length === 0,
            issues
          };
        },
        
        async openProjectInCursor(projectPath: string): Promise<void> {
          await cursorApi.openProject(projectPath);
        },
        
        async createAndOpenFile(filePath: string, content?: string): Promise<void> {
          if (content !== undefined) {
            await fileSystem.writeFile(filePath, content, { createDirectories: true });
          }
          await cursorApi.openFile(filePath);
        },
        
        async getProjectStructure(projectPath: string): Promise<import('../../domain/types/context.js').Directory[]> {
          const listing = await fileSystem.listDirectory(projectPath, { recursive: true });
          // DirectoryListingをDirectory[]に変換する必要がある場合は、ここで変換
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          return listing as any; // 一時的な型キャスト
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
  static forRoot(options: IntegrationModuleOptions = {}): { module: typeof IntegrationModule; providers: Array<{ provide: string; useValue: IntegrationModuleOptions }> } {
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
  }): { module: typeof IntegrationModule; providers: Array<{ provide: string; useFactory: (...args: unknown[]) => Promise<IntegrationModuleOptions> | IntegrationModuleOptions; inject: unknown[] }> } {
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