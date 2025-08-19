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

export class FrontendExpertPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      name: 'Frontend Expert',
      description: 'フロントエンド開発とUI/UXデザインに特化したAIペルソナ。モダンフロントエンド技術、パフォーマンス最適化、アクセシビリティ、レスポンシブデザインを専門とします。',
      version: '1.0.0',
      capabilities: [
        PersonaCapability.CODE_GENERATION,
        PersonaCapability.UI_DESIGN,
        PersonaCapability.PERFORMANCE_OPTIMIZATION,
        PersonaCapability.ACCESSIBILITY_AUDIT,
        PersonaCapability.RESPONSIVE_DESIGN,
        PersonaCapability.TESTING_STRATEGY,
        PersonaCapability.DOCUMENTATION,
        PersonaCapability.DEBUGGING
      ],
      defaultPromptTemplate: {
        id: 'frontend-expert-template',
        name: 'Frontend Expert Template',
        template: `あなたはフロントエンド開発のエキスパートとして、以下のリクエストにお答えください：

プロジェクト情報：
- プロジェクト名: {{PROJECT_NAME}}
- プロジェクトタイプ: {{PROJECT_TYPE}}
- 使用技術: {{FRONTEND_STACK}}

ユーザーリクエスト：
{{USER_INPUT}}

以下の観点から専門的なアドバイスを提供してください：
1. UI/UXデザイン
2. パフォーマンス最適化
3. アクセシビリティ
4. モバイル対応
5. モダンフロントエンド技術
6. ベストプラクティス

実装可能で具体的な回答をお願いします。`,
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
            name: 'FRONTEND_STACK',
            description: 'フロントエンド技術スタック',
            required: false,
            defaultValue: '未指定'
          }
        ]
      },
      learningEnabled: true,
      adaptationStrategy: AdaptationStrategy.USER_FEEDBACK_BASED,
      memoryRetention: {
        shortTerm: 24 * 60 * 60 * 1000, // 24時間
        longTerm: 30 * 24 * 60 * 60 * 1000, // 30日
        maxEntries: 1200
      },
      responseConstraints: {
        maxLength: 10000,
        minConfidence: 0.75,
        timeoutMs: 12000
      },
      knowledgeBaseConfig: {
        domains: [
          'react-development',
          'vue-development',
          'angular-development',
          'web-performance',
          'accessibility',
          'css-frameworks',
          'build-tools',
          'testing',
          'ui-ux-patterns'
        ],
        sources: [
          'mdn-web-docs',
          'react-documentation',
          'vue-documentation',
          'w3c-standards',
          'web-accessibility-guidelines'
        ],
        updateFrequency: 12 * 60 * 60 * 1000 // 12時間
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
    
    // フロントエンド専門知識の適用
    const expertResponse = await this.applyFrontendExpertise(analysis, context);
    
    // 応答の構築
    const response: PersonaResponse = {
      id: `frontend-response-${Date.now()}`,
      content: expertResponse.content,
      confidence: expertResponse.confidence,
      format: OutputFormat.MARKDOWN,
      suggestions: expertResponse.suggestions,
      codeExamples: expertResponse.codeExamples,
      metadata: {
        executionTime: 0, // 実行時間は BasePersona で設定
        tokensUsed: this.estimateTokenUsage(expertResponse.content),
        modelUsed: 'frontend-expert-v1',
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
    // フロントエンド固有のリソース初期化
    await this.loadUIPatterns();
    await this.loadPerformanceBenchmarks();
    await this.initializeAccessibilityGuidelines();
  }

  protected async cleanupResources(): Promise<void> {
    // リソースのクリーンアップ
  }

  private async analyzePrompt(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<FrontendPromptAnalysis> {
    const content = prompt.content.toLowerCase();
    
    // フロントエンド関連キーワード分析
    const componentKeywords = [
      'component', 'react', 'vue', 'angular', 'jsx', 'tsx',
      'hook', 'state', 'props', 'render'
    ];
    
    const stylingKeywords = [
      'css', 'scss', 'sass', 'styled', 'tailwind', 'bootstrap',
      'layout', 'responsive', 'design', 'theme'
    ];
    
    const performanceKeywords = [
      'performance', 'optimization', 'lazy', 'bundle', 'webpack',
      'vite', 'lighthouse', 'core web vitals', 'loading'
    ];
    
    const accessibilityKeywords = [
      'accessibility', 'a11y', 'wcag', 'aria', 'semantic',
      'screen reader', 'keyboard navigation'
    ];

    const testingKeywords = [
      'test', 'testing', 'jest', 'vitest', 'cypress', 'playwright',
      'unit test', 'integration', 'e2e'
    ];

    return {
      category: this.determineFrontendCategory(content, {
        component: componentKeywords,
        styling: stylingKeywords,
        performance: performanceKeywords,
        accessibility: accessibilityKeywords,
        testing: testingKeywords
      }),
      complexity: this.assessFrontendComplexity(prompt, context),
      framework: this.detectFramework(content, context),
      designSystem: this.detectDesignSystem(content, context),
      userExperience: this.analyzeUXRequirements(content),
      browserSupport: this.analyzeBrowserRequirements(content, context)
    };
  }

  private determineFrontendCategory(
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

  private assessFrontendComplexity(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;

    // プロンプト長による評価
    if (prompt.content.length > 300) complexityScore += 1;
    if (prompt.content.length > 800) complexityScore += 1;

    // プロジェクトの複雑性
    if (context.project) {
      const frameworks = context.project.technologies.frameworks;
      if (frameworks.some(f => ['React', 'Vue.js', 'Angular'].includes(f.name))) {
        complexityScore += 1;
      }
      if (frameworks.length > 2) complexityScore += 1;
    }

    // 高度な技術キーワード
    const advancedKeywords = [
      'server-side rendering', 'ssr', 'static generation', 'ssg',
      'micro-frontend', 'web workers', 'service worker', 'pwa'
    ];
    const advancedKeywordCount = advancedKeywords.reduce((count, keyword) => {
      return count + (prompt.content.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    complexityScore += advancedKeywordCount;

    if (complexityScore <= 2) return 'simple';
    if (complexityScore <= 4) return 'medium';
    return 'complex';
  }

  private detectFramework(content: string, context: PersonaContext): string {
    const frameworkKeywords = {
      'React': ['react', 'jsx', 'tsx', 'nextjs', 'next.js'],
      'Vue.js': ['vue', 'nuxt', 'composition api', 'options api'],
      'Angular': ['angular', 'typescript', '@angular', 'rxjs'],
      'Svelte': ['svelte', 'sveltekit'],
      'Vanilla': ['vanilla', 'javascript', 'html', 'css']
    };

    // プロジェクトコンテキストから検出を試行
    if (context.project?.technologies.frameworks) {
      for (const framework of context.project.technologies.frameworks) {
        if (['React', 'Vue.js', 'Angular', 'Svelte'].includes(framework.name)) {
          return framework.name;
        }
      }
    }

    // プロンプト内容から検出
    for (const [framework, keywords] of Object.entries(frameworkKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return framework;
      }
    }

    return 'Unknown';
  }

  private detectDesignSystem(content: string, context: PersonaContext): string {
    const designSystemKeywords = {
      'Material-UI': ['mui', 'material-ui', 'material design'],
      'Ant Design': ['antd', 'ant design'],
      'Chakra UI': ['chakra', 'chakra ui'],
      'Tailwind CSS': ['tailwind', 'tailwindcss'],
      'Bootstrap': ['bootstrap'],
      'Styled Components': ['styled-components', 'styled'],
      'Custom': ['custom', 'bespoke', '独自']
    };

    for (const [system, keywords] of Object.entries(designSystemKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return system;
      }
    }

    return 'Unknown';
  }

  private analyzeUXRequirements(content: string): UXRequirements {
    return {
      interactivity: content.includes('interactive') || content.includes('インタラクティブ'),
      animations: content.includes('animation') || content.includes('アニメーション'),
      accessibility: content.includes('accessible') || content.includes('アクセシビリティ'),
      performance: content.includes('fast') || content.includes('速い') || content.includes('パフォーマンス'),
      mobile: content.includes('mobile') || content.includes('responsive') || content.includes('モバイル')
    };
  }

  private analyzeBrowserRequirements(content: string, context: PersonaContext): BrowserSupport {
    return {
      modern: !content.includes('ie') && !content.includes('internet explorer'),
      legacy: content.includes('ie') || content.includes('legacy'),
      mobile: content.includes('mobile') || content.includes('safari'),
      crossBrowser: content.includes('cross-browser') || content.includes('all browsers')
    };
  }

  private async applyFrontendExpertise(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const { category, complexity, framework } = analysis;

    switch (category) {
      case 'component':
        return this.generateComponentAdvice(analysis, context);
      case 'styling':
        return this.generateStylingAdvice(analysis, context);
      case 'performance':
        return this.generatePerformanceAdvice(analysis, context);
      case 'accessibility':
        return this.generateAccessibilityAdvice(analysis, context);
      case 'testing':
        return this.generateTestingAdvice(analysis, context);
      default:
        return this.generateGeneralFrontendAdvice(analysis, context);
    }
  }

  private async generateComponentAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = this.buildComponentResponse(analysis, context);
    const suggestions = this.generateComponentSuggestions(analysis);
    const codeExamples = await this.generateComponentCodeExamples(analysis);

    return {
      content,
      confidence: 0.92,
      suggestions,
      codeExamples
    };
  }

  private buildComponentResponse(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    const { complexity, framework, designSystem } = analysis;
    
    let response = `# フロントエンドコンポーネント開発ガイド\n\n`;
    
    // プロジェクト分析
    response += `## プロジェクト分析\n`;
    response += `- **フレームワーク**: ${framework}\n`;
    response += `- **デザインシステム**: ${designSystem}\n`;
    response += `- **複雑性**: ${complexity}\n\n`;

    // フレームワーク固有のアドバイス
    response += `## ${framework} コンポーネント設計\n\n`;
    response += this.getFrameworkSpecificAdvice(framework, complexity);

    // デザインパターン
    response += `\n## 推奨デザインパターン\n\n`;
    response += this.getDesignPatterns(complexity);

    // パフォーマンス考慮事項
    response += `\n## パフォーマンス最適化\n\n`;
    response += this.getPerformanceOptimization(framework);

    return response;
  }

  private getFrameworkSpecificAdvice(framework: string, complexity: 'simple' | 'medium' | 'complex'): string {
    switch (framework) {
      case 'React':
        return this.getReactAdvice(complexity);
      case 'Vue.js':
        return this.getVueAdvice(complexity);
      case 'Angular':
        return this.getAngularAdvice(complexity);
      default:
        return this.getGeneralJSAdvice(complexity);
    }
  }

  private getReactAdvice(complexity: 'simple' | 'medium' | 'complex'): string {
    let advice = `### React コンポーネントのベストプラクティス

#### 関数コンポーネントとHooks
- **useState**: ローカル状態管理
- **useEffect**: 副作用の処理
- **useMemo**: 計算結果のメモ化
- **useCallback**: 関数のメモ化

#### コンポーネント設計原則
- **単一責任の原則**: 1つのコンポーネントは1つの責任
- **Props の型安全性**: TypeScript でインターフェースを定義
- **コンポーネントの再利用性**: 汎用的な設計

`;

    if (complexity !== 'simple') {
      advice += `#### 高度なパターン
- **Compound Components**: 複合コンポーネントパターン
- **Render Props**: レンダー関数パターン
- **Custom Hooks**: ロジックの再利用
- **Context API**: 状態の共有

`;
    }

    if (complexity === 'complex') {
      advice += `#### エンタープライズ級の考慮事項
- **Code Splitting**: 動的インポート
- **Error Boundaries**: エラー処理
- **Suspense**: 非同期コンポーネント
- **Server Components**: SSR最適化

`;
    }

    return advice;
  }

  private getVueAdvice(complexity: 'simple' | 'medium' | 'complex'): string {
    return `### Vue.js コンポーネントのベストプラクティス

#### Composition API の活用
- **ref/reactive**: リアクティブな状態管理
- **computed**: 算出プロパティ
- **watch**: データの監視
- **composables**: ロジックの再利用

#### コンポーネント通信
- **Props**: 親から子へのデータ渡し
- **Emit**: 子から親へのイベント送信
- **Provide/Inject**: 深い階層での状態共有

`;
  }

  private getAngularAdvice(complexity: 'simple' | 'medium' | 'complex'): string {
    return `### Angular コンポーネントのベストプラクティス

#### コンポーネントアーキテクチャ
- **Smart/Dumb Components**: 役割の明確化
- **OnPush Strategy**: 変更検知の最適化
- **Lifecycle Hooks**: ライフサイクルの活用

#### 依存性注入
- **Services**: ビジネスロジックの分離
- **Providers**: 依存関係の管理

`;
  }

  private getGeneralJSAdvice(complexity: 'simple' | 'medium' | 'complex'): string {
    return `### Vanilla JavaScript コンポーネント

#### モダンJavaScriptの活用
- **ES6+ モジュール**: コードの分割
- **Web Components**: 標準仕様に準拠
- **Custom Elements**: 再利用可能な要素

`;
  }

  private getDesignPatterns(complexity: 'simple' | 'medium' | 'complex'): string {
    let patterns = `### 基本パターン
- **Container/Presentational**: ロジックとUIの分離
- **Higher-Order Components**: コンポーネントの拡張
- **Provider Pattern**: 状態の提供

`;

    if (complexity !== 'simple') {
      patterns += `### 応用パターン
- **Observer Pattern**: 状態変更の通知
- **Factory Pattern**: コンポーネントの動的生成
- **Strategy Pattern**: 振る舞いの切り替え

`;
    }

    return patterns;
  }

  private getPerformanceOptimization(framework: string): string {
    return `### パフォーマンス最適化手法
- **Virtual Scrolling**: 大量データの効率的な表示
- **Image Optimization**: 画像の遅延読み込み
- **Code Splitting**: バンドルサイズの最適化
- **Tree Shaking**: 未使用コードの除去
- **Memoization**: 計算結果のキャッシュ

`;
  }

  private generateComponentSuggestions(analysis: FrontendPromptAnalysis): string[] {
    const suggestions: string[] = [
      'コンポーネントのストーリーブック（Storybook）を作成してください',
      'プロパティの型定義を明確にしてください',
      'ユニットテストを追加してください'
    ];

    if (analysis.complexity !== 'simple') {
      suggestions.push(
        'パフォーマンステストを実装してください',
        'アクセシビリティテストを追加してください'
      );
    }

    return suggestions;
  }

  private async generateComponentCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    const examples: Array<{ language: string; code: string; description: string }> = [];

    if (analysis.framework === 'React') {
      examples.push({
        language: 'typescript',
        code: `// Button.tsx
import React from 'react';
import { styled } from '@mui/system';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const StyledButton = styled('button')<ButtonProps>(({ theme, variant, size }) => ({
  padding: size === 'small' ? '8px 16px' : size === 'large' ? '16px 32px' : '12px 24px',
  borderRadius: theme.shape.borderRadius,
  border: variant === 'outlined' ? \`1px solid \${theme.palette.primary.main}\` : 'none',
  backgroundColor: variant === 'primary' ? theme.palette.primary.main : 'transparent',
  color: variant === 'primary' ? theme.palette.primary.contrastText : theme.palette.primary.main,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  
  '&:hover': {
    backgroundColor: variant === 'primary' 
      ? theme.palette.primary.dark 
      : theme.palette.action.hover,
  },
  
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}));

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  children,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </StyledButton>
  );
};`,
        description: 'TypeScript と Material-UI を使った再利用可能なボタンコンポーネント'
      });

      if (analysis.complexity !== 'simple') {
        examples.push({
          language: 'typescript',
          code: `// hooks/useIntersectionObserver.ts
import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export const useIntersectionObserver = (
  options: UseIntersectionObserverOptions = {}
) => {
  const { threshold = 0.1, rootMargin = '0px', once = false } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry!.isIntersecting;
        setIsVisible(visible);
        
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true);
          if (once) {
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, once, hasBeenVisible]);

  return { ref, isVisible, hasBeenVisible };
};

// 使用例
const LazyImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1, once: true });
  
  return (
    <div ref={ref} style={{ minHeight: '200px' }}>
      {isVisible && <img src={src} alt={alt} />}
    </div>
  );
};`,
          description: 'Intersection Observer を使った遅延読み込みカスタムフック'
        });
      }
    }

    return examples;
  }

  private async generateStylingAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = `# CSS & スタイリングガイド\n\n` +
      `モダンなスタイリング手法とベストプラクティスをご提案します。\n\n` +
      this.generateStylingGuidance(analysis, context);

    return {
      content,
      confidence: 0.88,
      suggestions: [
        'デザインシステムを構築してください',
        'CSS変数を活用してテーマを管理してください',
        'レスポンシブデザインを実装してください'
      ],
      codeExamples: await this.generateStylingCodeExamples(analysis)
    };
  }

  private generateStylingGuidance(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    return `## スタイリング戦略\n\nプロジェクトに最適なスタイリング手法をご提案いたします。`;
  }

  private async generateStylingCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'css',
      code: `:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --background-color: #ffffff;
  --text-color: #1f2937;
  --border-radius: 8px;
  --spacing-unit: 8px;
}

.button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  padding: calc(var(--spacing-unit) * 1.5) calc(var(--spacing-unit) * 3);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button:hover {
  background-color: color-mix(in srgb, var(--primary-color) 90%, black);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .button {
    font-size: 14px;
    padding: var(--spacing-unit) calc(var(--spacing-unit) * 2);
  }
}`,
      description: 'CSS カスタムプロパティを使ったモダンなスタイリング'
    }];
  }

  private async generatePerformanceAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = `# フロントエンドパフォーマンス最適化\n\n` +
      `Webアプリケーションのパフォーマンスを向上させるための戦略をご提案します。\n\n` +
      this.generatePerformanceGuidance(analysis, context);

    return {
      content,
      confidence: 0.90,
      suggestions: [
        'Lighthouse監査を定期的に実行してください',
        'Core Web Vitalsを監視してください',
        'Bundle Analyzerでバンドルサイズを確認してください'
      ],
      codeExamples: await this.generatePerformanceCodeExamples(analysis)
    };
  }

  private generatePerformanceGuidance(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    return `## パフォーマンス最適化戦略\n\n具体的な最適化手法については実装レベルでご提案いたします。`;
  }

  private async generatePerformanceCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// 遅延読み込みされるコンポーネント
