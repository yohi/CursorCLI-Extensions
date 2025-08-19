/**
 * 設計エンジン (/sc:design)
 */

import { EventEmitter } from 'events';
import { 
  CommandContext,
  CommandResult,
  ProjectContext,
  PersonaContext,
  ActivationTrigger
} from '../types';
import { getLogger } from '../core/logger';
import { PersonaManager } from '../personas/persona-manager';
import { CursorAPIIntegration } from '../integrations/cursor-api-integration';
import { FileSystemHandlerImpl } from '../integrations/file-system-handler';
import { ContextAnalyzer } from '../core/context-analyzer';

export interface DesignRequest {
  type: DesignType;
  scope: DesignScope;
  requirements: DesignRequirement[];
  constraints: DesignConstraint[];
  stakeholders?: Stakeholder[];
  timeline?: Timeline;
  budget?: BudgetConstraint;
  technology?: TechnologyPreference[];
}

export type DesignType = 
  | 'architecture' | 'system' | 'database' | 'api' | 'ui-ux'
  | 'security' | 'performance' | 'deployment' | 'integration' | 'microservice';

export type DesignScope = 'new-system' | 'enhancement' | 'migration' | 'optimization' | 'refactoring';

export interface DesignRequirement {
  id: string;
  category: 'functional' | 'non-functional' | 'business' | 'technical';
  priority: 'must-have' | 'should-have' | 'could-have' | 'won\'t-have';
  description: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
}

