import { EventEmitter } from 'events';
import {
  CommandRouter as ICommandRouter,
  ParsedCommand,
  ValidationResult,
  CommandResult,
  CommandHandler,
  CommandHistory,
  CommandContext,
  CacheManager
} from './interfaces.js';
import { FrameworkError, ErrorSeverity } from '../types/index.js';

export class CommandError extends FrameworkError {
  code = 'COMMAND_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

export class CommandRouter extends EventEmitter implements ICommandRouter {
  private handlers = new Map<string, CommandHandler>();
  private aliases = new Map<string, string>();
  private history = new Map<string, CommandHistory[]>();
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    super();
    this.cacheManager = cacheManager;
  }

  async parseCommand(input: string): Promise<ParsedCommand> {
    if (!input || typeof input !== 'string') {
      throw new CommandError('コマンド入力が無効です');
    }

    const trimmedInput = input.trim();
    if (!trimmedInput.startsWith('/sc:')) {
      throw new CommandError('SuperCursorコマンドは /sc: で始まる必要があります');
    }

    // /sc: プレフィックスを削除
    const commandPart = trimmedInput.slice(4);
    
    if (!commandPart) {
      throw new CommandError('コマンド名が指定されていません');
    }

    // スペースと引用符を考慮した引数解析
    const parts = this.parseCommandParts(commandPart);
    
    if (parts.length === 0) {
      throw new CommandError('コマンド名が空です');
    }

    const [commandName, ...rest] = parts;
    const { subcommand, arguments: args, options } = this.parseArgumentsAndOptions(rest);

    return {
      name: commandName,
      subcommand,
      arguments: args,
      options,
      raw: input
    };
  }

  private parseCommandParts(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      if (!inQuotes && char === ' ') {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    if (inQuotes) {
      throw new CommandError(`引用符が閉じられていません: ${quoteChar}`);
    }

    return parts;
  }

  private parseArgumentsAndOptions(parts: string[]): {
    subcommand?: string;
    arguments: string[];
    options: Record<string, any>;
  } {
    let subcommand: string | undefined;
    const arguments: string[] = [];
    const options: Record<string, any> = {};

    let i = 0;
    while (i < parts.length) {
      const part = parts[i];

      // オプション解析 (--key=value または --key value)
      if (part?.startsWith('--')) {
        const optionMatch = part.match(/^--([^=]+)(?:=(.*))?$/);
        if (optionMatch) {
          const key = optionMatch[1];
          let value: any = optionMatch[2];

          if (value === undefined) {
            // 次の引数を値として使用
            if (i + 1 < parts.length && !parts[i + 1]?.startsWith('--')) {
              value = parts[i + 1];
              i++; // 次の引数をスキップ
            } else {
              value = true; // フラグとして扱う
            }
          }

          options[key] = this.convertValue(value);
        }
      }
      // ショートオプション解析 (-k value)
      else if (part?.startsWith('-') && part.length === 2) {
        const key = part.slice(1);
        let value: any = true;

        if (i + 1 < parts.length && !parts[i + 1]?.startsWith('-')) {
          value = parts[i + 1];
          i++; // 次の引数をスキップ
        }

        options[key] = this.convertValue(value);
      }
      // サブコマンドまたは引数
      else if (part) {
        if (!subcommand && this.isSubcommand(part)) {
          subcommand = part;
        } else {
          arguments.push(part);
        }
      }

      i++;
    }

    return { subcommand, arguments, options };
  }

  private isSubcommand(part: string): boolean {
    // サブコマンドの判定ロジック
    // 一般的なサブコマンドパターンを検出
    const subcommandPatterns = [
      'create', 'update', 'delete', 'list', 'show', 'get', 'set',
      'start', 'stop', 'restart', 'enable', 'disable',
      'add', 'remove', 'install', 'uninstall',
      'build', 'test', 'deploy', 'run'
    ];

    return subcommandPatterns.includes(part.toLowerCase());
  }

  private convertValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    // 数値変換
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // 真偽値変換
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }

    // null/undefined変換
    if (value.toLowerCase() === 'null') {
      return null;
    }

    if (value.toLowerCase() === 'undefined') {
      return undefined;
    }

