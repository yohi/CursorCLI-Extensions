import {
  PersonaCapability,
  PersonaContext,
  PersonaPrompt,
  PersonaResponse,
  OutputFormat,
  ProjectType,
  AdaptationStrategy
} from '../../types/index.js';
import { BasePersona, PersonaConfig } from '../base-persona.js';
import { PromptTemplate } from '../../core/interfaces.js';

export class BackendArchitectPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      name: 'Backend Architect',
      description: 'バックエンドシステムの設計と実装に特化したAIペルソナ。スケーラブルなアーキテクチャ、API設計、データベース設計、パフォーマンス最適化を専門とします。',
      version: '1.0.0',
      capabilities: [
        PersonaCapability.CODE_GENERATION,
        PersonaCapability.ARCHITECTURE_DESIGN,
        PersonaCapability.PERFORMANCE_OPTIMIZATION,
        PersonaCapability.DATABASE_DESIGN,
        PersonaCapability.API_DESIGN,
        PersonaCapability.SECURITY_ANALYSIS,
        PersonaCapability.TESTING_STRATEGY,
        PersonaCapability.DOCUMENTATION
      ],
      defaultPromptTemplate: {
        id: 'backend-architect-template',
        name: 'Backend Architect Template',
        template: `あなたはバックエンドアーキテクトとして、以下のリクエストにお答えください：

プロジェクト情報：
- プロジェクト名: {{PROJECT_NAME}}
- プロジェクトタイプ: {{PROJECT_TYPE}}
- 技術スタック: {{TECH_STACK}}

ユーザーリクエスト：
{{USER_INPUT}}

以下の観点から専門的なアドバイスを提供してください：
1. アーキテクチャ設計
2. パフォーマンス考慮事項
3. スケーラビリティ
4. セキュリティ
5. ベストプラクティス

回答は具体的で実装可能な内容にしてください。`,
        variables: [
          {
            name: 'PROJECT_NAME',
            description: 'プロジェクト名',
            required: false,
            defaultValue: '不明'
          },
          {
            name: 'PROJECT_TYPE',
            description: 'プロジェクトタイプ',
            required: false,
            defaultValue: 'API_SERVICE'
          },
          {
            name: 'TECH_STACK',
            description: '技術スタック情報',
            required: false,
            defaultValue: '未指定'
          }
        ]
      },
      learningEnabled: true,
      adaptationStrategy: AdaptationStrategy.PERFORMANCE_BASED,
      memoryRetention: {
        shortTerm: 24 * 60 * 60 * 1000, // 24時間
        longTerm: 30 * 24 * 60 * 60 * 1000, // 30日
        maxEntries: 1000
      },
      responseConstraints: {
        maxLength: 8000,
        minConfidence: 0.7,
        timeoutMs: 15000
      },
      knowledgeBaseConfig: {
        domains: [
          'backend-architecture',
          'database-design',
          'api-design',
          'microservices',
          'cloud-architecture',
          'devops',
          'security',
          'performance-optimization'
        ],
        sources: [
          'architecture-patterns',
          'best-practices',
          'technology-documentation'
        ],
        updateFrequency: 24 * 60 * 60 * 1000 // 24時間
      }
    };

    super(config);
  }

  protected async generateResponse(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<PersonaResponse> {
    // プロンプトの分析
    const analysis = await this.analyzePrompt(prompt, context);
    
    // 専門知識の適用
    const expertResponse = await this.applyBackendExpertise(analysis, context);
    
    // 応答の構築
    const response: PersonaResponse = {
      id: `backend-response-${Date.now()}`,
      content: expertResponse.content,
      confidence: expertResponse.confidence,
      format: OutputFormat.MARKDOWN,
      suggestions: expertResponse.suggestions,
      codeExamples: expertResponse.codeExamples,
      metadata: {
        executionTime: 0, // 実行時間は BasePersona で設定
        tokensUsed: this.estimateTokenUsage(expertResponse.content),
        modelUsed: 'backend-architect-v1',
        cacheHit: false,
        resourcesUsed: {
          memory: 0,
          cpu: 0,
          diskIO: 0,
          networkIO: 0
        }
      },
      timestamp: new Date()
    };

    return response;
  }

  protected async initializeResources(): Promise<void> {
    // バックエンドアーキテクト固有のリソース初期化
    await this.loadArchitecturePatterns();
    await this.loadBestPractices();
    await this.initializeDesignPatterns();
  }

  protected async cleanupResources(): Promise<void> {
    // リソースのクリーンアップ
    // 実装は必要に応じて追加
  }

  private async analyzePrompt(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<PromptAnalysis> {
    const content = prompt.content.toLowerCase();
    
    // キーワード分析
    const architectureKeywords = [
      'architecture', 'design', 'pattern', 'structure',
      'microservices', 'monolith', 'api', 'rest', 'graphql'
    ];
    
    const databaseKeywords = [
      'database', 'db', 'sql', 'nosql', 'postgresql', 'mongodb',
      'redis', 'elasticsearch', 'schema', 'migration'
    ];
    
    const performanceKeywords = [
      'performance', 'optimization', 'scale', 'cache', 'load',
      'throughput', 'latency', 'bottleneck'
    ];
    
    const securityKeywords = [
      'security', 'auth', 'authentication', 'authorization',
      'jwt', 'oauth', 'encryption', 'validation'
    ];

    return {
      category: this.determineCategory(content, {
        architecture: architectureKeywords,
        database: databaseKeywords,
        performance: performanceKeywords,
        security: securityKeywords
      }),
      complexity: this.assessComplexity(prompt, context),
      projectContext: this.analyzeProjectContext(context),
      keyTopics: this.extractKeyTopics(content)
    };
  }

  private determineCategory(
    content: string,
    keywordSets: Record<string, string[]>
  ): string {
    let maxScore = 0;
    let bestCategory = 'general';

    for (const [category, keywords] of Object.entries(keywordSets)) {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (content.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private assessComplexity(prompt: PersonaPrompt, context: PersonaContext): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;

    // プロンプト長による評価
    if (prompt.content.length > 500) complexityScore += 1;
    if (prompt.content.length > 1000) complexityScore += 1;

    // プロジェクトの複雑性
    if (context.project) {
      if (context.project.type === ProjectType.MICROSERVICES) complexityScore += 2;
      if (context.project.technologies.frameworks.length > 3) complexityScore += 1;
      if (context.project.technologies.databases.length > 1) complexityScore += 1;
    }

    // 技術的なキーワードの数
    const technicalKeywords = [
      'distributed', 'concurrent', 'asynchronous', 'event-driven',
      'message-queue', 'load-balancing', 'clustering'
    ];
    const technicalKeywordCount = technicalKeywords.reduce((count, keyword) => {
      return count + (prompt.content.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    complexityScore += technicalKeywordCount;

    if (complexityScore <= 2) return 'simple';
    if (complexityScore <= 5) return 'medium';
    return 'complex';
  }

  private analyzeProjectContext(context: PersonaContext): ProjectAnalysis {
    return {
      type: context.project?.type || ProjectType.API_SERVICE,
      scale: this.estimateProjectScale(context),
      technologies: context.project?.technologies || { languages: [], frameworks: [], databases: [], tools: [], platforms: [] },
      constraints: this.identifyConstraints(context)
    };
  }

  private estimateProjectScale(context: PersonaContext): 'small' | 'medium' | 'large' | 'enterprise' {
    if (!context.project) return 'small';

    let scaleScore = 0;

    // ファイル数による評価
    const fileCount = context.project.structure?.files.length || 0;
    if (fileCount > 50) scaleScore += 1;
    if (fileCount > 200) scaleScore += 1;
    if (fileCount > 500) scaleScore += 1;

    // 技術スタックの複雑性
    const techComplexity = 
      (context.project.technologies.languages.length || 0) +
      (context.project.technologies.frameworks.length || 0) +
      (context.project.technologies.databases.length || 0);
    
    if (techComplexity > 5) scaleScore += 1;
    if (techComplexity > 10) scaleScore += 1;

    if (scaleScore <= 1) return 'small';
    if (scaleScore <= 3) return 'medium';
    if (scaleScore <= 5) return 'large';
    return 'enterprise';
  }

  private identifyConstraints(context: PersonaContext): string[] {
    const constraints: string[] = [];

    // ユーザーの制約からの推測
    if (context.user?.preferences?.verbosity === 'minimal') {
      constraints.push('concise-responses');
    }

    // プロジェクトタイプに基づく制約
    if (context.project?.type === ProjectType.LIBRARY) {
      constraints.push('minimal-dependencies');
    }

    return constraints;
  }

  private extractKeyTopics(content: string): string[] {
    const topics: string[] = [];
    const topicPatterns = [
      { pattern: /api.*(design|development)/i, topic: 'api-design' },
      { pattern: /database.*(design|schema)/i, topic: 'database-design' },
      { pattern: /performance.*(optimization|tuning)/i, topic: 'performance-optimization' },
      { pattern: /security.*(implementation|audit)/i, topic: 'security' },
      { pattern: /architecture.*(pattern|design)/i, topic: 'architecture' },
      { pattern: /microservices?/i, topic: 'microservices' },
      { pattern: /docker|container/i, topic: 'containerization' },
      { pattern: /kubernetes|k8s/i, topic: 'orchestration' }
    ];

    topicPatterns.forEach(({ pattern, topic }) => {
      if (pattern.test(content)) {
        topics.push(topic);
      }
    });

    return topics;
  }

  private async applyBackendExpertise(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    const { category, complexity, projectContext } = analysis;

    switch (category) {
      case 'architecture':
        return this.generateArchitectureAdvice(analysis, context);
      case 'database':
        return this.generateDatabaseAdvice(analysis, context);
      case 'performance':
        return this.generatePerformanceAdvice(analysis, context);
      case 'security':
        return this.generateSecurityAdvice(analysis, context);
      default:
        return this.generateGeneralBackendAdvice(analysis, context);
    }
  }

  private async generateArchitectureAdvice(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    const content = this.buildArchitectureResponse(analysis, context);
    const suggestions = this.generateArchitectureSuggestions(analysis);
    const codeExamples = await this.generateArchitectureCodeExamples(analysis);

    return {
      content,
      confidence: 0.9,
      suggestions,
      codeExamples
    };
  }

  private buildArchitectureResponse(analysis: PromptAnalysis, context: PersonaContext): string {
    const { complexity, projectContext } = analysis;
    
    let response = `# バックエンドアーキテクチャ設計\n\n`;
    
    // プロジェクト概要
    response += `## プロジェクト分析\n`;
    response += `- **規模**: ${projectContext.scale}\n`;
    response += `- **複雑性**: ${complexity}\n`;
    response += `- **プロジェクトタイプ**: ${projectContext.type}\n\n`;

    // アーキテクチャ推奨事項
    response += `## アーキテクチャ推奨事項\n\n`;
    
    switch (projectContext.scale) {
      case 'small':
        response += this.getSmallScaleArchitectureAdvice();
        break;
      case 'medium':
        response += this.getMediumScaleArchitectureAdvice();
        break;
      case 'large':
      case 'enterprise':
        response += this.getLargeScaleArchitectureAdvice();
        break;
    }

    // 技術選択の推奨
    response += `\n## 技術選択の推奨\n\n`;
    response += this.generateTechnologyRecommendations(projectContext);

    // ベストプラクティス
    response += `\n## ベストプラクティス\n\n`;
    response += this.generateBestPractices(complexity);

    return response;
  }

  private getSmallScaleArchitectureAdvice(): string {
    return `### モノリシックアーキテクチャ

小規模プロジェクトには、シンプルなモノリシックアーキテクチャを推奨します：

- **メリット**: 開発・デプロイが簡単、デバッグしやすい
- **構成**: 単一のアプリケーション、単一のデータベース
- **パターン**: レイヤードアーキテクチャ、MVC パターン

### 推奨構造
\`\`\`
src/
  controllers/     # リクエストハンドリング
  services/        # ビジネスロジック
  repositories/    # データアクセス
  models/          # データモデル
  utils/           # ユーティリティ
\`\`\``;
  }

  private getMediumScaleArchitectureAdvice(): string {
    return `### モジュラーモノリス

中規模プロジェクトには、モジュラーモノリスを推奨します：

- **メリット**: モノリスの簡潔性とモジュール性の両立
- **構成**: 機能別モジュール、共有データベース
- **パターン**: ヘキサゴナルアーキテクチャ、DDD

### 推奨構造
\`\`\`
src/
  modules/
    user/            # ユーザー管理モジュール
    product/         # 商品管理モジュール
    order/           # 注文管理モジュール
  shared/            # 共有コンポーネント
  infrastructure/    # インフラストラクチャ
\`\`\``;
  }

  private getLargeScaleArchitectureAdvice(): string {
    return `### マイクロサービスアーキテクチャ

大規模プロジェクトには、マイクロサービスアーキテクチャを推奨します：

- **メリット**: 独立したスケーラビリティ、技術の多様性
- **構成**: 複数の独立したサービス、専用データベース
- **パターン**: API Gateway、Event Sourcing、CQRS

### アーキテクチャコンポーネント
- **API Gateway**: リクエストルーティング、認証
- **Service Discovery**: サービスの動的発見
- **Message Queue**: 非同期通信
- **Monitoring**: 分散トレーシング、メトリクス`;
  }

  private generateTechnologyRecommendations(projectContext: ProjectAnalysis): string {
    let recommendations = '';

    // 言語推奨
    if (projectContext.technologies.languages.length === 0) {
      recommendations += `### プログラミング言語
- **Node.js/TypeScript**: 高速開発、フルスタック統一
- **Python**: データ処理、ML統合
- **Java**: エンタープライズ、高パフォーマンス
- **Go**: 高並行性、軽量

`;
    }

    // データベース推奨
    recommendations += `### データベース選択
- **PostgreSQL**: リレーショナルデータ、ACID準拠
- **MongoDB**: ドキュメント指向、柔軟なスキーマ
- **Redis**: キャッシュ、セッション管理
- **Elasticsearch**: 全文検索、ログ分析

`;

    return recommendations;
  }

  private generateBestPractices(complexity: 'simple' | 'medium' | 'complex'): string {
    let practices = `### 共通ベストプラクティス
- **SOLID原則**: 保守性の高い設計
- **テスト駆動開発**: 品質保証とドキュメント化
- **継続的インテグレーション**: 自動ビルド・テスト
- **ログ・モニタリング**: 運用可視性

`;

    if (complexity === 'complex') {
      practices += `### 複雑なシステム向け
- **Circuit Breaker**: 障害の連鎖を防止
- **Bulkhead Pattern**: リソース分離
- **Saga Pattern**: 分散トランザクション
- **Event Sourcing**: データ変更の完全な履歴

`;
    }

    return practices;
  }

  private generateArchitectureSuggestions(analysis: PromptAnalysis): string[] {
    const suggestions: string[] = [
      '設計文書を作成し、チーム全体で共有してください',
      'プロトタイプを作成して、アーキテクチャを検証してください',
      '非機能要件（パフォーマンス、可用性等）を明確にしてください'
    ];

    if (analysis.complexity === 'complex') {
      suggestions.push(
        'アーキテクチャ決定記録（ADR）を作成してください',
        '段階的な移行計画を策定してください'
      );
    }

    return suggestions;
  }

  private async generateArchitectureCodeExamples(analysis: PromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    const examples: Array<{ language: string; code: string; description: string }> = [];

    // Express.js APIの基本構造例
    examples.push({
      language: 'typescript',
      code: `// src/app.ts
import express from 'express';
import { UserController } from './controllers/UserController';
import { UserService } from './services/UserService';
import { UserRepository } from './repositories/UserRepository';

const app = express();

// 依存性注入
const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// ミドルウェア
app.use(express.json());
app.use('/api/users', userController.router);

export default app;`,
      description: 'レイヤードアーキテクチャの基本構造'
    });

    if (analysis.complexity !== 'simple') {
      examples.push({
        language: 'typescript',
        code: `// src/modules/user/domain/User.ts
export class User {
  constructor(
    private readonly id: string,
    private readonly email: string,
    private readonly name: string
  ) {}

  changeEmail(newEmail: string): void {
    if (!this.isValidEmail(newEmail)) {
      throw new Error('Invalid email format');
    }
    // ドメインイベントの発行
    DomainEvents.raise(new UserEmailChanged(this.id, newEmail));
  }

  private isValidEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }
}`,
        description: 'ドメイン駆動設計のドメインエンティティ例'
      });
    }

    return examples;
  }

  private async generateDatabaseAdvice(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    // データベース設計のアドバイス生成
    const content = `# データベース設計アドバイス\n\n` +
      `プロジェクトの規模と要件に基づいて、適切なデータベース設計をご提案します。\n\n` +
      this.generateDatabaseDesignGuidance(analysis, context);

    return {
      content,
      confidence: 0.85,
      suggestions: [
        'データモデルの正規化を検討してください',
        'インデックス戦略を計画してください',
        'データ移行戦略を策定してください'
      ],
      codeExamples: await this.generateDatabaseCodeExamples(analysis)
    };
  }

  private generateDatabaseDesignGuidance(analysis: PromptAnalysis, context: PersonaContext): string {
    // データベース設計のガイダンスを生成
    return `## データベース選択指針\n\n実装の詳細は省略しますが、プロジェクトに適したデータベース設計をご提案いたします。`;
  }

  private async generateDatabaseCodeExamples(analysis: PromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'sql',
      code: `-- ユーザーテーブルの例
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);`,
      description: 'PostgreSQLでの基本的なユーザーテーブル設計'
    }];
  }

  private async generatePerformanceAdvice(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    const content = `# パフォーマンス最適化アドバイス\n\n` +
      `システムのパフォーマンスを向上させるための戦略をご提案します。\n\n` +
      this.generatePerformanceOptimizationGuidance(analysis, context);

    return {
      content,
      confidence: 0.88,
      suggestions: [
        'パフォーマンステストを定期的に実行してください',
        'ボトルネックを特定するためのプロファイリングツールを使用してください',
        'キャッシュ戦略を実装してください'
      ],
      codeExamples: await this.generatePerformanceCodeExamples(analysis)
    };
  }

  private generatePerformanceOptimizationGuidance(analysis: PromptAnalysis, context: PersonaContext): string {
    return `## パフォーマンス改善戦略\n\n具体的な最適化手法については実装レベルで詳細をご提案いたします。`;
  }

  private async generatePerformanceCodeExamples(analysis: PromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// Redis キャッシュの実装例
import Redis from 'ioredis';

class CacheService {
  private redis = new Redis();

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}`,
      description: 'Redisを使用した基本的なキャッシュサービス'
    }];
  }

  private async generateSecurityAdvice(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    const content = `# セキュリティ実装アドバイス\n\n` +
      `アプリケーションのセキュリティを強化するための推奨事項をご提案します。\n\n` +
      this.generateSecurityGuidance(analysis, context);

    return {
      content,
      confidence: 0.92,
      suggestions: [
        'セキュリティ監査を定期的に実施してください',
        '最新のセキュリティ脆弱性情報をチェックしてください',
        'セキュリティテストを自動化してください'
      ],
      codeExamples: await this.generateSecurityCodeExamples(analysis)
    };
  }

  private generateSecurityGuidance(analysis: PromptAnalysis, context: PersonaContext): string {
    return `## セキュリティベストプラクティス\n\nセキュリティの実装詳細については、プロジェクトの要件に応じてご提案いたします。`;
  }

  private async generateSecurityCodeExamples(analysis: PromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// JWT認証の実装例
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AuthService {
  async login(email: string, password: string): Promise<string | null> {
    const user = await this.getUserByEmail(email);
    if (!user || !await bcrypt.compare(password, user.hashedPassword)) {
      return null;
    }
    
    return jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
  }
}`,
      description: 'JWT を使用した基本的な認証実装'
    }];
  }

  private async generateGeneralBackendAdvice(
    analysis: PromptAnalysis,
    context: PersonaContext
  ): Promise<ExpertResponse> {
    const content = `# バックエンド開発アドバイス\n\n` +
      `総合的な観点からバックエンド開発のベストプラクティスをご提案します。\n\n` +
      this.generateGeneralGuidance(analysis, context);

    return {
      content,
      confidence: 0.8,
      suggestions: [
        'プロジェクトの要件を明確にしてください',
        '適切な設計パターンを選択してください',
        'テストカバレッジを向上させてください'
      ],
      codeExamples: await this.generateGeneralCodeExamples(analysis)
    };
  }

  private generateGeneralGuidance(analysis: PromptAnalysis, context: PersonaContext): string {
    return `## 総合的な開発指針\n\nプロジェクトの成功のための包括的なアプローチをご提案いたします。`;
  }

  private async generateGeneralCodeExamples(analysis: PromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// 基本的なエラーハンドリング
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// エラーハンドリングミドルウェア
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code }
    });
  }
  
  console.error(err);
  res.status(500).json({ error: { message: 'Internal Server Error' } });
};`,
      description: '基本的なエラーハンドリングの実装'
    }];
  }

  private estimateTokenUsage(content: string): number {
    // 簡易的なトークン使用量の推定
    return Math.ceil(content.length / 4);
  }

  private async loadArchitecturePatterns(): Promise<void> {
    // アーキテクチャパターンの知識を読み込み
  }

  private async loadBestPractices(): Promise<void> {
    // ベストプラクティスの知識を読み込み
  }

  private async initializeDesignPatterns(): Promise<void> {
    // デザインパターンの知識を初期化
  }
}

// 型定義
interface PromptAnalysis {
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  projectContext: ProjectAnalysis;
  keyTopics: string[];
}

interface ProjectAnalysis {
  type: ProjectType;
  scale: 'small' | 'medium' | 'large' | 'enterprise';
  technologies: {
    languages: any[];
    frameworks: any[];
    databases: any[];
    tools: any[];
    platforms: any[];
  };
  constraints: string[];
}

interface ExpertResponse {
  content: string;
  confidence: number;
  suggestions: string[];
  codeExamples: Array<{
    language: string;
    code: string;
    description: string;
  }>;
}

export default BackendArchitectPersona;