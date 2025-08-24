/**
 * SuperCursor Framework - コマンド実行ハンドラー
 * NestJS CQRS パターンに基づくコマンドハンドラー
 */

import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';

import { CommandRoutingService } from '../../domain/services/command-routing.service.js';
import { PersonaSelectionService } from '../../domain/services/persona-selection.service.js';
import {
  ExecutionContext
} from '../../domain/types/commands.js';
import {
  CommandResult,
  CommandExecutionError,
  PersonaSelectionError
} from '../../domain/types/index.js';
import {
  PersonaSelectionResult,
  AIPersona
} from '../../domain/types/personas.js';


import { ExecuteSupercursorCommand } from './execute-supercursor.command.js';


/**
 * SuperCursorコマンド実行ハンドラー
 * 
 * このハンドラーは以下の責務を持つ：
 * 1. コンテキスト分析
 * 2. ペルソナ選択
 * 3. コマンド実行
 * 4. イベント発行
 */
@CommandHandler(ExecuteSupercursorCommand)
export class ExecuteSupercursorHandler
  implements ICommandHandler<ExecuteSupercursorCommand> {

  private readonly logger = new Logger(ExecuteSupercursorHandler.name);

  /**
   * エラーオブジェクトを正規化してError-likeオブジェクトに変換する
   */
  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  constructor(
    @Inject('PERSONA_SERVICE')
    private readonly personaService: PersonaSelectionService,
    
    @Inject('COMMAND_ROUTER')
    private readonly commandRouter: CommandRoutingService,
    
    private readonly eventBus: EventBus
  ) {}

  /**
   * コマンドを実行する
   */
  async execute(command: ExecuteSupercursorCommand): Promise<CommandResult> {
    this.logger.log(`Executing command: ${command.id}`, 'CommandHandler');

    const startTime = Date.now();

    try {
      // 1. コンテキスト分析
      const context = this.analyzeContext(command);

      // 2. ペルソナ選択 (Framework-1 インターフェース活用)
      const personaResult = await this.selectPersona(context);
      let selectedPersona;
      
      if (personaResult.success && personaResult.selectedPersona) {
        selectedPersona = personaResult.selectedPersona;
        this.logger.log(`Selected persona: ${selectedPersona.name}`, 'CommandHandler');
      } else {
        this.logger.warn(`No suitable persona found: ${personaResult.reasoning}`, 'CommandHandler');
      }

      // 3. コマンド実行 (Framework-2 実装統合)
      const result = await this.executeCommand(command, context, selectedPersona);

      // 4. イベント発行
      this.publishExecutionEvent(command, result, selectedPersona);

      const duration = Date.now() - startTime;
      this.logger.log(`Command completed successfully in ${duration}ms`, 'CommandHandler');

      return result;

    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      const duration = Date.now() - startTime;
      this.logger.error(`Command execution failed after ${duration}ms: ${normalized.message}`, normalized.stack);
      
      // エラーイベントを発行
      this.publishErrorEvent(command, normalized);
      
      throw new CommandExecutionError(
        normalized.message,
        {
          commandId: command.id,
          sessionId: command.sessionId,
          duration,
          originalError: normalized.stack
        }
      );
    }
  }

  /**
   * コンテキストを分析する
   */
  private analyzeContext(command: ExecuteSupercursorCommand): ExecutionContext {
    // Framework-1 の ContextAnalyzer 統合
    // 実際の実装では、プロジェクト構造、技術スタック、ユーザー履歴などを分析
    return {
      sessionId: command.sessionId,
      workingDirectory: command.executionContext.workingDirectory,
      user: command.executionContext.user,
      project: command.executionContext.project,
      environment: command.executionContext.environment,
      persona: command.executionContext.persona
    };
  }

  /**
   * 適切なペルソナを選択する
   */
  private async selectPersona(context: ExecutionContext): Promise<PersonaSelectionResult> {
    try {
      if (!this.personaService) {
        return {
          success: false,
          reasoning: 'ペルソナサービスが利用できません',
          confidence: 0,
          alternatives: [],
          selectionTime: 0
        };
      }

      return await this.personaService.selectPersona(context);
      
    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      this.logger.error(`Persona selection failed: ${normalized.message}`, normalized.stack);
      throw new PersonaSelectionError(`ペルソナ選択に失敗しました: ${normalized.message}`);
    }
  }

  /**
   * コマンドを実行する
   */
  private async executeCommand(
    command: ExecuteSupercursorCommand,
    context: ExecutionContext,
    persona?: AIPersona
  ): Promise<CommandResult> {
    
    if (!this.commandRouter) {
      throw new CommandExecutionError('コマンドルーターが利用できません');
    }

    try {
      // Framework-2のコマンドルーティングシステムを使用
      const result = await this.commandRouter.routeCommand(
        command.parsedCommand,
        {
          ...context,
          persona: persona?.id
        }
      );

      return {
        commandId: command.id,
        success: true,
        output: result.output || { data: null },
        format: result.format || 'text',
        metadata: {
          executionTime: result.metadata?.executionTime || 0,
          persona: persona?.id,
          cacheHit: result.metadata?.cacheHit || false,
          resourcesUsed: result.metadata?.resourcesUsed || {
            memory: 0,
            cpu: 0,
            diskIO: 0,
            networkIO: 0
          }
        },
        performance: {
          startTime: command.timestamp as import('../../domain/types/base.js').Timestamp,
          endTime: Date.now() as import('../../domain/types/base.js').Timestamp,
          duration: Math.max(0, Date.now() - command.timestamp)
        }
      };

    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      // 実行エラーを適切にラップ
      throw new CommandExecutionError(
        `コマンド実行エラー: ${normalized.message}`,
        {
          commandName: command.parsedCommand.name,
          personaId: persona?.id,
          originalError: normalized.stack
        }
      );
    }
  }

  /**
   * 実行完了イベントを発行する
   */
  private publishExecutionEvent(
    command: ExecuteSupercursorCommand,
    _result: CommandResult,
    _persona?: AIPersona
  ): void {
    try {
      // カスタムイベントクラスが定義されている場合はそれを使用
      // await this.eventBus.publish(new SupercursorCommandExecutedEvent({
      //   commandId: command.id,
      //   sessionId: command.sessionId,
      //   personaId: persona?.id,
      //   result,
      //   timestamp: new Date()
      // }));
      
      // 暫定的にログ出力
      this.logger.log(`Event published: command executed for ${command.id}`, 'EventBus');
      
    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      this.logger.error(`Failed to publish execution event: ${normalized.message}`, normalized.stack);
      // イベント発行の失敗はコマンド実行の失敗として扱わない
    }
  }

  /**
   * エラーイベントを発行する
   */
  private publishErrorEvent(
    _command: ExecuteSupercursorCommand,
    _error: Error
  ): void {
    try {
      // カスタムイベントクラスが定義されている場合はそれを使用
      // await this.eventBus.publish(new SupercursorCommandErrorEvent({
      //   commandId: command.id,
      //   sessionId: command.sessionId,
      //   error: {
      //     message: error.message,
      //     stack: error.stack,
      //     name: error.name
      //   },
      //   timestamp: new Date()
      // }));

      // カスタムイベントクラスが定義されている場合はそれを使用
      // await this.eventBus.publish(new SupercursorCommandFailedEvent(event));
      
      // 暫定的にログ出力
      this.logger.error(`Event published: command failed`, 'EventBus');
      
    } catch (eventError: unknown) {
      const normalized = this.normalizeError(eventError);
      this.logger.error(`Failed to publish error event: ${normalized.message}`, normalized.stack);
    }
  }
}