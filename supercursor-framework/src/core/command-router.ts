/**
 * コマンドルーターとディスパッチャー
 */

import { 
  Command, 
  CommandContext, 
  CommandResult, 
  CommandType,
  CommandError,
  ValidationError,
  CommandHistory
} from '../types';
import { getLogger } from './logger';
import { CacheManager } from './cache-manager';

export interface CommandProcessor {
  process(context: CommandContext): Promise<CommandResult>;
  supports(command: CommandType): boolean;
  getCommand(): Command;
}

export interface CommandRouterConfig {
  enableCaching: boolean;
  cacheTimeout: number;
  maxHistorySize: number;
  enableValidation: boolean;
}

export class CommandRouter {
  private processors = new Map<CommandType, CommandProcessor>();
  private history: CommandHistory[] = [];
  private cache: CacheManager | undefined;
  private config: CommandRouterConfig;

  constructor(config: CommandRouterConfig, cache: CacheManager | undefined = undefined) {
    this.config = config;
    this.cache = cache;
  }

  /**
   * コマンドプロセッサーを登録
   */
  public registerProcessor(processor: CommandProcessor): void {
    const command = processor.getCommand();
    this.processors.set(command.type as CommandType, processor);
    getLogger().debug(`コマンドプロセッサーを登録しました: ${command.type}`, { command: command.name });
  }

  /**
   * 複数のプロセッサーを一括登録
   */
  public registerProcessors(processors: CommandProcessor[]): void {
    for (const processor of processors) {
      this.registerProcessor(processor);
    }
  }

  /**
   * コマンドを実行
   */
  public async executeCommand(context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 入力の検証
      if (this.config.enableValidation) {
        this.validateContext(context);
      }

      // コマンドタイプを抽出
      const commandType = this.parseCommandType(context.command);
      
      // プロセッサーを取得
      const processor = this.processors.get(commandType);
      if (!processor) {
        throw new CommandError(`サポートされていないコマンドです: ${commandType}`);
      }

      // キャッシュをチェック
      if (this.config.enableCaching && this.cache) {
        const cacheKey = this.generateCacheKey(context);
        const cachedResult = await this.cache.get<CommandResult>(cacheKey);
        
        if (cachedResult) {
          getLogger().debug(`キャッシュからコマンド結果を取得しました: ${context.command}`, { cacheKey });
          this.addToHistory(context, cachedResult, Date.now() - startTime);
          return cachedResult;
        }
      }

      // コマンドを実行
      getLogger().info(`コマンドを実行中: ${context.command}`, { 
        type: commandType, 
        arguments: context.arguments,
        workingDirectory: context.workingDirectory 
      });

      const result = await processor.process(context);
      
      // メタデータを追加
      const executionTime = Date.now() - startTime;
      result.metadata = {
        ...result.metadata,
        executionTime,
      };

      // キャッシュに保存
      if (this.config.enableCaching && this.cache && result.success) {
        const cacheKey = this.generateCacheKey(context);
        await this.cache.set(cacheKey, result, this.config.cacheTimeout);
      }

      // 履歴に追加
      this.addToHistory(context, result, executionTime);

      getLogger().info(`コマンドの実行が完了しました: ${context.command}`, {
        success: result.success,
        executionTime
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: CommandResult = {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {
          executionTime,
          resourceUsage: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0,
          },
        },
      };

      // エラーを履歴に記録
      this.addToHistory(context, result, executionTime);

      getLogger().error(`コマンドの実行に失敗しました: ${context.command}`, {
        error: errorMessage,
        executionTime
      }, error instanceof Error ? error : undefined);

      return result;
    }
  }

  /**
   * 複数のコマンドを連続実行
   */
  public async executeCommandChain(contexts: CommandContext[]): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    
    for (const context of contexts) {
      const result = await this.executeCommand(context);
      results.push(result);
      
      // エラーが発生した場合は実行を停止
      if (!result.success) {
        getLogger().warn(`コマンドチェーンが中断されました: ${context.command}`, { 
          executedCommands: results.length 
        });
        break;
      }
    }
    