export interface DesignConstraint {
  type: 'technical' | 'business' | 'regulatory' | 'resource' | 'timeline';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface Stakeholder {
  role: string;
  name?: string;
  interests: string[];
  influence: 'low' | 'medium' | 'high';
}

export interface Timeline {
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  date: Date;
  deliverables: string[];
}

export interface BudgetConstraint {
  total: number;
  currency: string;
  breakdown?: BudgetItem[];
}

export interface BudgetItem {
  category: string;
  amount: number;
  description: string;
}

export interface TechnologyPreference {
  category: 'language' | 'framework' | 'database' | 'cloud' | 'tool';
  preferred: string[];
  prohibited?: string[];
  reasons?: string[];
}

export interface DesignResult {
  success: boolean;
  designs: SystemDesign[];
  documents: DesignDocument[];
  diagrams: DesignDiagram[];
  recommendations: DesignRecommendation[];
  alternatives: DesignAlternative[];
  risks: DesignRisk[];
  estimations: ProjectEstimation;
  nextSteps: string[];
}

export interface SystemDesign {
  id: string;
  name: string;
  type: DesignType;
  description: string;
  components: SystemComponent[];
  interfaces: SystemInterface[];
  dataFlow: DataFlow[];
  architecturalPatterns: string[];
  qualityAttributes: QualityAttribute[];
}

export interface SystemComponent {
  id: string;
  name: string;
  type: 'service' | 'database' | 'gateway' | 'cache' | 'queue' | 'storage';
  description: string;
  responsibilities: string[];
  dependencies: string[];
  interfaces: string[];
  technology?: string;
  configuration?: ComponentConfiguration;
}

export interface ComponentConfiguration {
  resources: ResourceRequirement;
  scaling: ScalingConfiguration;
  monitoring: MonitoringConfiguration;
  security: SecurityConfiguration;
}

export interface ResourceRequirement {
  cpu: string;
  memory: string;
  storage: string;
  network: string;
}

export interface ScalingConfiguration {
  type: 'horizontal' | 'vertical' | 'hybrid';
  minInstances: number;
  maxInstances: number;
  triggers: ScalingTrigger[];
}

export interface ScalingTrigger {
  metric: string;
  threshold: number;
  action: 'scale-up' | 'scale-down';
}

export interface MonitoringConfiguration {
  healthCheck: string;
  metrics: string[];
  alerts: AlertConfiguration[];
}

export interface AlertConfiguration {
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  recipients: string[];
}

export interface SecurityConfiguration {
  authentication: string;
  authorization: string;
  encryption: EncryptionConfiguration;
  compliance: string[];
}

export interface EncryptionConfiguration {
  inTransit: string;
  atRest: string;
  keyManagement: string;
}

export interface SystemInterface {
  id: string;
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'message-queue';
  provider: string;
  consumer: string;
  specification: InterfaceSpecification;
}

export interface InterfaceSpecification {
  format: string;
  protocol: string;
  authentication: string;
  rateLimiting?: RateLimitConfiguration;
  versioning: VersioningStrategy;
}

export interface RateLimitConfiguration {
  requests: number;
  timeWindow: string;
  strategy: 'sliding-window' | 'fixed-window' | 'token-bucket';
}

export interface VersioningStrategy {
  type: 'url' | 'header' | 'parameter';
  pattern: string;
  deprecationPolicy: string;
}

export interface DataFlow {
  id: string;
  name: string;
  source: string;
  destination: string;
  dataType: string;
  volume: DataVolumeSpec;
  frequency: string;
  transformations: DataTransformation[];
}

export interface DataVolumeSpec {
  size: string;
  unit: 'KB' | 'MB' | 'GB' | 'TB';
  peak: string;
}

export interface DataTransformation {
  type: 'filter' | 'aggregate' | 'enrich' | 'validate' | 'format';
  description: string;
  rules: string[];
}

export interface QualityAttribute {
  name: string;
  description: string;
  measurement: string;
  target: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DesignDocument {
  id: string;
  title: string;
  type: 'specification' | 'architecture' | 'api' | 'database' | 'deployment';
  format: 'markdown' | 'html' | 'pdf' | 'confluence';
  content: string;
  sections: DocumentSection[];
  references: string[];
}

export interface DocumentSection {
  title: string;
  content: string;
  subsections?: DocumentSection[];
}

export interface DesignDiagram {
  id: string;
  name: string;
  type: 'architecture' | 'sequence' | 'class' | 'component' | 'deployment' | 'flow';
  format: 'mermaid' | 'plantuml' | 'draw.io' | 'lucidchart';
  content: string;
  description: string;
}

export interface DesignRecommendation {
  id: string;
  category: 'architecture' | 'technology' | 'process' | 'security' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  implementation: ImplementationGuidance;
  impact: ImpactAssessment;
}

export interface ImplementationGuidance {
  steps: string[];
  timeline: string;
  resources: string[];
  risks: string[];
}

export interface ImpactAssessment {
  effort: 'small' | 'medium' | 'large' | 'extra-large';
  cost: 'low' | 'medium' | 'high';
  benefits: string[];
  risks: string[];
}

export interface DesignAlternative {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  tradeoffs: string[];
  suitability: string;
  estimatedCost: number;
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface DesignRisk {
  id: string;
  category: 'technical' | 'business' | 'operational' | 'security';
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: MitigationStrategy;
}

export interface MitigationStrategy {
  approach: 'avoid' | 'mitigate' | 'transfer' | 'accept';
  actions: string[];
  monitoring: string[];
  contingency: string[];
}

export interface ProjectEstimation {
  development: EstimationBreakdown;
  testing: EstimationBreakdown;
  deployment: EstimationBreakdown;
  maintenance: EstimationBreakdown;
  total: EstimationSummary;
}

export interface EstimationBreakdown {
  effort: number; // person-hours
  duration: number; // days
  resources: ResourceEstimate[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ResourceEstimate {
  role: string;
  count: number;
  allocation: number; // percentage
}

export interface EstimationSummary {
  effort: number;
  duration: number;
  cost: number;
  currency: string;
}

export class DesignEngine extends EventEmitter {
  private personaManager: PersonaManager;
  private cursorApi: CursorAPIIntegration;
  private fileSystem: FileSystemHandlerImpl;
  private contextAnalyzer: ContextAnalyzer;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    super();
    this.personaManager = personaManager;
    this.cursorApi = cursorApi;
    this.fileSystem = fileSystem;
    this.contextAnalyzer = contextAnalyzer;
  }

  /**
   * 設計リクエストを処理
   */
  public async processDesignRequest(
    request: DesignRequest,
    context: CommandContext
  ): Promise<DesignResult> {
    const logger = getLogger();
    const startTime = Date.now();

    try {
      logger.info('設計リクエストを処理開始', {
        type: request.type,
        scope: request.scope,
        requirements: request.requirements.length,
      });

      // プロジェクトコンテキストを取得
      const projectContext = await this.cursorApi.getProjectContext();

      // ペルソナコンテキストを作成
      const personaContext = this.createPersonaContext(request, projectContext, context);

      // ペルソナを選択・活性化
      const selectedPersonas = await this.personaManager.selectPersonas(personaContext);
      const activatedPersonas = await this.personaManager.activatePersonas(selectedPersonas, personaContext);

      if (activatedPersonas.length === 0) {
        throw new Error('適切なペルソナを活性化できませんでした');
      }

      // 設計プロセスを実行
      const designs = await this.generateSystemDesigns(request, projectContext);
      const documents = await this.generateDesignDocuments(designs, request);
      const diagrams = await this.generateDesignDiagrams(designs, request);
      const recommendations = await this.generateRecommendations(designs, request);
      const alternatives = await this.generateAlternatives(designs, request);
      const risks = await this.assessRisks(designs, request);
      const estimations = await this.generateEstimations(designs, request);
      const nextSteps = this.generateNextSteps(designs, request);

      const executionTime = Date.now() - startTime;

      const result: DesignResult = {
        success: true,
        designs,
        documents,
        diagrams,
        recommendations,
        alternatives,
        risks,
        estimations,
        nextSteps,
      };

      this.emit('designCompleted', {
        request,
        result,
        executionTime,
        activatedPersonas: activatedPersonas.map(p => p.getId()),
      });

      logger.info('設計リクエスト処理完了', {
        success: result.success,
        designsCount: designs.length,
        documentsCount: documents.length,
        executionTime,
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('設計リクエスト処理に失敗', {
        error: errorMessage,
        executionTime,
      });

      return {
        success: false,
        designs: [],
        documents: [],
        diagrams: [],
        recommendations: [],
        alternatives: [],
        risks: [],
        estimations: this.createEmptyEstimation(),
        nextSteps: ['エラーを修正してから再試行してください'],
      };
    } finally {
      // ペルソナを非活性化
      await this.personaManager.deactivatePersonas();
    }
  }

  // プライベートメソッド

  /**
   * ペルソナコンテキストを作成
   */
  private createPersonaContext(
    request: DesignRequest,
    projectContext: ProjectContext,
    commandContext: CommandContext
  ): PersonaContext {
    const trigger: ActivationTrigger = {
      type: 'command',
      data: {
        command: 'design',
        type: request.type,
        scope: request.scope,
        requirements: request.requirements.map(r => r.description),
      },
      timestamp: new Date(),
    };

    return {
      trigger,
      projectContext,
      command: `design: ${request.type} for ${request.scope}`,
      timestamp: new Date(),
    };
  }

  /**
   * システム設計を生成
   */
  private async generateSystemDesigns(
    request: DesignRequest,
    projectContext: ProjectContext
  ): Promise<SystemDesign[]> {
    const logger = getLogger();

    try {
      logger.debug('システム設計を生成中', { type: request.type });

      // ペルソナに設計生成を依頼
      const command = `Generate ${request.type} design for ${request.scope}:
Requirements: ${request.requirements.map(r => r.description).join(', ')}
Constraints: ${request.constraints.map(c => c.description).join(', ')}
Project context: ${projectContext.type} using ${projectContext.technologies.languages.join(', ')}`;

      const personaResponses = await this.personaManager.processCommand(command);

      const designs: SystemDesign[] = [];

      if (personaResponses.length > 0 && personaResponses[0].success) {
        // ペルソナの応答から設計を構築
        const design = this.parseDesignFromPersonaResponse(
          personaResponses[0].output,
          request,
          projectContext
        );
        designs.push(design);
      }

      // プロジェクトタイプに基づく追加設計
      const additionalDesign = this.generateBaseDesign(request, projectContext);
      if (additionalDesign) {
        designs.push(additionalDesign);
      }

      return designs;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('システム設計生成に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * 設計ドキュメントを生成
   */
  private async generateDesignDocuments(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<DesignDocument[]> {
    const documents: DesignDocument[] = [];

    for (const design of designs) {
      const document: DesignDocument = {
        id: `doc-${design.id}`,
        title: `${design.name} - 設計仕様書`,
        type: 'specification',
        format: 'markdown',
        content: this.generateDesignDocumentContent(design, request),
        sections: [
          {
            title: '概要',
            content: design.description,
          },
          {
            title: 'アーキテクチャ',
            content: 'アーキテクチャの詳細...',
          },
          {
            title: 'コンポーネント',
            content: design.components.map(c => `- ${c.name}: ${c.description}`).join('\n'),
          },
        ],
        references: [],
      };

      documents.push(document);
    }

    return documents;
  }

  /**
   * 設計図を生成
   */
  private async generateDesignDiagrams(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<DesignDiagram[]> {
    const diagrams: DesignDiagram[] = [];

    for (const design of designs) {
      // システムアーキテクチャ図
      diagrams.push({
        id: `arch-${design.id}`,
        name: `${design.name} - アーキテクチャ図`,
        type: 'architecture',
        format: 'mermaid',
        content: this.generateArchitectureDiagram(design),
        description: 'システム全体のアーキテクチャを示す図',
      });

      // コンポーネント図
      if (design.components.length > 0) {
        diagrams.push({
          id: `comp-${design.id}`,
          name: `${design.name} - コンポーネント図`,
          type: 'component',
          format: 'mermaid',
          content: this.generateComponentDiagram(design),
          description: 'システムコンポーネントの関係を示す図',
        });
      }

      // データフロー図
      if (design.dataFlow.length > 0) {
        diagrams.push({
          id: `flow-${design.id}`,
          name: `${design.name} - データフロー図`,
          type: 'flow',
          format: 'mermaid',
          content: this.generateDataFlowDiagram(design),
          description: 'データの流れを示す図',
        });
      }
    }

    return diagrams;
  }

  /**
   * 推奨事項を生成
   */
  private async generateRecommendations(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<DesignRecommendation[]> {
    const recommendations: DesignRecommendation[] = [];

    // 一般的な推奨事項
    recommendations.push({
      id: 'monitoring-observability',
      category: 'architecture',
      priority: 'high',
      title: '監視・可観測性の実装',
      description: 'システムの健全性を監視するための仕組みを実装してください',
      rationale: '本番環境での問題の早期発見と対応のため',
      implementation: {
        steps: [
          'ログ集約システムの実装',
          'メトリクス収集の設定',
          'アラート設定',
          'ダッシュボード作成',
        ],
        timeline: '2-3週間',
        resources: ['DevOpsエンジニア', '開発者'],
        risks: ['実装の複雑さ', 'パフォーマンスへの影響'],
      },
      impact: {
        effort: 'medium',
        cost: 'medium',
        benefits: ['問題の早期発見', '運用効率の向上', 'システムの信頼性向上'],
        risks: ['初期実装コスト', '運用学習コスト'],
      },
    });

    // セキュリティ推奨事項
    recommendations.push({
      id: 'security-implementation',
      category: 'security',
      priority: 'critical',
      title: 'セキュリティ対策の実装',
      description: 'OWASP Top 10 に基づくセキュリティ対策を実装してください',
      rationale: 'セキュリティインシデントの防止のため',
      implementation: {
        steps: [
          '認証・認可の実装',
          '入力値検証',
          'HTTPS通信の強制',
          '定期的なセキュリティ監査',
        ],
        timeline: '3-4週間',
        resources: ['セキュリティ専門家', '開発者'],
        risks: ['実装の複雑さ', 'ユーザビリティへの影響'],
      },
      impact: {
        effort: 'large',
        cost: 'high',
        benefits: ['セキュリティリスクの軽減', 'コンプライアンス遵守'],
        risks: ['開発工数の増加', '機能リリースの遅延'],
      },
    });

    return recommendations;
  }

  /**
   * 代替案を生成
   */
  private async generateAlternatives(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<DesignAlternative[]> {
    const alternatives: DesignAlternative[] = [];

    // モノリシック vs マイクロサービス
    if (request.type === 'architecture') {
      alternatives.push({
        id: 'monolithic-approach',
        name: 'モノリシックアーキテクチャ',
        description: '単一のデプロイ可能な単位として構築',
        pros: [
          '開発の初期段階で簡単',
          'デプロイメントが単純',
          'テストが容易',
          '運用が簡素',
        ],
        cons: [
          'スケーラビリティの制限',
          '技術選択の制約',
          'チーム間の依存関係',
        ],
        tradeoffs: [
          '初期の開発速度 vs 長期的な柔軟性',
          '運用の簡単さ vs スケーラビリティ',
        ],
        suitability: '小〜中規模のプロジェクト、少人数チーム',
        estimatedCost: 100000,
        implementationComplexity: 'low',
      });

      alternatives.push({
        id: 'microservices-approach',
        name: 'マイクロサービスアーキテクチャ',
        description: '小さな独立したサービスの集合として構築',
        pros: [
          '技術選択の自由度',
          '独立したデプロイメント',
          'チームの自律性',
          '障害の局所化',
        ],
        cons: [
          '運用の複雑さ',
          'ネットワーク通信のオーバーヘッド',
          '分散システムの課題',
        ],
        tradeoffs: [
          '運用の複雑さ vs スケーラビリティ',
          '初期コスト vs 長期的な保守性',
        ],
        suitability: '大規模プロジェクト、複数チーム',
        estimatedCost: 250000,
        implementationComplexity: 'high',
      });
    }

    return alternatives;
  }

  /**
   * リスクを評価
   */
  private async assessRisks(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<DesignRisk[]> {
    const risks: DesignRisk[] = [];

    // 技術的リスク
    risks.push({
      id: 'scalability-risk',
      category: 'technical',
      probability: 'medium',
      impact: 'high',
      description: 'システムのスケーラビリティが要件を満たさない可能性',
      mitigation: {
        approach: 'mitigate',
        actions: [
          'ロードテストの実施',
          'パフォーマンス監視の実装',
          'スケーリング戦略の準備',
        ],
        monitoring: [
          'レスポンス時間の監視',
          'スループットの監視',
          'リソース使用率の監視',
        ],
        contingency: [
          'インフラの増強',
          'アーキテクチャの見直し',
        ],
      },
    });

    // ビジネスリスク
    risks.push({
      id: 'requirement-change-risk',
      category: 'business',
      probability: 'high',
      impact: 'medium',
      description: '開発中に要件が大幅に変更される可能性',
      mitigation: {
        approach: 'mitigate',
        actions: [
          'アジャイル開発手法の採用',
          'ステークホルダーとの定期的なコミュニケーション',
          '柔軟性のあるアーキテクチャ設計',
        ],
        monitoring: [
          '要件変更の追跡',
          'スコープクリープの監視',
        ],
        contingency: [
          'プロジェクトスコープの再調整',
          'タイムラインの見直し',
        ],
      },
    });

    return risks;
  }

  /**
   * プロジェクト見積もりを生成
   */
  private async generateEstimations(
    designs: SystemDesign[],
    request: DesignRequest
  ): Promise<ProjectEstimation> {
    // 簡略化された見積もり
    const baseEffort = this.calculateBaseEffort(designs, request);
    
    const development: EstimationBreakdown = {
      effort: baseEffort,
      duration: Math.ceil(baseEffort / 160), // 1人月 = 160時間
      resources: [
        { role: 'シニア開発者', count: 2, allocation: 100 },
        { role: '開発者', count: 3, allocation: 100 },
      ],
      confidence: 'medium',
    };

    const testing: EstimationBreakdown = {
      effort: Math.round(baseEffort * 0.3),
      duration: Math.ceil(development.duration * 0.5),
      resources: [
        { role: 'QAエンジニア', count: 2, allocation: 100 },
      ],
      confidence: 'medium',
    };

    const deployment: EstimationBreakdown = {
      effort: Math.round(baseEffort * 0.1),
      duration: 5,
      resources: [
        { role: 'DevOpsエンジニア', count: 1, allocation: 100 },
      ],
      confidence: 'high',
    };

    const maintenance: EstimationBreakdown = {
      effort: Math.round(baseEffort * 0.2),
      duration: 365, // 1年間
      resources: [
        { role: '開発者', count: 1, allocation: 50 },
      ],
      confidence: 'low',
    };

    const totalEffort = development.effort + testing.effort + deployment.effort;
    const totalDuration = Math.max(development.duration, testing.duration) + deployment.duration;

    return {
      development,
      testing,
      deployment,
      maintenance,
      total: {
        effort: totalEffort,
        duration: totalDuration,
        cost: totalEffort * 100, // 1時間あたり100ドル
        currency: 'USD',
      },
    };
  }

  /**
   * 次のステップを生成
   */
  private generateNextSteps(
    designs: SystemDesign[],
    request: DesignRequest
  ): string[] {
    const nextSteps: string[] = [];

    nextSteps.push('設計ドキュメントをレビューしてください');
    nextSteps.push('ステークホルダーからのフィードバックを収集してください');
    nextSteps.push('技術的なプロトタイプの作成を検討してください');
    
    if (request.type === 'architecture') {
      nextSteps.push('アーキテクチャ決定記録（ADR）を作成してください');
    }
    
    nextSteps.push('開発チームと設計内容を共有してください');
    nextSteps.push('実装計画を立案してください');

    return nextSteps;
  }

  // ヘルパーメソッド

  private parseDesignFromPersonaResponse(
    response: string,
    request: DesignRequest,
    projectContext: ProjectContext
  ): SystemDesign {
    // ペルソナの応答から設計情報を抽出（簡略化）
    return {
      id: `persona-design-${Date.now()}`,
      name: `${request.type} Design`,
      type: request.type,
      description: response.substring(0, 200) + '...',
      components: [],
      interfaces: [],
      dataFlow: [],
      architecturalPatterns: ['layered', 'mvc'],
      qualityAttributes: [
        {
          name: 'Performance',
          description: 'System response time',
          measurement: 'Response time < 200ms',
          target: '95th percentile',
          priority: 'high',
        },
      ],
    };
  }

  private generateBaseDesign(
    request: DesignRequest,
    projectContext: ProjectContext
  ): SystemDesign | null {
    if (request.type === 'architecture') {
      return {
        id: 'base-architecture',
        name: 'Base System Architecture',
        type: 'architecture',
        description: '基本的なシステムアーキテクチャ',
        components: [
          {
            id: 'web-server',
            name: 'Web Server',
            type: 'service',
            description: 'HTTP requests handling',
            responsibilities: ['Request routing', 'Response formatting'],
            dependencies: ['database', 'cache'],
            interfaces: ['http-api'],
            technology: 'Express.js',
            configuration: {
              resources: {
                cpu: '2 cores',
                memory: '4GB',
                storage: '20GB',
                network: '1Gbps',
              },
              scaling: {
                type: 'horizontal',
                minInstances: 2,
                maxInstances: 10,
                triggers: [
                  {
                    metric: 'cpu_utilization',
                    threshold: 80,
                    action: 'scale-up',
                  },
                ],
              },
              monitoring: {
                healthCheck: '/health',
                metrics: ['request_count', 'response_time', 'error_rate'],
                alerts: [
                  {
                    condition: 'error_rate > 5%',
                    severity: 'warning',
                    recipients: ['dev-team@company.com'],
                  },
                ],
              },
              security: {
                authentication: 'JWT',
                authorization: 'RBAC',
                encryption: {
                  inTransit: 'TLS 1.3',
                  atRest: 'AES-256',
                  keyManagement: 'AWS KMS',
                },
                compliance: ['GDPR', 'SOC2'],
              },
            },
          },
          {
            id: 'database',
            name: 'Database',
            type: 'database',
            description: 'Data persistence layer',
            responsibilities: ['Data storage', 'Data retrieval', 'Data consistency'],
            dependencies: [],
            interfaces: ['sql'],
            technology: 'PostgreSQL',
            configuration: {
              resources: {
                cpu: '4 cores',
                memory: '8GB',
                storage: '100GB',
                network: '1Gbps',
              },
              scaling: {
                type: 'vertical',
                minInstances: 1,
                maxInstances: 1,
                triggers: [],
              },
              monitoring: {
                healthCheck: 'SELECT 1',
                metrics: ['connection_count', 'query_time', 'disk_usage'],
                alerts: [
                  {
                    condition: 'disk_usage > 80%',
                    severity: 'critical',
                    recipients: ['ops-team@company.com'],
                  },
                ],
              },
              security: {
                authentication: 'Database credentials',
                authorization: 'Role-based',
                encryption: {
                  inTransit: 'SSL',
                  atRest: 'Database encryption',
                  keyManagement: 'Database native',
                },
                compliance: ['GDPR'],
              },
            },
          },
        ],
        interfaces: [
          {
            id: 'http-api',
            name: 'HTTP API',
            type: 'rest',
            provider: 'web-server',
            consumer: 'client',
            specification: {
              format: 'JSON',
              protocol: 'HTTP/1.1',
              authentication: 'Bearer Token',
              rateLimiting: {
                requests: 1000,
                timeWindow: '1hour',
                strategy: 'sliding-window',
              },
              versioning: {
                type: 'url',
                pattern: '/api/v{version}/',
                deprecationPolicy: '6 months notice',
              },
            },
          },
        ],
        dataFlow: [
          {
            id: 'user-data-flow',
            name: 'User Data Processing',
            source: 'client',
            destination: 'database',
            dataType: 'user_data',
            volume: {
              size: '1',
              unit: 'MB',
              peak: '10MB',
            },
            frequency: '100 requests/minute',
            transformations: [
              {
                type: 'validate',
                description: 'Input validation',
                rules: ['Required fields check', 'Data type validation'],
              },
              {
                type: 'enrich',
                description: 'Add metadata',
                rules: ['Timestamp addition', 'User ID enrichment'],
              },
            ],
          },
        ],
        architecturalPatterns: ['layered', 'mvc', 'repository'],
        qualityAttributes: [
          {
            name: 'Availability',
            description: 'System uptime',
            measurement: 'Percentage of uptime',
            target: '99.9%',
            priority: 'critical',
          },
          {
            name: 'Scalability',
            description: 'System ability to handle load',
            measurement: 'Requests per second',
            target: '1000 RPS',
            priority: 'high',
          },
        ],
      };
    }

    return null;
  }

  private generateDesignDocumentContent(design: SystemDesign, request: DesignRequest): string {
    return `# ${design.name} 設計仕様書

## 概要
${design.description}

## アーキテクチャパターン
${design.architecturalPatterns.map(pattern => `- ${pattern}`).join('\n')}

## システムコンポーネント
${design.components.map(component => `
### ${component.name}
- **タイプ**: ${component.type}
- **説明**: ${component.description}
- **責務**: ${component.responsibilities.join(', ')}
- **技術**: ${component.technology || 'TBD'}
`).join('\n')}

## インターフェース
${design.interfaces.map(iface => `
### ${iface.name}
- **タイプ**: ${iface.type}
- **プロトコル**: ${iface.specification.protocol}
- **認証**: ${iface.specification.authentication}
`).join('\n')}

## 品質属性
${design.qualityAttributes.map(qa => `
### ${qa.name}
- **説明**: ${qa.description}
- **測定方法**: ${qa.measurement}
- **目標**: ${qa.target}
- **優先度**: ${qa.priority}
`).join('\n')}
`;
  }

  private generateArchitectureDiagram(design: SystemDesign): string {
    // Mermaid形式のアーキテクチャ図を生成
    return `graph TB
${design.components.map(comp => `  ${comp.id}[${comp.name}]`).join('\n')}
${design.components.flatMap(comp => 
  comp.dependencies.map(dep => `  ${comp.id} --> ${dep}`)
).join('\n')}
`;
  }

  private generateComponentDiagram(design: SystemDesign): string {
    // Mermaid形式のコンポーネント図を生成
    return `graph LR
${design.components.map(comp => `  subgraph ${comp.name}
    ${comp.id}[${comp.description}]
  end`).join('\n')}
`;
  }

  private generateDataFlowDiagram(design: SystemDesign): string {
    // Mermaid形式のデータフロー図を生成
    return `flowchart LR
${design.dataFlow.map(flow => `  ${flow.source} -->|${flow.dataType}| ${flow.destination}`).join('\n')}
`;
  }

  private calculateBaseEffort(designs: SystemDesign[], request: DesignRequest): number {
    // 基本工数を計算（時間単位）
    let baseHours = 160; // 1人月

    // 要件数による調整
    baseHours += request.requirements.length * 20;

    // コンポーネント数による調整
    const totalComponents = designs.reduce((sum, design) => sum + design.components.length, 0);
    baseHours += totalComponents * 40;

    // 制約による調整
    baseHours += request.constraints.length * 10;

    return baseHours;
  }

  private createEmptyEstimation(): ProjectEstimation {
    const empty: EstimationBreakdown = {
      effort: 0,
      duration: 0,
      resources: [],
      confidence: 'low',
    };

    return {
      development: empty,
      testing: empty,
      deployment: empty,
      maintenance: empty,
      total: {
        effort: 0,
        duration: 0,
        cost: 0,
        currency: 'USD',
      },
    };
  }
}