/**
 * SuperCursor Framework - コマンドルーティングドメインサービス
 * Framework-2のコマンドルーティングロジックをドメインサービスとして統合
 */

import {
  CommandId,
  PersonaId,
  Timestamp,
  FrameworkError,
  ValidationError,
  CommandExecutionError,
  createCommandId
} from '../types/index.js';

import {
  Command,
  ParsedCommand,
  CommandResult,
  CommandHandler,
  CommandRouter,
  ExecutionContext,
  CommandCategory,
  CommandPriority
} from '../types/commands.js';

/**
 * コマンドルーティング設定
 */
export interface CommandRoutingConfig {
  readonly enableValidation: boolean;
  readonly enableCaching: boolean;
  readonly enableMetrics: boolean;
  readonly defaultTimeout: number;
  readonly maxConcurrentCommands: number;
}

/**
 * コマンドルーティングドメインサービス
 * 
 * Framework-2のコマンドルーティングロジックを
 * ドメインサービスとして実装し、ビジネスロジックを提供
 */
export class CommandRoutingService implements CommandRouter {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly aliases = new Map<string, string>(); // alias -> commandName
  private readonly executionQueue = new Map<CommandId, Promise<CommandResult>>();

  constructor(
    private readonly config: CommandRoutingConfig
  ) {}

  /**
   * コマンド文字列を解析してParseCommandを生成
   */
  async parseCommand(input: string): Promise<ParsedCommand> {
    const startTime = Date.now();

    try {
      // 基本的なコマンド解析
      const trimmed = input.trim();
      
      if (!trimmed) {
        throw new ValidationError('空のコマンドは解析できません');
      }

      // コマンド部分とオプション部分を分割
      const parts = this.splitCommandParts(trimmed);
      const commandName = parts.shift()?.toLowerCase() || '';
      
      // エイリアス解決
      const resolvedName = this.resolveAlias(commandName);
      
      // 引数とオプションを解析
      const { arguments: args, options } = this.parseArgumentsAndOptions(parts);

      const parseMetadata = {
        parser: 'CommandRoutingService',
        version: '1.0.0',
        timestamp: Date.now() as Timestamp,
        confidence: this.calculateParseConfidence(resolvedName, args, options),
        alternatives: await this.generateAlternatives(resolvedName, args)
      };

      return {
        name: resolvedName,
        subcommand: this.extractSubcommand(args),
        arguments: args.filter(arg => !arg.startsWith('-')),
        options,
        raw: input,
        parseMetadata
      };

    } catch (error) {
      throw new ValidationError(`コマンド解析エラー: ${error.message}`);
    }
  }

