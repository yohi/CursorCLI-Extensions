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

export class OptimizeCommandProcessorError extends FrameworkError {
  code = 'OPTIMIZE_COMMAND_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

export interface OptimizationRequest {
  target: string;
  type: 'performance' | 'security' | 'code' | 'architecture' | 'bundle' | 'database' | 'memory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  constraints?: string[];
  preserveBackup?: boolean;
  aggressiveMode?: boolean;
  targetMetric?: {
    name: string;
    currentValue: number;
    targetValue: number;
  };
}

export interface OptimizationResult extends CommandResult {
  optimizationType: string;
  target: string;
  optimizations: OptimizationItem[];
  metricsImprovement: MetricsComparison;
  riskAssessment: RiskAssessment;
  backupPaths?: string[];
  rollbackInstructions?: string[];
  nextOptimizations?: string[];
}

export interface OptimizationItem {
  category: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  effort: 'minimal' | 'moderate' | 'significant' | 'extensive';
  implementationStatus: 'planned' | 'applied' | 'failed' | 'skipped';
  beforeCode?: string;
  afterCode?: string;
  filesAffected: string[];
  estimatedImprovement?: string;
  potentialRisks?: string[];
}

export interface MetricsComparison {
  before: Record<string, number>;
  after: Record<string, number>;
  improvement: Record<string, number>;
  percentageImprovement: Record<string, number>;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  mitigationStrategies: string[];
  rollbackComplexity: 'simple' | 'moderate' | 'complex' | 'difficult';
}

export class OptimizeCommandProcessor implements CommandProcessor {
  readonly command = '/sc:optimize';
  readonly description = 'パフォーマンス、セキュリティ、コード品質などの最適化を実行します。';
  readonly examples = [
    '/sc:optimize "src/api" --type="performance" --priority="high"',
    '/sc:optimize . --type="security" --aggressive',
    '/sc:optimize "components" --type="code" --preserve-backup',
    '/sc:optimize "package.json" --type="bundle" --target-size="50KB"'
  ];

  constructor(
    private personaManager: PersonaManager,
    private cursorApi: CursorAPIIntegration,
    private contextAnalyzer: ContextAnalyzer
  ) {}