import { lazy, Suspense } from 'react';

const LazyComponent = lazy(() => import('./HeavyComponent'));

// 使用例
const App = () => {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LazyComponent />
    </Suspense>
  );
};

// Service Worker の登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}`,
      description: 'React での遅延読み込みと Service Worker の実装'
    }];
  }

  private async generateAccessibilityAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = `# Webアクセシビリティ実装ガイド\n\n` +
      `すべてのユーザーが利用しやすいWebアプリケーションを構築するためのガイドラインをご提案します。\n\n` +
      this.generateAccessibilityGuidance(analysis, context);

    return {
      content,
      confidence: 0.94,
      suggestions: [
        'axe-core を使ったアクセシビリティテストを導入してください',
        'キーボードナビゲーションをテストしてください',
        'スクリーンリーダーでの動作確認を行ってください'
      ],
      codeExamples: await this.generateAccessibilityCodeExamples(analysis)
    };
  }

  private generateAccessibilityGuidance(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    return `## アクセシビリティベストプラクティス\n\nWCAG 2.1 ガイドラインに準拠した実装をご提案いたします。`;
  }

  private async generateAccessibilityCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// アクセシブルなボタンコンポーネント
interface AccessibleButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disabled?: boolean;
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onClick,
  ariaLabel,
  ariaDescribedBy,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </button>
  );
};

