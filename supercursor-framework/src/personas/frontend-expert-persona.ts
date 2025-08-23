/**
 * フロントエンドエキスパートペルソナ
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

export class FrontendExpertPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      id: 'frontend-expert',
      name: 'Frontend Expert',
      type: 'frontend-expert',
      description: 'UI/UX設計、フロントエンド開発、パフォーマンス最適化に特化したAI',
      version: '1.0.0',
      capabilities: [
        {
          name: 'ui-design',
          description: 'ユーザーインターフェース設計',
          category: 'design',
          supported: true,
        },
        {
          name: 'component-architecture',
          description: 'コンポーネント設計とアーキテクチャ',
          category: 'architecture',
          supported: true,
        },
        {
          name: 'performance-optimization',
          description: 'フロントエンドパフォーマンス最適化',
          category: 'performance',
          supported: true,
        },
        {
          name: 'responsive-design',
          description: 'レスポンシブデザイン実装',
          category: 'design',
          supported: true,
        },
        {
          name: 'accessibility',
          description: 'アクセシビリティ対応',
          category: 'accessibility',
          supported: true,
        },
        {
          name: 'state-management',
          description: '状態管理設計',
          category: 'architecture',
          supported: true,
        },
      ],
      activationScore: 80,
      priority: 7,
      contextRequirements: ['react', 'vue', 'angular', 'svelte', 'html', 'css', 'javascript', 'typescript', 'frontend'],
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
      logger.debug('フロントエンドエキスパート活性化評価', {
        triggerType: context.trigger.type,
        projectType: context.projectContext.type,
      });

      // フロントエンド関連のファイルパターンをチェック
      const frontendPatterns = [
        /\.(js|ts|jsx|tsx)$/,
        /\.(vue|svelte)$/,
        /\.(html|htm)$/,
        /\.(css|scss|sass|less|styl)$/,
        /components\/.*\.(js|ts|jsx|tsx|vue|svelte)$/,
        /pages\/.*\.(js|ts|jsx|tsx|vue|svelte)$/,
        /src\/.*\.(js|ts|jsx|tsx|vue|svelte)$/,
        /public\/.*\.(html|css|js)$/,
        /assets\/.*\.(css|scss|sass|less|styl)$/,
        /styles\/.*\.(css|scss|sass|less|styl)$/,
      ];

      // プロジェクトファイルでフロントエンドパターンをチェック
      const projectFiles = context.projectContext.structure.files || [];
      const hasFrontendFiles = projectFiles.some(file =>
        frontendPatterns.some(pattern => pattern.test(file.path))
      );

      // フロントエンド技術の検出
      const frontendFrameworks = [
        'react', 'vue', 'angular', 'svelte', 'solid',
        'next', 'nuxt', 'gatsby', 'vite', 'webpack',
        'bootstrap', 'tailwind', 'mui', 'antd', 'chakra',
      ];

      const hasFrontendFramework = context.projectContext.technologies.frameworks
        .map(f => f.toString().toLowerCase())
        .some(framework => frontendFrameworks.includes(framework));

      // フロントエンド言語の検出
      const frontendLanguages = ['javascript', 'typescript', 'html', 'css'];
      const hasFrontendLang = context.projectContext.technologies.languages
        .some(lang => frontendLanguages.includes(lang.toLowerCase()));

      // フロントエンド開発ツールの検出
      const frontendTools = [
        'webpack', 'vite', 'parcel', 'rollup',
        'babel', 'eslint', 'prettier',
        'sass', 'less', 'postcss', 'styled-components',
        'storybook', 'chromatic',
      ];

      const hasFrontendTools = context.projectContext.technologies.tools
        .map(t => t.toString().toLowerCase())
        .some(tool => frontendTools.includes(tool));

      // トリガータイプによる評価
      let triggerScore = 0;
      switch (context.trigger.type) {
        case 'command':
          const command = context.command?.toLowerCase() || '';
          if (command.includes('ui') || command.includes('component') || 
              command.includes('frontend') || command.includes('style')) {
            triggerScore += 30;
          }
          break;
        case 'file-change':
          if (hasFrontendFiles) {
            triggerScore += 25;
          }
          break;
      }

      // 総合評価
      const evaluation = hasFrontendFiles || hasFrontendFramework || 
                        hasFrontendLang || hasFrontendTools || triggerScore > 0;

      logger.debug('フロントエンドエキスパート評価結果', {
        hasFrontendFiles,
        hasFrontendFramework,
        hasFrontendLang,
        hasFrontendTools,
        triggerScore,
        evaluation,
      });

      return evaluation;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('フロントエンドエキスパート活性化評価に失敗', { error: errorMessage });
      return false;
    }
  }

  /**
   * ペルソナ固有の活性化処理
   */
  protected async performActivation(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('フロントエンドエキスパートペルソナを活性化');

      // フロントエンド関連のコンテキストを分析
      await this.analyzeFrontendContext(context);

      logger.info('フロントエンドエキスパートペルソナ活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('フロントエンドエキスパート活性化処理に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * ペルソナ固有の非活性化処理
   */
  protected async performDeactivation(): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('フロントエンドエキスパートペルソナを非活性化');

      // クリーンアップ処理
      logger.info('フロントエンドエキスパートペルソナ非活性化完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('フロントエンドエキスパート非活性化処理に失敗', { error: errorMessage });
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
      logger.debug('フロントエンドエキスパートコマンド実行', {
        command: command.substring(0, 100),
      });

      let output = '';
      let confidence = 0.8;

      // コマンドタイプを分析
      const commandLower = command.toLowerCase();
      
      if (commandLower.includes('component') || commandLower.includes('ui')) {
        output = await this.handleComponentCommand(command, context);
        confidence = 0.9;
      } else if (commandLower.includes('design') || commandLower.includes('layout')) {
        output = await this.handleDesignCommand(command, context);
        confidence = 0.88;
      } else if (commandLower.includes('performance') || commandLower.includes('optimization')) {
        output = await this.handlePerformanceCommand(command, context);
        confidence = 0.85;
      } else if (commandLower.includes('responsive') || commandLower.includes('mobile')) {
        output = await this.handleResponsiveCommand(command, context);
        confidence = 0.87;
      } else if (commandLower.includes('accessibility') || commandLower.includes('a11y')) {
        output = await this.handleAccessibilityCommand(command, context);
        confidence = 0.86;
      } else if (commandLower.includes('state') || commandLower.includes('redux') || commandLower.includes('vuex')) {
        output = await this.handleStateManagementCommand(command, context);
        confidence = 0.84;
      } else {
        output = await this.handleGeneralFrontendCommand(command, context);
        confidence = 0.75;
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
          reasoning: 'フロントエンドエキスパートとしての専門知識を活用',
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('フロントエンドエキスパートコマンド実行に失敗', { error: errorMessage });

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
    if (projectType === 'web-application') {
      bonus += 20;
    }

    // フロントエンド言語ボーナス
    const frontendLanguages = ['javascript', 'typescript'];
    const hasFrontendLang = context.projectContext.technologies.languages
      .some(lang => frontendLanguages.includes(lang.toLowerCase()));
    
    if (hasFrontendLang) {
      bonus += 15;
    }

    // フロントエンドフレームワークボーナス
    const frontendFrameworks = ['react', 'vue', 'angular', 'svelte'];
    const hasFrontendFramework = context.projectContext.technologies.frameworks
      .map(f => f.toString().toLowerCase())
      .some(framework => frontendFrameworks.includes(framework));
    
    if (hasFrontendFramework) {
      bonus += 15;
    }

    return Math.min(bonus, 25); // 最大25ポイントのボーナス
  }

  // プライベートメソッド

  /**
   * フロントエンドコンテキストを分析
   */
  private async analyzeFrontendContext(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      // コンポーネントファイルの分析
      const componentFiles = context.projectContext.structure.files?.filter(file =>
        /components\/|src\/.*\.(jsx|tsx|vue|svelte)$/.test(file.path)
      );

      // スタイルファイルの分析
      const styleFiles = context.projectContext.structure.files?.filter(file =>
        /\.(css|scss|sass|less|styl)$/.test(file.path)
      );

      logger.debug('フロントエンドコンテキスト分析完了', {
        componentFilesCount: componentFiles?.length || 0,
        styleFilesCount: styleFiles?.length || 0,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('フロントエンドコンテキスト分析に失敗', { error: errorMessage });
    }
  }

  /**
   * コンポーネントコマンドを処理
   */
  private async handleComponentCommand(command: string, context: PersonaContext): Promise<string> {
    return `## UI コンポーネント設計提案

フロントエンドエキスパートとして、以下のコンポーネント設計を提案いたします：

### コンポーネント設計原則
- 単一責任の原則
- 再利用可能性の考慮
- プロパティの最小化
- 適切な命名規則

### 推奨実装パターン
- Container/Presentational パターン
- Compound Component パターン
- Render Props / Hooks パターン
- 状態管理の分離

### ベストプラクティス
- TypeScript での型安全性
- Storybook でのドキュメント化
- テストの自動化
- パフォーマンス最適化

プロジェクトの要件に応じた具体的なコンポーネント実装をご提案いたします。`;
  }

  /**
   * デザインコマンドを処理
   */
  private async handleDesignCommand(command: string, context: PersonaContext): Promise<string> {
    return `## UI/UX デザイン提案

### デザインシステム
- 一貫したビジュアル言語
- カラーパレット定義
- タイポグラフィ体系
- スペーシングシステム

### レイアウト設計
- Grid システムの活用
- Flexbox レイアウト
- モバイルファーストアプローチ
- ビジュアルヒエラルキー

### インタラクションデザイン
- マイクロインタラクション
- トランジション効果
- フィードバック機能
- ローディング状態

ユーザー体験を最大化するデザイン戦略をご提案いたします。`;
  }

  /**
   * パフォーマンスコマンドを処理
   */
  private async handlePerformanceCommand(command: string, context: PersonaContext): Promise<string> {
    return `## フロントエンドパフォーマンス最適化

### レンダリング最適化
- React.memo / Vue.js computed 活用
- 仮想化（Virtual Scrolling）
- 遅延ローディング
- コード分割

### バンドル最適化
- Tree Shaking
- Code Splitting
- 動的インポート
- 依存関係の最適化

### Web パフォーマンス
- Critical Path の最適化
- 画像最適化
- キャッシュ戦略
- Service Worker 活用

具体的なパフォーマンス改善策をプロファイリング結果に基づいてご提案いたします。`;
  }

  /**
   * レスポンシブコマンドを処理
   */
  private async handleResponsiveCommand(command: string, context: PersonaContext): Promise<string> {
    return `## レスポンシブデザイン実装

### モバイルファーストアプローチ
- 最小画面サイズから設計
- プログレッシブエンハンスメント
- タッチインターフェース対応
- パフォーマンス重視

### ブレークポイント戦略
- デバイスカテゴリー別設定
- コンテンツベースのブレークポイント
- フレキシブルなグリッド
- 適応的な画像表示

### 実装手法
- CSS Grid / Flexbox 活用
- Media Queries 最適化
- Container Queries 対応
- ビューポート単位の活用

すべてのデバイスで最適な体験を提供する実装をご提案いたします。`;
  }

  /**
   * アクセシビリティコマンドを処理
   */
  private async handleAccessibilityCommand(command: string, context: PersonaContext): Promise<string> {
    return `## アクセシビリティ対応

### WCAG 2.1 準拠
- 知覚可能性の確保
- 操作可能性の実装
- 理解可能性の向上
- 堅牢性の保証

### 実装要素
- セマンティック HTML
- ARIA 属性の適切な使用
- キーボードナビゲーション
- フォーカス管理

### テスト・検証
- 自動化テストツール
- スクリーンリーダーテスト
- コントラスト比チェック
- ユーザビリティテスト

包括的なアクセシビリティ対応をご提案いたします。`;
  }

  /**
   * 状態管理コマンドを処理
   */
  private async handleStateManagementCommand(command: string, context: PersonaContext): Promise<string> {
    return `## 状態管理設計

### 状態管理パターン
- Flux / Redux パターン
- Context API 活用
- 状態の正規化
- 副作用の管理

### 実装アプローチ
- Redux Toolkit
- Zustand / Valtio
- SWR / React Query
- Vue 3 Composition API

### ベストプラクティス
- 状態の最小化
- 不変性の保持
- 状態の分割
- パフォーマンス最適化

プロジェクトの複雑さに応じた最適な状態管理戦略をご提案いたします。`;
  }

  /**
   * 一般的なフロントエンドコマンドを処理
   */
  private async handleGeneralFrontendCommand(command: string, context: PersonaContext): Promise<string> {
    return `## フロントエンド開発支援

フロントエンドエキスパートとして、以下の領域でサポートいたします：

- UI/UX 設計・実装
- コンポーネントアーキテクチャ
- パフォーマンス最適化
- レスポンシブデザイン
- アクセシビリティ対応
- 状態管理設計

具体的なご要望をお聞かせください。プロジェクトに最適な解決策をご提案いたします。`;
  }
}