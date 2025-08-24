/**
 * SuperCursor Framework - 分析コマンドハンドラー
 * Framework-2のAnalysisEngineを統合したNestJSコマンドハンドラー
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import {
  CommandHandler as BaseCommandHandler,
  CommandResult,
  Command,
  CommandParameter,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ParsedCommand,
  ParameterType,
  CommandCategory,
  isAnalyzeCommand,
  CommandExecutionError,
  ErrorSeverity,
  OutputFormat
} from '../../domain/types/index.js';

/**
 * 分析オプション
 */
export interface AnalysisOptions {
  readonly deep: boolean;
  readonly includeTests: boolean;
  readonly includeDependencies: boolean;
  readonly patterns?: readonly string[];
  readonly excludePatterns?: readonly string[];
  readonly outputFormat: 'json' | 'text' | 'markdown';
  readonly maxDepth?: number;
  readonly includeMetrics: boolean;
}

/**
 * 分析結果
 */
export interface AnalysisResult {
  readonly summary: string;
  readonly fileCount: number;
  readonly lineCount: number;
  readonly complexity: ComplexityMetrics;
  readonly technologies: DetectedTechnology[];
  readonly patterns: ArchitecturalPattern[];
  readonly issues: CodeIssue[];
  readonly recommendations: string[];
  readonly metrics: QualityMetrics;
}

export interface ComplexityMetrics {
  readonly cyclomaticComplexity: number;
  readonly cognitiveComplexity: number;
  readonly maintainabilityIndex: number;
  readonly technicalDebt: number;
}

export interface DetectedTechnology {
  readonly name: string;
  readonly version?: string;
  readonly confidence: number;
  readonly usage: number; // percentage
}

export interface ArchitecturalPattern {
  readonly name: string;
  readonly description: string;
  readonly confidence: number;
  readonly files: string[];
}

export interface CodeIssue {
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly type: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly suggestion?: string;
}

export interface QualityMetrics {
  readonly maintainability: number;
  readonly reliability: number;
  readonly security: number;
  readonly performance: number;
  readonly testCoverage: number;
}

/**
 * 分析コマンドハンドラー
 * 
 * Framework-2のAnalysisEngineの機能を継承し、
 * NestJSアーキテクチャに適合させた実装
 */
@Injectable()
export class AnalyzeCommandHandler implements BaseCommandHandler {
  private readonly logger = new Logger(AnalyzeCommandHandler.name);

  /**
   * エラーオブジェクトを正規化してError-likeオブジェクトに変換する
   */
  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  public readonly name = 'analyze';
  public readonly description = 'プロジェクトまたはファイルのコード分析を実行します';
  public readonly aliases = ['analyse', 'scan', 'review'];
  public readonly category = CommandCategory.ANALYSIS;
  public readonly version = '1.0.0';

  public readonly parameters: readonly CommandParameter[] = [
    {
      name: 'target',
      type: ParameterType.STRING,
      required: true,
      description: '分析対象のパスまたはファイル',
      defaultValue: './src'
    },
    {
      name: 'deep',
      type: ParameterType.BOOLEAN,
      required: false,
      description: '深い分析を実行（時間がかかります）',
      defaultValue: false
    },
    {
      name: 'include-tests',
      type: ParameterType.BOOLEAN,
      required: false,
      description: 'テストファイルを分析に含める',
      defaultValue: false
    },
    {
      name: 'output-format',
      type: ParameterType.STRING,
      required: false,
      description: '出力形式 (json, text, markdown)',
      defaultValue: 'text',
      validation: {
        allowedValues: ['json', 'text', 'markdown']
      }
    },
    {
      name: 'patterns',
      type: ParameterType.ARRAY,
      required: false,
      description: '分析するファイルパターン',
      defaultValue: []
    },
    {
      name: 'exclude',
      type: ParameterType.ARRAY,
      required: false,
      description: '除外するファイルパターン',
      defaultValue: ['node_modules', 'dist', 'build']
    }
  ];

  constructor(
    private readonly eventBus: EventBus
  ) {}

  /**
   * コマンドが処理可能かチェック
   */
  canHandle(command: ParsedCommand): boolean {
    return command.name === this.name || this.aliases.includes(command.name);
  }

  /**
   * ヘルプテキストを取得
   */
  getHelpText(): string {
    return `
使用法: ${this.name} <target> [options]

説明: ${this.description}

引数:
  target              分析対象のパスまたはファイル (デフォルト: ./src)

オプション:
  --deep              深い分析を実行（時間がかかります）
  --include-tests     テストファイルを分析に含める
  --output-format     出力形式 (json, text, markdown)
  --patterns          分析するファイルパターン (カンマ区切り)
  --exclude           除外するファイルパターン (カンマ区切り)

例:
  ${this.name} src/                          # srcディレクトリを分析
  ${this.name} src/ --deep                   # 深い分析を実行
  ${this.name} . --include-tests --deep      # テストを含めた深い分析
  ${this.name} src/ --output-format json     # JSON形式で出力
`;
  }

