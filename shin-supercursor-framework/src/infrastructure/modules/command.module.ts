/**
 * SuperCursor Framework - コマンドモジュール
 * コマンド処理関連のすべてのコンポーネントを統合
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// ドメインサービス
import { CommandRoutingService } from '../../domain/services/command-routing.service.js';

// アプリケーションハンドラー
import { AnalyzeCommandHandler } from '../../application/handlers/analyze-command.handler.js';

// 将来追加予定のハンドラー
// import { ImplementCommandHandler } from '../../application/handlers/implement-command.handler.js';
// import { BuildCommandHandler } from '../../application/handlers/build-command.handler.js';
// import { DesignCommandHandler } from '../../application/handlers/design-command.handler.js';

/**
 * コマンドモジュール設定
 */
export interface CommandModuleOptions {
  readonly enableValidation?: boolean;
  readonly enableCaching?: boolean;
  readonly enableMetrics?: boolean;
  readonly defaultTimeout?: number;
  readonly maxConcurrentCommands?: number;
}

/**
 * コマンドモジュール
 * 
 * Framework-2のコマンドエンジンとプロセッサを統合し、
 * NestJSのCQRSパターンに適合させた実装
 */
@Module({
  imports: [
    CqrsModule
  ],
  
  providers: [
    // ドメインサービス
    CommandRoutingService,
    
    // コマンドハンドラー
    AnalyzeCommandHandler,
    
    // 将来追加予定
    // ImplementCommandHandler,
    // BuildCommandHandler,
    // DesignCommandHandler,
    
    // 設定プロバイダー
    {
      provide: 'COMMAND_ROUTING_CONFIG',
      useFactory: () => ({
        enableValidation: process.env.COMMAND_ENABLE_VALIDATION !== 'false',
        enableCaching: process.env.COMMAND_ENABLE_CACHING !== 'false',
        enableMetrics: process.env.COMMAND_ENABLE_METRICS !== 'false',
        defaultTimeout: parseInt(process.env.COMMAND_DEFAULT_TIMEOUT || '30000'),
        maxConcurrentCommands: parseInt(process.env.MAX_CONCURRENT_COMMANDS || '10')
      })
    },
    
    // コマンドルーター実装
    {
      provide: 'COMMAND_ROUTER',
      useFactory: (
        routingService: CommandRoutingService,
        analyzeHandler: AnalyzeCommandHandler
      ) => {
        // ハンドラーを登録
        routingService.registerHandler(analyzeHandler);
        
        return routingService;
      },
      inject: [CommandRoutingService, AnalyzeCommandHandler]
    }
  ],
  
  exports: [
    CommandRoutingService,
    AnalyzeCommandHandler,
    'COMMAND_ROUTER',
    'COMMAND_ROUTING_CONFIG'
  ]
})
export class CommandModule {
  
  /**
   * 動的設定でモジュールを構成
   */
  static forRoot(options: CommandModuleOptions = {}) {
    return {
      module: CommandModule,
      providers: [
        {
          provide: 'COMMAND_MODULE_OPTIONS',
          useValue: options
        },
        {
          provide: 'COMMAND_ROUTING_CONFIG',
          useFactory: () => ({
            enableValidation: options.enableValidation ?? true,
            enableCaching: options.enableCaching ?? true,
            enableMetrics: options.enableMetrics ?? true,
            defaultTimeout: options.defaultTimeout || 30000,
            maxConcurrentCommands: options.maxConcurrentCommands || 10
          })
        }
      ]
    };
  }
  
  /**
   * 非同期設定でモジュールを構成
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<CommandModuleOptions> | CommandModuleOptions;
    inject?: any[];
  }) {
    return {
      module: CommandModule,
      providers: [
        {
          provide: 'COMMAND_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        {
          provide: 'COMMAND_ROUTING_CONFIG',
          useFactory: async (moduleOptions: CommandModuleOptions) => ({
            enableValidation: moduleOptions.enableValidation ?? true,
            enableCaching: moduleOptions.enableCaching ?? true,
            enableMetrics: moduleOptions.enableMetrics ?? true,
            defaultTimeout: moduleOptions.defaultTimeout || 30000,
            maxConcurrentCommands: moduleOptions.maxConcurrentCommands || 10
          }),
          inject: ['COMMAND_MODULE_OPTIONS']
        }
      ]
    };
  }
}