    return results;
  }

  /**
   * コマンド履歴を取得
   */
  public getHistory(): CommandHistory[] {
    return [...this.history];
  }

  /**
   * 履歴をクリア
   */
  public clearHistory(): void {
    this.history = [];
    getLogger().debug('コマンド履歴をクリアしました');
  }

  /**
   * 登録されているコマンドの一覧を取得
   */
  public getAvailableCommands(): Command[] {
    return Array.from(this.processors.values()).map(processor => processor.getCommand());
  }

  /**
   * 特定のコマンドの詳細を取得
   */
  public getCommandDetail(commandType: CommandType): Command | null {
    const processor = this.processors.get(commandType);
    return processor ? processor.getCommand() : null;
  }

  /**
   * コマンドの使用例を生成
   */
  public generateCommandHelp(commandType?: CommandType): string {
    if (commandType) {
      const command = this.getCommandDetail(commandType);
      if (!command) {
        return `コマンド '${commandType}' が見つかりません。`;
      }
      return this.formatCommandHelp(command);
    }

    const commands = this.getAvailableCommands();
    let help = 'SuperCursor Framework - 利用可能なコマンド:\\n\\n';
    
    for (const command of commands) {
      help += `/${command.type}:\\n`;
      help += `  ${command.description}\\n`;
      if (command.examples.length > 0) {
        help += `  例: ${command.examples[0].command}\\n`;
      }
      help += '\\n';
    }
    
    return help;
  }

  /**
   * コンテキストの検証
   */
  private validateContext(context: CommandContext): void {
    if (!context.command || context.command.trim() === '') {
      throw new ValidationError('コマンドが指定されていません');
    }

    if (!context.workingDirectory || context.workingDirectory.trim() === '') {
      throw new ValidationError('作業ディレクトリが指定されていません');
    }

    if (!context.user || !context.user.id) {
      throw new ValidationError('ユーザーコンテキストが無効です');
    }

    if (!context.session || !context.session.id) {
      throw new ValidationError('セッションコンテキストが無効です');
    }
  }

  /**
   * コマンドタイプを解析
   */
  private parseCommandType(command: string): CommandType {
    // コマンドは '/sc:command-name' の形式
    const match = command.match(/^\/sc:([a-z-]+)/);
    if (!match) {
      throw new CommandError(`無効なコマンド形式です: ${command}`);
    }

    return match[1].replace('-', '') as CommandType;
  }

  /**
   * キャッシュキーを生成
   */
  private generateCacheKey(context: CommandContext): string {
    const keyComponents = [
      context.command,
      context.arguments.join('|'),
      JSON.stringify(context.options),
      context.workingDirectory,
      context.user.id,
    ];
    
    // ハッシュ化せずに単純な文字列結合（実際の実装では適切なハッシュ関数を使用）
    return keyComponents.join(':').replace(/[^a-zA-Z0-9-_:]/g, '_');
  }

  /**
   * 履歴に追加
   */
  private addToHistory(context: CommandContext, result: CommandResult, duration: number): void {
    const historyEntry: CommandHistory = {
      command: context.command,
      timestamp: new Date(),
      duration,
      success: result.success,
      output: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
      error: result.error || undefined,
    };

    this.history.unshift(historyEntry);

    // 履歴サイズを制限
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(0, this.config.maxHistorySize);
    }
  }

  /**
   * コマンドヘルプをフォーマット
   */
  private formatCommandHelp(command: Command): string {
    let help = `/${command.type} - ${command.description}\\n\\n`;
    
    if (command.arguments.length > 0) {
      help += '引数:\\n';
      for (const arg of command.arguments) {
        const required = arg.required ? '[必須]' : '[任意]';
        help += `  ${arg.name} (${arg.type}) ${required} - ${arg.description}\\n`;
      }
      help += '\\n';
    }

    if (command.options.length > 0) {
      help += 'オプション:\\n';
      for (const option of command.options) {
        const alias = option.alias ? ` (-${option.alias})` : '';
        const defaultValue = option.defaultValue !== undefined ? ` [デフォルト: ${option.defaultValue}]` : '';
        help += `  --${option.name}${alias} (${option.type})${defaultValue} - ${option.description}\\n`;
      }
      help += '\\n';
    }

    if (command.examples.length > 0) {
      help += '使用例:\\n';
      for (const example of command.examples) {
        help += `  ${example.command}\\n`;
        help += `    ${example.description}\\n`;
        if (example.output) {
          help += `    出力: ${example.output}\\n`;
        }
        help += '\\n';
      }
    }

    return help;
  }
}