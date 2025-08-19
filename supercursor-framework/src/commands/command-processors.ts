/**
 * コマンドプロセッサーの実装
 */

import { 
  Command,
  CommandContext,
  CommandResult,
  CommandType,
  CommandArgument,
  CommandOption
} from '../types';
import { CommandProcessor } from '../core/command-router';
import { getLogger } from '../core/logger';
import { PersonaManager } from '../personas/persona-manager';
import { CursorAPIIntegration } from '../integrations/cursor-api-integration';
import { FileSystemHandlerImpl } from '../integrations/file-system-handler';
import { ContextAnalyzer } from '../core/context-analyzer';

// エンジンのインポート
import { ImplementationEngine, ImplementationRequest } from './implementation-engine';
import { AnalysisEngine, AnalysisRequest } from './analysis-engine';
import { BuildEngine, BuildRequest } from './build-engine';
import { DesignEngine, DesignRequest } from './design-engine';

/**
 * 実装コマンドプロセッサー
 */
export class ImplementCommandProcessor implements CommandProcessor {
  private implementationEngine: ImplementationEngine;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    this.implementationEngine = new ImplementationEngine(
      personaManager,
      cursorApi,
      fileSystem,
      contextAnalyzer
    );
  }

  public supports(command: CommandType): boolean {
    return command === 'implement';
  }

  public getCommand(): Command {
    return {
      type: 'implement',
      name: 'implement',
      description: '要件に基づいてコードを実装します',
      arguments: [
        {
          name: 'description',
          description: '実装する機能の説明',
          required: true,
          type: 'string',
        },
        {
          name: 'requirements',
          description: '実装要件のリスト',
          required: false,
          type: 'array',
        },
      ],
      options: [
        {
          name: 'framework',
          description: '使用するフレームワーク',
          type: 'string',
        },
        {
          name: 'language',
          description: 'プログラミング言語',
          type: 'string',
        },
        {
          name: 'target-files',
          description: '対象ファイルのパス',
          type: 'string',
        },
      ],
      examples: [
        {
          command: '/sc:implement "ユーザー認証機能" --language typescript --framework react',
          description: 'TypeScriptとReactを使用してユーザー認証機能を実装',
        },
      ],
    };
  }

  public async process(context: CommandContext): Promise<CommandResult> {
    const logger = getLogger();
    
    try {
      logger.info('実装コマンドを処理中', { command: context.command });

      const request = this.parseImplementationRequest(context);
      const result = await this.implementationEngine.processImplementationRequest(request, context);

      return {
        success: result.success,
        output: result,
        metadata: {
          executionTime: 0, // エンジンで計算される
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('実装コマンドの処理に失敗', { error: errorMessage });

      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };
    }
  }

  private parseImplementationRequest(context: CommandContext): ImplementationRequest {
    const description = context.arguments[0] || '';
    const requirements = context.arguments.slice(1);

    return {
      description,
      requirements,
      framework: context.options.framework,
      language: context.options.language,
      targetFiles: context.options['target-files'] ? [context.options['target-files']] : undefined,
    };
  }
}

/**
 * 分析コマンドプロセッサー
 */
export class AnalyzeCommandProcessor implements CommandProcessor {
  private analysisEngine: AnalysisEngine;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    this.analysisEngine = new AnalysisEngine(
      personaManager,
      cursorApi,
      fileSystem,
      contextAnalyzer
    );
  }

  public supports(command: CommandType): boolean {
    return command === 'analyze';
  }

  public getCommand(): Command {
    return {
      type: 'analyze',
      name: 'analyze',
      description: 'コードベースを分析し、問題点や改善提案を提供します',
      arguments: [
        {
          name: 'scope',
          description: '分析スコープ (project, directory, file)',
          required: true,
          type: 'string',
          validation: {
            allowedValues: ['project', 'directory', 'file', 'function', 'class'],
          },
        },
      ],
      options: [
        {
          name: 'types',
          description: '分析タイプ (architecture, code-quality, performance, security)',
          type: 'string',
        },
        {
          name: 'files',
          description: '対象ファイル',
          type: 'string',
        },
        {
          name: 'include-tests',
          description: 'テストファイルを含める',
          type: 'boolean',
          defaultValue: false,
        },
      ],
      examples: [
        {
          command: '/sc:analyze project --types architecture,security',
          description: 'プロジェクト全体のアーキテクチャとセキュリティを分析',
        },
      ],
    };
  }

  public async process(context: CommandContext): Promise<CommandResult> {
    const logger = getLogger();
    
    try {
      logger.info('分析コマンドを処理中', { command: context.command });

      const request = this.parseAnalysisRequest(context);
      const result = await this.analysisEngine.processAnalysisRequest(request, context);

      return {
        success: result.success,
        output: result,
        metadata: {
          executionTime: result.executionTime,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('分析コマンドの処理に失敗', { error: errorMessage });

      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };
    }
  }

  private parseAnalysisRequest(context: CommandContext): AnalysisRequest {
    const scope = context.arguments[0] as any || 'project';
    const typesString = context.options.types || 'architecture,code-quality';
    const types = typesString.split(',').map(t => t.trim() as any);

    return {
      scope,
      types,
      targetFiles: context.options.files ? context.options.files.split(',') : undefined,
      includeTests: context.options['include-tests'] || false,
    };
  }
}