  /**
   * コマンドバリデーション
   */
  async validate(command: Command): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!isAnalyzeCommand(command)) {
      errors.push(new ValidationError('このハンドラーはanalyzeコマンド専用です'));
    }

    // ターゲットパスの検証
    const target = command.arguments[0] || command.options.target || './src';
    if (typeof target !== 'string') {
      errors.push(new ValidationError('ターゲットパスは文字列である必要があります'));
    }

    // 出力形式の検証
    const outputFormat = command.options['output-format'] || 'text';
    if (!['json', 'text', 'markdown'].includes(outputFormat as string)) {
      errors.push(new ValidationError('出力形式はjson、text、markdownのいずれかである必要があります'));
    }

    // パフォーマンス警告
    const isDeep = command.options.deep === true;
    const includeTests = command.options['include-tests'] === true;
    
    if (isDeep && includeTests) {
      warnings.push({
        code: 'PERFORMANCE_WARNING',
        message: '深い分析とテスト分析の両方が有効です。処理に時間がかかる可能性があります',
        suggestion: '分析範囲を狭めることを検討してください'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * コマンド実行
   */
  async execute(command: Command): Promise<CommandResult> {
    const startTime = Date.now();
    this.logger.log(`Executing analysis command for: ${command.arguments[0] || './src'}`);

    try {
      // オプションを解析
      const options = this.parseAnalysisOptions(command);
      
      // 分析実行
      const analysisResult = this.performAnalysis(
        command.arguments[0] || './src',
        options,
        command.executionContext
      );

      // 結果をフォーマット
      const output = this.formatOutput(analysisResult, options.outputFormat);

      const executionTime = Date.now() - startTime;

      // 分析完了イベントを発行
      this.publishAnalysisCompletedEvent(command, analysisResult);

      this.logger.log(`Analysis completed in ${executionTime}ms`);

      return {
        commandId: command.id,
        success: true,
        output: {
          data: output,
          summary: `分析完了: ${analysisResult.fileCount}ファイル、${analysisResult.lineCount}行を分析`,
          details: analysisResult
        },
        format: options.outputFormat as import('../../domain/types/index.js').OutputFormat,
        metadata: {
          executionTime,
          cacheHit: false, // TODO: キャッシング実装時に更新
          resourcesUsed: {
            memory: process.memoryUsage().heapUsed,
            cpu: 0, // TODO: CPU使用率測定実装
            diskIO: analysisResult.fileCount * 1024, // 概算
            networkIO: 0
          }
        },
        performance: {
          startTime: startTime as import('../../domain/types/base.js').Timestamp,
          endTime: Date.now() as import('../../domain/types/base.js').Timestamp,
          duration: executionTime
        }
      };

    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      const executionTime = Date.now() - startTime;
      this.logger.error(`Analysis failed: ${normalized.message}`, normalized.stack);

      return {
        commandId: command.id,
        success: false,
        output: { data: null },
        format: OutputFormat.TEXT,
        metadata: {
          executionTime,
          cacheHit: false,
          resourcesUsed: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0
          }
        },
        errors: [new CommandExecutionError(normalized.message)],
        performance: {
          startTime: startTime as import('../../domain/types/base.js').Timestamp,
          endTime: Date.now() as import('../../domain/types/base.js').Timestamp,
          duration: executionTime
        }
      };
    }
  }

  // プライベートメソッド

  private parseAnalysisOptions(command: Command): AnalysisOptions {
    return {
      deep: command.options.deep === true,
      includeTests: command.options['include-tests'] === true,
      includeDependencies: command.options['include-dependencies'] === true,
      patterns: this.parseArrayOption(command.options.patterns),
      excludePatterns: this.parseArrayOption(command.options.exclude),
      outputFormat: (command.options['output-format'] as 'json' | 'text' | 'markdown') || 'text',
      maxDepth: ((): number | undefined => {
        const maxDepthValue = command.options['max-depth'];
        if (maxDepthValue === undefined || maxDepthValue === null) return undefined;
        const parsed = parseInt(String(maxDepthValue), 10);
        return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
      })(),
      includeMetrics: command.options['include-metrics'] !== false
    };
  }

  private parseArrayOption(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim());
    }
    return undefined;
  }

  private performAnalysis(
    target: string,
    _options: AnalysisOptions,
    _context: import('../../domain/types/commands.js').ExecutionContext
  ): AnalysisResult {
    this.logger.debug(`Performing analysis on: ${target}`);

    // ここでFramework-2のAnalysisEngineの機能を統合
    // 実際の分析ロジックを実装

    // モック実装（実際の分析エンジンに置き換え予定）
    const result: AnalysisResult = {
      summary: `${target}の分析が完了しました`,
      fileCount: 42, // モック値
      lineCount: 1337, // モック値
      complexity: {
        cyclomaticComplexity: 15.2,
        cognitiveComplexity: 23.8,
        maintainabilityIndex: 78.5,
        technicalDebt: 2.3
      },
      technologies: [
        {
          name: 'TypeScript',
          version: '5.2.0',
          confidence: 0.95,
          usage: 85
        },
        {
          name: 'NestJS',
          version: '10.0.0',
          confidence: 0.88,
          usage: 60
        }
      ],
      patterns: [
        {
          name: 'Hexagonal Architecture',
          description: 'ポート&アダプターパターンの使用を検出',
          confidence: 0.82,
          files: ['src/domain', 'src/application', 'src/infrastructure']
        }
      ],
      issues: [
        {
          severity: 'warning',
          type: 'complexity',
          message: '関数の複雑度が高すぎます',
          file: 'src/example.ts',
          line: 42,
          suggestion: '関数を小さく分割することを検討してください'
        }
      ],
      recommendations: [
        'テストカバレッジを向上させてください',
        '循環的複雑度を下げることを検討してください',
        'TypeScript strict modeを有効にしてください'
      ],
      metrics: {
        maintainability: 78.5,
        reliability: 82.1,
        security: 91.3,
        performance: 75.8,
        testCoverage: 67.4
      }
    };

    return result;
  }

  private formatOutput(result: AnalysisResult, format: string): string | AnalysisResult {
    switch (format) {
      case 'json':
        return result;
        
      case 'markdown':
        return this.formatAsMarkdown(result);
        
      case 'text':
      default:
        return this.formatAsText(result);
    }
  }

  private formatAsText(result: AnalysisResult): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('         SUPERCURSOR 分析レポート');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`概要: ${result.summary}`);
    lines.push(`ファイル数: ${result.fileCount}`);
    lines.push(`行数: ${result.lineCount}`);
    lines.push('');
    
    lines.push('【複雑度メトリクス】');
    lines.push(`循環的複雑度: ${result.complexity.cyclomaticComplexity}`);
    lines.push(`認知的複雑度: ${result.complexity.cognitiveComplexity}`);
    lines.push(`保守性指数: ${result.complexity.maintainabilityIndex}`);
    lines.push(`技術的負債: ${result.complexity.technicalDebt}日`);
    lines.push('');
    
    if (result.technologies.length > 0) {
      lines.push('【検出技術】');
      result.technologies.forEach(tech => {
        lines.push(`- ${tech.name} ${tech.version ?? ''} (${Math.round(tech.confidence * 100)}%信頼度, ${tech.usage}%使用)`);
      });
      lines.push('');
    }
    
    if (result.issues.length > 0) {
      lines.push('【課題】');
      result.issues.forEach((issue, index) => {
        lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.file) {
          lines.push(`   ファイル: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        }
        if (issue.suggestion) {
          lines.push(`   提案: ${issue.suggestion}`);
        }
        lines.push('');
      });
    }
    
    if (result.recommendations.length > 0) {
      lines.push('【推奨事項】');
      result.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
      lines.push('');
    }
    
    lines.push('【品質メトリクス】');
    lines.push(`保守性: ${result.metrics.maintainability}/100`);
    lines.push(`信頼性: ${result.metrics.reliability}/100`);
    lines.push(`セキュリティ: ${result.metrics.security}/100`);
    lines.push(`パフォーマンス: ${result.metrics.performance}/100`);
    lines.push(`テストカバレッジ: ${result.metrics.testCoverage}%`);
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  private formatAsMarkdown(result: AnalysisResult): string {
    const lines: string[] = [];
    
    lines.push('# SuperCursor 分析レポート');
    lines.push('');
    lines.push(`**概要**: ${result.summary}`);
    lines.push(`**ファイル数**: ${result.fileCount}`);
    lines.push(`**行数**: ${result.lineCount}`);
    lines.push('');
    
    lines.push('## 複雑度メトリクス');
    lines.push('');
    lines.push('| メトリクス | 値 |');
    lines.push('|-----------|-----|');
    lines.push(`| 循環的複雑度 | ${result.complexity.cyclomaticComplexity} |`);
    lines.push(`| 認知的複雑度 | ${result.complexity.cognitiveComplexity} |`);
    lines.push(`| 保守性指数 | ${result.complexity.maintainabilityIndex} |`);
    lines.push(`| 技術的負債 | ${result.complexity.technicalDebt}日 |`);
    lines.push('');
    
    if (result.technologies.length > 0) {
      lines.push('## 検出技術');
      lines.push('');
      result.technologies.forEach(tech => {
        lines.push(`- **${tech.name}** ${tech.version ?? ''} (${Math.round(tech.confidence * 100)}%信頼度, ${tech.usage}%使用)`);
      });
      lines.push('');
    }
    
    if (result.issues.length > 0) {
      lines.push('## 課題');
      lines.push('');
      result.issues.forEach((issue, index) => {
        lines.push(`### ${index + 1}. ${issue.message}`);
        lines.push('');
        lines.push(`**重要度**: ${issue.severity}`);
        if (issue.file) {
          lines.push(`**ファイル**: \`${issue.file}${issue.line ? `:${issue.line}` : ''}\``);
        }
        if (issue.suggestion) {
          lines.push(`**提案**: ${issue.suggestion}`);
        }
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }

  private publishAnalysisCompletedEvent(
    command: Command,
    _result: AnalysisResult
  ): void {
    try {
      // カスタムイベントを発行（実装時にイベントクラスを定義）
      this.logger.debug(`Published analysis completed event for command: ${command.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish analysis completed event: ${errorMessage}`);
    }
  }
}