// フォーカス管理のカスタムフック
const useFocusManagement = () => {
  const focusRef = useRef<HTMLElement>(null);
  
  const setFocus = () => {
    if (focusRef.current) {
      focusRef.current.focus();
    }
  };
  
  return { focusRef, setFocus };
};`,
      description: 'アクセシブルなUI コンポーネントの実装例'
    }];
  }

  private async generateTestingAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = `# フロントエンドテスト戦略\n\n` +
      `品質の高いフロントエンドアプリケーションを構築するためのテスト戦略をご提案します。\n\n` +
      this.generateTestingGuidance(analysis, context);

    return {
      content,
      confidence: 0.87,
      suggestions: [
        'テストピラミッドを意識したテスト設計を行ってください',
        'Visual Regression Testing を導入してください',
        'E2E テストで重要なユーザーフローを確認してください'
      ],
      codeExamples: await this.generateTestingCodeExamples(analysis)
    };
  }

  private generateTestingGuidance(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    return `## テスト戦略\n\n包括的なテスト手法をご提案いたします。`;
  }

  private async generateTestingCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled button</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should have correct accessibility attributes', () => {
    render(
      <Button ariaLabel="Submit form" ariaDescribedBy="help-text">
        Submit
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
    expect(button).toHaveAttribute('aria-describedby', 'help-text');
  });
});`,
      description: 'React Testing Library を使用したコンポーネントテスト'
    }];
  }

  private async generateGeneralFrontendAdvice(
    analysis: FrontendPromptAnalysis,
    context: PersonaContext
  ): Promise<FrontendExpertResponse> {
    const content = `# フロントエンド開発ガイド\n\n` +
      `モダンフロントエンド開発のベストプラクティスをご提案します。\n\n` +
      this.generateGeneralGuidance(analysis, context);

    return {
      content,
      confidence: 0.82,
      suggestions: [
        'プロジェクトの要件を明確にしてください',
        '適切なツールチェーンを選択してください',
        'コードレビューのプロセスを確立してください'
      ],
      codeExamples: await this.generateGeneralCodeExamples(analysis)
    };
  }

  private generateGeneralGuidance(analysis: FrontendPromptAnalysis, context: PersonaContext): string {
    return `## 総合的な開発指針\n\nプロジェクトの成功のための包括的なアプローチをご提案いたします。`;
  }

  private async generateGeneralCodeExamples(analysis: FrontendPromptAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// utils/errorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // エラーレポーティングサービスに送信
    // reportError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div role="alert">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}`,
      description: 'React Error Boundary の実装例'
    }];
  }

  private estimateTokenUsage(content: string): number {
    // 簡易的なトークン使用量の推定
    return Math.ceil(content.length / 4);
  }

  private async loadUIPatterns(): Promise<void> {
    // UIパターンの知識を読み込み
  }

  private async loadPerformanceBenchmarks(): Promise<void> {
    // パフォーマンスベンチマークデータを読み込み
  }

  private async initializeAccessibilityGuidelines(): Promise<void> {
    // アクセシビリティガイドラインを初期化
  }
}

// 型定義
interface FrontendPromptAnalysis {
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  framework: string;
  designSystem: string;
  userExperience: UXRequirements;
  browserSupport: BrowserSupport;
}

interface UXRequirements {
  interactivity: boolean;
  animations: boolean;
  accessibility: boolean;
  performance: boolean;
  mobile: boolean;
}

interface BrowserSupport {
  modern: boolean;
  legacy: boolean;
  mobile: boolean;
  crossBrowser: boolean;
}

interface FrontendExpertResponse {
  content: string;
  confidence: number;
  suggestions: string[];
  codeExamples: Array<{
    language: string;
    code: string;
    description: string;
  }>;
}

export default FrontendExpertPersona;