/**
 * ビルドコマンドプロセッサー
 */
export class BuildCommandProcessor implements CommandProcessor {
  private buildEngine: BuildEngine;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    this.buildEngine = new BuildEngine(
      personaManager,
      cursorApi,
      fileSystem,
      contextAnalyzer
    );
  }

  public supports(command: CommandType): boolean {
    return command === 'build';
  }

  public getCommand(): Command {
    return {
      type: 'build',
      name: 'build',
      description: 'プロジェクトをビルドし、最適化されたアウトプットを生成します',
      arguments: [
        {
          name: 'target',
          description: 'ビルドターゲット (development, production, testing)',
          required: false,
          type: 'string',
          validation: {
            allowedValues: ['development', 'production', 'testing', 'staging'],
          },
        },
      ],
      options: [
        {
          name: 'environment',
          description: 'ビルド環境',
          type: 'string',
          defaultValue: 'browser',
        },
        {
          name: 'optimization',
          description: '最適化レベル',
          type: 'string',
          defaultValue: 'basic',
        },
        {
          name: 'output-path',
          description: '出力パス',
          type: 'string',
        },
      ],
      examples: [
        {
          command: '/sc:build production --environment browser --optimization advanced',
          description: 'プロダクション向けの高度な最適化ビルドを実行',
        },
      ],
    };
  }

  public async process(context: CommandContext): Promise<CommandResult> {
    const logger = getLogger();
    
    try {
      logger.info('ビルドコマンドを処理中', { command: context.command });

      const request = this.parseBuildRequest(context);
      const result = await this.buildEngine.processBuildRequest(request, context);

      return {
        success: result.success,
        output: result,
        metadata: {
          executionTime: result.buildTime,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ビルドコマンドの処理に失敗', { error: errorMessage });

      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };
    }
  }

  private parseBuildRequest(context: CommandContext): BuildRequest {
    const target = context.arguments[0] as any || 'development';

    return {
      target,
      environment: context.options.environment as any || 'browser',
      optimization: context.options.optimization as any || 'basic',
      outputPath: context.options['output-path'],
    };
  }
}

/**
 * 設計コマンドプロセッサー
 */
export class DesignCommandProcessor implements CommandProcessor {
  private designEngine: DesignEngine;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    this.designEngine = new DesignEngine(
      personaManager,
      cursorApi,
      fileSystem,
      contextAnalyzer
    );
  }

  public supports(command: CommandType): boolean {
    return command === 'design';
  }

  public getCommand(): Command {
    return {
      type: 'design',
      name: 'design',
      description: 'システム設計を生成し、アーキテクチャ文書と図表を作成します',
      arguments: [
        {
          name: 'type',
          description: '設計タイプ (architecture, system, database, api)',
          required: true,
          type: 'string',
          validation: {
            allowedValues: ['architecture', 'system', 'database', 'api', 'ui-ux'],
          },
        },
        {
          name: 'scope',
          description: '設計スコープ (new-system, enhancement, migration)',
          required: true,
          type: 'string',
          validation: {
            allowedValues: ['new-system', 'enhancement', 'migration', 'optimization'],
          },
        },
      ],
      options: [
        {
          name: 'requirements',
          description: '要件リスト',
          type: 'string',
        },
        {
          name: 'constraints',
          description: '制約条件',
          type: 'string',
        },
      ],
      examples: [
        {
          command: '/sc:design architecture new-system --requirements "高可用性,スケーラブル"',
          description: '新システムのアーキテクチャ設計を生成',
        },
      ],
    };
  }

  public async process(context: CommandContext): Promise<CommandResult> {
    const logger = getLogger();
    
    try {
      logger.info('設計コマンドを処理中', { command: context.command });

      const request = this.parseDesignRequest(context);
      const result = await this.designEngine.processDesignRequest(request, context);

      return {
        success: result.success,
        output: result,
        metadata: {
          executionTime: 0, // 設計エンジンで計算される
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('設計コマンドの処理に失敗', { error: errorMessage });

      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };
    }
  }

  private parseDesignRequest(context: CommandContext): any {
    const type = context.arguments[0] as any;
    const scope = context.arguments[1] as any;
    
    const requirementsString = context.options.requirements || '';
    const constraintsString = context.options.constraints || '';

    const requirements = requirementsString
      ? requirementsString.split(',').map((req: string, index: number) => ({
          id: `req-${index + 1}`,
          category: 'functional' as const,
          priority: 'should-have' as const,
          description: req.trim(),
        }))
      : [];

    const constraints = constraintsString
      ? constraintsString.split(',').map((constraint: string) => ({
          type: 'technical' as const,
          description: constraint.trim(),
          impact: 'medium' as const,
        }))
      : [];

    return {
      type,
      scope,
      requirements,
      constraints,
    };
  }
}

