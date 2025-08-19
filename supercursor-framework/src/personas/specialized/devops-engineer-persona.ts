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

export class DevOpsEngineerPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      name: 'DevOps Engineer',
      description: 'インフラストラクチャ、CI/CD、自動化、監視に特化したAIペルソナ。クラウドアーキテクチャ、コンテナ化、デプロイメント戦略、運用自動化を専門とします。',
      version: '1.0.0',
      capabilities: [
        PersonaCapability.INFRASTRUCTURE_AUTOMATION,
        PersonaCapability.CI_CD_PIPELINE,
        PersonaCapability.CONTAINER_ORCHESTRATION,
        PersonaCapability.CLOUD_ARCHITECTURE,
        PersonaCapability.MONITORING_SETUP,
        PersonaCapability.SECURITY_HARDENING,
        PersonaCapability.PERFORMANCE_OPTIMIZATION,
        PersonaCapability.DISASTER_RECOVERY,
        PersonaCapability.DOCUMENTATION
      ],
      defaultPromptTemplate: {
        id: 'devops-engineer-template',
        name: 'DevOps Engineer Template',
        template: `あなたはDevOpsエンジニアとして、以下のリクエストにお答えください：

プロジェクト情報：
- プロジェクト名: {{PROJECT_NAME}}
- プロジェクトタイプ: {{PROJECT_TYPE}}
- インフラ環境: {{INFRASTRUCTURE_ENV}}
- 現在の課題: {{CURRENT_ISSUES}}

ユーザーリクエスト：
{{USER_INPUT}}

以下の観点から専門的なソリューションを提供してください：
1. インフラストラクチャ設計
2. CI/CDパイプライン
3. 自動化戦略
4. 監視・アラート
5. セキュリティ対策
6. 災害復旧計画
7. 運用効率化

実装可能で具体的な解決策を提案してください。`,
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
            defaultValue: 'WEB_APPLICATION'
          },
          {
            name: 'INFRASTRUCTURE_ENV',
            description: 'インフラ環境情報',
            required: false,
            defaultValue: '未指定'
          },
          {
            name: 'CURRENT_ISSUES',
            description: '現在の課題',
            required: false,
            defaultValue: '特になし'
          }
        ]
      },
      learningEnabled: true,
      adaptationStrategy: AdaptationStrategy.PERFORMANCE_BASED,
      memoryRetention: {
        shortTerm: 48 * 60 * 60 * 1000, // 48時間
        longTerm: 60 * 24 * 60 * 60 * 1000, // 60日
        maxEntries: 800
      },
      responseConstraints: {
        maxLength: 12000,
        minConfidence: 0.8,
        timeoutMs: 20000
      },
      knowledgeBaseConfig: {
        domains: [
          'cloud-platforms',
          'containerization',
          'ci-cd-pipelines',
          'infrastructure-as-code',
          'monitoring-alerting',
          'security-hardening',
          'automation-scripting',
          'disaster-recovery'
        ],
        sources: [
          'aws-documentation',
          'kubernetes-documentation',
          'docker-best-practices',
          'terraform-modules',
          'ansible-playbooks'
        ],
        updateFrequency: 6 * 60 * 60 * 1000 // 6時間
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
    
    // DevOps 専門知識の適用
    const expertResponse = await this.applyDevOpsExpertise(analysis, context);
    
    // 応答の構築
    const response: PersonaResponse = {
      id: `devops-response-${Date.now()}`,
      content: expertResponse.content,
      confidence: expertResponse.confidence,
      format: OutputFormat.MARKDOWN,
      suggestions: expertResponse.suggestions,
      codeExamples: expertResponse.codeExamples,
      metadata: {
        executionTime: 0, // 実行時間は BasePersona で設定
        tokensUsed: this.estimateTokenUsage(expertResponse.content),
        modelUsed: 'devops-engineer-v1',
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
    // DevOps 固有のリソース初期化
    await this.loadInfrastructureTemplates();
    await this.loadBestPractices();
    await this.initializeCloudProviderKnowledge();
  }

  protected async cleanupResources(): Promise<void> {
    // リソースのクリーンアップ
  }

  private async analyzePrompt(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<DevOpsPromptAnalysis> {
    const content = prompt.content.toLowerCase();
    
    // DevOps 関連キーワード分析
    const infrastructureKeywords = [
      'infrastructure', 'terraform', 'cloudformation', 'iac',
      'aws', 'azure', 'gcp', 'cloud', 'server', 'network'
    ];
    
    const cicdKeywords = [
      'ci/cd', 'pipeline', 'jenkins', 'github actions', 'gitlab ci',
      'deploy', 'deployment', 'build', 'release', 'automation'
    ];
    
    const containerKeywords = [
      'docker', 'kubernetes', 'k8s', 'container', 'pod',
      'helm', 'istio', 'microservices', 'orchestration'
    ];
    
    const monitoringKeywords = [
      'monitoring', 'prometheus', 'grafana', 'alerting', 'logging',
      'elk', 'observability', 'metrics', 'traces', 'kibana'
    ];

    const securityKeywords = [
      'security', 'vulnerability', 'compliance', 'audit',
      'encryption', 'tls', 'ssl', 'secrets', 'rbac'
    ];

    return {
      category: this.determineDevOpsCategory(content, {
        infrastructure: infrastructureKeywords,
        cicd: cicdKeywords,
        container: containerKeywords,
        monitoring: monitoringKeywords,
        security: securityKeywords
      }),
      complexity: this.assessDevOpsComplexity(prompt, context),
      cloudProvider: this.detectCloudProvider(content, context),
      environment: this.detectEnvironment(content, context),
      scale: this.assessInfrastructureScale(content, context),
      urgency: this.assessUrgency(content)
    };
  }

  private determineDevOpsCategory(
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

  private assessDevOpsComplexity(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): 'simple' | 'medium' | 'complex' | 'enterprise' {
    let complexityScore = 0;

    // プロンプト長による評価
    if (prompt.content.length > 400) complexityScore += 1;
    if (prompt.content.length > 1000) complexityScore += 1;

    // 技術スタックの複雑性
    if (context.project) {
      const techCount = 
        (context.project.technologies.platforms?.length || 0) +
        (context.project.technologies.tools?.length || 0);
      
      if (techCount > 3) complexityScore += 1;
      if (techCount > 6) complexityScore += 1;
    }

    // 高度なキーワード
    const enterpriseKeywords = [
      'multi-region', 'high availability', 'disaster recovery',
      'compliance', 'enterprise', 'scalability', 'multi-cloud'
    ];
    const enterpriseCount = enterpriseKeywords.reduce((count, keyword) => {
      return count + (prompt.content.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    complexityScore += enterpriseCount;

    if (complexityScore <= 1) return 'simple';
    if (complexityScore <= 3) return 'medium';
    if (complexityScore <= 5) return 'complex';
    return 'enterprise';
  }

  private detectCloudProvider(content: string, context: PersonaContext): string {
    const providers = {
      'AWS': ['aws', 'amazon', 'ec2', 's3', 'lambda', 'cloudformation'],
      'Azure': ['azure', 'microsoft', 'arm template', 'azure functions'],
      'GCP': ['gcp', 'google cloud', 'gke', 'cloud functions', 'cloud run'],
      'Multi-Cloud': ['multi-cloud', 'hybrid', 'multiple cloud']
    };

    for (const [provider, keywords] of Object.entries(providers)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return provider;
      }
    }

    return 'Cloud-Agnostic';
  }

  private detectEnvironment(content: string, context: PersonaContext): DevOpsEnvironment {
    return {
      development: content.includes('dev') || content.includes('development'),
      staging: content.includes('staging') || content.includes('test'),
      production: content.includes('prod') || content.includes('production'),
      multiEnvironment: content.includes('multi') || content.includes('environments')
    };
  }

  private assessInfrastructureScale(content: string, context: PersonaContext): 'startup' | 'small' | 'medium' | 'large' | 'enterprise' {
    let scaleIndicators = 0;

    const largeScaleKeywords = [
      'enterprise', 'thousands', 'millions', 'global', 'multi-region',
      'high traffic', 'scalability', 'load balancing'
    ];

    largeScaleKeywords.forEach(keyword => {
      if (content.includes(keyword)) scaleIndicators++;
    });

    if (content.includes('startup') || content.includes('mvp')) return 'startup';
    if (scaleIndicators === 0) return 'small';
    if (scaleIndicators <= 2) return 'medium';
    if (scaleIndicators <= 4) return 'large';
    return 'enterprise';
  }

  private assessUrgency(content: string): 'low' | 'medium' | 'high' | 'critical' {
    const urgentKeywords = [
      'urgent', 'emergency', 'down', 'outage', 'critical',
      'immediately', 'asap', 'broken', 'failing'
    ];

    const urgentCount = urgentKeywords.reduce((count, keyword) => {
      return count + (content.includes(keyword) ? 1 : 0);
    }, 0);

    if (urgentCount >= 3) return 'critical';
    if (urgentCount >= 2) return 'high';
    if (urgentCount >= 1) return 'medium';
    return 'low';
  }

  private async applyDevOpsExpertise(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const { category, complexity, cloudProvider } = analysis;

    switch (category) {
      case 'infrastructure':
        return this.generateInfrastructureAdvice(analysis, context);
      case 'cicd':
        return this.generateCICDAdvice(analysis, context);
      case 'container':
        return this.generateContainerAdvice(analysis, context);
      case 'monitoring':
        return this.generateMonitoringAdvice(analysis, context);
      case 'security':
        return this.generateSecurityAdvice(analysis, context);
      default:
        return this.generateGeneralDevOpsAdvice(analysis, context);
    }
  }

  private async generateInfrastructureAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = this.buildInfrastructureResponse(analysis, context);
    const suggestions = this.generateInfrastructureSuggestions(analysis);
    const codeExamples = await this.generateInfrastructureCodeExamples(analysis);

    return {
      content,
      confidence: 0.93,
      suggestions,
      codeExamples
    };
  }

  private buildInfrastructureResponse(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): string {
    const { complexity, cloudProvider, scale, urgency } = analysis;
    
    let response = `# インフラストラクチャ設計・実装ガイド\n\n`;
    
    // 分析結果の表示
    response += `## プロジェクト分析\n`;
    response += `- **クラウドプロバイダー**: ${cloudProvider}\n`;
    response += `- **規模**: ${scale}\n`;
    response += `- **複雑性**: ${complexity}\n`;
    response += `- **緊急度**: ${urgency}\n\n`;

    // 緊急度に基づく対応策
    if (urgency === 'critical' || urgency === 'high') {
      response += `## 🚨 緊急対応策\n\n`;
      response += this.getEmergencyResponse(urgency);
      response += `\n\n`;
    }

    // インフラ設計推奨事項
    response += `## インフラストラクチャ アーキテクチャ\n\n`;
    response += this.getInfrastructureArchitecture(cloudProvider, scale, complexity);

    // IaC 実装戦略
    response += `\n## Infrastructure as Code (IaC) 戦略\n\n`;
    response += this.getIaCStrategy(cloudProvider, complexity);

    // ベストプラクティス
    response += `\n## ベストプラクティス\n\n`;
    response += this.getInfrastructureBestPractices(scale, complexity);

    return response;
  }

  private getEmergencyResponse(urgency: 'high' | 'critical'): string {
    return `### 即座に実行すべき対応

1. **現状把握**
   - システム監視ダッシュボードの確認
   - エラーログとメトリクスの分析
   - 影響範囲の特定

2. **緊急対応**
   - ヘルスチェック実行
   - ロードバランサーでの問題ノード分離
   - 必要に応じてスケールアウト

3. **コミュニケーション**
   - ステークホルダーへの状況報告
   - インシデント記録の開始
   - 対応チームの招集

4. **一時的な解決策**
   - トラフィック制限
   - キャッシュの活用
   - フェイルオーバーの実行`;
  }

  private getInfrastructureArchitecture(
    cloudProvider: string,
    scale: string,
    complexity: string
  ): string {
    let architecture = '';

    switch (cloudProvider) {
      case 'AWS':
        architecture += this.getAWSArchitecture(scale, complexity);
        break;
      case 'Azure':
        architecture += this.getAzureArchitecture(scale, complexity);
        break;
      case 'GCP':
        architecture += this.getGCPArchitecture(scale, complexity);
        break;
      default:
        architecture += this.getCloudAgnosticArchitecture(scale, complexity);
    }

    return architecture;
  }

  private getAWSArchitecture(scale: string, complexity: string): string {
    let arch = `### AWS アーキテクチャ設計

#### 基本コンポーネント
- **Compute**: EC2 / ECS / Lambda
- **Storage**: S3 / EBS / EFS
- **Database**: RDS / DynamoDB
- **Network**: VPC / CloudFront / Route 53
- **Security**: IAM / WAF / Security Groups

`;

    if (scale === 'enterprise' || complexity === 'enterprise') {
      arch += `#### エンタープライズ級コンポーネント
- **Multi-AZ**: 高可用性の確保
- **Auto Scaling**: 動的なリソース調整
- **CloudWatch**: 包括的な監視
- **AWS Config**: コンプライアンス管理
- **AWS Organizations**: アカウント管理

`;
    }

    return arch;
  }

  private getAzureArchitecture(scale: string, complexity: string): string {
    return `### Azure アーキテクチャ設計

#### 基本コンポーネント
- **Compute**: Virtual Machines / Container Instances / Functions
- **Storage**: Blob Storage / Managed Disks
- **Database**: SQL Database / Cosmos DB
- **Network**: Virtual Network / Application Gateway / Traffic Manager
- **Security**: Active Directory / Key Vault / Security Center

`;
  }

  private getGCPArchitecture(scale: string, complexity: string): string {
    return `### GCP アーキテクチャ設計

#### 基本コンポーネント
- **Compute**: Compute Engine / GKE / Cloud Functions
- **Storage**: Cloud Storage / Persistent Disk
- **Database**: Cloud SQL / Firestore
- **Network**: VPC / Cloud Load Balancing / Cloud DNS
- **Security**: IAM / Cloud Security Command Center

`;
  }

  private getCloudAgnosticArchitecture(scale: string, complexity: string): string {
    return `### クラウドアグノスティック アーキテクチャ

#### 基本原則
- **コンテナ化**: Docker + Kubernetes
- **マイクロサービス**: 疎結合なサービス設計
- **API Gateway**: 統一されたAPI管理
- **分散ストレージ**: 複数のストレージバックエンド
- **監視**: Prometheus + Grafana

`;
  }

  private getIaCStrategy(cloudProvider: string, complexity: string): string {
    let strategy = `### 推奨ツール

`;

    switch (cloudProvider) {
      case 'AWS':
        strategy += `- **Terraform**: マルチクラウド対応
- **AWS CDK**: プログラマティックな定義
- **CloudFormation**: AWS ネイティブ

`;
        break;
      case 'Azure':
        strategy += `- **Terraform**: クロスプラットフォーム
- **ARM Templates**: Azure ネイティブ
- **Bicep**: より読みやすい ARM

`;
        break;
      case 'GCP':
        strategy += `- **Terraform**: 標準的な選択
- **Deployment Manager**: GCP ネイティブ
- **Pulumi**: プログラミング言語ベース

`;
        break;
      default:
        strategy += `- **Terraform**: 最も汎用的
- **Pulumi**: プログラミング言語対応
- **Ansible**: 設定管理含む

`;
    }

    strategy += `### IaC ベストプラクティス
- **バージョン管理**: Git での管理
- **環境分離**: 環境ごとの設定
- **モジュール化**: 再利用可能なコンポーネント
- **テスト**: インフラのテスト自動化
- **ドキュメント**: アーキテクチャ図と説明

`;

    return strategy;
  }

  private getInfrastructureBestPractices(scale: string, complexity: string): string {
    let practices = `### 基本ベストプラクティス
- **冗長性**: 単一点障害の回避
- **監視**: 包括的なメトリクス収集
- **バックアップ**: 定期的なデータ保護
- **セキュリティ**: 最小権限の原則
- **コスト最適化**: リソース使用量の監視

`;

    if (complexity === 'complex' || complexity === 'enterprise') {
      practices += `### 高度なベストプラクティス
- **災害復旧**: RTO/RPO の設定
- **コンプライアンス**: 規制要件への対応
- **パフォーマンス**: 継続的な最適化
- **自動化**: 人的ミスの削減
- **ガバナンス**: リソース管理ポリシー

`;
    }

    return practices;
  }

  private generateInfrastructureSuggestions(analysis: DevOpsPromptAnalysis): string[] {
    const suggestions: string[] = [
      'インフラストラクチャ図を作成してください',
      'コスト見積もりを実施してください',
      '災害復旧計画を策定してください'
    ];

    if (analysis.urgency === 'critical' || analysis.urgency === 'high') {
      suggestions.unshift(
        '緊急度が高いため、段階的な実装を検討してください',
        'まず最小限の安定した環境を構築してください'
      );
    }

    if (analysis.complexity === 'enterprise') {
      suggestions.push(
        'セキュリティ監査を実施してください',
        'コンプライアンス要件を確認してください'
      );
    }

    return suggestions;
  }

  private async generateInfrastructureCodeExamples(
    analysis: DevOpsPromptAnalysis
  ): Promise<Array<{ language: string; code: string; description: string }>> {
    const examples: Array<{ language: string; code: string; description: string }> = [];

    // Terraform の例
    examples.push({
      language: 'hcl',
      code: `# main.tf - AWS VPC とサブネットの定義
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# VPC の作成
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "main-vpc"
    Environment = var.environment
  }
}

# パブリックサブネット
resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.\${count.index + 1}.0/24"
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "public-subnet-\${count.index + 1}"
    Type = "public"
  }
}

# プライベートサブネット
resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.\${count.index + 10}.0/24"
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "private-subnet-\${count.index + 1}"
    Type = "private"
  }
}

# インターネットゲートウェイ
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "main-igw"
  }
}

# NAT ゲートウェイ用の Elastic IP
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name = "nat-eip-\${count.index + 1}"
  }
}

# NAT ゲートウェイ
resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones)
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "nat-gw-\${count.index + 1}"
  }
}`,
      description: 'Terraform を使用した AWS VPC の構成例'
    });

    if (analysis.cloudProvider === 'AWS' && analysis.scale !== 'startup') {
      examples.push({
        language: 'yaml',
        code: `# docker-compose.yml - 開発環境用
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:password@db:5432/myapp
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - web

volumes:
  postgres_data:
  redis_data:`,
        description: 'Docker Compose を使用した開発環境の構成'
      });
    }

    return examples;
  }

  private async generateCICDAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = `# CI/CD パイプライン設計・実装ガイド\n\n` +
      `継続的インテグレーション・デプロイメントの最適なパイプラインを構築します。\n\n` +
      this.getCICDGuidance(analysis, context);

    return {
      content,
      confidence: 0.91,
      suggestions: [
        'パイプラインのテスト戦略を定義してください',
        'ロールバック戦略を準備してください',
        'デプロイメントの可視性を向上させてください'
      ],
      codeExamples: await this.generateCICDCodeExamples(analysis)
    };
  }

  private getCICDGuidance(analysis: DevOpsPromptAnalysis, context: PersonaContext): string {
    return `## CI/CD パイプライン戦略\n\n効率的で信頼性の高いパイプラインを設計いたします。`;
  }

  private async generateCICDCodeExamples(analysis: DevOpsPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'yaml',
      code: `# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.DOCKER_REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            \${{ env.DOCKER_REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
            \${{ env.DOCKER_REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production..."
          # ここに実際のデプロイメントコマンドを記述`,
      description: 'GitHub Actions を使用した CI/CD パイプライン'
    }];
  }

  private async generateContainerAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = `# コンテナ・オーケストレーション ガイド\n\n` +
      `コンテナ化とKubernetesを活用した効率的な運用をご提案します。\n\n` +
      this.getContainerGuidance(analysis, context);

    return {
      content,
      confidence: 0.89,
      suggestions: [
        'セキュリティスキャンを定期実行してください',
        'リソース制限を適切に設定してください',
        'ヘルスチェックを実装してください'
      ],
      codeExamples: await this.generateContainerCodeExamples(analysis)
    };
  }

  private getContainerGuidance(analysis: DevOpsPromptAnalysis, context: PersonaContext): string {
    return `## コンテナ戦略\n\nスケーラブルなコンテナ環境を構築いたします。`;
  }

  private async generateContainerCodeExamples(analysis: DevOpsPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'yaml',
      code: `# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web-app
        image: ghcr.io/myorg/web-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
spec:
  selector:
    app: web-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP`,
      description: 'Kubernetes デプロイメントとサービスの設定例'
    }];
  }

  private async generateMonitoringAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = `# 監視・アラート システム構築ガイド\n\n` +
      `包括的な監視体制とアラート設定をご提案します。\n\n` +
      this.getMonitoringGuidance(analysis, context);

    return {
      content,
      confidence: 0.87,
      suggestions: [
        'SLI/SLO を定義してください',
        'ダッシュボードを作成してください',
        'オンコール体制を整備してください'
      ],
      codeExamples: await this.generateMonitoringCodeExamples(analysis)
    };
  }

  private getMonitoringGuidance(analysis: DevOpsPromptAnalysis, context: PersonaContext): string {
    return `## 監視戦略\n\n効果的な監視システムを構築いたします。`;
  }

  private async generateMonitoringCodeExamples(analysis: DevOpsPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'yaml',
      code: `# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts/*.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'web-app'
    static_configs:
      - targets: ['web-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

---
# alerts/app-alerts.yml
groups:
  - name: web-app-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for {{ $labels.instance }}"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"`,
      description: 'Prometheus を使用した監視設定とアラートルール'
    }];
  }

  private async generateSecurityAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = `# セキュリティ強化ガイド\n\n` +
      `インフラとアプリケーションのセキュリティを強化します。\n\n` +
      this.getSecurityGuidance(analysis, context);

    return {
      content,
      confidence: 0.95,
      suggestions: [
        'セキュリティスキャンを自動化してください',
        '最小権限の原則を適用してください',
        'セキュリティ監査ログを設定してください'
      ],
      codeExamples: await this.generateSecurityCodeExamples(analysis)
    };
  }

  private getSecurityGuidance(analysis: DevOpsPromptAnalysis, context: PersonaContext): string {
    return `## セキュリティ戦略\n\n多層防御によるセキュリティを実装いたします。`;
  }

  private async generateSecurityCodeExamples(analysis: DevOpsPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'yaml',
      code: `# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-app-netpol
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: web-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53

---
# k8s/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'`,
      description: 'Kubernetes セキュリティポリシーの設定例'
    }];
  }

  private async generateGeneralDevOpsAdvice(
    analysis: DevOpsPromptAnalysis,
    context: PersonaContext
  ): Promise<DevOpsExpertResponse> {
    const content = `# DevOps ベストプラクティス ガイド\n\n` +
      `総合的なDevOps手法をご提案します。\n\n` +
      this.getGeneralDevOpsGuidance(analysis, context);

    return {
      content,
      confidence: 0.84,
      suggestions: [
        'DevOps 成熟度を評価してください',
        'チーム間のコラボレーションを改善してください',
        '自動化可能な作業を特定してください'
      ],
      codeExamples: await this.generateGeneralDevOpsCodeExamples(analysis)
    };
  }

  private getGeneralDevOpsGuidance(analysis: DevOpsPromptAnalysis, context: PersonaContext): string {
    return `## DevOps 総合戦略\n\nプロジェクトの成功のための包括的なDevOpsアプローチをご提案いたします。`;
  }

  private async generateGeneralDevOpsCodeExamples(analysis: DevOpsPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'bash',
      code: `#!/bin/bash
# scripts/deploy.sh - 基本的なデプロイメントスクリプト

set -euo pipefail

# 変数定義
ENVIRONMENT=\${1:-staging}
IMAGE_TAG=\${2:-latest}
NAMESPACE=\${ENVIRONMENT}

echo "Deploying to \${ENVIRONMENT} environment..."

# 前処理チェック
kubectl get namespace "\${NAMESPACE}" >/dev/null 2>&1 || {
    echo "Creating namespace \${NAMESPACE}"
    kubectl create namespace "\${NAMESPACE}"
}

# デプロイメント
kubectl set image deployment/web-app \\
    web-app=ghcr.io/myorg/web-app:\${IMAGE_TAG} \\
    -n "\${NAMESPACE}"

# デプロイメントの確認
kubectl rollout status deployment/web-app -n "\${NAMESPACE}" --timeout=300s

# ヘルスチェック
echo "Waiting for application to be ready..."
sleep 10

# 簡易ヘルスチェック
SERVICE_URL=\$(kubectl get service web-app-service -n "\${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
if [ -n "\${SERVICE_URL}" ]; then
    curl -f "http://\${SERVICE_URL}/health" || {
        echo "Health check failed!"
        kubectl rollout undo deployment/web-app -n "\${NAMESPACE}"
        exit 1
    }
fi

echo "Deployment completed successfully!"`,
      description: '基本的なKubernetesデプロイメントスクリプト'
    }];
  }

  private estimateTokenUsage(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private async loadInfrastructureTemplates(): Promise<void> {
    // インフラテンプレートの読み込み
  }

  private async loadBestPractices(): Promise<void> {
    // ベストプラクティスの読み込み
  }

  private async initializeCloudProviderKnowledge(): Promise<void> {
    // クラウドプロバイダー固有の知識を初期化
  }
}

// 型定義
interface DevOpsPromptAnalysis {
  category: string;
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  cloudProvider: string;
  environment: DevOpsEnvironment;
  scale: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface DevOpsEnvironment {
  development: boolean;
  staging: boolean;
  production: boolean;
  multiEnvironment: boolean;
}

interface DevOpsExpertResponse {
  content: string;
  confidence: number;
  suggestions: string[];
  codeExamples: Array<{
    language: string;
    code: string;
    description: string;
  }>;
}

export default DevOpsEngineerPersona;