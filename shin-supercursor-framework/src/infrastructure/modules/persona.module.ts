/**
 * SuperCursor Framework - ペルソナモジュール
 * ペルソナ関連のすべてのコンポーネントを統合
 */

import { Module, DynamicModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// アプリケーションサービス
import { PersonaManagementService } from '../../application/services/persona-management.service.js';
// ドメインリポジトリとサービス
import { PersonaRepository } from '../../domain/repositories/persona.repository.js';
import { PersonaSelectionService } from '../../domain/services/persona-selection.service.js';
// インフラストラクチャー実装
import {
  PersonaEntity,
  PersonaInteractionEntity,
  PersonaFeedbackEntity,
  PersonaRepositoryImpl
} from '../persistence/persona.repository.impl.js';

// ファクトリー（実装予定）
// import { PersonaFactoryImpl } from '../factories/persona.factory.impl.js';

/**
 * ペルソナモジュール設定
 */
export interface PersonaModuleOptions {
  readonly enableLearning?: boolean;
  readonly enableCaching?: boolean;
  readonly maxActivePersonas?: number;
  readonly selectionTimeoutMs?: number;
}

/**
 * ペルソナモジュール非同期設定
 */
export interface PersonaModuleAsyncOptions {
  readonly imports?: unknown[];
  readonly useFactory: (...args: unknown[]) => Promise<PersonaModuleOptions> | PersonaModuleOptions;
  readonly inject?: unknown[];
}

/**
 * ペルソナスペック
 */
export interface PersonaSpec {
  readonly name: string;
  readonly type: string;
}

/**
 * ペルソナ作成結果
 */
export interface PersonaCreationResult {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/**
 * ペルソナ検証結果
 */
export interface PersonaValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly suggestions: string[];
}

/**
 * ペルソナ管理設定
 */
export interface PersonaManagementConfig {
  readonly maxActivePersonas: number;
  readonly selectionTimeoutMs: number;
  readonly enableLearning: boolean;
  readonly enableCaching: boolean;
  readonly cacheTimeoutMs: number;
  readonly enableMetrics: boolean;
}

/**
 * ペルソナモジュール
 * 
 * Framework-1の設計思想とFramework-2の実装を統合した
 * 完全なペルソナ管理システムを提供
 */
@Module({
  imports: [
    // TypeORM エンティティの登録
    TypeOrmModule.forFeature([
      PersonaEntity,
      PersonaInteractionEntity,
      PersonaFeedbackEntity
    ]),
    
    // CQRS サポート
    CqrsModule
  ],
  
  providers: [
    // リポジトリ実装
    {
      provide: PersonaRepository,
      useClass: PersonaRepositoryImpl
    },
    
    // ドメインサービス
    PersonaSelectionService,
    
    // アプリケーションサービス
    PersonaManagementService,
    
    // ファクトリー（モック実装）
    {
      provide: 'PERSONA_FACTORY',
      useValue: {
        createPersona: (spec: PersonaSpec): PersonaCreationResult => {
          // モック実装
          return {
            id: 'persona_mock',
            name: spec.name,
            type: spec.type,
            // ... 他の必須プロパティ
          };
        },
        validatePersona: (_persona: unknown): PersonaValidationResult => ({
          valid: true,
          errors: [],
          warnings: [],
          suggestions: []
        }),
        clonePersona: (_personaId: unknown, _customizations: unknown): PersonaCreationResult => {
          // モック実装
          return {} as PersonaCreationResult;
        },
        buildFromTemplate: (_template: unknown, _parameters: unknown): PersonaCreationResult => {
          // モック実装
          return {} as PersonaCreationResult;
        }
      }
    },
    
    // 設定プロバイダーは forRoot/forRootAsync でのみ提供
  ],
  
  exports: [
    // 他のモジュールで利用可能にする
    PersonaRepository,
    PersonaSelectionService,
    PersonaManagementService,
    'PERSONA_FACTORY',
    'PERSONA_MANAGEMENT_CONFIG'
  ]
})
export class PersonaModule {
  
  /**
   * 動的設定でモジュールを構成
   */
  static forRoot(options: PersonaModuleOptions = {}): DynamicModule {
    return {
      module: PersonaModule,
      providers: [
        {
          provide: 'PERSONA_MODULE_OPTIONS',
          useValue: options
        },
        {
          provide: 'PERSONA_MANAGEMENT_CONFIG',
          useFactory: (opts: PersonaModuleOptions): PersonaManagementConfig => ({
            maxActivePersonas: opts.maxActivePersonas ?? parseInt(process.env.MAX_ACTIVE_PERSONAS ?? '5', 10),
            selectionTimeoutMs: opts.selectionTimeoutMs ?? parseInt(process.env.PERSONA_SELECTION_TIMEOUT ?? '5000', 10),
            enableLearning: opts.enableLearning ?? (process.env.PERSONA_ENABLE_LEARNING !== 'false'),
            enableCaching: opts.enableCaching ?? (process.env.PERSONA_ENABLE_CACHING !== 'false'),
            cacheTimeoutMs: parseInt(process.env.PERSONA_CACHE_TIMEOUT ?? '300000', 10),
            enableMetrics: process.env.PERSONA_ENABLE_METRICS !== 'false',
          }),
          inject: ['PERSONA_MODULE_OPTIONS'],
        }
      ]
    };
  }
  
  /**
   * 非同期設定でモジュールを構成
   */
  static forRootAsync(options: PersonaModuleAsyncOptions): DynamicModule {
    return {
      module: PersonaModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: 'PERSONA_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject ?? []
        },
        {
          provide: 'PERSONA_MANAGEMENT_CONFIG',
          useFactory: (opts: PersonaModuleOptions): PersonaManagementConfig => ({
            maxActivePersonas: opts.maxActivePersonas ?? parseInt(process.env.MAX_ACTIVE_PERSONAS ?? '5', 10),
            selectionTimeoutMs: opts.selectionTimeoutMs ?? parseInt(process.env.PERSONA_SELECTION_TIMEOUT ?? '5000', 10),
            enableLearning: opts.enableLearning ?? (process.env.PERSONA_ENABLE_LEARNING !== 'false'),
            enableCaching: opts.enableCaching ?? (process.env.PERSONA_ENABLE_CACHING !== 'false'),
            cacheTimeoutMs: parseInt(process.env.PERSONA_CACHE_TIMEOUT ?? '300000', 10),
            enableMetrics: process.env.PERSONA_ENABLE_METRICS !== 'false',
          }),
          inject: ['PERSONA_MODULE_OPTIONS'],
        }
      ],
      exports: ['PERSONA_MANAGEMENT_CONFIG'],
    };
  }
}