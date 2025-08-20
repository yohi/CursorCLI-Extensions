/**
 * SuperCursor Framework - ペルソナモジュール
 * ペルソナ関連のすべてのコンポーネントを統合
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

// エンティティ
import {
  PersonaEntity,
  PersonaInteractionEntity,
  PersonaFeedbackEntity
} from '../persistence/persona.repository.impl.js';

// リポジトリ
import { PersonaRepository } from '../../domain/repositories/persona.repository.js';
import { PersonaRepositoryImpl } from '../persistence/persona.repository.impl.js';

// ドメインサービス
import { PersonaSelectionService } from '../../domain/services/persona-selection.service.js';

// アプリケーションサービス
import { PersonaManagementService } from '../../application/services/persona-management.service.js';

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
        createPersona: async (spec: any) => {
          // モック実装
          return {
            id: 'persona_mock',
            name: spec.name,
            type: spec.type,
            // ... 他の必須プロパティ
          };
        },
        validatePersona: async (persona: any) => ({
          valid: true,
          errors: [],
          warnings: [],
          suggestions: []
        }),
        clonePersona: async (personaId: any, customizations: any) => {
          // モック実装
          return {} as any;
        },
        buildFromTemplate: async (template: any, parameters: any) => {
          // モック実装
          return {} as any;
        }
      }
    },
    
    // 設定プロバイダー
    {
      provide: 'PERSONA_MANAGEMENT_CONFIG',
      useFactory: () => ({
        maxActivePersonas: parseInt(process.env.MAX_ACTIVE_PERSONAS || '5'),
        selectionTimeoutMs: parseInt(process.env.PERSONA_SELECTION_TIMEOUT || '5000'),
        enableLearning: process.env.PERSONA_ENABLE_LEARNING !== 'false',
        enableCaching: process.env.PERSONA_ENABLE_CACHING !== 'false',
        cacheTimeoutMs: parseInt(process.env.PERSONA_CACHE_TIMEOUT || '300000'),
        enableMetrics: process.env.PERSONA_ENABLE_METRICS !== 'false'
      })
    }
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
  static forRoot(options: PersonaModuleOptions = {}) {
    return {
      module: PersonaModule,
      providers: [
        {
          provide: 'PERSONA_MODULE_OPTIONS',
          useValue: options
        },
        {
          provide: 'PERSONA_MANAGEMENT_CONFIG',
          useFactory: () => ({
            maxActivePersonas: options.maxActivePersonas || 5,
            selectionTimeoutMs: options.selectionTimeoutMs || 5000,
            enableLearning: options.enableLearning ?? true,
            enableCaching: options.enableCaching ?? true,
            cacheTimeoutMs: 300000,
            enableMetrics: true
          })
        }
      ]
    };
  }
  
  /**
   * 非同期設定でモジュールを構成
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<PersonaModuleOptions> | PersonaModuleOptions;
    inject?: any[];
  }) {
    return {
      module: PersonaModule,
      providers: [
        {
          provide: 'PERSONA_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        {
          provide: 'PERSONA_MANAGEMENT_CONFIG',
          useFactory: async (moduleOptions: PersonaModuleOptions) => ({
            maxActivePersonas: moduleOptions.maxActivePersonas || 5,
            selectionTimeoutMs: moduleOptions.selectionTimeoutMs || 5000,
            enableLearning: moduleOptions.enableLearning ?? true,
            enableCaching: moduleOptions.enableCaching ?? true,
            cacheTimeoutMs: 300000,
            enableMetrics: true
          }),
          inject: ['PERSONA_MODULE_OPTIONS']
        }
      ]
    };
  }
}