    // JSON配列/オブジェクト変換を試行
    if ((value.startsWith('[') && value.endsWith(']')) || 
        (value.startsWith('{') && value.endsWith('}'))) {
      try {
        return JSON.parse(value);
      } catch {
        // JSON解析に失敗した場合は文字列として扱う
      }
    }

    return value;
  }

  async validateCommand(command: ParsedCommand): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // コマンド名の検証
    if (!command.name) {
      errors.push({
        code: 'MISSING_COMMAND',
        message: 'コマンド名が指定されていません',
        field: 'name',
        severity: 'error'
      });
    } else {
      // エイリアス解決
      const actualCommandName = this.aliases.get(command.name) || command.name;
      const handler = this.handlers.get(actualCommandName);

      if (!handler) {
        errors.push({
          code: 'UNKNOWN_COMMAND',
          message: `未知のコマンドです: ${command.name}`,
          field: 'name',
          severity: 'error'
        });
      } else {
        // コマンド固有の検証
        if (handler.validate) {
          try {
            const context: CommandContext = {
              command: command.name,
              arguments: command.arguments,
              options: command.options,
              workingDirectory: process.cwd(),
              user: {} as any, // 実際の実装では適切なユーザーコンテキストを設定
              project: {} as any, // 実際の実装では適切なプロジェクトコンテキストを設定
              session: {} as any // 実際の実装では適切なセッションコンテキストを設定
            };

            const handlerValidation = await handler.validate(context);
            errors.push(...handlerValidation.errors);
            warnings.push(...handlerValidation.warnings);
          } catch (error) {
            errors.push({
              code: 'VALIDATION_ERROR',
              message: `コマンド検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
              field: 'handler',
              severity: 'error'
            });
          }
        }

        // 必須パラメータの検証
        const requiredParams = handler.parameters.filter(p => p.required);
        for (const param of requiredParams) {
          const hasValue = command.arguments.length > 0 || 
                          command.options[param.name] !== undefined;
          
          if (!hasValue) {
            errors.push({
              code: 'MISSING_PARAMETER',
              message: `必須パラメータが不足しています: ${param.name}`,
              field: param.name,
              severity: 'error'
            });
          }
        }

        // 非推奨コマンドの警告
        if (handler.name.includes('deprecated') || handler.description.includes('非推奨')) {
          warnings.push({
            code: 'DEPRECATED_COMMAND',
            message: `このコマンドは非推奨です: ${handler.name}`,
            suggestion: '新しいコマンドの使用を検討してください'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async routeCommand(command: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // 検証
      const validation = await this.validateCommand(command);
      if (!validation.valid) {
        return {
          success: false,
          output: {
            errors: validation.errors,
            warnings: validation.warnings
          },
          format: context.options?.format || 'text',
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: false,
            resourcesUsed: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0
            }
          },
          errors: validation.errors.map(e => new CommandError(e.message))
        };
      }

      // キャッシュチェック
      const cacheKey = this.generateCacheKey(command, context);
      const cachedResult = await this.cacheManager.get<CommandResult>(cacheKey);
      
      if (cachedResult) {
        this.emit('commandCacheHit', { command, result: cachedResult });
        return {
          ...cachedResult,
          metadata: {
            ...cachedResult.metadata,
            cacheHit: true
          }
        };
      }

      // コマンド実行
      const actualCommandName = this.aliases.get(command.name) || command.name;
      const handler = this.handlers.get(actualCommandName);

      if (!handler) {
        throw new CommandError(`コマンドハンドラーが見つかりません: ${command.name}`);
      }

      const result = await handler.execute(context);
      result.metadata.executionTime = Date.now() - startTime;

      // 成功した場合はキャッシュに保存
      if (result.success && context.options?.cache !== false) {
        await this.cacheManager.set(cacheKey, result, 3600); // 1時間キャッシュ
      }

      // 履歴に追加
      await this.addToHistory(context.session.id, {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        command: command.raw,
        timestamp: new Date(),
        duration: result.metadata.executionTime,
        success: result.success,
        output: result.output,
        error: result.errors?.[0]?.message
      });

      this.emit('commandExecuted', { command, context, result });

      return result;

    } catch (error) {
      const commandError = error instanceof CommandError ? error : 
        new CommandError(`コマンド実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);

      const result: CommandResult = {
        success: false,
        output: null,
        format: context.options?.format || 'text',
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          resourcesUsed: {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0
          }
        },
        errors: [commandError]
      };

      this.emit('commandError', { command, context, error: commandError });

      return result;
    }
  }

  private generateCacheKey(command: ParsedCommand, context: CommandContext): string {
    // キャッシュキーの生成（セキュアなハッシュ）
    const keyData = {
      command: command.name,
      subcommand: command.subcommand,
      arguments: command.arguments,
      options: command.options,
      workingDirectory: context.workingDirectory,
      userId: context.user.id
    };

    return `cmd:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  async registerCommand(handler: CommandHandler): Promise<void> {
    if (!handler.name) {
      throw new CommandError('コマンドハンドラーに名前が設定されていません');
    }

    if (this.handlers.has(handler.name)) {
      throw new CommandError(`コマンド '${handler.name}' は既に登録されています`);
    }

    this.handlers.set(handler.name, handler);

    // エイリアスの登録
    for (const alias of handler.aliases) {
      if (this.aliases.has(alias)) {
        throw new CommandError(`エイリアス '${alias}' は既に使用されています`);
      }
      this.aliases.set(alias, handler.name);
    }

    this.emit('commandRegistered', handler);
  }

  async unregisterCommand(commandName: string): Promise<boolean> {
    const handler = this.handlers.get(commandName);
    if (!handler) {
      return false;
    }

    // エイリアスの削除
    for (const alias of handler.aliases) {
      this.aliases.delete(alias);
    }

    const deleted = this.handlers.delete(commandName);
    
    if (deleted) {
      this.emit('commandUnregistered', commandName);
    }

    return deleted;
  }

  getRegisteredCommands(): CommandHandler[] {
    return Array.from(this.handlers.values());
  }

  getCommandHandler(commandName: string): CommandHandler | undefined {
    const actualName = this.aliases.get(commandName) || commandName;
    return this.handlers.get(actualName);
  }

  async getCommandHistory(sessionId: string): Promise<CommandHistory[]> {
    const sessionHistory = this.history.get(sessionId) || [];
    return [...sessionHistory].reverse(); // 最新から古い順
  }

  private async addToHistory(sessionId: string, entry: CommandHistory): Promise<void> {
    let sessionHistory = this.history.get(sessionId);
    if (!sessionHistory) {
      sessionHistory = [];
      this.history.set(sessionId, sessionHistory);
    }

    sessionHistory.push(entry);

    // 履歴サイズの制限（最新100件）
    if (sessionHistory.length > 100) {
      sessionHistory.splice(0, sessionHistory.length - 100);
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.history.delete(sessionId);
    this.emit('historyCleared', sessionId);
  }

  async getCommandSuggestions(partialCommand: string): Promise<string[]> {
    const suggestions: string[] = [];
    const partial = partialCommand.toLowerCase();

    // ハンドラー名での検索
    for (const handler of this.handlers.values()) {
      if (handler.name.toLowerCase().includes(partial)) {
        suggestions.push(handler.name);
      }
    }

    // エイリアスでの検索
    for (const [alias, commandName] of this.aliases) {
      if (alias.toLowerCase().includes(partial)) {
        suggestions.push(alias);
      }
    }

    // 重複削除とソート
    return [...new Set(suggestions)].sort();
  }

  getCommandUsageStats(): Record<string, { count: number; lastUsed: Date; averageExecutionTime: number }> {
    const stats: Record<string, { count: number; lastUsed: Date; averageExecutionTime: number }> = {};

    for (const sessionHistory of this.history.values()) {
      for (const entry of sessionHistory) {
        const commandName = entry.command.split(' ')[0]?.replace('/sc:', '') || '';
        
        if (!stats[commandName]) {
          stats[commandName] = {
            count: 0,
            lastUsed: new Date(0),
            averageExecutionTime: 0
          };
        }

        stats[commandName].count++;
        
        if (entry.timestamp > stats[commandName].lastUsed) {
          stats[commandName].lastUsed = entry.timestamp;
        }

        // 平均実行時間の更新
        const currentAvg = stats[commandName].averageExecutionTime;
        const count = stats[commandName].count;
        stats[commandName].averageExecutionTime = 
          (currentAvg * (count - 1) + entry.duration) / count;
      }
    }

    return stats;
  }

  dispose(): void {
    this.handlers.clear();
    this.aliases.clear();
    this.history.clear();
    this.removeAllListeners();
  }
}

export default CommandRouter;