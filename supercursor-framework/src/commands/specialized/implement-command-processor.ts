import { 
  CommandProcessor, 
  CommandResult, 
  CommandContext 
} from '../../core/interfaces.js';
import { 
  FrameworkError, 
  ErrorSeverity, 
  PersonaCapability,
  PersonaContext,
  ProjectType
} from '../../types/index.js';
import { PersonaManager } from '../../personas/persona-manager.js';
import { CursorAPIIntegration } from '../../integrations/cursor-api-integration.js';
import { ContextAnalyzer } from '../../core/context-analyzer.js';

export class ImplementCommandProcessorError extends FrameworkError {
  code = 'IMPLEMENT_COMMAND_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

export interface ImplementationRequest {
  feature: string;
  description?: string;
  fileTargets?: string[];
  requirements?: string[];
  constraints?: string[];
  testRequired?: boolean;
  documentationRequired?: boolean;
}

export interface ImplementationResult extends CommandResult {
  filesCreated: string[];
  filesModified: string[];
  testsGenerated: string[];
  documentation: string[];
  suggestions: string[];
  nextSteps: string[];
}

export class ImplementCommandProcessor implements CommandProcessor {
  readonly command = '/sc:implement';
  readonly description = '機能実装を支援するコマンド。AIペルソナと連携して、要件に応じた最適な実装を提供します。';
  readonly examples = [
    '/sc:implement "ユーザー認証システム" --tests --docs',
    '/sc:implement "API レート制限機能" --files="src/middleware" --persona="backend-architect"',
    '/sc:implement "レスポンシブダッシュボード" --persona="frontend-expert" --framework="react"'
  ];

  constructor(
    private personaManager: PersonaManager,
    private cursorApi: CursorAPIIntegration,
    private contextAnalyzer: ContextAnalyzer
  ) {}

