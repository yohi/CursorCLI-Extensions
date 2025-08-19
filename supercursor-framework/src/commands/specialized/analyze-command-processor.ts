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

export class AnalyzeCommandProcessorError extends FrameworkError {
  code = 'ANALYZE_COMMAND_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

export interface AnalysisRequest {
  target: string;
  type: 'code' | 'architecture' | 'security' | 'performance' | 'dependencies' | 'quality';
  scope?: 'file' | 'directory' | 'project';
  depth?: 'surface' | 'detailed' | 'comprehensive';
  includeMetrics?: boolean;
  includeSuggestions?: boolean;
  outputFormat?: 'text' | 'json' | 'markdown';
}

export interface AnalysisResult extends CommandResult {
  analysisType: string;
  target: string;
  findings: AnalysisFinding[];
  metrics: AnalysisMetrics;
  summary: string;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface AnalysisFinding {
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  suggestion?: string;
  impact?: string;
}

export interface AnalysisMetrics {
  codeComplexity?: number;
  maintainabilityIndex?: number;
  testCoverage?: number;
  duplicatedLines?: number;
  securityScore?: number;
  performanceScore?: number;
  dependencyVulnerabilities?: number;
}

export class AnalyzeCommandProcessor implements CommandProcessor {
  readonly command = '/sc:analyze';
  readonly description = 'コード、アーキテクチャ、セキュリティなどの包括的な分析を実行します。';
  readonly examples = [
    '/sc:analyze "src/auth" --type="security" --depth="comprehensive"',
    '/sc:analyze "package.json" --type="dependencies" --include-metrics',
    '/sc:analyze . --type="architecture" --output="markdown"',
    '/sc:analyze "src/components" --type="quality" --include-suggestions'
  ];

  constructor(
    private personaManager: PersonaManager,
    private cursorApi: CursorAPIIntegration,
    private contextAnalyzer: ContextAnalyzer
  ) {}

