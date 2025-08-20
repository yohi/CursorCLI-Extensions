/**
 * SuperCursor Framework - ペルソナ管理アプリケーションサービス
 * Framework-2の実装とFramework-1の設計を統合したペルソナ管理
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import {
  PersonaId,
  SessionId,
  UserId,
  createPersonaId,
  createTimestamp
} from '../../domain/types/index.js';

import {
  AIPersona,
  PersonaManager,
  PersonaSelectionResult,
  PersonaActivationResult,
  PersonaSwitchResult,
  PersonaFilter,
  PersonaSearchQuery,
  PersonaSearchResult,
  PersonaFeedback,
  PersonaInteraction,
  PersonaFactory,
  PersonaSpecification,
  PersonaValidationResult
} from '../../domain/types/personas.js';

import {
  ExecutionContext
} from '../../domain/types/commands.js';

import { PersonaRepository } from '../../domain/repositories/persona.repository.js';
import { PersonaSelectionService } from '../../domain/services/persona-selection.service.js';

/**
 * ペルソナ管理設定
 */
export interface PersonaManagementConfig {
  readonly maxActivePersonas: number;
  readonly selectionTimeoutMs: number;
  readonly enableLearning: boolean;
  readonly enableCaching: boolean;
  readonly cacheTimeoutMs: number;
  readonly enableMetrics: boolean;
}

/**
 * ペルソナ管理アプリケーションサービス
 * 
 * このサービスは以下の責務を持つ：
 * - ペルソナの選択・活性化・切り替え
 * - ペルソナライフサイクル管理
 * - パフォーマンス監視
 * - 学習データ収集
 */
