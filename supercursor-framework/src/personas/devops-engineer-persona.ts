/**
 * DevOps エンジニアペルソナ
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

export class DevOpsEngineerPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      id: 'devops-engineer',
      name: 'DevOps Engineer',
      type: 'devops-engineer',
      description: 'CI/CD、インフラストラクチャ、自動化、監視に特化したAI',
      version: '1.0.0',
      capabilities: [
        {
          name: 'ci-cd-pipeline',
          description: 'CI/CDパイプライン設計と実装',
          category: 'automation',
          supported: true,
        },
        {
          name: 'infrastructure-as-code',
          description: 'Infrastructure as Code (IaC)実装',
          category: 'infrastructure',
          supported: true,
        },
        {
          name: 'containerization',
          description: 'Docker・Kubernetes実装',
          category: 'containerization',
          supported: true,
        },
        {
          name: 'monitoring-observability',
          description: '監視・可観測性の実装',
          category: 'monitoring',
          supported: true,
        },
        {
          name: 'cloud-architecture',
          description: 'クラウドアーキテクチャ設計',
          category: 'cloud',
          supported: true,
        },
        {
          name: 'security-automation',
          description: 'セキュリティ自動化',
          category: 'security',
          supported: true,
        },
      ],
      activationScore: 75,
      priority: 6,
      contextRequirements: ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ansible', 'jenkins', 'github-actions'],
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
      logger.debug('DevOpsエンジニア活性化評価', {
        triggerType: context.trigger.type,
        projectType: context.projectContext.type,
      });

      // DevOps関連のファイルパターンをチェック
      const devopsPatterns = [
        /Dockerfile$/,
        /docker-compose\.ya?ml$/,
        /\.gitlab-ci\.ya?ml$/,
        /\.github\/workflows\/.*\.ya?ml$/,
        /Jenkinsfile$/,
        /bitbucket-pipelines\.ya?ml$/,
        /azure-pipelines\.ya?ml$/,
        /buildspec\.ya?ml$/,
        /terraform\/.*\.tf$/,
        /ansible\/.*\.ya?ml$/,
        /k8s\/.*\.ya?ml$/,
        /kubernetes\/.*\.ya?ml$/,
        /manifests\/.*\.ya?ml$/,
        /helm\/.*\.ya?ml$/,
        /charts\/.*\.ya?ml$/,
        /infrastructure\/.*\.(tf|ya?ml)$/,
        /deploy\/.*\.(sh|ya?ml)$/,
      ];

      // プロジェクトファイルでDevOpsパターンをチェック
      const projectFiles = context.projectContext.structure.files || [];
      const hasDevOpsFiles = projectFiles.some(file =>
        devopsPatterns.some(pattern => pattern.test(file.path))
      );

      // DevOps技術の検出
      const devopsTools = [
        'docker', 'kubernetes', 'k8s', 'helm',
        'terraform', 'ansible', 'puppet', 'chef',
        'jenkins', 'circleci', 'travisci', 'gitlab-ci',
        'github-actions', 'azure-devops', 'bamboo',
        'prometheus', 'grafana', 'elasticsearch', 'kibana',
        'datadog', 'newrelic', 'splunk',
        'nginx', 'apache', 'haproxy', 'istio',
      ];

      const hasDevOpsTools = context.projectContext.technologies.tools
        .map(t => t.toString().toLowerCase())
        .some(tool => devopsTools.includes(tool));

      // クラウドプロバイダーの検出
      const cloudProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel'];
      const hasCloudProvider = context.projectContext.technologies.tools
        .map(t => t.toString().toLowerCase())
        .some(tool => cloudProviders.includes(tool));

      // トリガータイプによる評価
      let triggerScore = 0;
      switch (context.trigger.type) {
        case 'command':
          const command = context.command?.toLowerCase() || '';
          if (command.includes('deploy') || command.includes('ci') || command.includes('cd') ||
              command.includes('docker') || command.includes('k8s') || command.includes('kubernetes') ||
              command.includes('infrastructure') || command.includes('devops')) {
            triggerScore += 35;
          }
          break;
        case 'file-change':
          if (hasDevOpsFiles) {
            triggerScore += 30;
          }
          break;
      }

      // 総合評価
      const evaluation = hasDevOpsFiles || hasDevOpsTools || hasCloudProvider || triggerScore > 0;

      logger.debug('DevOpsエンジニア評価結果', {
        hasDevOpsFiles,
        hasDevOpsTools,
        hasCloudProvider,
        triggerScore,
        evaluation,
      });

      return evaluation;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DevOpsエンジニア活性化評価に失敗', { error: errorMessage });
      return false;
    }
  }

  /**
   * ペルソナ固有の活性化処理
   */
  protected async performActivation(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('DevOpsエンジニアペルソナを活性化');

      // DevOps関連のコンテキストを分析
      await this.analyzeDevOpsContext(context);

      logger.info('DevOpsエンジニアペルソナ活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DevOpsエンジニア活性化処理に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * ペルソナ固有の非活性化処理
   */
  protected async performDeactivation(): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('DevOpsエンジニアペルソナを非活性化');

      // クリーンアップ処理
      logger.info('DevOpsエンジニアペルソナ非活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DevOpsエンジニア非活性化処理に失敗', { error: errorMessage });
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
      logger.debug('DevOpsエンジニアコマンド実行', {
        command: command.substring(0, 100),
      });

      let output = '';
      let confidence = 0.75;

      // コマンドタイプを分析
      const commandLower = command.toLowerCase();
      
      if (commandLower.includes('ci') || commandLower.includes('cd') || 
          commandLower.includes('pipeline') || commandLower.includes('deploy')) {
        output = await this.handleCICDCommand(command, context);
        confidence = 0.9;
      } else if (commandLower.includes('docker') || commandLower.includes('container')) {
        output = await this.handleContainerCommand(command, context);
        confidence = 0.88;
      } else if (commandLower.includes('kubernetes') || commandLower.includes('k8s')) {
        output = await this.handleKubernetesCommand(command, context);
        confidence = 0.87;
      } else if (commandLower.includes('terraform') || commandLower.includes('infrastructure') || commandLower.includes('iac')) {
        output = await this.handleInfrastructureCommand(command, context);
        confidence = 0.86;
      } else if (commandLower.includes('monitoring') || commandLower.includes('observability') || commandLower.includes('metrics')) {
        output = await this.handleMonitoringCommand(command, context);
        confidence = 0.84;
      } else if (commandLower.includes('cloud') || commandLower.includes('aws') || commandLower.includes('gcp') || commandLower.includes('azure')) {
        output = await this.handleCloudCommand(command, context);
        confidence = 0.83;
      } else if (commandLower.includes('security') || commandLower.includes('compliance')) {
        output = await this.handleSecurityCommand(command, context);
        confidence = 0.82;
      } else {
        output = await this.handleGeneralDevOpsCommand(command, context);
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
          reasoning: 'DevOpsエンジニアとしての専門知識を活用',
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('DevOpsエンジニアコマンド実行に失敗', { error: errorMessage });

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
    if (projectType === 'service' || projectType === 'tool') {
      bonus += 20;
    }

    // DevOpsツールボーナス
    const devopsTools = ['docker', 'kubernetes', 'terraform', 'ansible', 'jenkins'];
    const hasDevOpsTools = context.projectContext.technologies.tools
      .map(t => t.toString().toLowerCase())
      .some(tool => devopsTools.includes(tool));
    
    if (hasDevOpsTools) {
      bonus += 15;
    }

    // クラウドプロバイダーボーナス
    const cloudProviders = ['aws', 'gcp', 'azure'];
    const hasCloudProvider = context.projectContext.technologies.tools
      .map(t => t.toString().toLowerCase())
      .some(tool => cloudProviders.includes(tool));
    
    if (hasCloudProvider) {
      bonus += 10;
    }

    return Math.min(bonus, 25); // 最大25ポイントのボーナス
  }

  // プライベートメソッド

  /**
   * DevOpsコンテキストを分析
   */
  private async analyzeDevOpsContext(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      // CI/CDファイルの分析
      const cicdFiles = context.projectContext.structure.files?.filter(file =>
        /\.gitlab-ci\.ya?ml$|\.github\/workflows\/|Jenkinsfile$|bitbucket-pipelines\.ya?ml$/.test(file.path)
      );

      // インフラファイルの分析
      const infraFiles = context.projectContext.structure.files?.filter(file =>
        /terraform\/.*\.tf$|ansible\/.*\.ya?ml$|k8s\/.*\.ya?ml$/.test(file.path)
      );

      // コンテナ関連ファイルの分析
      const containerFiles = context.projectContext.structure.files?.filter(file =>
        /Dockerfile$|docker-compose\.ya?ml$/.test(file.path)
      );

      logger.debug('DevOpsコンテキスト分析完了', {
        cicdFilesCount: cicdFiles?.length || 0,
        infraFilesCount: infraFiles?.length || 0,
        containerFilesCount: containerFiles?.length || 0,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DevOpsコンテキスト分析に失敗', { error: errorMessage });
    }
  }

  /**
   * CI/CDコマンドを処理
   */
  private async handleCICDCommand(command: string, context: PersonaContext): Promise<string> {
    return `## CI/CDパイプライン設計提案

DevOpsエンジニアとして、以下のCI/CDパイプライン設計を提案いたします：

### パイプライン設計原則
- 段階的デプロイメント
- 自動テスト統合
- 品質ゲート実装
- ロールバック戦略

### 推奨実装パターン
- GitOps ワークフロー
- ブルー・グリーンデプロイメント
- カナリアリリース
- フィーチャーフラグ活用

### ツール選定
- GitHub Actions / GitLab CI
- Jenkins / Azure DevOps
- ArgoCD / Flux (GitOps)
- Helm Charts

### ベストプラクティス
- セキュリティスキャン統合
- 並列実行による高速化
- キャッシュ戦略
- 詳細なロギング・監視

プロジェクトの規模と要件に応じた最適なパイプライン実装をご提案いたします。`;
  }

  /**
   * コンテナコマンドを処理
   */
  private async handleContainerCommand(command: string, context: PersonaContext): Promise<string> {
    return `## コンテナ化戦略

### Docker化のベストプラクティス
- マルチステージビルド
- 最小ベースイメージ使用
- セキュリティスキャン
- イメージレイヤー最適化

### Docker Compose 設計
- サービス分離
- ネットワーク設定
- ボリューム管理
- 環境変数管理

### セキュリティ強化
- 非rootユーザー実行
- 必要最小限の権限
- 脆弱性スキャン
- シークレット管理

### 運用最適化
- ヘルスチェック実装
- ログ設定
- リソース制限
- 自動再起動設定

効率的で安全なコンテナ化戦略をご提案いたします。`;
  }

  /**
   * Kubernetesコマンドを処理
   */
  private async handleKubernetesCommand(command: string, context: PersonaContext): Promise<string> {
    return `## Kubernetes デプロイメント戦略

### クラスター設計
- 名前空間分離
- リソース管理
- ネットワークポリシー
- ストレージクラス設定

### ワークロード管理
- Deployment / StatefulSet
- Service / Ingress
- ConfigMap / Secret
- PersistentVolume

### 可観測性
- Prometheus + Grafana
- ログ集約
- 分散トレーシング
- アラート設定

### 運用自動化
- HPA / VPA
- RBAC設定
- バックアップ戦略
- 災害復旧計画

スケーラブルで堅牢なKubernetes環境をご提案いたします。`;
  }

  /**
   * インフラストラクチャコマンドを処理
   */
  private async handleInfrastructureCommand(command: string, context: PersonaContext): Promise<string> {
    return `## Infrastructure as Code (IaC) 実装

### Terraform設計
- モジュール化
- 状態管理
- プロバイダー設定
- 変数管理

### 環境管理
- 開発・ステージング・本番環境
- ワークスペース活用
- 環境間の差異管理
- シークレット管理

### ベストプラクティス
- コードレビュー
- 計画・適用分離
- 状態ファイルのセキュリティ
- 自動化パイプライン

### 災害復旧
- バックアップ戦略
- 復旧手順
- 冗長化設計
- モニタリング

堅牢で保守性の高いインフラ設計をご提案いたします。`;
  }

  /**
   * 監視コマンドを処理
   */
  private async handleMonitoringCommand(command: string, context: PersonaContext): Promise<string> {
    return `## 監視・可観測性実装

### メトリクス収集
- Prometheus + Grafana
- アプリケーションメトリクス
- インフラメトリクス
- ビジネスメトリクス

### ログ管理
- 構造化ログ
- 集約・検索
- 保持ポリシー
- セキュリティログ

### 分散トレーシング
- Jaeger / Zipkin
- 依存関係可視化
- パフォーマンス分析
- ボトルネック特定

### アラート戦略
- 段階的エスカレーション
- ノイズ削減
- SLI/SLO設定
- インシデント対応

包括的な監視戦略をご提案いたします。`;
  }

  /**
   * クラウドコマンドを処理
   */
  private async handleCloudCommand(command: string, context: PersonaContext): Promise<string> {
    return `## クラウドアーキテクチャ設計

### マルチクラウド戦略
- プロバイダー選択
- ベンダーロックイン回避
- コスト最適化
- 可用性向上

### セキュリティ設計
- IAM設計
- ネットワークセキュリティ
- データ暗号化
- コンプライアンス対応

### スケーラビリティ
- オートスケーリング
- ロードバランシング
- CDN活用
- キャッシュ戦略

### コスト管理
- リソース最適化
- 予約インスタンス
- 使用量監視
- 自動シャットダウン

効率的でスケーラブルなクラウドアーキテクチャをご提案いたします。`;
  }

  /**
   * セキュリティコマンドを処理
   */
  private async handleSecurityCommand(command: string, context: PersonaContext): Promise<string> {
    return `## DevSecOps実装

### シフトレフトセキュリティ
- 開発段階でのセキュリティ検査
- 依存関係スキャン
- 静的解析
- 動的解析

### コンプライアンス自動化
- ポリシー as Code
- セキュリティガイドライン
- 監査ログ
- 証跡管理

### インフラセキュリティ
- 最小権限原則
- ネットワークセグメンテーション
- 暗号化実装
- 脆弱性管理

### インシデント対応
- セキュリティ監視
- 自動対応
- 影響範囲特定
- 復旧手順

包括的なセキュリティ自動化をご提案いたします。`;
  }

  /**
   * 一般的なDevOpsコマンドを処理
   */
  private async handleGeneralDevOpsCommand(command: string, context: PersonaContext): Promise<string> {
    return `## DevOps支援

DevOpsエンジニアとして、以下の領域でサポートいたします：

- CI/CDパイプライン設計・実装
- インフラストラクチャ自動化
- コンテナ・オーケストレーション
- 監視・可観測性実装
- クラウドアーキテクチャ設計
- セキュリティ自動化

具体的なご要望をお聞かせください。プロジェクトに最適なDevOpsソリューションをご提案いたします。`;
  }
}