  /**
   * パース済みコマンドを検証
   */
  async validateCommand(command: ParsedCommand): Promise<import('../types/index.js').ValidationResult> {
    const errors: import('../types/index.js').ValidationError[] = [];
    const warnings: import('../types/index.js').ValidationWarning[] = [];

    try {
      // ハンドラーの存在確認
      const handler = this.handlers.get(command.name);
      if (!handler) {
        errors.push({
          code: 'HANDLER_NOT_FOUND',
          message: `コマンド '${command.name}' のハンドラーが見つかりません`,
          field: 'name',
          severity: 'error'
        });
      } else {
        // ハンドラー固有のバリデーション
        if (handler.validate) {
          // TODO: ExecutionContextを適切に渡す必要がある
          // const handlerValidation = await handler.validate(command as any);
          // errors.push(...handlerValidation.errors);
          // warnings.push(...handlerValidation.warnings);
        }

        // パラメータバリデーション
        const paramValidation = this.validateParameters(command, handler);
        errors.push(...paramValidation.errors);
        warnings.push(...paramValidation.warnings);
      }

      // 構文バリデーション
      const syntaxValidation = this.validateSyntax(command);
      errors.push(...syntaxValidation.errors);
      warnings.push(...syntaxValidation.warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `バリデーションエラー: ${error.message}`,
        severity: 'error'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * コマンドを適切なハンドラーにルーティングして実行
   */
  async routeCommand(
    parsedCommand: ParsedCommand,
    context: ExecutionContext
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // ハンドラーを取得
      const handler = this.handlers.get(parsedCommand.name);
      if (!handler) {
        throw new CommandExecutionError(`コマンドハンドラーが見つかりません: ${parsedCommand.name}`);
      }

      // ハンドラーが対応可能か確認
      if (!handler.canHandle(parsedCommand)) {
        throw new CommandExecutionError(`コマンドハンドラーがコマンドを処理できません: ${parsedCommand.name}`);
      }

      // Commandオブジェクトを構築
      const command = this.buildCommand(parsedCommand, context);

      // 並行実行数チェック
      if (this.executionQueue.size >= this.config.maxConcurrentCommands) {
        throw new CommandExecutionError('並行実行数の上限に達しています');
      }

      // コマンド実行
      const executionPromise = this.executeCommand(handler, command);
      this.executionQueue.set(command.id, executionPromise);

      try {
        const result = await executionPromise;
        return result;
      } finally {
        this.executionQueue.delete(command.id);
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        commandId: createCommandId(),
        success: false,
        output: { data: null },
        format: 'text',
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
        errors: [error instanceof FrameworkError ? error : new CommandExecutionError(error.message)],
        performance: {
          startTime: startTime as Timestamp,
          endTime: Date.now() as Timestamp,
          duration: executionTime
        }
      };
    }
  }

  /**
   * ハンドラーを登録
   */
  async registerHandler(handler: CommandHandler): Promise<void> {
    const name = handler.name.toLowerCase();
    
    if (this.handlers.has(name)) {
      throw new ValidationError(`ハンドラーが既に登録されています: ${name}`);
    }

    this.handlers.set(name, handler);

    // エイリアスを登録
    for (const alias of handler.aliases) {
      if (this.aliases.has(alias.toLowerCase())) {
        throw new ValidationError(`エイリアスが既に使用されています: ${alias}`);
      }
      this.aliases.set(alias.toLowerCase(), name);
    }
  }

  /**
   * ハンドラー登録解除
   */
  async unregisterHandler(name: string): Promise<boolean> {
    const lowerName = name.toLowerCase();
    const handler = this.handlers.get(lowerName);
    
    if (!handler) {
      return false;
    }

    // ハンドラーを削除
    this.handlers.delete(lowerName);

    // エイリアスを削除
    for (const alias of handler.aliases) {
      this.aliases.delete(alias.toLowerCase());
    }

    return true;
  }

  /**
   * 登録済みハンドラーを取得
   */
  async getRegisteredHandlers(): Promise<readonly CommandHandler[]> {
    return Array.from(this.handlers.values());
  }

  /**
   * コマンド履歴を取得
   */
  async getCommandHistory(sessionId: import('../types/index.js').SessionId): Promise<readonly import('../types/commands.js').CommandHistoryEntry[]> {
    // TODO: 履歴リポジトリから取得
    return [];
  }

  // プライベートメソッド

  private splitCommandParts(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escapeNext = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inQuotes) {
        escapeNext = true;
        continue;
      }
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    // 閉じられていない引用符の検証
    if (inQuotes) {
      throw new ValidationError(`閉じられていない引用符があります: ${quoteChar}`);
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  private resolveAlias(commandName: string): string {
    return this.aliases.get(commandName) || commandName;
  }

  private parseArgumentsAndOptions(parts: string[]): {
    arguments: string[];
    options: Record<string, any>;
  } {
    const args: string[] = [];
    const options: Record<string, any> = {};

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.startsWith('--')) {
        // 長いオプション (--option=value または --option value)
        const [key, ...valueParts] = part.substring(2).split('=');
        if (valueParts.length > 0) {
          options[key] = valueParts.join('=');
        } else if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          options[key] = parts[++i];
        } else {
          options[key] = true;
        }
      } else if (part.startsWith('-') && part.length > 1) {
        // 短いオプション (-o value または -o)
        const key = part.substring(1);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          options[key] = parts[++i];
        } else {
          options[key] = true;
        }
      } else {
        // 引数
        args.push(part);
      }
    }