@Injectable()
export class PersonaManagementService implements PersonaManager {
  private readonly logger = new Logger(PersonaManagementService.name);
  private readonly activeSessions = new Map<SessionId, {
    activePersona: PersonaId;
    activatedAt: Date;
    interactionCount: number;
  }>();

  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly personaSelectionService: PersonaSelectionService,
    private readonly personaFactory: PersonaFactory,
    private readonly eventBus: EventBus,
    private readonly config: PersonaManagementConfig
  ) {}

  /**
   * コンテキストを分析してペルソナコンテキストを構築
   */
  async analyzeContext(executionContext: ExecutionContext): Promise<import('../../domain/types/personas.js').PersonaContext> {
    this.logger.debug(`Analyzing context for session: ${executionContext.sessionId}`);

    try {
      // 現在のアクティブペルソナを取得
      const activePersona = await this.getActivePersona(executionContext.sessionId);

      // 学習データを収集
      const learningData = await this.collectLearningData(executionContext);

      // ペルソナコンテキストを構築
      const personaContext: import('../../domain/types/personas.js').PersonaContext = {
        sessionId: executionContext.sessionId,
        activePersona,
        confidence: 0.8, // 初期値、実際の分析で更新
        reasoning: 'コンテキスト分析による初期評価',
        alternatives: [],
        executionContext,
        learningData
      };

      this.logger.debug(`Context analysis completed for session: ${executionContext.sessionId}`);
      return personaContext;

    } catch (error) {
      this.logger.error(`Context analysis failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * ペルソナコンテキストに基づいてペルソナを選択
   */
  async selectPersona(context: import('../../domain/types/personas.js').PersonaContext): Promise<PersonaSelectionResult> {
    this.logger.log(`Selecting persona for session: ${context.sessionId}`);

    try {
      // ペルソナ選択サービスを使用
      const result = await this.personaSelectionService.selectPersona(context.executionContext);

      // 選択結果をログ
      if (result.success && result.selectedPersona) {
        this.logger.log(
          `Persona selected: ${result.selectedPersona.name} (confidence: ${(result.confidence * 100).toFixed(1)}%)`
        );
      } else {
        this.logger.warn(`No suitable persona found: ${result.reasoning}`);
      }

      // 選択イベントを発行
      await this.publishPersonaSelectedEvent(context, result);

      return result;

    } catch (error) {
      this.logger.error(`Persona selection failed: ${error.message}`, error.stack);
      
      return {
        success: false,
        confidence: 0,
        reasoning: `ペルソナ選択エラー: ${error.message}`,
        alternatives: [],
        selectionTime: 0
      };
    }
  }

  /**
   * ペルソナを活性化
   */
  async activatePersona(
    personaId: PersonaId,
    context: ExecutionContext
  ): Promise<PersonaActivationResult> {
    this.logger.log(`Activating persona: ${personaId} for session: ${context.sessionId}`);

    const startTime = Date.now();

    try {
      // ペルソナを取得
      const persona = await this.personaRepository.findById(personaId);
      if (!persona) {
        throw new Error(`Persona not found: ${personaId}`);
      }

      // 活性化前のバリデーション
      await this.validatePersonaActivation(persona, context);

      // 既存のアクティブペルソナを非活性化
      await this.deactivateCurrentPersona(context.sessionId);

      // 新しいペルソナを活性化
      this.activeSessions.set(context.sessionId, {
        activePersona: personaId,
        activatedAt: new Date(),
        interactionCount: 0
      });

      const activationTime = Date.now() - startTime;

      const result: PersonaActivationResult = {
        success: true,
        persona,
        confidence: 0.9, // 活性化時の信頼度
        reasoning: `${persona.name} を正常に活性化しました`,
        activationTime,
        resources: {
          memory: process.memoryUsage().heapUsed,
          cpu: 0, // CPU使用率は実装に応じて取得
          diskIO: 0,
          networkIO: 0
        }
      };

      // 活性化イベントを発行
      await this.publishPersonaActivatedEvent(context, result);

      this.logger.log(`Persona activated successfully: ${persona.name} (${activationTime}ms)`);
      return result;

    } catch (error) {
      this.logger.error(`Persona activation failed: ${error.message}`, error.stack);

      return {
        success: false,
        persona: {} as AIPersona, // エラー時の最小構造
        confidence: 0,
        reasoning: `活性化エラー: ${error.message}`,
        activationTime: Date.now() - startTime,
        resources: {
          memory: 0,
          cpu: 0,
          diskIO: 0,
          networkIO: 0
        }
      };
    }
  }

  /**
   * ペルソナを非活性化
   */
  async deactivatePersona(sessionId: SessionId): Promise<boolean> {
    this.logger.log(`Deactivating persona for session: ${sessionId}`);

    try {
      const sessionInfo = this.activeSessions.get(sessionId);
      if (!sessionInfo) {
        this.logger.debug(`No active persona found for session: ${sessionId}`);
        return true;
      }

      // セッション情報をクリア
      this.activeSessions.delete(sessionId);

      // 非活性化イベントを発行
      await this.publishPersonaDeactivatedEvent(sessionId, sessionInfo.activePersona);

      this.logger.log(`Persona deactivated for session: ${sessionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Persona deactivation failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * ペルソナを切り替え
   */
  async switchPersona(sessionId: SessionId, newPersonaId: PersonaId): Promise<PersonaSwitchResult> {
    this.logger.log(`Switching persona for session: ${sessionId} to: ${newPersonaId}`);

    const startTime = Date.now();

    try {
      // 現在のペルソナ情報を取得
      const currentPersona = await this.getActivePersona(sessionId);
      const newPersona = await this.personaRepository.findById(newPersonaId);

      if (!newPersona) {
        throw new Error(`New persona not found: ${newPersonaId}`);
      }

      // 現在のペルソナを非活性化
      await this.deactivatePersona(sessionId);

      // 新しいペルソナを活性化（簡略化版）
      this.activeSessions.set(sessionId, {
        activePersona: newPersonaId,
        activatedAt: new Date(),
        interactionCount: 0
      });

      const switchTime = Date.now() - startTime;

      const result: PersonaSwitchResult = {
        success: true,
        previousPersona: currentPersona,
        newPersona,
        reason: `ユーザーリクエストによるペルソナ切り替え`,
        switchTime
      };

      // 切り替えイベントを発行
      await this.publishPersonaSwitchedEvent(sessionId, result);

      this.logger.log(`Persona switched successfully: ${newPersona.name} (${switchTime}ms)`);
      return result;

    } catch (error) {
      this.logger.error(`Persona switch failed: ${error.message}`, error.stack);

      return {
        success: false,
        newPersona: {} as AIPersona,
        reason: `切り替えエラー: ${error.message}`,
        switchTime: Date.now() - startTime
      };
    }
  }

  /**
   * アクティブペルソナを取得
   */
  async getActivePersona(sessionId: SessionId): Promise<AIPersona | null> {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (!sessionInfo) {
      return null;
    }

    return await this.personaRepository.findById(sessionInfo.activePersona);
  }

  /**
   * ペルソナを登録
   */
  async registerPersona(persona: AIPersona): Promise<void> {
    this.logger.log(`Registering persona: ${persona.name}`);

    try {
      // バリデーション
      const validation = await this.validatePersona(persona);
      if (!validation.valid) {
        throw new Error(`Persona validation failed: ${validation.errors.join(', ')}`);
      }

      // リポジトリに保存
      await this.personaRepository.create(persona);

      this.logger.log(`Persona registered successfully: ${persona.name}`);

    } catch (error) {
      this.logger.error(`Persona registration failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * ペルソナ登録解除
   */
  async unregisterPersona(personaId: PersonaId): Promise<boolean> {
    this.logger.log(`Unregistering persona: ${personaId}`);

    try {
      // アクティブセッションから削除
      for (const [sessionId, info] of this.activeSessions.entries()) {
        if (info.activePersona === personaId) {
          await this.deactivatePersona(sessionId);
        }
      }

      // リポジトリから削除
      const result = await this.personaRepository.delete(personaId);

      this.logger.log(`Persona unregistered: ${personaId}`);
      return result;

    } catch (error) {
      this.logger.error(`Persona unregistration failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * ペルソナを更新
   */
  async updatePersona(personaId: PersonaId, updates: Partial<AIPersona>): Promise<AIPersona> {
    this.logger.log(`Updating persona: ${personaId}`);

    try {
      const updatedPersona = await this.personaRepository.update(personaId, updates);
      
      this.logger.log(`Persona updated successfully: ${personaId}`);
      return updatedPersona;

    } catch (error) {
      this.logger.error(`Persona update failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 利用可能なペルソナをリスト
   */
  async listAvailablePersonas(filter?: PersonaFilter): Promise<readonly AIPersona[]> {
    try {
      if (filter) {
        return await this.personaRepository.findByFilter(filter);
      } else {
        return await this.personaRepository.findAllActive();
      }
    } catch (error) {
      this.logger.error(`Failed to list personas: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * ペルソナを検索
   */
  async searchPersonas(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]> {
    try {
      return await this.personaRepository.search(query);
    } catch (error) {
      this.logger.error(`Persona search failed: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * インタラクションから学習
   */
  async learnFromInteraction(interaction: PersonaInteraction): Promise<void> {
    if (!this.config.enableLearning) {
      return;
    }

    this.logger.debug(`Learning from interaction: ${interaction.id}`);

    try {
      // インタラクションを保存
      await this.personaRepository.saveInteraction(interaction);

      // 学習ロジック（将来実装）
      // await this.updatePersonaPerformance(interaction);

      this.logger.debug(`Learning completed for interaction: ${interaction.id}`);

    } catch (error) {
      this.logger.error(`Learning failed: ${error.message}`, error.stack);
    }
  }

  /**
   * フィードバックを提供
   */
  async provideFeedback(feedback: PersonaFeedback): Promise<void> {
    this.logger.debug(`Providing feedback for persona: ${feedback.personaId}`);

    try {
      // フィードバックを保存
      await this.personaRepository.saveFeedback(feedback);

      // フィードバックイベントを発行
      await this.publishPersonaFeedbackEvent(feedback);

      this.logger.debug(`Feedback provided for persona: ${feedback.personaId}`);

    } catch (error) {
      this.logger.error(`Feedback provision failed: ${error.message}`, error.stack);
    }
  }

  // プライベートメソッド

  private async deactivateCurrentPersona(sessionId: SessionId): Promise<void> {
    const currentSession = this.activeSessions.get(sessionId);
    if (currentSession) {
      await this.deactivatePersona(sessionId);
    }
  }

  private async validatePersonaActivation(persona: AIPersona, context: ExecutionContext): Promise<void> {
    // 活性化前のバリデーションロジック
    if (!persona.configuration.active) {
      throw new Error(`Persona is not active: ${persona.id}`);
    }

    // その他のバリデーション...
  }

  private async validatePersona(persona: AIPersona): Promise<PersonaValidationResult> {
    return await this.personaFactory.validatePersona(persona);
  }

  private async collectLearningData(context: ExecutionContext): Promise<import('../../domain/types/personas.js').LearningData | undefined> {
    if (!this.config.enableLearning) {
      return undefined;
    }

    try {
      const interactions = await this.personaRepository.getSessionHistory(context.sessionId);
      const feedbacks = await this.personaRepository.getUserHistory(context.user.id);

      return {
        interactions,
        feedbacks: [], // 型変換が必要な場合は実装
        adaptations: [] // 適応データ
      };
    } catch {
      return undefined;
    }
  }

  // イベント発行メソッド

  private async publishPersonaSelectedEvent(
    context: import('../../domain/types/personas.js').PersonaContext,
    result: PersonaSelectionResult
  ): Promise<void> {
    try {
      // カスタムイベントを発行（実装時にイベントクラスを定義）
      this.logger.debug(`Published persona selected event for session: ${context.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to publish persona selected event: ${error.message}`);
    }
  }

  private async publishPersonaActivatedEvent(
    context: ExecutionContext,
    result: PersonaActivationResult
  ): Promise<void> {
    try {
      this.logger.debug(`Published persona activated event for session: ${context.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to publish persona activated event: ${error.message}`);
    }
  }

  private async publishPersonaDeactivatedEvent(
    sessionId: SessionId,
    personaId: PersonaId
  ): Promise<void> {
    try {
      this.logger.debug(`Published persona deactivated event for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to publish persona deactivated event: ${error.message}`);
    }
  }

  private async publishPersonaSwitchedEvent(
    sessionId: SessionId,
    result: PersonaSwitchResult
  ): Promise<void> {
    try {
      this.logger.debug(`Published persona switched event for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to publish persona switched event: ${error.message}`);
    }
  }

  private async publishPersonaFeedbackEvent(feedback: PersonaFeedback): Promise<void> {
    try {
      this.logger.debug(`Published persona feedback event for persona: ${feedback.personaId}`);
    } catch (error) {
      this.logger.error(`Failed to publish persona feedback event: ${error.message}`);
    }
  }
}