/**
 * ヘルプコマンドプロセッサー
 */
export class HelpCommandProcessor implements CommandProcessor {
  private availableCommands: Command[] = [];

  constructor() {
    // 利用可能なコマンド情報を初期化
  }

  public supports(command: CommandType): boolean {
    return command === 'help' || command === 'index';
  }

  public getCommand(): Command {
    return {
      type: 'help',
      name: 'help',
      description: '利用可能なコマンドとその使用方法を表示します',
      arguments: [
        {
          name: 'command',
          description: 'ヘルプを表示するコマンド名',
          required: false,
          type: 'string',
        },
      ],
      options: [],
      examples: [
        {
          command: '/sc:help',
          description: '全コマンドの一覧を表示',
        },
        {
          command: '/sc:help implement',
          description: 'implementコマンドの詳細ヘルプを表示',
        },
      ],
    };
  }

  public async process(context: CommandContext): Promise<CommandResult> {
    try {
      const commandName = context.arguments[0];
      
      if (commandName) {
        const help = this.getSpecificCommandHelp(commandName as CommandType);
        return {
          success: true,
          output: help,
          metadata: {
            executionTime: 0,
            resourceUsage: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0,
            },
          },
        };
      } else {
        const help = this.getGeneralHelp();
        return {
          success: true,
          output: help,
          metadata: {
            executionTime: 0,
            resourceUsage: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0,
            },
          },
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime: 0,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };
    }
  }

  private getGeneralHelp(): string {
    return `
SuperCursor Framework - AI駆動開発支援フレームワーク

利用可能なコマンド:
  /sc:implement  - 要件に基づいてコードを実装
  /sc:analyze    - コードベースを分析し改善提案を提供  
  /sc:build      - プロジェクトをビルドし最適化
  /sc:design     - システム設計とアーキテクチャ文書を生成
  /sc:help       - このヘルプメッセージを表示

詳細なヘルプを表示するには:
  /sc:help <command-name>

例:
  /sc:help implement
  /sc:implement "ユーザー認証機能" --language typescript
  /sc:analyze project --types security,performance
`;
  }

  private getSpecificCommandHelp(commandType: CommandType): string {
    const commandHelpers = {
      implement: () => `
/sc:implement - コード実装コマンド

説明: 指定された要件に基づいてコードを自動実装します

引数:
  description (必須) - 実装する機能の説明
  requirements (任意) - 追加の実装要件

オプション:
  --language <言語>     プログラミング言語を指定
  --framework <FW>      使用するフレームワークを指定
  --target-files <パス> 対象ファイルを指定

使用例:
  /sc:implement "ユーザー登録機能"
  /sc:implement "API認証" --language typescript --framework express
`,
      analyze: () => `
/sc:analyze - コード分析コマンド

説明: コードベースを分析し、問題点や改善案を提供します

引数:
  scope (必須) - 分析スコープ (project/directory/file)

オプション:
  --types <タイプ>      分析タイプを指定 (architecture,security,performance等)
  --files <ファイル>    対象ファイルを指定
  --include-tests       テストファイルを含める

使用例:
  /sc:analyze project
  /sc:analyze directory --types security,performance
`,
      build: () => `
/sc:build - ビルドコマンド

説明: プロジェクトをビルドし最適化されたアウトプットを生成します

引数:
  target (任意) - ビルドターゲット (development/production/testing)

オプション:
  --environment <環境>    ビルド環境を指定
  --optimization <レベル> 最適化レベルを指定
  --output-path <パス>    出力パスを指定

使用例:
  /sc:build production
  /sc:build --environment node --optimization advanced
`,
      design: () => `
/sc:design - 設計コマンド

説明: システム設計とアーキテクチャ文書を生成します

引数:
  type (必須)  - 設計タイプ (architecture/system/database/api)
  scope (必須) - 設計スコープ (new-system/enhancement/migration)

オプション:
  --requirements <要件>  要件リストを指定
  --constraints <制約>   制約条件を指定

使用例:
  /sc:design architecture new-system
  /sc:design api enhancement --requirements "REST,JWT認証"
`,
    };

    const helper = commandHelpers[commandType as keyof typeof commandHelpers];
    if (helper) {
      return helper();
    }

    return `コマンド '${commandType}' のヘルプは利用できません。`;
  }
}