  async execute(args: string[], context: CommandContext): Promise<OptimizationResult> {
    const request = this.parseOptimizationRequest(args);
    
    if (!request.target) {
      throw new OptimizeCommandProcessorError('最適化対象の指定が必要です');
    }

    try {
      // プロジェクトコンテキストの分析
      const projectContext = await this.analyzeProjectContext(context);
      
      // 最適化タイプに応じたペルソナの選択
      const selectedPersona = await this.selectOptimizationPersona(request, projectContext);
      
      // 現在の状態分析
      const currentMetrics = await this.analyzeCurrentState(request, context);
      
      // バックアップの作成（必要に応じて）
      const backupPaths = await this.createBackupIfNeeded(request, context);
      
      // 最適化計画の生成
      const optimizationPlan = await this.generateOptimizationPlan(
        request,
        currentMetrics,
        selectedPersona.id,
        projectContext
      );
      
      // 最適化の実行
      const result = await this.executeOptimizations(optimizationPlan, request, context);
      
      // 結果の検証と後処理
      const validatedResult = await this.validateOptimizationResults(result, currentMetrics);
      
      return validatedResult;

    } catch (error) {
      throw new OptimizeCommandProcessorError(
        `最適化処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseOptimizationRequest(args: string[]): OptimizationRequest {
    const request: OptimizationRequest = {
      target: '',
      type: 'performance',
      priority: 'medium',
      preserveBackup: false,
      aggressiveMode: false
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('"') && arg.endsWith('"')) {
        request.target = arg.slice(1, -1);
      } else if (arg.startsWith('--type=')) {
        const type = arg.substring('--type='.length);
        if (['performance', 'security', 'code', 'architecture', 'bundle', 'database', 'memory'].includes(type)) {
          request.type = type as OptimizationRequest['type'];
        }
      } else if (arg.startsWith('--priority=')) {
        const priority = arg.substring('--priority='.length);
        if (['low', 'medium', 'high', 'critical'].includes(priority)) {
          request.priority = priority as OptimizationRequest['priority'];
        }
      } else if (arg.startsWith('--constraints=')) {
        request.constraints = arg.substring('--constraints='.length).split(',');
      } else if (arg.startsWith('--target-')) {
        const [metricName, targetValue] = arg.substring(2).split('=');
        request.targetMetric = {
          name: metricName.replace('target-', ''),
          currentValue: 0,
          targetValue: parseFloat(targetValue) || 0
        };
      } else if (arg === '--preserve-backup') {
        request.preserveBackup = true;
      } else if (arg === '--aggressive') {
        request.aggressiveMode = true;
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

  private async selectOptimizationPersona(request: OptimizationRequest, projectContext: PersonaContext) {
    const requiredCapabilities = this.determineOptimizationCapabilities(request, projectContext);
    
    const selectionCriteria = {
      requiredCapabilities,
      minPerformanceScore: 0.8,
      preferredState: undefined
    };

    const selectionResult = await this.personaManager.selectPersona(
      selectionCriteria, 
      projectContext
    );

    return selectionResult.selectedPersona;
  }

  private determineOptimizationCapabilities(
    request: OptimizationRequest, 
    projectContext: PersonaContext
  ): PersonaCapability[] {
    const capabilities: PersonaCapability[] = [PersonaCapability.CODE_GENERATION];
    
    // 最適化タイプに基づく機能選択
    switch (request.type) {
      case 'performance':
        capabilities.push(
          PersonaCapability.PERFORMANCE_OPTIMIZATION,
          PersonaCapability.MONITORING_SETUP
        );
        break;
        
      case 'security':
        capabilities.push(
          PersonaCapability.SECURITY_ANALYSIS,
          PersonaCapability.VULNERABILITY_ASSESSMENT
        );
        break;
        
      case 'architecture':
        capabilities.push(
          PersonaCapability.ARCHITECTURE_DESIGN,
          PersonaCapability.SYSTEM_DESIGN
        );
        break;
        
      case 'code':
        capabilities.push(
          PersonaCapability.CODE_GENERATION,
          PersonaCapability.TESTING_STRATEGY
        );
        break;
        
      case 'database':
        capabilities.push(
          PersonaCapability.DATABASE_DESIGN,
          PersonaCapability.PERFORMANCE_OPTIMIZATION
        );
        break;
        
      case 'bundle':
        capabilities.push(
          PersonaCapability.PERFORMANCE_OPTIMIZATION,
          PersonaCapability.FRONTEND_OPTIMIZATION
        );
        break;
        
      case 'memory':
        capabilities.push(
          PersonaCapability.PERFORMANCE_OPTIMIZATION,
          PersonaCapability.SYSTEM_OPTIMIZATION
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

  private async analyzeCurrentState(request: OptimizationRequest, context: CommandContext): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};
    const targetPath = this.resolvePath(request.target, context.workingDirectory);

    try {
      // 基本メトリクスの収集
      if (await this.cursorApi.fileExists(targetPath)) {
        const files = await this.collectTargetFiles(targetPath);
        
        // ファイルサイズメトリクス
        let totalSize = 0;
        for (const file of files) {
          const content = await this.cursorApi.readFile(file);
          totalSize += content.length;
        }
        metrics['totalSize'] = totalSize;
        metrics['fileCount'] = files.length;
        
        // コード品質メトリクス（簡易版）
        metrics['averageFileSize'] = totalSize / files.length;
        
        // 最適化タイプ別の専用メトリクス
        const typeSpecificMetrics = await this.collectTypeSpecificMetrics(request.type, files);
        Object.assign(metrics, typeSpecificMetrics);
      }
    } catch (error) {
      console.warn('メトリクス収集中にエラーが発生しました:', error);
    }

    return metrics;
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

  private async collectTargetFiles(targetPath: string): Promise<string[]> {
    const isFile = await this.cursorApi.isFile(targetPath);
    if (isFile) {
      return [targetPath];
    }
    
    return await this.cursorApi.findFiles(targetPath, ['**/*.{ts,js,tsx,jsx,py,java,go,rs,css,scss,json}']);
  }

  private async collectTypeSpecificMetrics(
    type: OptimizationRequest['type'],
    files: string[]
  ): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    switch (type) {
      case 'performance':
        metrics['complexFunctions'] = await this.countComplexFunctions(files);
        metrics['largeFunctions'] = await this.countLargeFunctions(files);
        break;
        
      case 'security':
        metrics['potentialVulnerabilities'] = await this.countSecurityIssues(files);
        break;
        
      case 'code':
        metrics['duplicatedLines'] = await this.countDuplicatedLines(files);
        metrics['longLines'] = await this.countLongLines(files);
        break;
        
      case 'bundle':
        metrics['importCount'] = await this.countImports(files);
        metrics['unusedImports'] = await this.countUnusedImports(files);
        break;
    }

    return metrics;
  }

  private async countComplexFunctions(files: string[]): Promise<number> {
    // 複雑な関数の簡易カウント
    let count = 0;
    for (const file of files.slice(0, 10)) { // パフォーマンスのため最初の10ファイルのみ
      try {
        const content = await this.cursorApi.readFile(file);
        const functionRegex = /function\s+\w+|const\s+\w+\s*=.*=>|=>\s*{/g;
        const matches = content.match(functionRegex);
        if (matches) count += matches.length;
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async countLargeFunctions(files: string[]): Promise<number> {
    // 大きな関数の簡易カウント（100行以上）
    let count = 0;
    for (const file of files.slice(0, 10)) {
      try {
        const content = await this.cursorApi.readFile(file);
        const functions = content.split(/function\s+\w+|const\s+\w+\s*=.*=>/).slice(1);
        count += functions.filter(f => f.split('\n').length > 100).length;
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async countSecurityIssues(files: string[]): Promise<number> {
    // セキュリティ問題の簡易カウント
    let count = 0;
    const securityPatterns = [
      /eval\s*\(/g,
      /innerHTML\s*=/g,
      /document\.write/g,
      /process\.env\./g
    ];
    
    for (const file of files.slice(0, 10)) {
      try {
        const content = await this.cursorApi.readFile(file);
        securityPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) count += matches.length;
        });
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async countDuplicatedLines(files: string[]): Promise<number> {
    // 重複行の簡易カウント
    const lineMap = new Map<string, number>();
    let totalLines = 0;
    
    for (const file of files.slice(0, 10)) {
      try {
        const content = await this.cursorApi.readFile(file);
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 10);
        lines.forEach(line => {
          totalLines++;
          lineMap.set(line, (lineMap.get(line) || 0) + 1);
        });
      } catch (error) {
        // エラーは無視
      }
    }
    
    let duplicatedLines = 0;
    lineMap.forEach(count => {
      if (count > 1) duplicatedLines += count - 1;
    });
    
    return duplicatedLines;
  }

  private async countLongLines(files: string[]): Promise<number> {
    // 長すぎる行のカウント（120文字以上）
    let count = 0;
    for (const file of files.slice(0, 10)) {
      try {
        const content = await this.cursorApi.readFile(file);
        const longLines = content.split('\n').filter(line => line.length > 120);
        count += longLines.length;
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async countImports(files: string[]): Promise<number> {
    // インポート文のカウント
    let count = 0;
    for (const file of files) {
      try {
        const content = await this.cursorApi.readFile(file);
        const imports = content.match(/^import\s+.*from\s+['"][^'"]+['"];?$/gm);
        if (imports) count += imports.length;
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async countUnusedImports(files: string[]): Promise<number> {
    // 未使用インポートの簡易カウント
    let count = 0;
    for (const file of files.slice(0, 5)) { // パフォーマンスのため
      try {
        const content = await this.cursorApi.readFile(file);
        const importRegex = /import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"][^'"]+['"];?/gm;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
          const importedItems = match[1]?.split(',').map(s => s.trim()) || [match[2] || match[3]];
          importedItems.forEach(item => {
            if (item && !content.includes(item.replace(/\s+as\s+\w+/, ''))) {
              count++;
            }
          });
        }
      } catch (error) {
        // エラーは無視
      }
    }
    return count;
  }

  private async createBackupIfNeeded(request: OptimizationRequest, context: CommandContext): Promise<string[]> {
    if (!request.preserveBackup) {
      return [];
    }

    const backupPaths: string[] = [];
    const targetPath = this.resolvePath(request.target, context.workingDirectory);
    const files = await this.collectTargetFiles(targetPath);

    for (const file of files) {
      try {
        const backupPath = `${file}.backup.${Date.now()}`;
        const content = await this.cursorApi.readFile(file);
        await this.cursorApi.writeFile(backupPath, content);
        backupPaths.push(backupPath);
      } catch (error) {
        console.warn(`バックアップ作成に失敗しました: ${file}`, error);
      }
    }

    return backupPaths;
  }

  private async generateOptimizationPlan(
    request: OptimizationRequest,
    currentMetrics: Record<string, number>,
    personaId: string,
    projectContext: PersonaContext
  ): Promise<OptimizationPlan> {
    const prompt = {
      id: `optimize-${request.type}-${Date.now()}`,
      content: this.buildOptimizationPrompt(request, currentMetrics, projectContext),
      type: 'optimization-request' as const,
      context: {
        request,
        currentMetrics,
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

    return this.parseOptimizationPlan(response.content, request, currentMetrics);
  }

  private buildOptimizationPrompt(
    request: OptimizationRequest,
    currentMetrics: Record<string, number>,
    projectContext: PersonaContext
  ): string {
    let prompt = `以下の${this.getOptimizationTypeName(request.type)}最適化を計画してください：

**最適化対象**: ${request.target}
**最適化タイプ**: ${this.getOptimizationTypeName(request.type)}
**優先度**: ${request.priority}
**アグレッシブモード**: ${request.aggressiveMode ? '有効' : '無効'}

**プロジェクト情報**:
- プロジェクト名: ${projectContext.project?.name}
- プロジェクトタイプ: ${projectContext.project?.type}
- 主要技術: ${projectContext.project?.technologies.frameworks.join(', ')}

**現在のメトリクス**:`;

    Object.entries(currentMetrics).forEach(([key, value]) => {
      prompt += `\n- ${key}: ${value}`;
    });

    if (request.targetMetric) {
      prompt += `\n\n**目標メトリクス**:
- ${request.targetMetric.name}: ${request.targetMetric.currentValue} → ${request.targetMetric.targetValue}`;
    }

    if (request.constraints && request.constraints.length > 0) {
      prompt += `\n\n**制約事項**:\n${request.constraints.map(c => `- ${c}`).join('\n')}`;
    }

    // 最適化タイプ別の詳細指示
    prompt += this.getOptimizationTypeInstructions(request.type, request.aggressiveMode);

    prompt += `\n\n**出力形式**:
各最適化項目について以下を含めてください：
1. 最適化内容の説明
2. 影響度（low/medium/high/critical）
3. 実装工数（minimal/moderate/significant/extensive）
4. 期待される改善効果
5. 潜在的リスク
6. 実装前後のコード例（可能な場合）
7. 影響を受けるファイル一覧`;

    return prompt;
  }

  private getOptimizationTypeName(type: string): string {
    const names = {
      'performance': 'パフォーマンス',
      'security': 'セキュリティ',
      'code': 'コード品質',
      'architecture': 'アーキテクチャ',
      'bundle': 'バンドル',
      'database': 'データベース',
      'memory': 'メモリ'
    };
    return names[type as keyof typeof names] || type;
  }

  private getOptimizationTypeInstructions(type: string, aggressiveMode?: boolean): string {
    const baseInstructions = this.getBaseOptimizationInstructions(type);
    
    if (aggressiveMode) {
      return baseInstructions + `\n\n**アグレッシブモード**: より積極的な最適化を実行してください。多少のリスクを許容し、大幅な改善を目指してください。`;
    }
    
    return baseInstructions;
  }

  private getBaseOptimizationInstructions(type: string): string {
    switch (type) {
      case 'performance':
        return `\n\n**パフォーマンス最適化の重点項目**:
- 処理時間の短縮
- メモリ使用量の削減
- I/O操作の最適化
- アルゴリズムの改善
- キャッシュ戦略の実装
- 非同期処理の活用`;

      case 'security':
        return `\n\n**セキュリティ最適化の重点項目**:
- 脆弱性の修正
- 入力値検証の強化
- 暗号化の実装
- 認証・認可の改善
- セキュリティヘッダーの設定
- 機密情報の保護`;

      case 'code':
        return `\n\n**コード品質最適化の重点項目**:
- 重複コードの削除
- 複雑度の削減
- 命名の改善
- 関数の分割
- コメントの追加
- エラーハンドリングの改善`;

      case 'architecture':
        return `\n\n**アーキテクチャ最適化の重点項目**:
- 責任の分離
- 依存関係の整理
- モジュール構造の改善
- インターフェースの最適化
- 拡張性の向上
- 保守性の改善`;

      case 'bundle':
        return `\n\n**バンドル最適化の重点項目**:
- 未使用コードの削除
- 動的インポートの活用
- バンドルサイズの削減
- 重複依存関係の解決
- Tree shaking の最適化
- コード分割の実装`;

      default:
        return '';
    }
  }

  private parseOptimizationPlan(
    content: string,
    request: OptimizationRequest,
    currentMetrics: Record<string, number>
  ): OptimizationPlan {
    const optimizations = this.extractOptimizationItems(content);
    const riskAssessment = this.assessOptimizationRisks(optimizations, request);
    const expectedMetrics = this.estimateExpectedMetrics(currentMetrics, optimizations);

    return {
      type: request.type,
      target: request.target,
      priority: request.priority,
      optimizations,
      riskAssessment,
      expectedMetrics,
      implementationOrder: this.determineImplementationOrder(optimizations)
    };
  }

  private extractOptimizationItems(content: string): OptimizationItem[] {
    const items: OptimizationItem[] = [];
    
    // 最適化項目の抽出（簡易版）
    const sections = content.split(/\n(?=\d+\.|##)/);
    
    sections.forEach(section => {
      const match = section.match(/^(\d+)\.\s*(.+?)(?:\n|$)/);
      if (match) {
        const title = match[2].trim();
        const description = this.extractItemDescription(section);
        const impact = this.extractImpact(section);
        const effort = this.extractEffort(section);
        
        items.push({
          category: this.categorizeOptimization(title),
          description: `${title}: ${description}`,
          impact,
          effort,
          implementationStatus: 'planned',
          filesAffected: this.extractAffectedFiles(section),
          estimatedImprovement: this.extractEstimatedImprovement(section),
          potentialRisks: this.extractPotentialRisks(section)
        });
      }
    });

    return items;
  }

  private extractItemDescription(section: string): string {
    const lines = section.split('\n').slice(1);
    return lines.find(line => line.trim() && !line.includes(':'))?.trim() || '';
  }

  private extractImpact(section: string): OptimizationItem['impact'] {
    const impactMatch = section.match(/影響度[：:]?\s*(low|medium|high|critical)/i);
    return impactMatch ? impactMatch[1].toLowerCase() as OptimizationItem['impact'] : 'medium';
  }

  private extractEffort(section: string): OptimizationItem['effort'] {
    const effortMatch = section.match /工数[：:]?\s*(minimal|moderate|significant|extensive)/i);
    return effortMatch ? effortMatch[1].toLowerCase() as OptimizationItem['effort'] : 'moderate';
  }

  private categorizeOptimization(title: string): string {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('cache') || lowerTitle.includes('performance')) return 'performance';
    if (lowerTitle.includes('security') || lowerTitle.includes('auth')) return 'security';
    if (lowerTitle.includes('code') || lowerTitle.includes('refactor')) return 'code-quality';
    if (lowerTitle.includes('bundle') || lowerTitle.includes('import')) return 'bundle';
    return 'general';
  }

  private extractAffectedFiles(section: string): string[] {
    const filesMatch = section.match(/ファイル[：:]?\s*([^\n]+)/);
    if (!filesMatch) return [];
    
    return filesMatch[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
  }

  private extractEstimatedImprovement(section: string): string {
    const improvementMatch = section.match(/改善効果[：:]?\s*([^\n]+)/);
    return improvementMatch ? improvementMatch[1].trim() : '';
  }

  private extractPotentialRisks(section: string): string[] {
    const risksMatch = section.match(/リスク[：:]?\s*([^\n]+)/);
    if (!risksMatch) return [];
    
    return risksMatch[1].split(',').map(r => r.trim()).filter(r => r.length > 0);
  }

  private assessOptimizationRisks(optimizations: OptimizationItem[], request: OptimizationRequest): RiskAssessment {
    const highRiskOptimizations = optimizations.filter(opt => 
      opt.impact === 'critical' || opt.effort === 'extensive'
    );
    
    const overallRisk: RiskAssessment['overallRisk'] = 
      highRiskOptimizations.length > 3 ? 'critical' :
      highRiskOptimizations.length > 1 ? 'high' :
      optimizations.length > 10 ? 'medium' : 'low';

    const riskFactors: string[] = [];
    if (request.aggressiveMode) riskFactors.push('アグレッシブモードが有効');
    if (!request.preserveBackup) riskFactors.push('バックアップが無効');
    if (highRiskOptimizations.length > 0) riskFactors.push('高影響度の最適化を含む');

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: [
        '段階的な実装を推奨',
        '十分なテストを実施',
        '必要に応じてロールバック準備'
      ],
      rollbackComplexity: overallRisk === 'critical' ? 'difficult' : 
                         overallRisk === 'high' ? 'complex' : 'moderate'
    };
  }

  private estimateExpectedMetrics(
    currentMetrics: Record<string, number>,
    optimizations: OptimizationItem[]
  ): Record<string, number> {
    const expected = { ...currentMetrics };
    
    // 簡易的な改善予測
    const highImpactCount = optimizations.filter(opt => opt.impact === 'high' || opt.impact === 'critical').length;
    const mediumImpactCount = optimizations.filter(opt => opt.impact === 'medium').length;
    
    // パフォーマンス系メトリクスの改善
    if (expected['complexFunctions']) {
      expected['complexFunctions'] = Math.max(0, expected['complexFunctions'] - highImpactCount * 2 - mediumImpactCount);
    }
    
    if (expected['duplicatedLines']) {
      expected['duplicatedLines'] = Math.max(0, expected['duplicatedLines'] - highImpactCount * 50 - mediumImpactCount * 20);
    }

    return expected;
  }

  private determineImplementationOrder(optimizations: OptimizationItem[]): string[] {
    // 影響度とリスクに基づく実装順序の決定
    const sorted = [...optimizations].sort((a, b) => {
      const impactScore = { low: 1, medium: 2, high: 3, critical: 4 };
      const effortScore = { minimal: 1, moderate: 2, significant: 3, extensive: 4 };
      
      const scoreA = impactScore[a.impact] / effortScore[a.effort];
      const scoreB = impactScore[b.impact] / effortScore[b.effort];
      
      return scoreB - scoreA;
    });

    return sorted.map(opt => opt.description);
  }

  private async executeOptimizations(
    plan: OptimizationPlan,
    request: OptimizationRequest,
    context: CommandContext
  ): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      success: true,
      message: `${this.getOptimizationTypeName(request.type)}最適化が完了しました`,
      data: { plan },
      optimizationType: request.type,
      target: request.target,
      optimizations: [],
      metricsImprovement: {
        before: {},
        after: {},
        improvement: {},
        percentageImprovement: {}
      },
      riskAssessment: plan.riskAssessment,
      nextOptimizations: [],
      timestamp: new Date(),
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      // 各最適化項目の実行
      for (const optimization of plan.optimizations) {
        const executedOptimization = await this.executeIndividualOptimization(
          optimization,
          context
        );
        result.optimizations.push(executedOptimization);
      }

      // 最適化後のメトリクス測定
      const afterMetrics = await this.analyzeCurrentState(request, context);
      
      // メトリクス比較の計算
      result.metricsImprovement = this.calculateMetricsImprovement(
        plan.expectedMetrics,
        afterMetrics
      );

      // 次の最適化提案
      result.nextOptimizations = this.suggestNextOptimizations(result, request);

      result.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      result.success = false;
      result.message = `最適化実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  private async executeIndividualOptimization(
    optimization: OptimizationItem,
    context: CommandContext
  ): Promise<OptimizationItem> {
    const executed = { ...optimization };

    try {
      // ファイルが存在する場合の実際の最適化実行
      if (optimization.filesAffected.length > 0) {
        for (const filePath of optimization.filesAffected) {
          const fullPath = this.resolvePath(filePath, context.workingDirectory);
          
          if (await this.cursorApi.fileExists(fullPath)) {
            // 実際の最適化処理をここで実行
            // 現在は計画段階として記録のみ
            executed.implementationStatus = 'planned';
          }
        }
      }
      
      executed.implementationStatus = 'applied';
      
    } catch (error) {
      executed.implementationStatus = 'failed';
      if (!executed.potentialRisks) executed.potentialRisks = [];
      executed.potentialRisks.push(`実行エラー: ${error instanceof Error ? error.message : String(error)}`);
    }

    return executed;
  }

  private calculateMetricsImprovement(
    beforeMetrics: Record<string, number>,
    afterMetrics: Record<string, number>
  ): MetricsComparison {
    const improvement: Record<string, number> = {};
    const percentageImprovement: Record<string, number> = {};

    Object.keys(beforeMetrics).forEach(key => {
      const before = beforeMetrics[key] || 0;
      const after = afterMetrics[key] || 0;
      improvement[key] = before - after;
      percentageImprovement[key] = before > 0 ? ((before - after) / before) * 100 : 0;
    });

    return {
      before: beforeMetrics,
      after: afterMetrics,
      improvement,
      percentageImprovement
    };
  }

  private suggestNextOptimizations(result: OptimizationResult, request: OptimizationRequest): string[] {
    const suggestions = [];

    // 失敗した最適化の再実行提案
    const failedOptimizations = result.optimizations.filter(opt => opt.implementationStatus === 'failed');
    if (failedOptimizations.length > 0) {
      suggestions.push('失敗した最適化項目の原因を調査し、再実行を検討してください');
    }

    // 他の最適化タイプの提案
    const otherTypes = ['performance', 'security', 'code', 'architecture'].filter(t => t !== request.type);
    if (otherTypes.length > 0) {
      suggestions.push(`他の最適化タイプ (${otherTypes.join(', ')}) も検討してください`);
    }

    // 継続的な最適化の提案
    suggestions.push('定期的な最適化を設定し、継続的な改善を行ってください');

    return suggestions;
  }

  private async validateOptimizationResults(
    result: OptimizationResult,
    originalMetrics: Record<string, number>
  ): Promise<OptimizationResult> {
    // 最適化結果の検証
    const appliedCount = result.optimizations.filter(opt => opt.implementationStatus === 'applied').length;
    const failedCount = result.optimizations.filter(opt => opt.implementationStatus === 'failed').length;

    if (appliedCount === 0 && failedCount > 0) {
      result.success = false;
      result.message = '最適化の適用に失敗しました';
    } else if (appliedCount > 0) {
      result.message = `${appliedCount}件の最適化を適用しました`;
      if (failedCount > 0) {
        result.message += ` (${failedCount}件は失敗)`;
      }
    }

    return result;
  }
}

// 型定義
interface OptimizationPlan {
  type: OptimizationRequest['type'];
  target: string;
  priority: OptimizationRequest['priority'];
  optimizations: OptimizationItem[];
  riskAssessment: RiskAssessment;
  expectedMetrics: Record<string, number>;
  implementationOrder: string[];
}

export default OptimizeCommandProcessor;