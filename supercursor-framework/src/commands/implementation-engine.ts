/**
 * 実装エンジン (/sc:implement)
 */

import { EventEmitter } from 'events';
import { 
  CommandContext,
  CommandResult,
  ProjectContext,
  PersonaContext,
  ActivationTrigger,
  FileContent,
  WriteResult
} from '../types';
import { getLogger } from '../core/logger';
import { PersonaManager } from '../personas/persona-manager';
import { CursorAPIIntegration } from '../integrations/cursor-api-integration';
import { FileSystemHandlerImpl } from '../integrations/file-system-handler';
import { ContextAnalyzer } from '../core/context-analyzer';

export interface ImplementationRequest {
  description: string;
  requirements: string[];
  targetFiles?: string[];
  framework?: string;
  language?: string;
  patterns?: string[];
  constraints?: string[];
}

export interface ImplementationResult {
  success: boolean;
  generatedFiles: GeneratedFile[];
  modifiedFiles: ModifiedFile[];
  suggestions: string[];
  warnings: string[];
  nextSteps: string[];
  estimatedTime: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'implementation' | 'test' | 'config' | 'documentation';
  confidence: number;
  dependencies: string[];
}

export interface ModifiedFile {
  path: string;
  originalContent: string;
  modifiedContent: string;
  changes: FileChange[];
  confidence: number;
}

export interface FileChange {
  type: 'addition' | 'modification' | 'deletion';
  lineStart: number;
  lineEnd?: number;
  content: string;
  reason: string;
}

export interface ImplementationPlan {
  steps: ImplementationStep[];
  dependencies: string[];
  estimatedTime: number;
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  risks: Risk[];
}

export interface ImplementationStep {
  id: string;
  description: string;
  type: 'file-creation' | 'file-modification' | 'dependency-installation' | 'configuration';
  targetPath?: string;
  estimatedTime: number;
  dependencies: string[];
}

export interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export class ImplementationEngine extends EventEmitter {
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
   * 実装リクエストを処理
   */
  public async processImplementationRequest(
    request: ImplementationRequest,
    context: CommandContext
  ): Promise<ImplementationResult> {
    const logger = getLogger();
    const startTime = Date.now();

    try {
      logger.info('実装リクエストを処理開始', {
        description: request.description,
        requirementsCount: request.requirements.length,
        targetFiles: request.targetFiles?.length || 0,
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

      // 実装計画を生成
      const implementationPlan = await this.generateImplementationPlan(request, projectContext);

      // 実装を実行
      const result = await this.executeImplementation(implementationPlan, request, projectContext);

      const executionTime = Date.now() - startTime;

      this.emit('implementationCompleted', {
        request,
        result,
        executionTime,
        activatedPersonas: activatedPersonas.map(p => p.getId()),
      });

      logger.info('実装リクエスト処理完了', {
        success: result.success,
        generatedFiles: result.generatedFiles.length,
        modifiedFiles: result.modifiedFiles.length,
        executionTime,
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('実装リクエスト処理に失敗', {
        error: errorMessage,
        executionTime,
      });

      return {
        success: false,
        generatedFiles: [],
        modifiedFiles: [],
        suggestions: [],
        warnings: [errorMessage],
        nextSteps: ['エラーを修正してから再試行してください'],
        estimatedTime: 0,
      };
    } finally {
      // ペルソナを非活性化
      await this.personaManager.deactivatePersonas();
    }
  }

  /**
   * 実装計画を生成
   */
  public async generateImplementationPlan(
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): Promise<ImplementationPlan> {
    const logger = getLogger();

    try {
      logger.debug('実装計画を生成中', {
        description: request.description,
        framework: request.framework,
        language: request.language,
      });

      // 要件分析
      const requirements = await this.analyzeRequirements(request, projectContext);

      // 複雑度評価
      const complexity = this.evaluateComplexity(request, projectContext);

      // 実装ステップ生成
      const steps = await this.generateImplementationSteps(request, projectContext, complexity);

      // 依存関係分析
      const dependencies = await this.analyzeDependencies(request, projectContext);

      // リスク評価
      const risks = this.assessRisks(request, projectContext, complexity);

      // 時間見積もり
      const estimatedTime = this.estimateImplementationTime(steps, complexity);

      const plan: ImplementationPlan = {
        steps,
        dependencies,
        estimatedTime,
        complexity,
        risks,
      };

      logger.info('実装計画生成完了', {
        stepsCount: steps.length,
        dependenciesCount: dependencies.length,
        complexity,
        estimatedTime,
      });

      return plan;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('実装計画生成に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * 実装を実行
   */
  public async executeImplementation(
    plan: ImplementationPlan,
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): Promise<ImplementationResult> {
    const logger = getLogger();

    try {
      logger.debug('実装実行開始', {
        stepsCount: plan.steps.length,
        complexity: plan.complexity,
      });

      const generatedFiles: GeneratedFile[] = [];
      const modifiedFiles: ModifiedFile[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // 実装ステップを順次実行
      for (const step of plan.steps) {
        try {
          await this.executeImplementationStep(
            step,
            request,
            projectContext,
            generatedFiles,
            modifiedFiles
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          warnings.push(`ステップ "${step.description}" の実行に失敗: ${errorMessage}`);
          logger.warn('実装ステップ実行に失敗', {
            stepId: step.id,
            error: errorMessage,
          });
        }
      }

      // 次のステップを提案
      const nextSteps = this.generateNextSteps(generatedFiles, modifiedFiles, request);

      const result: ImplementationResult = {
        success: generatedFiles.length > 0 || modifiedFiles.length > 0,
        generatedFiles,
        modifiedFiles,
        suggestions,
        warnings,
        nextSteps,
        estimatedTime: plan.estimatedTime,
      };

      logger.info('実装実行完了', {
        success: result.success,
        generatedFiles: generatedFiles.length,
        modifiedFiles: modifiedFiles.length,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('実装実行に失敗', { error: errorMessage });
      throw error;
    }
  }

  // プライベートメソッド

  /**
   * ペルソナコンテキストを作成
   */
  private createPersonaContext(
    request: ImplementationRequest,
    projectContext: ProjectContext,
    commandContext: CommandContext
  ): PersonaContext {
    const trigger: ActivationTrigger = {
      type: 'command',
      data: {
        command: 'implement',
        description: request.description,
        requirements: request.requirements,
        framework: request.framework,
        language: request.language,
      },
      timestamp: new Date(),
    };

    return {
      trigger,
      projectContext,
      command: `implement: ${request.description}`,
      timestamp: new Date(),
    };
  }

  /**
   * 要件を分析
   */
  private async analyzeRequirements(
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): Promise<string[]> {
    const requirements: string[] = [...request.requirements];

    // プロジェクト固有の要件を推論
    const inferredRequirements = this.inferProjectRequirements(projectContext);
    requirements.push(...inferredRequirements);

    return requirements;
  }

  /**
   * 複雑度を評価
   */
  private evaluateComplexity(
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): 'low' | 'medium' | 'high' | 'very-high' {
    let score = 0;

    // 要件数による評価
    if (request.requirements.length > 10) score += 3;
    else if (request.requirements.length > 5) score += 2;
    else if (request.requirements.length > 2) score += 1;

    // 対象ファイル数による評価
    if (request.targetFiles && request.targetFiles.length > 5) score += 2;
    else if (request.targetFiles && request.targetFiles.length > 2) score += 1;

    // パターン数による評価
    if (request.patterns && request.patterns.length > 3) score += 2;
    else if (request.patterns && request.patterns.length > 1) score += 1;

    // 制約による評価
    if (request.constraints && request.constraints.length > 0) score += 1;

    if (score >= 7) return 'very-high';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * 実装ステップを生成
   */
  private async generateImplementationSteps(
    request: ImplementationRequest,
    projectContext: ProjectContext,
    complexity: 'low' | 'medium' | 'high' | 'very-high'
  ): Promise<ImplementationStep[]> {
    const steps: ImplementationStep[] = [];

    // 基本的なステップを生成
    if (request.targetFiles) {
      for (const filePath of request.targetFiles) {
        steps.push({
          id: `modify-${filePath}`,
          description: `${filePath} を修正`,
          type: 'file-modification',
          targetPath: filePath,
          estimatedTime: this.estimateFileModificationTime(filePath, complexity),
          dependencies: [],
        });
      }
    } else {
      // 新規ファイル作成
      const suggestedFiles = this.suggestImplementationFiles(request, projectContext);
      for (const file of suggestedFiles) {
        steps.push({
          id: `create-${file.path}`,
          description: `${file.path} を作成`,
          type: 'file-creation',
          targetPath: file.path,
          estimatedTime: this.estimateFileCreationTime(file.type, complexity),
          dependencies: [],
        });
      }
    }

    return steps;
  }

  /**
   * 依存関係を分析
   */
  private async analyzeDependencies(
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): Promise<string[]> {
    const dependencies: string[] = [];

    // フレームワークに基づく依存関係
    if (request.framework) {
      const frameworkDeps = this.getFrameworkDependencies(request.framework);
      dependencies.push(...frameworkDeps);
    }

    // 言語に基づく依存関係
    if (request.language) {
      const languageDeps = this.getLanguageDependencies(request.language);
      dependencies.push(...languageDeps);
    }

    return [...new Set(dependencies)]; // 重複除去
  }

  /**
   * リスクを評価
   */
  private assessRisks(
    request: ImplementationRequest,
    projectContext: ProjectContext,
    complexity: 'low' | 'medium' | 'high' | 'very-high'
  ): Risk[] {
    const risks: Risk[] = [];

    // 複雑度によるリスク
    if (complexity === 'very-high') {
      risks.push({
        level: 'high',
        description: '実装が非常に複雑で、予期しない問題が発生する可能性があります',
        mitigation: '段階的な実装とテストの実施',
      });
    }

    // 既存コードへの影響リスク
    if (request.targetFiles && request.targetFiles.length > 0) {
      risks.push({
        level: 'medium',
        description: '既存のファイルを変更するため、他の機能に影響する可能性があります',
        mitigation: 'バックアップの作成とテストの実施',
      });
    }

    return risks;
  }

  /**
   * 実装時間を見積もり
   */
  private estimateImplementationTime(
    steps: ImplementationStep[],
    complexity: 'low' | 'medium' | 'high' | 'very-high'
  ): number {
    const baseTime = steps.reduce((total, step) => total + step.estimatedTime, 0);
    
    // 複雑度による係数
    const complexityMultiplier = {
      'low': 1.0,
      'medium': 1.5,
      'high': 2.0,
      'very-high': 3.0,
    };

    return Math.round(baseTime * complexityMultiplier[complexity]);
  }

  /**
   * 実装ステップを実行
   */
  private async executeImplementationStep(
    step: ImplementationStep,
    request: ImplementationRequest,
    projectContext: ProjectContext,
    generatedFiles: GeneratedFile[],
    modifiedFiles: ModifiedFile[]
  ): Promise<void> {
    const logger = getLogger();

    try {
      logger.debug('実装ステップ実行', { stepId: step.id, type: step.type });

      switch (step.type) {
        case 'file-creation':
          await this.createImplementationFile(step, request, projectContext, generatedFiles);
          break;
        case 'file-modification':
          await this.modifyImplementationFile(step, request, projectContext, modifiedFiles);
          break;
        case 'dependency-installation':
          // 依存関係インストールは提案のみ
          break;
        case 'configuration':
          await this.createConfigurationFile(step, request, projectContext, generatedFiles);
          break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('実装ステップ実行エラー', { stepId: step.id, error: errorMessage });
      throw error;
    }
  }

  /**
   * 実装ファイルを作成
   */
  private async createImplementationFile(
    step: ImplementationStep,
    request: ImplementationRequest,
    projectContext: ProjectContext,
    generatedFiles: GeneratedFile[]
  ): Promise<void> {
    if (!step.targetPath) return;

    // ペルソナにコード生成を依頼
    const command = `Generate implementation for: ${request.description}. 
Target file: ${step.targetPath}
Requirements: ${request.requirements.join(', ')}
Framework: ${request.framework || 'auto-detect'}
Language: ${request.language || 'auto-detect'}`;

    const personaResponses = await this.personaManager.processCommand(command);
    
    if (personaResponses.length > 0 && personaResponses[0].success) {
      const content = personaResponses[0].output;
      
      generatedFiles.push({
        path: step.targetPath,
        content,
        type: 'implementation',
        confidence: personaResponses[0].metadata.confidence || 0.8,
        dependencies: [],
      });
    }
  }

  /**
   * 実装ファイルを修正
   */
  private async modifyImplementationFile(
    step: ImplementationStep,
    request: ImplementationRequest,
    projectContext: ProjectContext,
    modifiedFiles: ModifiedFile[]
  ): Promise<void> {
    if (!step.targetPath) return;

    try {
      // 既存ファイルを読み込み
      const fileContent = await this.cursorApi.readFile(step.targetPath);
      
      // ペルソナに修正を依頼
      const command = `Modify file ${step.targetPath} for: ${request.description}
Current content available for context.
Requirements: ${request.requirements.join(', ')}`;

      const personaResponses = await this.personaManager.processCommand(command);
      
      if (personaResponses.length > 0 && personaResponses[0].success) {
        const modifiedContent = personaResponses[0].output;
        
        modifiedFiles.push({
          path: step.targetPath,
          originalContent: fileContent.content,
          modifiedContent,
          changes: [], // 実際の差分分析は簡略化
          confidence: personaResponses[0].metadata.confidence || 0.7,
        });
      }
    } catch (error) {
      // ファイルが存在しない場合は新規作成として処理
      await this.createImplementationFile(step, request, projectContext, []);
    }
  }

  /**
   * 設定ファイルを作成
   */
  private async createConfigurationFile(
    step: ImplementationStep,
    request: ImplementationRequest,
    projectContext: ProjectContext,
    generatedFiles: GeneratedFile[]
  ): Promise<void> {
    // 設定ファイル作成は実装ファイル作成と同様の処理
    await this.createImplementationFile(step, request, projectContext, generatedFiles);
  }

  // ヘルパーメソッド

  private inferProjectRequirements(projectContext: ProjectContext): string[] {
    const requirements: string[] = [];
    
    // TypeScript プロジェクトの場合の推論
    if (projectContext.technologies.languages.includes('typescript')) {
      requirements.push('型安全性の確保');
    }

    // フレームワーク固有の要件
    if (projectContext.technologies.frameworks.some(f => f.toString() === 'react')) {
      requirements.push('React コンポーネント設計原則の遵守');
    }

    return requirements;
  }

  private suggestImplementationFiles(
    request: ImplementationRequest,
    projectContext: ProjectContext
  ): Array<{path: string; type: 'implementation' | 'test' | 'config'}> {
    const files: Array<{path: string; type: 'implementation' | 'test' | 'config'}> = [];
    
    // 基本的な実装ファイルを提案
    if (request.language === 'typescript') {
      files.push({
        path: `src/implementation.ts`,
        type: 'implementation'
      });
      files.push({
        path: `src/implementation.test.ts`,
        type: 'test'
      });
    }

    return files;
  }

  private getFrameworkDependencies(framework: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      'react': ['react', '@types/react'],
      'vue': ['vue'],
      'angular': ['@angular/core'],
      'express': ['express', '@types/express'],
    };
    
    return dependencyMap[framework] || [];
  }

  private getLanguageDependencies(language: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      'typescript': ['typescript', '@types/node'],
      'javascript': [],
    };
    
    return dependencyMap[language] || [];
  }

  private estimateFileModificationTime(filePath: string, complexity: string): number {
    // ファイル修正時間の基本見積もり（分単位）
    const baseTime = 15;
    const complexityMultiplier = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'very-high': 5,
    }[complexity] || 1;

    return baseTime * complexityMultiplier;
  }

  private estimateFileCreationTime(fileType: string, complexity: string): number {
    // ファイル作成時間の基本見積もり（分単位）
    const baseTime = {
      'implementation': 30,
      'test': 20,
      'config': 10,
      'documentation': 15,
    }[fileType] || 20;

    const complexityMultiplier = {
      'low': 1,
      'medium': 1.5,
      'high': 2,
      'very-high': 3,
    }[complexity] || 1;

    return Math.round(baseTime * complexityMultiplier);
  }

  private generateNextSteps(
    generatedFiles: GeneratedFile[],
    modifiedFiles: ModifiedFile[],
    request: ImplementationRequest
  ): string[] {
    const nextSteps: string[] = [];

    if (generatedFiles.length > 0) {
      nextSteps.push('生成されたファイルをレビューしてください');
      nextSteps.push('必要に応じて依存関係をインストールしてください');
    }

    if (modifiedFiles.length > 0) {
      nextSteps.push('変更されたファイルの差分を確認してください');
      nextSteps.push('既存のテストが通ることを確認してください');
    }

    nextSteps.push('実装をテストしてください');
    nextSteps.push('必要に応じてドキュメントを更新してください');

    return nextSteps;
  }
}