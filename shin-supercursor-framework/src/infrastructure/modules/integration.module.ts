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
  };
  
  // ファイルシステム設定
  readonly fileSystem?: {
    readonly enableWatching?: boolean;
    readonly maxFileSize?: number;
    readonly allowedPaths?: readonly string[];
    readonly deniedPaths?: readonly string[];
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
    // Cursor API アダプター
    {
      provide: CursorApiAdapter,
      useFactory: () => new CursorApiAdapter({
        cursorPath: process.env.CURSOR_PATH || 'cursor',
        timeout: parseInt(process.env.CURSOR_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.CURSOR_RETRY_ATTEMPTS || '3'),
        workingDirectory: process.cwd(),
        enableLogging: process.env.CURSOR_ENABLE_LOGGING !== 'false'
      })
    },
    
    // ファイルシステムアダプター
    {
      provide: FileSystemAdapter,
      useFactory: () => new FileSystemAdapter({
        allowedPaths: process.env.ALLOWED_PATHS?.split(',') || [process.cwd()],
        deniedPaths: process.env.DENIED_PATHS?.split(',') || ['/etc', '/usr', '/bin'],
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
        enableWatching: process.env.ENABLE_FILE_WATCHING !== 'false',
        watchIgnorePatterns: process.env.WATCH_IGNORE_PATTERNS?.split(',') || ['node_modules', '.git'],
        maxWatchers: parseInt(process.env.MAX_FILE_WATCHERS || '100')
      })
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
            cursor: cursorHealth.status === 'fulfilled' ? cursorHealth.value : { available: false, error: cursorHealth.reason?.message },
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
        },
        
        // Cursor API アダプター（設定付き）
        {
          provide: CursorApiAdapter,
          useFactory: () => new CursorApiAdapter({
            cursorPath: options.cursorApi?.cursorPath || process.env.CURSOR_PATH || 'cursor',
            timeout: options.cursorApi?.timeout || parseInt(process.env.CURSOR_TIMEOUT || '30000'),
            retryAttempts: options.cursorApi?.retryAttempts || parseInt(process.env.CURSOR_RETRY_ATTEMPTS || '3'),
            workingDirectory: process.cwd(),
            enableLogging: process.env.CURSOR_ENABLE_LOGGING !== 'false'
          })
        },
        
        // ファイルシステムアダプター（設定付き）
        {
          provide: FileSystemAdapter,
          useFactory: () => new FileSystemAdapter({
            allowedPaths: options.fileSystem?.allowedPaths || [process.cwd()],
            deniedPaths: options.fileSystem?.deniedPaths || ['/etc', '/usr', '/bin'],
            maxFileSize: options.fileSystem?.maxFileSize || 10485760,
            enableWatching: options.fileSystem?.enableWatching ?? true,
            watchIgnorePatterns: ['node_modules', '.git', 'dist', 'build'],
            maxWatchers: 100
          })
        }
      ]
    };
  }
  
  /**
   * 非同期設定でモジュールを構成
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<IntegrationModuleOptions> | IntegrationModuleOptions;
    inject?: any[];
  }) {
    return {
      module: IntegrationModule,
      providers: [
        {
          provide: 'INTEGRATION_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        
        {
          provide: CursorApiAdapter,
          useFactory: async (moduleOptions: IntegrationModuleOptions) => {
            return new CursorApiAdapter({
              cursorPath: moduleOptions.cursorApi?.cursorPath || 'cursor',
              timeout: moduleOptions.cursorApi?.timeout || 30000,
              retryAttempts: moduleOptions.cursorApi?.retryAttempts || 3,
              workingDirectory: process.cwd(),
              enableLogging: true
            });
          },
          inject: ['INTEGRATION_MODULE_OPTIONS']
        },
        
        {
          provide: FileSystemAdapter,
          useFactory: async (moduleOptions: IntegrationModuleOptions) => {
            return new FileSystemAdapter({
              allowedPaths: moduleOptions.fileSystem?.allowedPaths || [process.cwd()],
              deniedPaths: moduleOptions.fileSystem?.deniedPaths || ['/etc', '/usr', '/bin'],
              maxFileSize: moduleOptions.fileSystem?.maxFileSize || 10485760,
              enableWatching: moduleOptions.fileSystem?.enableWatching ?? true,
              watchIgnorePatterns: ['node_modules', '.git', 'dist', 'build'],
              maxWatchers: 100
            });
          },
          inject: ['INTEGRATION_MODULE_OPTIONS']
        }
      ]
    };
  }
}