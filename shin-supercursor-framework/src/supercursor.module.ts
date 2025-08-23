/**
 * SuperCursor Framework - メインモジュール
 * NestJSアーキテクチャに基づく統合モジュール定義
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// アプリケーション層
import { ExecuteSupercursorHandler } from './application/commands/execute-supercursor.handler.js';
import { PersonaManagementService } from './application/services/persona-management.service.js';

// インフラストラクチャ層
import { PersonaModule } from './infrastructure/modules/persona.module.js';
import { CommandModule } from './infrastructure/modules/command.module.js';
import { IntegrationModule } from './infrastructure/modules/integration.module.js';

// インフラストラクチャ層（将来実装）
// import { PersonaServiceImpl } from './infrastructure/services/persona.service.js';
// import { CommandRouterImpl } from './infrastructure/services/command-router.service.js';

/**
 * SuperCursor フレームワーク設定
 */
export interface SuperCursorModuleOptions {
  configPath?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  enableCaching?: boolean;
  enableMetrics?: boolean;
}

/**
 * SuperCursor メインモジュール
 * 
 * このモジュールは以下を提供する：
 * - CQRS パターンの実装
 * - 設定管理
 * - 依存性注入の設定
 * - サービスプロバイダーの定義
 */
@Module({
  imports: [
    // グローバル設定管理
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true
    }),
    
    // データベース設定 (SQLite for development)
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'supercursor.db',
      entities: ['dist/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development'
    }),
    
    // CQRS パターンサポート
    CqrsModule,
    
    // ペルソナモジュール
    PersonaModule.forRoot({
      enableLearning: process.env.PERSONA_ENABLE_LEARNING !== 'false',
      enableCaching: process.env.PERSONA_ENABLE_CACHING !== 'false',
      maxActivePersonas: parseInt(process.env.MAX_ACTIVE_PERSONAS || '5'),
      selectionTimeoutMs: parseInt(process.env.PERSONA_SELECTION_TIMEOUT || '5000')
    }),
    
    // コマンドモジュール
    CommandModule.forRoot({
      enableValidation: process.env.COMMAND_ENABLE_VALIDATION !== 'false',
      enableCaching: process.env.COMMAND_ENABLE_CACHING !== 'false',
      enableMetrics: process.env.COMMAND_ENABLE_METRICS !== 'false',
      defaultTimeout: parseInt(process.env.COMMAND_DEFAULT_TIMEOUT || '30000'),
      maxConcurrentCommands: parseInt(process.env.MAX_CONCURRENT_COMMANDS || '10')
    }),

    // 統合モジュール
    IntegrationModule.forRoot()
  ],
  
  providers: [
    // コマンドハンドラー
    ExecuteSupercursorHandler,
    
    // TODO: 以下のサービスは実装後に追加
    // PersonaServiceImpl,
    // CommandRouterImpl,
    // CacheManagerImpl,
    // ContextAnalyzerImpl,
    
    // ペルソナサービス（PersonaModuleから提供）
    {
      provide: 'PERSONA_SERVICE',
      useExisting: PersonaManagementService
    },
    
    // コマンドルーター（CommandModuleから提供）
    // 'COMMAND_ROUTER' はCommandModuleで提供される
    
    // フレームワーク設定プロバイダー
    {
      provide: 'FRAMEWORK_CONFIG',
      useFactory: () => ({
        logLevel: process.env.LOG_LEVEL || 'info',
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '300000'),
        maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '1000'),
        enableValidation: process.env.ENABLE_VALIDATION !== 'false',
        personas: {
          enableAutoSelection: process.env.PERSONA_AUTO_SELECTION !== 'false',
          enableLearning: process.env.PERSONA_LEARNING !== 'false',
          confidenceThreshold: parseFloat(process.env.PERSONA_CONFIDENCE_THRESHOLD || '0.7'),
          maxConcurrentPersonas: parseInt(process.env.MAX_CONCURRENT_PERSONAS || '3')
        },
        security: {
          enableAuthentication: process.env.ENABLE_AUTH === 'true',
          enableAuthorization: process.env.ENABLE_AUTHZ === 'true',
          rateLimiting: {
            enabled: process.env.RATE_LIMITING_ENABLED === 'true',
            maxRequestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60'),
            maxRequestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '1000')
          },
          encryption: {
            enabled: process.env.ENCRYPTION_ENABLED === 'true',
            algorithm: process.env.ENCRYPTION_ALGORITHM || 'AES-256-GCM',
            keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '256')
          }
        },
        performance: {
          enableMetrics: process.env.ENABLE_METRICS !== 'false',
          enableProfiling: process.env.ENABLE_PROFILING === 'true',
          maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '1000000000'),
          commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '30000')
        }
      })
    }
  ],
  
  exports: [
    // 他のモジュールで利用可能にするプロバイダー
    'FRAMEWORK_CONFIG',
    'PERSONA_SERVICE',
    'COMMAND_ROUTER',
    CqrsModule,
    PersonaModule,
    CommandModule,
    IntegrationModule
  ]
})
export class SuperCursorModule {
  
  /**
   * 動的モジュール設定
   * アプリケーション固有の設定でモジュールをカスタマイズ
   */
  static forRoot(options: SuperCursorModuleOptions = {}) {
    return {
      module: SuperCursorModule,
      providers: [
        {
          provide: 'MODULE_OPTIONS',
          useValue: options
        },
        // オプション固有のプロバイダーを追加
        ...(options.enableMetrics ? [
          // MetricsServiceImpl など
        ] : []),
        ...(options.enableCaching ? [
          // CacheServiceImpl など
        ] : [])
      ]
    };
  }
  
  /**
   * 非同期モジュール設定
   * 非同期設定読み込みをサポート
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<SuperCursorModuleOptions> | SuperCursorModuleOptions;
    inject?: any[];
  }) {
    return {
      module: SuperCursorModule,
      providers: [
        {
          provide: 'MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || []
        }
      ]
    };
  }
}