  async execute(args: string[], context: CommandContext): Promise<AnalysisResult> {
    const request = this.parseAnalysisRequest(args);
    
    if (!request.target) {
      throw new AnalyzeCommandProcessorError('分析対象の指定が必要です');
    }

    try {
      // プロジェクトコンテキストの分析
      const projectContext = await this.analyzeProjectContext(context);
      
      // 分析タイプに応じたペルソナの選択
      const selectedPersona = await this.selectAnalysisPersona(request, projectContext);
      
      // 分析対象の詳細調査
      const analysisScope = await this.defineAnalysisScope(request, context);
      
      // 実際の分析実行
      const analysisResult = await this.performAnalysis(
        request, 
        analysisScope, 
        selectedPersona.id,
        projectContext
      );
      
      // 結果の後処理と品質向上
      const enhancedResult = await this.enhanceAnalysisResult(analysisResult, request);
      
      return enhancedResult;

    } catch (error) {
      throw new AnalyzeCommandProcessorError(
        `分析処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseAnalysisRequest(args: string[]): AnalysisRequest {
    const request: AnalysisRequest = {
      target: '',
      type: 'code',
      scope: 'file',
      depth: 'detailed',
      includeMetrics: false,
      includeSuggestions: true,
      outputFormat: 'text'
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('"') && arg.endsWith('"')) {
        request.target = arg.slice(1, -1);
      } else if (arg.startsWith('--type=')) {
        const type = arg.substring('--type='.length);
        if (['code', 'architecture', 'security', 'performance', 'dependencies', 'quality'].includes(type)) {
          request.type = type as AnalysisRequest['type'];
        }
      } else if (arg.startsWith('--scope=')) {
        const scope = arg.substring('--scope='.length);
        if (['file', 'directory', 'project'].includes(scope)) {
          request.scope = scope as AnalysisRequest['scope'];
        }
      } else if (arg.startsWith('--depth=')) {
        const depth = arg.substring('--depth='.length);
        if (['surface', 'detailed', 'comprehensive'].includes(depth)) {
          request.depth = depth as AnalysisRequest['depth'];
        }
      } else if (arg.startsWith('--output=')) {
        const format = arg.substring('--output='.length);
        if (['text', 'json', 'markdown'].includes(format)) {
          request.outputFormat = format as AnalysisRequest['outputFormat'];
        }
      } else if (arg === '--include-metrics') {
        request.includeMetrics = true;
      } else if (arg === '--include-suggestions') {
        request.includeSuggestions = true;
      } else if (!arg.startsWith('--') && !request.target) {
        request.target = arg;
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
    const frameworks = techStack.frameworks || [];
    const hasReact = frameworks.some((f: string) => f.toLowerCase().includes('react'));
    const hasExpress = frameworks.some((f: string) => f.toLowerCase().includes('express'));
    const hasNextJs = frameworks.some((f: string) => f.toLowerCase().includes('next'));

    if (hasNextJs) return ProjectType.FULL_STACK_APP;
    if (hasReact) return ProjectType.FRONTEND_APP;
    if (hasExpress) return ProjectType.API_SERVICE;
    
    return ProjectType.GENERAL_PURPOSE;
  }

  private async selectAnalysisPersona(request: AnalysisRequest, projectContext: PersonaContext) {
    const requiredCapabilities = this.determineAnalysisCapabilities(request, projectContext);
    
    const selectionCriteria = {
      requiredCapabilities,
      minPerformanceScore: 0.75,
      preferredState: undefined
    };

    const selectionResult = await this.personaManager.selectPersona(
      selectionCriteria, 
      projectContext
    );

    return selectionResult.selectedPersona;
  }

  private determineAnalysisCapabilities(
    request: AnalysisRequest, 
    projectContext: PersonaContext
  ): PersonaCapability[] {
    const capabilities: PersonaCapability[] = [];
    
    // 分析タイプに基づく機能選択
    switch (request.type) {
      case 'code':
      case 'quality':
        capabilities.push(
          PersonaCapability.CODE_GENERATION,
          PersonaCapability.TESTING_STRATEGY
        );
        break;
        
      case 'architecture':
        capabilities.push(
          PersonaCapability.ARCHITECTURE_DESIGN,
          PersonaCapability.SYSTEM_DESIGN
        );
        break;
        
      case 'security':
        capabilities.push(
          PersonaCapability.SECURITY_ANALYSIS,
          PersonaCapability.VULNERABILITY_ASSESSMENT,
          PersonaCapability.THREAT_MODELING
        );
        break;
        
      case 'performance':
        capabilities.push(
          PersonaCapability.PERFORMANCE_OPTIMIZATION,
          PersonaCapability.MONITORING_SETUP
        );
        break;
        
      case 'dependencies':
        capabilities.push(
          PersonaCapability.SYSTEM_DESIGN,
          PersonaCapability.SECURITY_ANALYSIS
        );
        break;
    }

    // プロジェクトタイプに基づく機能追加
    if (projectContext.project?.type === ProjectType.API_SERVICE) {
      capabilities.push(PersonaCapability.API_DESIGN);
    }
    
    if (projectContext.project?.type === ProjectType.FRONTEND_APP) {
      capabilities.push(PersonaCapability.UI_UX_DESIGN);
    }

    return capabilities;
  }

  private async defineAnalysisScope(request: AnalysisRequest, context: CommandContext): Promise<AnalysisScope> {
    const targetPath = this.resolvePath(request.target, context.workingDirectory);
    
    // パスの存在確認
    const exists = await this.cursorApi.fileExists(targetPath);
    if (!exists) {
      throw new AnalyzeCommandProcessorError(`指定されたパス「${targetPath}」が存在しません`);
    }

    // スコープの決定
    const isFile = await this.cursorApi.isFile(targetPath);
    const actualScope = request.scope || (isFile ? 'file' : 'directory');

    const files = await this.collectAnalysisTargets(targetPath, actualScope);
    
    return {
      targetPath,
      scope: actualScope,
      files,
      depth: request.depth || 'detailed'
    };
  }

  private resolvePath(relativePath: string, workingDirectory: string): string {
    if (relativePath === '.') {
      return workingDirectory;
    }
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return `${workingDirectory}/${relativePath}`.replace(/\/+/g, '/');
  }

  private async collectAnalysisTargets(targetPath: string, scope: string): Promise<string[]> {
    if (scope === 'file') {
      return [targetPath];
    }

    if (scope === 'directory') {
      const files = await this.cursorApi.listFiles(targetPath);
      return files.filter(file => this.isAnalyzableFile(file));
    }

    if (scope === 'project') {
      return await this.cursorApi.findFiles(targetPath, ['**/*.{ts,js,tsx,jsx,py,java,go,rs}']);
    }

    return [];
  }

  private isAnalyzableFile(filePath: string): boolean {
    const analyzableExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.json', '.yml', '.yaml'];
    return analyzableExtensions.some(ext => filePath.endsWith(ext));
  }

  private async performAnalysis(
    request: AnalysisRequest,
    scope: AnalysisScope,
    personaId: string,
    projectContext: PersonaContext
  ): Promise<AnalysisResult> {
    const prompt = {
      id: `analyze-${request.type}-${Date.now()}`,
      content: this.buildAnalysisPrompt(request, scope, projectContext),
      type: 'analysis-request' as const,
      context: {
        request,
        scope,
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

    return this.parseAnalysisResponse(response.content, request, scope);
  }

  private buildAnalysisPrompt(
    request: AnalysisRequest,
    scope: AnalysisScope,
    projectContext: PersonaContext
  ): string {
    let prompt = `以下の${this.getAnalysisTypeName(request.type)}分析を実行してください：

**分析対象**: ${scope.targetPath}
**分析タイプ**: ${this.getAnalysisTypeName(request.type)}
**分析範囲**: ${scope.scope}
**分析深度**: ${this.getDepthName(scope.depth)}

**プロジェクト情報**:
- プロジェクト名: ${projectContext.project?.name}
- プロジェクトタイプ: ${projectContext.project?.type}
- 主要技術: ${projectContext.project?.technologies.frameworks.join(', ')}`;

    // 分析タイプ別の詳細指示
    prompt += this.getTypeSpecificInstructions(request.type);

    // 対象ファイル情報の追加
    if (scope.files.length <= 5) {
      prompt += `\n\n**対象ファイル**:\n${scope.files.map(f => `- ${f}`).join('\n')}`;
    } else {
      prompt += `\n\n**対象ファイル数**: ${scope.files.length}個`;
    }

    // 出力形式の指定
    prompt += `\n\n**出力形式**:
1. 分析サマリー
2. 発見事項（重要度順）
3. メトリクス（要求された場合）
4. 推奨事項
5. リスクレベル評価

各発見事項には以下を含めてください：
- カテゴリ
- 重要度（info/warning/error/critical）
- 場所（ファイル名、行番号）
- 説明
- 改善提案`;

    return prompt;
  }

  private getAnalysisTypeName(type: string): string {
    const names = {
      'code': 'コード品質',
      'architecture': 'アーキテクチャ',
      'security': 'セキュリティ',
      'performance': 'パフォーマンス',
      'dependencies': '依存関係',
      'quality': '品質'
    };
    return names[type as keyof typeof names] || type;
  }

  private getDepthName(depth: string): string {
    const names = {
      'surface': '表面的',
      'detailed': '詳細',
      'comprehensive': '包括的'
    };
    return names[depth as keyof typeof names] || depth;
  }

  private getTypeSpecificInstructions(type: string): string {
    switch (type) {
      case 'security':
        return `\n\n**セキュリティ分析の重点項目**:
- 入力値検証の不備
- 認証・認可の脆弱性
- データ暗号化の問題
- SQLインジェクション脆弱性
- XSS脆弱性
- 機密情報の露出
- セキュリティヘッダーの不備`;

      case 'performance':
        return `\n\n**パフォーマンス分析の重点項目**:
- 処理時間の長いコード
- メモリリークの可能性
- 非効率なアルゴリズム
- データベースクエリの最適化
- キャッシュ戦略の評価
- リソース使用量の分析`;

      case 'architecture':
        return `\n\n**アーキテクチャ分析の重点項目**:
- 設計パターンの適用
- モジュール間の結合度
- 責任の分離
- 拡張性の評価
- 保守性の評価
- 技術的負債の識別`;

      case 'code':
      case 'quality':
        return `\n\n**コード品質分析の重点項目**:
- コードの複雑度
- 重複コードの検出
- 命名規則の遵守
- コメントの適切性
- テストカバレッジ
- エラーハンドリングの評価`;

      case 'dependencies':
        return `\n\n**依存関係分析の重点項目**:
- 脆弱性のある依存関係
- 未使用の依存関係
- バージョンの競合
- ライセンスの問題
- 依存関係の循環参照
- アップデート推奨事項`;

      default:
        return '';
    }
  }

  private parseAnalysisResponse(content: string, request: AnalysisRequest, scope: AnalysisScope): AnalysisResult {
    const findings = this.extractFindings(content);
    const metrics = this.extractMetrics(content);
    const summary = this.extractSummary(content);
    const recommendations = this.extractRecommendations(content);
    const riskLevel = this.assessRiskLevel(findings);
    const confidence = this.calculateConfidence(content, findings);

    return {
      success: true,
      message: `${this.getAnalysisTypeName(request.type)}分析が完了しました`,
      data: {
        analysisRequest: request,
        analysisScope: scope
      },
      analysisType: request.type,
      target: scope.targetPath,
      findings,
      metrics,
      summary,
      recommendations,
      riskLevel,
      confidence,
      timestamp: new Date(),
      executionTime: 0
    };
  }

  private extractFindings(content: string): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];
    const findingRegex = /\*\*(.*?)\*\*[\s]*\n.*?重要度[：:]?\s*(info|warning|error|critical)/gi;
    let match;

    while ((match = findingRegex.exec(content)) !== null) {
      findings.push({
        category: 'general',
        severity: match[2].toLowerCase() as AnalysisFinding['severity'],
        title: match[1].trim(),
        description: this.extractFindingDescription(content, match.index),
        suggestion: this.extractFindingSuggestion(content, match.index)
      });
    }

    return findings;
  }

  private extractFindingDescription(content: string, startIndex: number): string {
    const afterMatch = content.substring(startIndex);
    const lines = afterMatch.split('\n').slice(0, 3);
    return lines.join(' ').trim();
  }

  private extractFindingSuggestion(content: string, startIndex: number): string {
    const afterMatch = content.substring(startIndex);
    const suggestionMatch = afterMatch.match(/改善提案[：:]?\s*([^\n]*)/i);
    return suggestionMatch ? suggestionMatch[1].trim() : '';
  }

  private extractMetrics(content: string): AnalysisMetrics {
    const metrics: AnalysisMetrics = {};

    const complexityMatch = content.match(/複雑度[：:]?\s*(\d+(?:\.\d+)?)/i);
    if (complexityMatch) {
      metrics.codeComplexity = parseFloat(complexityMatch[1]);
    }

    const maintainabilityMatch = content.match(/保守性[：:]?\s*(\d+(?:\.\d+)?)/i);
    if (maintainabilityMatch) {
      metrics.maintainabilityIndex = parseFloat(maintainabilityMatch[1]);
    }

    const coverageMatch = content.match(/テストカバレッジ[：:]?\s*(\d+(?:\.\d+)?)/i);
    if (coverageMatch) {
      metrics.testCoverage = parseFloat(coverageMatch[1]);
    }

    return metrics;
  }

  private extractSummary(content: string): string {
    const summaryMatch = content.match(/分析サマリー[：:]?\s*\n([\s\S]*?)(?=\n\d+\.|$)/i);
    return summaryMatch ? summaryMatch[1].trim() : '分析結果のサマリーが取得できませんでした。';
  }

  private extractRecommendations(content: string): string[] {
    const recommendationsSection = content.match(/推奨事項[：:]?\s*\n([\s\S]*?)(?=\n[A-Za-z]|$)/i);
    if (!recommendationsSection) return [];

    return recommendationsSection[1]
      .split('\n')
      .filter(line => line.trim().match(/^-|\d+\./))
      .map(line => line.replace(/^-|\d+\./, '').trim())
      .filter(line => line.length > 0);
  }

  private assessRiskLevel(findings: AnalysisFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const errorCount = findings.filter(f => f.severity === 'error').length;
    const warningCount = findings.filter(f => f.severity === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (errorCount >= 3) return 'high';
    if (errorCount > 0 || warningCount >= 5) return 'medium';
    return 'low';
  }

  private calculateConfidence(content: string, findings: AnalysisFinding[]): number {
    let confidence = 0.7; // ベース信頼度

    // コンテンツの詳細度による調整
    if (content.length > 1000) confidence += 0.1;
    if (content.length > 2000) confidence += 0.1;

    // 発見事項の具体性による調整
    const specificFindings = findings.filter(f => f.location && f.suggestion);
    confidence += (specificFindings.length / Math.max(findings.length, 1)) * 0.2;

    return Math.min(confidence, 1.0);
  }

  private async enhanceAnalysisResult(result: AnalysisResult, request: AnalysisRequest): Promise<AnalysisResult> {
    // メトリクス計算の改善
    if (request.includeMetrics) {
      result.metrics = await this.calculateEnhancedMetrics(result, request);
    }

    // 出力フォーマットの変換
    if (request.outputFormat === 'json') {
      result.message = JSON.stringify(result, null, 2);
    } else if (request.outputFormat === 'markdown') {
      result.message = this.formatAsMarkdown(result);
    }

    return result;
  }

  private async calculateEnhancedMetrics(result: AnalysisResult, request: AnalysisRequest): Promise<AnalysisMetrics> {
    const enhanced = { ...result.metrics };

    // セキュリティスコアの計算
    if (request.type === 'security') {
      const securityIssues = result.findings.filter(f => 
        f.category.includes('security') || f.severity === 'critical'
      );
      enhanced.securityScore = Math.max(0, 100 - securityIssues.length * 15);
    }

    // パフォーマンススコアの計算
    if (request.type === 'performance') {
      const performanceIssues = result.findings.filter(f => 
        f.category.includes('performance')
      );
      enhanced.performanceScore = Math.max(0, 100 - performanceIssues.length * 10);
    }

    return enhanced;
  }

  private formatAsMarkdown(result: AnalysisResult): string {
    let markdown = `# ${this.getAnalysisTypeName(result.analysisType)}分析結果\n\n`;
    
    markdown += `**対象**: ${result.target}\n`;
    markdown += `**リスクレベル**: ${result.riskLevel.toUpperCase()}\n`;
    markdown += `**信頼度**: ${(result.confidence * 100).toFixed(1)}%\n\n`;

    markdown += `## サマリー\n${result.summary}\n\n`;

    if (result.findings.length > 0) {
      markdown += `## 発見事項\n\n`;
      result.findings.forEach((finding, index) => {
        markdown += `### ${index + 1}. ${finding.title}\n`;
        markdown += `**重要度**: ${finding.severity}\n`;
        markdown += `**説明**: ${finding.description}\n`;
        if (finding.suggestion) {
          markdown += `**改善提案**: ${finding.suggestion}\n`;
        }
        markdown += '\n';
      });
    }

    if (result.recommendations.length > 0) {
      markdown += `## 推奨事項\n\n`;
      result.recommendations.forEach((rec, index) => {
        markdown += `${index + 1}. ${rec}\n`;
      });
    }

    return markdown;
  }
}

// 型定義
interface AnalysisScope {
  targetPath: string;
  scope: 'file' | 'directory' | 'project';
  files: string[];
  depth: 'surface' | 'detailed' | 'comprehensive';
}

export default AnalyzeCommandProcessor;