    return { arguments: args, options };
  }

  private extractSubcommand(args: string[]): string | undefined {
    // 最初の引数がサブコマンドの可能性をチェック
    if (args.length > 0 && !args[0].includes('/') && !args[0].includes('.')) {
      const potentialSubcommand = args[0].toLowerCase();
      // 既知のサブコマンドパターンをチェック
      const commonSubcommands = ['add', 'remove', 'update', 'list', 'show', 'create', 'delete'];
      if (commonSubcommands.includes(potentialSubcommand)) {
        return potentialSubcommand;
      }
    }
    return undefined;
  }

  private calculateParseConfidence(name: string, args: string[], options: Record<string, any>): number {
    let confidence = 0.5; // ベース信頼度

    // ハンドラーが存在する場合
    if (this.handlers.has(name)) {
      confidence += 0.3;
    }

    // 引数が適切に構造化されている場合
    if (args.length > 0) {
      confidence += 0.1;
    }

    // オプションが存在する場合
    if (Object.keys(options).length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private async generateAlternatives(name: string, args: string[]): Promise<ParsedCommand[]> {
    // 類似コマンドの提案を生成
    const alternatives: ParsedCommand[] = [];
    
    for (const [handlerName] of this.handlers) {
      if (handlerName !== name && this.calculateSimilarity(name, handlerName) > 0.6) {
        alternatives.push({
          name: handlerName,
          arguments: args,
          options: {},
          raw: `${handlerName} ${args.join(' ')}`,
          parseMetadata: {
            parser: 'AlternativeGenerator',
            version: '1.0.0',
            timestamp: Date.now() as Timestamp,
            confidence: this.calculateSimilarity(name, handlerName)
          }
        });
      }
    }

    return alternatives.slice(0, 3); // 最大3つの代替案
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // レーベンシュタイン距離を使用した類似度計算
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,      // 削除
            matrix[i][j - 1] + 1,      // 挿入
            matrix[i - 1][j - 1] + 1   // 置換
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - (matrix[len1][len2] / maxLen);
  }

  private validateParameters(
    command: ParsedCommand,
    handler: CommandHandler
  ): { errors: import('../types/index.js').ValidationError[]; warnings: import('../types/index.js').ValidationWarning[]; } {
    const errors: import('../types/index.js').ValidationError[] = [];
    const warnings: import('../types/index.js').ValidationWarning[] = [];

    // 必須パラメータのチェック
    const requiredParams = handler.parameters.filter(p => p.required);
    
    for (const param of requiredParams) {
      const hasArgument = command.arguments.length > handler.parameters.indexOf(param);
      const hasOption = command.options[param.name] !== undefined;
      
      if (!hasArgument && !hasOption) {
        errors.push({
          code: 'MISSING_REQUIRED_PARAMETER',
          message: `必須パラメータが不足しています: ${param.name}`,
          field: param.name,
          severity: 'error'
        });
      }
    }

    // 型バリデーション
    for (const param of handler.parameters) {
      const value = command.options[param.name] ?? command.arguments[handler.parameters.indexOf(param)];
      
      if (value !== undefined) {
        const typeValid = this.validateParameterType(value, param.type);
        if (!typeValid) {
          errors.push({
            code: 'INVALID_PARAMETER_TYPE',
            message: `パラメータの型が不正です: ${param.name} (期待: ${param.type})`,
            field: param.name,
            severity: 'error'
          });
        }
      }
    }

    return { errors, warnings };
  }

  private validateSyntax(command: ParsedCommand): {
    errors: import('../types/index.js').ValidationError[];
    warnings: import('../types/index.js').ValidationWarning[];
  } {
    const errors: import('../types/index.js').ValidationError[] = [];
    const warnings: import('../types/index.js').ValidationWarning[] = [];

    // コマンド名の検証
    if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(command.name)) {
      errors.push({
        code: 'INVALID_COMMAND_NAME',
        message: `コマンド名が不正です: ${command.name}`,
        field: 'name',
        severity: 'error'
      });
    }

    // 引数の数制限
    if (command.arguments.length > 50) {
      warnings.push({
        code: 'TOO_MANY_ARGUMENTS',
        message: '引数が多すぎます（50個以上）',
        suggestion: '不要な引数を削除することを検討してください'
      });
    }

    return { errors, warnings };
  }

  private validateParameterType(value: any, type: import('../types/index.js').ParameterType): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return value === 'true' || value === 'false' || typeof value === 'boolean';
      case 'array':
        return Array.isArray(value) || typeof value === 'string';
      default:
        return true;
    }
  }

  private buildCommand(parsedCommand: ParsedCommand, context: ExecutionContext): Command {
    return {
      id: this.generateCommandId(),
      sessionId: context.sessionId,
      name: parsedCommand.name,
      arguments: parsedCommand.arguments,
      options: parsedCommand.options,
      raw: parsedCommand.raw,
      executionContext: context,
      metadata: {
        priority: this.determinePriority(parsedCommand),
        timeout: this.config.defaultTimeout,
        retryable: false,
        maxRetries: 0,
        tags: [],
        dependencies: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async executeCommand(handler: CommandHandler, command: Command): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // タイムアウト設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new CommandExecutionError('コマンド実行がタイムアウトしました'));
        }, command.metadata.timeout);
      });

      // ハンドラー実行
      const executionPromise = handler.execute(command);

      // レース実行
      const result = await Promise.race([executionPromise, timeoutPromise]);

      return {
        ...result,
        commandId: command.id,
        performance: {
          startTime: startTime as Timestamp,
          endTime: Date.now() as Timestamp,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      throw error instanceof FrameworkError 
        ? error 
        : new CommandExecutionError(`コマンド実行エラー: ${error.message}`);
    }
  }

  private determinePriority(parsedCommand: ParsedCommand): CommandPriority {
    // コマンド名に基づいた優先度決定
    const highPriorityCommands = ['help', 'stop', 'cancel'];
    const lowPriorityCommands = ['log', 'debug', 'info'];

    if (highPriorityCommands.includes(parsedCommand.name)) {
      return 'high';
    } else if (lowPriorityCommands.includes(parsedCommand.name)) {
      return 'low';
    }

    return 'normal';
  }

  private generateCommandId(): CommandId {
    return createCommandId();
  }
}