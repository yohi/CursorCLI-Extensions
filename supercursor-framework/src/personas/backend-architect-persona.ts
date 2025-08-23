/**
 * バックエンドアーキテクトペルソナ
 */

import { BasePersona, PersonaConfig } from './base-persona';
import {
  PersonaContext,
  PersonaResponse,
  PersonaCapability,
  ActivationTrigger,
  ProjectContext
} from '../types';
import { getLogger } from '../core/logger';

export class BackendArchitectPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      id: 'backend-architect',
      name: 'Backend Architect',
      type: 'backend-architect',
      description: 'バックエンドシステムの設計、API開発、データベース設計に特化したAI',
      version: '1.0.0',
      capabilities: [
        {
          name: 'api-design',
          description: 'RESTful API、GraphQL API設計',
          category: 'architecture',
          supported: true,
        },
        {
          name: 'database-design',
          description: 'データベーススキーマ設計と最適化',
          category: 'database',
          supported: true,
        },
        {
          name: 'microservices-architecture',
          description: 'マイクロサービスアーキテクチャ設計',
          category: 'architecture',
          supported: true,
        },
        {
          name: 'performance-optimization',
          description: 'バックエンドパフォーマンス最適化',
          category: 'performance',
          supported: true,
        },
        {
          name: 'security-architecture',
          description: 'セキュリティアーキテクチャ設計',
          category: 'security',
          supported: true,
        },
      ],
      activationScore: 85,
      priority: 8,
      contextRequirements: ['node.js', 'python', 'java', 'go', 'rust', 'api', 'database', 'server'],
      conflictingPersonas: [],
    };

    super(config);
  }

  /**
   * カスタム活性化評価ロジック
   */
  protected async evaluateCustomActivation(context: PersonaContext): Promise<boolean> {
    const logger = getLogger();
    
    try {
      logger.debug('バックエンドアーキテクト活性化評価', {
        triggerType: context.trigger.type,
        projectType: context.projectContext.type,
      });

      // バックエンド関連のファイルパターンをチェック
      const backendPatterns = [
        /server\.js$|server\.ts$/,
        /app\.js$|app\.ts$/,
        /api\/.*\.(js|ts|py|java|go|rs)$/,
        /routes\/.*\.(js|ts|py|java|go|rs)$/,
        /controllers\/.*\.(js|ts|py|java|go|rs)$/,
        /models\/.*\.(js|ts|py|java|go|rs)$/,
        /services\/.*\.(js|ts|py|java|go|rs)$/,
        /middleware\/.*\.(js|ts|py|java|go|rs)$/,
        /database\/.*\.(js|ts|py|java|go|rs|sql)$/,
        /migrations\/.*\.(js|ts|py|java|go|rs|sql)$/,
      ];

      // プロジェクトファイルでバックエンドパターンをチェック
      const projectFiles = context.projectContext.structure.files || [];
      const hasBackendFiles = projectFiles.some(file =>
        backendPatterns.some(pattern => pattern.test(file.path))
      );

      // バックエンド技術の検出
      const backendTech = [
        'express', 'fastify', 'koa', 'nestjs',
        'django', 'flask', 'fastapi',
        'spring', 'spring-boot',
        'gin', 'echo', 'fiber',
        'actix-web', 'rocket', 'warp',
      ];

      const hasBackendTech = context.projectContext.technologies.frameworks
        .map(f => f.toString().toLowerCase())
        .some(framework => backendTech.includes(framework));

      // データベース関連技術の検出
      const dbTech = [
        'postgresql', 'mysql', 'sqlite', 'mongodb',
        'redis', 'elasticsearch', 'dynamodb',
        'prisma', 'sequelize', 'typeorm', 'mongoose',
      ];

      const hasDatabaseTech = context.projectContext.technologies.tools
        .map(t => t.toString().toLowerCase())
        .some(tool => dbTech.includes(tool));

      // トリガータイプによる評価
      let triggerScore = 0;
      switch (context.trigger.type) {
        case 'command':
          const command = context.command?.toLowerCase() || '';
          if (command.includes('api') || command.includes('server') || command.includes('backend')) {
            triggerScore += 30;
          }
          break;
        case 'file-change':
          if (hasBackendFiles) {
            triggerScore += 25;
          }
          break;
      }

      // 総合評価
      const evaluation = hasBackendFiles || hasBackendTech || hasDatabaseTech || triggerScore > 0;

      logger.debug('バックエンドアーキテクト評価結果', {
        hasBackendFiles,
        hasBackendTech,
        hasDatabaseTech,
        triggerScore,
        evaluation,
      });

      return evaluation;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('バックエンドアーキテクト活性化評価に失敗', { error: errorMessage });
      return false;
    }
  }

  /**
   * ペルソナ固有の活性化処理
   */
  protected async performActivation(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('バックエンドアーキテクトペルソナを活性化');

      // バックエンド関連のコンテキストを分析
      await this.analyzeBackendContext(context);

      logger.info('バックエンドアーキテクトペルソナ活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('バックエンドアーキテクト活性化処理に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * ペルソナ固有の非活性化処理
   */
  protected async performDeactivation(): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('バックエンドアーキテクトペルソナを非活性化');

      // クリーンアップ処理
      logger.info('バックエンドアーキテクトペルソナ非活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('バックエンドアーキテクト非活性化処理に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * コマンド実行の具体的な処理
   */
  protected async executeCommand(command: string, context: PersonaContext): Promise<PersonaResponse> {
    const startTime = Date.now();
    const logger = getLogger();
    
    try {
      logger.debug('バックエンドアーキテクトコマンド実行', {
        command: command.substring(0, 100),
      });

      let output = '';
      let confidence = 0.8;

      // コマンドタイプを分析
      const commandLower = command.toLowerCase();
      
      if (commandLower.includes('api') || commandLower.includes('endpoint')) {
        output = await this.handleAPIDesignCommand(command, context);
        confidence = 0.9;
      } else if (commandLower.includes('database') || commandLower.includes('db') || commandLower.includes('schema')) {
        output = await this.handleDatabaseCommand(command, context);
        confidence = 0.85;
      } else if (commandLower.includes('microservice') || commandLower.includes('architecture')) {
        output = await this.handleArchitectureCommand(command, context);
        confidence = 0.88;
      } else if (commandLower.includes('performance') || commandLower.includes('optimization')) {
        output = await this.handlePerformanceCommand(command, context);
        confidence = 0.82;
      } else if (commandLower.includes('security') || commandLower.includes('auth')) {
        output = await this.handleSecurityCommand(command, context);
        confidence = 0.85;
      } else {
        output = await this.handleGeneralBackendCommand(command, context);
        confidence = 0.7;
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        output,
        metadata: {
          personaId: this.config.id,
          timestamp: new Date(),
          processingTime,
          confidence,
          reasoning: 'バックエンドアーキテクトとしての専門知識を活用',
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('バックエンドアーキテクトコマンド実行に失敗', { error: errorMessage });

      return {
        success: false,
        output: '',
        error: errorMessage,
        metadata: {
          personaId: this.config.id,
          timestamp: new Date(),
          processingTime,
        },
      };
    }
  }

  /**
   * カスタム信頼度計算
   */
  protected calculateCustomConfidence(context: PersonaContext): number {
    let bonus = 0;

    // プロジェクトタイプボーナス
    const projectType = context.projectContext.type;
    if (projectType === 'service' || projectType === 'api') {
      bonus += 20;
    }

    // 技術スタックボーナス
    const backendLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
    const hasBackendLang = context.projectContext.technologies.languages
      .some(lang => backendLanguages.includes(lang.toLowerCase()));
    
    if (hasBackendLang) {
      bonus += 15;
    }

    // フレームワークボーナス
    const backendFrameworks = ['express', 'fastify', 'nestjs', 'django', 'flask', 'spring'];
    const hasBackendFramework = context.projectContext.technologies.frameworks
      .map(f => f.toString().toLowerCase())
      .some(framework => backendFrameworks.includes(framework));
    
    if (hasBackendFramework) {
      bonus += 15;
    }

    return Math.min(bonus, 25); // 最大25ポイントのボーナス
  }

  // プライベートメソッド

  /**
   * バックエンドコンテキストを分析
   */
  private async analyzeBackendContext(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      // API エンドポイントの分析
      const apiFiles = context.projectContext.structure.files?.filter(file =>
        /api\/|routes\/|controllers\//.test(file.path)
      );

      // データベース関連の分析
      const dbFiles = context.projectContext.structure.files?.filter(file =>
        /models\/|database\/|migrations\//.test(file.path)
      );

      logger.debug('バックエンドコンテキスト分析完了', {
        apiFilesCount: apiFiles?.length || 0,
        dbFilesCount: dbFiles?.length || 0,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('バックエンドコンテキスト分析に失敗', { error: errorMessage });
    }
  }

  /**
   * API設計コマンドを処理
   */
  private async handleAPIDesignCommand(command: string, context: PersonaContext): Promise<string> {
    return `## API設計提案

バックエンドアーキテクトとして、以下のAPI設計を提案いたします：

### RESTful API設計原則
- リソースベースのURL設計
- 適切なHTTPメソッドの使用
- ステータスコードの標準化
- レスポンス形式の統一

### 推奨実装パターン
- Controller-Service-Repository パターン
- ミドルウェアによる横断的関心事の実装
- バリデーション層の分離
- エラーハンドリングの統一

プロジェクトの具体的な要件に基づいて、詳細な設計を提供いたします。`;
  }

  /**
   * データベースコマンドを処理
   */
  private async handleDatabaseCommand(command: string, context: PersonaContext): Promise<string> {
    return `## データベース設計提案

### スキーマ設計原則
- 正規化とパフォーマンスのバランス
- インデックス戦略の最適化
- 制約とリレーションシップの設計

### パフォーマンス最適化
- クエリ最適化
- 接続プール設定
- キャッシュ戦略

### マイグレーション戦略
- バージョン管理
- ロールバック計画
- ダウンタイム最小化

技術スタックに応じた具体的な実装方法をご提案いたします。`;
  }

  /**
   * アーキテクチャコマンドを処理
   */
  private async handleArchitectureCommand(command: string, context: PersonaContext): Promise<string> {
    return `## アーキテクチャ設計提案

### マイクロサービス設計原則
- サービス境界の定義
- データ一貫性の管理
- 非同期通信パターン

### スケーラビリティ対応
- 水平スケーリング設計
- ロードバランシング
- 分散システム設計

### 監視・運用性
- ヘルスチェック実装
- ログ集約
- メトリクス収集

現在のプロジェクト規模と要件に最適化されたアーキテクチャをご提案いたします。`;
  }

  /**
   * パフォーマンスコマンドを処理
   */
  private async handlePerformanceCommand(command: string, context: PersonaContext): Promise<string> {
    return `## パフォーマンス最適化提案

### アプリケーションレベル最適化
- 非同期処理の活用
- メモリ使用量の最適化
- CPU集約的処理の改善

### データベース最適化
- インデックス最適化
- クエリ最適化
- コネクションプール調整

### システムレベル最適化
- キャッシュ戦略
- CDN活用
- ロードバランシング

具体的なボトルネックの特定と改善方法をご提案いたします。`;
  }

  /**
   * セキュリティコマンドを処理
   */
  private async handleSecurityCommand(command: string, context: PersonaContext): Promise<string> {
    return `## セキュリティ設計提案

### 認証・認可
- JWT実装
- RBAC設計
- OAuth2.0統合

### データ保護
- 暗号化戦略
- 個人情報保護
- セキュアな通信

### セキュリティ強化
- 入力値検証
- SQLインジェクション対策
- XSS対策

包括的なセキュリティ対策をご提案いたします。`;
  }

  /**
   * 一般的なバックエンドコマンドを処理
   */
  private async handleGeneralBackendCommand(command: string, context: PersonaContext): Promise<string> {
    return `## バックエンド開発支援

バックエンドアーキテクトとして、以下の領域でサポートいたします：

- API設計・開発
- データベース設計・最適化
- アーキテクチャ設計
- パフォーマンス最適化
- セキュリティ強化

具体的なご要望をお聞かせください。プロジェクトに最適な解決策をご提案いたします。`;
  }
}