  async execute(args: string[], context: CommandContext): Promise<ImplementationResult> {
    const request = this.parseImplementationRequest(args);
    
    if (!request.feature) {
      throw new ImplementCommandProcessorError('実装する機能の指定が必要です');
    }

    try {
      // プロジェクトコンテキストの分析
      const projectContext = await this.analyzeProjectContext(context);
      
      // 適切なペルソナの選択
      const selectedPersona = await this.selectBestPersona(request, projectContext);
      
      // 実装計画の生成
      const implementationPlan = await this.generateImplementationPlan(
        request, 
        projectContext, 
        selectedPersona.id
      );
      
      // 実装の実行
      const result = await this.executeImplementation(implementationPlan, context);
      
      // 品質チェックとバリデーション
      await this.validateImplementation(result, request);
      
      return result;

    } catch (error) {
      throw new ImplementCommandProcessorError(
        `実装処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseImplementationRequest(args: string[]): ImplementationRequest {
    const request: ImplementationRequest = {
      feature: '',
      testRequired: false,
      documentationRequired: false
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('"') && arg.endsWith('"')) {
        request.feature = arg.slice(1, -1);
      } else if (arg.startsWith('--description=')) {
        request.description = arg.substring('--description='.length);
      } else if (arg.startsWith('--files=')) {
        request.fileTargets = arg.substring('--files='.length).split(',');
      } else if (arg.startsWith('--requirements=')) {
        request.requirements = arg.substring('--requirements='.length).split(',');
      } else if (arg.startsWith('--constraints=')) {
        request.constraints = arg.substring('--constraints='.length).split(',');
      } else if (arg === '--tests') {
        request.testRequired = true;
      } else if (arg === '--docs') {
        request.documentationRequired = true;
      } else if (!arg.startsWith('--') && !request.feature) {
        // 最初の非オプション引数を機能名として扱う
        request.feature = arg;
      }
      
      i++;
    }

    return request;
  }

  private async analyzeProjectContext(context: CommandContext): Promise<PersonaContext> {
    const projectStructure = await this.contextAnalyzer.analyzeProjectStructure(
      context.workingDirectory
    );
    
    const techStack = await this.contextAnalyzer.detectTechnologyStack(
      projectStructure
    );

    return {
      user: {
        id: context.user?.id || 'unknown',
        name: context.user?.name || 'User',
        preferences: context.user?.preferences
      },
      project: {
        name: this.extractProjectName(context.workingDirectory),
        type: this.inferProjectType(techStack, projectStructure),
        structure: projectStructure,
        technologies: techStack
      },
      session: {
        id: context.sessionId || `session-${Date.now()}`,
        startTime: new Date(),
        context: context.metadata || {}
      }
    };
  }

  private extractProjectName(workingDirectory: string): string {
    const parts = workingDirectory.split('/');
    return parts[parts.length - 1] || 'unknown-project';
  }

  private inferProjectType(techStack: any, structure: any): ProjectType {
    // フレームワークに基づくプロジェクトタイプの推論
    const frameworks = techStack.frameworks || [];
    const hasReact = frameworks.some((f: string) => f.toLowerCase().includes('react'));
    const hasAngular = frameworks.some((f: string) => f.toLowerCase().includes('angular'));
    const hasVue = frameworks.some((f: string) => f.toLowerCase().includes('vue'));
    const hasExpress = frameworks.some((f: string) => f.toLowerCase().includes('express'));
    const hasNextJs = frameworks.some((f: string) => f.toLowerCase().includes('next'));

    if (hasNextJs) return ProjectType.FULL_STACK_APP;
    if (hasReact || hasAngular || hasVue) return ProjectType.FRONTEND_APP;
    if (hasExpress) return ProjectType.API_SERVICE;
    
    // ファイル構造に基づく推論
    const files = structure.files || [];
    const hasApiFiles = files.some((f: string) => f.includes('api/') || f.includes('routes/'));
    const hasComponentFiles = files.some((f: string) => f.includes('component') || f.includes('view'));
    
    if (hasApiFiles && hasComponentFiles) return ProjectType.FULL_STACK_APP;
    if (hasApiFiles) return ProjectType.API_SERVICE;
    if (hasComponentFiles) return ProjectType.FRONTEND_APP;

    return ProjectType.GENERAL_PURPOSE;
  }

  private async selectBestPersona(request: ImplementationRequest, projectContext: PersonaContext) {
    // 実装タイプに基づくペルソナ選択
    const requiredCapabilities = this.determineRequiredCapabilities(request, projectContext);
    
    const selectionCriteria = {
      requiredCapabilities,
      minPerformanceScore: 0.7,
      preferredState: undefined
    };

    const selectionResult = await this.personaManager.selectPersona(
      selectionCriteria, 
      projectContext
    );

    return selectionResult.selectedPersona;
  }

  private determineRequiredCapabilities(
    request: ImplementationRequest, 
    projectContext: PersonaContext
  ): PersonaCapability[] {
    const capabilities: PersonaCapability[] = [PersonaCapability.CODE_GENERATION];
    
    // プロジェクトタイプに基づく機能追加
    switch (projectContext.project?.type) {
      case ProjectType.API_SERVICE:
      case ProjectType.MICROSERVICES:
        capabilities.push(
          PersonaCapability.ARCHITECTURE_DESIGN,
          PersonaCapability.DATABASE_DESIGN,
          PersonaCapability.API_DESIGN
        );
        break;
        
      case ProjectType.FRONTEND_APP:
      case ProjectType.MOBILE_APP:
        capabilities.push(
          PersonaCapability.UI_UX_DESIGN,
          PersonaCapability.PERFORMANCE_OPTIMIZATION
        );
        break;
        
      case ProjectType.FULL_STACK_APP:
        capabilities.push(
          PersonaCapability.ARCHITECTURE_DESIGN,
          PersonaCapability.UI_UX_DESIGN,
          PersonaCapability.DATABASE_DESIGN
        );
        break;
    }

    // セキュリティ関連の機能が含まれている場合
    if (this.isSecurityRelated(request)) {
      capabilities.push(
        PersonaCapability.SECURITY_ANALYSIS,
        PersonaCapability.VULNERABILITY_ASSESSMENT
      );
    }

    // テスト要求がある場合
    if (request.testRequired) {
      capabilities.push(PersonaCapability.TESTING_STRATEGY);
    }

    // ドキュメント要求がある場合
    if (request.documentationRequired) {
      capabilities.push(PersonaCapability.DOCUMENTATION);
    }

    return capabilities;
  }

  private isSecurityRelated(request: ImplementationRequest): boolean {
    const securityKeywords = [
      'auth', 'authentication', 'authorization', 'security', 'encrypt',
      'permission', 'access-control', 'jwt', 'oauth', 'login', 'password'
    ];

    const searchText = `${request.feature} ${request.description || ''}`.toLowerCase();
    return securityKeywords.some(keyword => searchText.includes(keyword));
  }

  private async generateImplementationPlan(
    request: ImplementationRequest,
    projectContext: PersonaContext,
    personaId: string
  ): Promise<ImplementationPlan> {
    const prompt = {
      id: `implement-plan-${Date.now()}`,
      content: this.buildImplementationPrompt(request, projectContext),
      type: 'implementation-request' as const,
      context: {
        request,
        projectContext,
        timestamp: new Date()
      },
      timestamp: new Date()
    };

    const response = await this.personaManager.executeWithPersona(
      personaId,
      prompt,
      projectContext
    );

    return this.parseImplementationPlan(response.content, request);
  }

  private buildImplementationPrompt(
    request: ImplementationRequest,
    projectContext: PersonaContext
  ): string {
    let prompt = `以下の機能を実装してください：

**機能名**: ${request.feature}`;

    if (request.description) {
      prompt += `\n**詳細説明**: ${request.description}`;
    }

    prompt += `\n\n**プロジェクト情報**:
- プロジェクト名: ${projectContext.project?.name}
- プロジェクトタイプ: ${projectContext.project?.type}
- 主要技術: ${projectContext.project?.technologies.frameworks.join(', ')}
- 使用言語: ${projectContext.project?.technologies.languages.join(', ')}`;

    if (request.requirements && request.requirements.length > 0) {
      prompt += `\n\n**要件**:\n${request.requirements.map(req => `- ${req}`).join('\n')}`;
    }

    if (request.constraints && request.constraints.length > 0) {
      prompt += `\n\n**制約事項**:\n${request.constraints.map(constraint => `- ${constraint}`).join('\n')}`;
    }

    if (request.fileTargets && request.fileTargets.length > 0) {
      prompt += `\n\n**対象ファイル/ディレクトリ**: ${request.fileTargets.join(', ')}`;
    }

    prompt += `\n\n**実装方針**:
1. 既存のプロジェクト構造とコーディング規約に従う
2. ベストプラクティスを適用する
3. 保守性と可読性を重視する`;

    if (request.testRequired) {
      prompt += `\n4. 適切な単体テストを含める`;
    }

    if (request.documentationRequired) {
      prompt += `\n5. 技術文書とコメントを含める`;
    }

    prompt += `\n\n以下の形式で実装計画を提示してください：
1. アーキテクチャ設計
2. 実装すべきファイルとその内容
3. テスト戦略（要求された場合）
4. 実装手順
5. 注意事項とベストプラクティス`;

    return prompt;
  }

  private parseImplementationPlan(content: string, request: ImplementationRequest): ImplementationPlan {
    return {
      feature: request.feature,
      architecture: this.extractSection(content, 'アーキテクチャ設計'),
      files: this.extractFileImplementations(content),
      tests: request.testRequired ? this.extractTestStrategy(content) : [],
      documentation: request.documentationRequired ? this.extractDocumentation(content) : [],
      steps: this.extractImplementationSteps(content),
      warnings: this.extractWarnings(content),
      estimatedTime: this.estimateImplementationTime(content, request)
    };
  }

  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`${sectionName}[:\\s]*([\\s\\S]*?)(?=\\n\\d+\\.|\\n##|$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractFileImplementations(content: string): FileImplementation[] {
    const implementations: FileImplementation[] = [];
    const fileRegex = /```(\w+)?\s*\/\/ (.*?)\n([\s\S]*?)```/g;
    let match;

    while ((match = fileRegex.exec(content)) !== null) {
      implementations.push({
        path: match[2].trim(),
        language: match[1] || 'typescript',
        content: match[3].trim(),
        action: 'create' // デフォルトは新規作成
      });
    }

    return implementations;
  }

  private extractTestStrategy(content: string): TestPlan[] {
    // テスト戦略の抽出ロジック
    return [{
      type: 'unit',
      files: [],
      description: 'ユニットテストの実装'
    }];
  }

  private extractDocumentation(content: string): DocumentationPlan[] {
    // ドキュメント計画の抽出ロジック
    return [{
      type: 'technical',
      content: '',
      filename: 'README.md'
    }];
  }

  private extractImplementationSteps(content: string): string[] {
    const stepsSection = this.extractSection(content, '実装手順');
    return stepsSection
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.trim());
  }

  private extractWarnings(content: string): string[] {
    const warningsSection = this.extractSection(content, '注意事項');
    return warningsSection
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim().substring(1).trim());
  }

  private estimateImplementationTime(content: string, request: ImplementationRequest): number {
    // 基本時間（分）
    let baseTime = 60;
    
    // 機能の複雑性による調整
    if (content.length > 2000) baseTime *= 1.5;
    if (request.testRequired) baseTime *= 1.3;
    if (request.documentationRequired) baseTime *= 1.2;
    
    return Math.round(baseTime);
  }

  private async executeImplementation(
    plan: ImplementationPlan,
    context: CommandContext
  ): Promise<ImplementationResult> {
    const result: ImplementationResult = {
      success: true,
      message: `機能「${plan.feature}」の実装が完了しました`,
      data: {
        implementationPlan: plan
      },
      filesCreated: [],
      filesModified: [],
      testsGenerated: [],
      documentation: [],
      suggestions: [],
      nextSteps: plan.steps,
      timestamp: new Date(),
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      // ファイルの作成・更新
      for (const fileImpl of plan.files) {
        const fullPath = this.resolvePath(fileImpl.path, context.workingDirectory);
        
        if (fileImpl.action === 'create') {
          await this.cursorApi.writeFile(fullPath, fileImpl.content);
          result.filesCreated.push(fullPath);
        } else {
          await this.cursorApi.updateFile(fullPath, fileImpl.content);
          result.filesModified.push(fullPath);
        }
      }

      // テストファイルの生成
      for (const testPlan of plan.tests) {
        const testFiles = await this.generateTestFiles(testPlan, context);
        result.testsGenerated.push(...testFiles);
      }

      // ドキュメントの生成
      for (const docPlan of plan.documentation) {
        const docFile = await this.generateDocumentation(docPlan, context);
        result.documentation.push(docFile);
      }

      // 実装提案の生成
      result.suggestions = this.generateImplementationSuggestions(plan);

      result.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      result.success = false;
      result.message = `実装中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  private resolvePath(relativePath: string, workingDirectory: string): string {
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return `${workingDirectory}/${relativePath}`.replace(/\/+/g, '/');
  }

  private async generateTestFiles(testPlan: TestPlan, context: CommandContext): Promise<string[]> {
    // テストファイル生成の実装
    return [];
  }

  private async generateDocumentation(docPlan: DocumentationPlan, context: CommandContext): Promise<string> {
    // ドキュメント生成の実装
    return docPlan.filename;
  }

  private generateImplementationSuggestions(plan: ImplementationPlan): string[] {
    const suggestions = [
      'コードレビューを実施してください',
      'セキュリティテストを実行してください'
    ];

    if (plan.warnings.length > 0) {
      suggestions.push('実装時の注意事項を確認してください');
    }

    return suggestions;
  }

  private async validateImplementation(result: ImplementationResult, request: ImplementationRequest): Promise<void> {
    // 実装結果の検証
    if (result.filesCreated.length === 0 && result.filesModified.length === 0) {
      throw new ImplementCommandProcessorError('ファイルが作成・更新されませんでした');
    }

    if (request.testRequired && result.testsGenerated.length === 0) {
      console.warn('テストが要求されましたが、テストファイルが生成されませんでした');
    }

    if (request.documentationRequired && result.documentation.length === 0) {
      console.warn('ドキュメントが要求されましたが、ドキュメントファイルが生成されませんでした');
    }
  }
}

// 型定義
interface ImplementationPlan {
  feature: string;
  architecture: string;
  files: FileImplementation[];
  tests: TestPlan[];
  documentation: DocumentationPlan[];
  steps: string[];
  warnings: string[];
  estimatedTime: number;
}

interface FileImplementation {
  path: string;
  language: string;
  content: string;
  action: 'create' | 'update' | 'modify';
}

interface TestPlan {
  type: 'unit' | 'integration' | 'e2e';
  files: string[];
  description: string;
}

interface DocumentationPlan {
  type: 'technical' | 'api' | 'user';
  content: string;
  filename: string;
}

export default ImplementCommandProcessor;