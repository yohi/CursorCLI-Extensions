/**
 * ペルソナマネージャー - ペルソナの選択と活性化管理
 */

import { EventEmitter } from 'events';
import { BasePersona } from './base-persona';
import { PersonaRegistry } from './persona-registry';
import { 
  PersonaContext,
  PersonaResponse,
  ActivationTrigger,
  ProjectContext,
  PersonaSelectionError,
  PersonaActivationError
} from '../types';
import { getLogger } from '../core/logger';

export interface PersonaSelectionCandidate {
  persona: BasePersona;
  confidenceScore: number;
  activationReasons: string[];
  rank: number;
}

export interface PersonaManagerConfig {
  maxActivePersonas: number;
  selectionThreshold: number; // 最小信頼度スコア（0-100）
  personaCombinationEnabled: boolean;
  fallbackPersonaId?: string;
  selectionTimeoutMs: number;
}

export class PersonaManager extends EventEmitter {
  private registry: PersonaRegistry;
  private config: PersonaManagerConfig;
  private currentContext: PersonaContext | null = null;
  private selectionHistory: Map<string, PersonaSelectionCandidate[]> = new Map();

  constructor(
    registry: PersonaRegistry,
    config: Partial<PersonaManagerConfig> = {}
  ) {
    super();
    this.registry = registry;
    this.config = {
      maxActivePersonas: 3,
      selectionThreshold: 30,
      personaCombinationEnabled: true,
      selectionTimeoutMs: 5000,
      ...config,
    };

    // レジストリイベントをリッスン
    this.setupRegistryEventListeners();
  }

  /**
   * コンテキストに基づいてペルソナを選択
   */
  public async selectPersonas(context: PersonaContext): Promise<BasePersona[]> {
    const logger = getLogger();
    const startTime = Date.now();
    
    try {
      logger.debug('ペルソナ選択を開始', {
        triggerType: context.trigger.type,
        activePersonas: context.activePersonas?.length || 0,
      });

      // タイムアウト設定
      const timeoutPromise = new Promise<BasePersona[]>((_, reject) => {
        setTimeout(() => {
          reject(new PersonaSelectionError('ペルソナ選択がタイムアウトしました'));
        }, this.config.selectionTimeoutMs);
      });

      // 実際の選択処理
      const selectionPromise = this.performPersonaSelection(context);

      // レース実行
      const selectedPersonas = await Promise.race([selectionPromise, timeoutPromise]);

      const selectionTime = Date.now() - startTime;
      
      logger.info('ペルソナ選択完了', {
        selectedCount: selectedPersonas.length,
        selectionTime,
        personaIds: selectedPersonas.map(p => p.getId()),
      });

      // 選択結果をイベント発信
      this.emit('personasSelected', {
        selectedPersonas: selectedPersonas.map(p => ({
          id: p.getId(),
          name: p.getName(),
          type: p.getType(),
        })),
        context,
        selectionTime,
        timestamp: new Date(),
      });

      return selectedPersonas;

    } catch (error) {
      const selectionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('ペルソナ選択に失敗', {
        error: errorMessage,
        selectionTime,
        triggerType: context.trigger.type,
      });

      // フォールバックペルソナを試行
      const fallbackPersonas = await this.selectFallbackPersonas(context);
      if (fallbackPersonas.length > 0) {
        logger.info('フォールバックペルソナを使用', {
          fallbackCount: fallbackPersonas.length,
        });
        return fallbackPersonas;
      }

      throw new PersonaSelectionError(`ペルソナ選択に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * ペルソナを活性化
   */
  public async activatePersonas(
    personas: BasePersona[], 
    context: PersonaContext
  ): Promise<BasePersona[]> {
    const logger = getLogger();
    
    try {
      logger.debug('ペルソナ活性化を開始', {
        personaCount: personas.length,
        personaIds: personas.map(p => p.getId()),
      });

      this.currentContext = context;
      const activatedPersonas: BasePersona[] = [];
      const activationPromises: Promise<void>[] = [];

      for (const persona of personas) {
        try {
          // 活性化可能性を確認
          const canActivate = await persona.canActivate(context);
          if (!canActivate) {
            logger.warn('ペルソナを活性化できません', { 
              personaId: persona.getId() 
            });
            continue;
          }

          // 活性化を実行
          const activationPromise = persona.activate(context).then(() => {
            activatedPersonas.push(persona);
            logger.debug('ペルソナ活性化成功', { 
              personaId: persona.getId() 
            });
          }).catch((error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('個別ペルソナ活性化に失敗', {
              personaId: persona.getId(),
              error: errorMessage,
            });
          });

          activationPromises.push(activationPromise);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn('ペルソナ活性化前チェックに失敗', {
            personaId: persona.getId(),
            error: errorMessage,
          });
        }
      }

      // すべての活性化処理を待機
      await Promise.allSettled(activationPromises);

      if (activatedPersonas.length === 0) {
        throw new PersonaActivationError('ペルソナの活性化に成功しませんでした');
      }

      logger.info('ペルソナ活性化完了', {
        activatedCount: activatedPersonas.length,
        requestedCount: personas.length,
        activatedIds: activatedPersonas.map(p => p.getId()),
      });

      this.emit('personasActivated', {
        activatedPersonas: activatedPersonas.map(p => ({
          id: p.getId(),
          name: p.getName(),
          type: p.getType(),
        })),
        context,
        timestamp: new Date(),
      });

      return activatedPersonas;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ活性化に失敗', {
        error: errorMessage,
        requestedCount: personas.length,
      });
      throw new PersonaActivationError(`ペルソナ活性化に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * アクティブなペルソナを非活性化
   */
  public async deactivatePersonas(personaIds?: string[]): Promise<void> {
    const logger = getLogger();
    
    try {
      const activePersonas = this.registry.getActivePersonas();
      const targetPersonas = personaIds 
        ? activePersonas.filter(p => personaIds.includes(p.getId()))
        : activePersonas;

      logger.debug('ペルソナ非活性化を開始', {
        targetCount: targetPersonas.length,
        targetIds: targetPersonas.map(p => p.getId()),
      });

      const deactivationPromises = targetPersonas.map(async (persona) => {
        try {
          await persona.deactivate();
          logger.debug('ペルソナ非活性化成功', { 
            personaId: persona.getId() 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('個別ペルソナ非活性化に失敗', {
            personaId: persona.getId(),
            error: errorMessage,
          });
        }
      });

      await Promise.allSettled(deactivationPromises);

      this.currentContext = null;

      logger.info('ペルソナ非活性化完了', {
        processedCount: targetPersonas.length,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ非活性化に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * コマンドをアクティブなペルソナで処理
   */
  public async processCommand(command: string): Promise<PersonaResponse[]> {
    const logger = getLogger();
    
    try {
      const activePersonas = this.registry.getActivePersonas();
      
      if (activePersonas.length === 0) {
        throw new Error('アクティブなペルソナがありません');
      }

      if (!this.currentContext) {
        throw new Error('コンテキストが設定されていません');
      }

      logger.debug('コマンド処理を開始', {
        command: command.substring(0, 100),
        activePersonaCount: activePersonas.length,
      });

      // 並列処理でコマンドを実行
      const responsePromises = activePersonas.map(async (persona): Promise<PersonaResponse> => {
        try {
          return await persona.processCommand(command, this.currentContext!);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            output: '',
            error: errorMessage,
            metadata: {
              personaId: persona.getId(),
              timestamp: new Date(),
              processingTime: 0,
            },
          };
        }
      });

      const responses = await Promise.all(responsePromises);

      // 成功した応答の数を記録
      const successfulResponses = responses.filter(r => r.success);
      
      logger.info('コマンド処理完了', {
        totalResponses: responses.length,
        successfulResponses: successfulResponses.length,
      });

      return responses;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コマンド処理に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * 現在のコンテキストを取得
   */
  public getCurrentContext(): PersonaContext | null {
    return this.currentContext;
  }

  /**
   * 選択履歴を取得
   */
  public getSelectionHistory(): Map<string, PersonaSelectionCandidate[]> {
    return new Map(this.selectionHistory);
  }

  /**
   * 設定を更新
   */
  public updateConfig(updates: Partial<PersonaManagerConfig>): void {
    const logger = getLogger();
    this.config = { ...this.config, ...updates };
    
    logger.info('ペルソナマネージャー設定を更新', { updates });
    
    this.emit('configUpdated', {
      config: this.config,
      timestamp: new Date(),
    });
  }

  // プライベートメソッド

  /**
   * 実際のペルソナ選択処理
   */
  private async performPersonaSelection(context: PersonaContext): Promise<BasePersona[]> {
    const logger = getLogger();

    // 候補ペルソナを取得
    const candidates = await this.generatePersonaCandidates(context);
    
    if (candidates.length === 0) {
      logger.warn('ペルソナ候補が見つかりません');
      return [];
    }

    // 信頼度でフィルタリング
    const qualifiedCandidates = candidates.filter(
      c => c.confidenceScore >= this.config.selectionThreshold
    );

    if (qualifiedCandidates.length === 0) {
      logger.warn('信頼度の条件を満たすペルソナがありません', {
        candidateCount: candidates.length,
        threshold: this.config.selectionThreshold,
      });
      return [];
    }

    // 優先度でソート
    qualifiedCandidates.sort((a, b) => {
      // 信頼度で主ソート
      if (b.confidenceScore !== a.confidenceScore) {
        return b.confidenceScore - a.confidenceScore;
      }
      // 優先度で副ソート
      return b.persona.getPriority() - a.persona.getPriority();
    });

    // 選択数の制限を適用
    const selectedCandidates = qualifiedCandidates.slice(0, this.config.maxActivePersonas);
    
    // 選択履歴を保存
    const historyKey = this.generateHistoryKey(context);
    this.selectionHistory.set(historyKey, candidates);

    logger.debug('ペルソナ選択候補を決定', {
      totalCandidates: candidates.length,
      qualifiedCandidates: qualifiedCandidates.length,
      selectedCount: selectedCandidates.length,
    });

    return selectedCandidates.map(c => c.persona);
  }

  /**
   * ペルソナ候補を生成
   */
  private async generatePersonaCandidates(context: PersonaContext): Promise<PersonaSelectionCandidate[]> {
    const enabledPersonas = this.registry.getEnabledPersonas();
    const candidates: PersonaSelectionCandidate[] = [];

    for (let i = 0; i < enabledPersonas.length; i++) {
      const persona = enabledPersonas[i];
      
      try {
        // 活性化可能性をチェック
        const canActivate = await persona.canActivate(context);
        if (!canActivate) {
          continue;
        }

        // 信頼度スコアを計算
        const confidenceScore = persona.calculateConfidenceScore(context);

        // 活性化理由を生成
        const activationReasons = this.generateActivationReasons(persona, context);

        candidates.push({
          persona,
          confidenceScore,
          activationReasons,
          rank: i + 1,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        getLogger().warn('ペルソナ候補評価に失敗', {
          personaId: persona.getId(),
          error: errorMessage,
        });
      }
    }

    return candidates;
  }

  /**
   * フォールバックペルソナを選択
   */
  private async selectFallbackPersonas(context: PersonaContext): Promise<BasePersona[]> {
    if (!this.config.fallbackPersonaId) {
      return [];
    }

    const fallbackPersona = this.registry.getPersona(this.config.fallbackPersonaId);
    if (!fallbackPersona) {
      return [];
    }

    try {
      const canActivate = await fallbackPersona.canActivate(context);
      return canActivate ? [fallbackPersona] : [];
    } catch {
      return [];
    }
  }

  /**
   * 活性化理由を生成
   */
  private generateActivationReasons(persona: BasePersona, context: PersonaContext): string[] {
    const reasons: string[] = [];

    // プロジェクトタイプマッチング
    const projectType = context.projectContext.type;
    if (projectType) {
      reasons.push(`プロジェクトタイプ: ${projectType}`);
    }

    // トリガータイプマッチング
    const triggerType = context.trigger.type;
    reasons.push(`トリガー: ${triggerType}`);

    // 機能マッチング
    const capabilities = persona.getCapabilities();
    if (capabilities.length > 0) {
      reasons.push(`対応機能: ${capabilities.map(c => c.name).join(', ')}`);
    }

    return reasons;
  }

  /**
   * 履歴キーを生成
   */
  private generateHistoryKey(context: PersonaContext): string {
    const timestamp = new Date().toISOString();
    const triggerType = context.trigger.type;
    const projectName = context.projectContext.name;
    
    return `${timestamp}-${triggerType}-${projectName}`;
  }

  /**
   * レジストリイベントリスナーを設定
   */
  private setupRegistryEventListeners(): void {
    this.registry.on('personaRegistered', (event) => {
      this.emit('personaRegistered', event);
    });

    this.registry.on('personaUnregistered', (event) => {
      this.emit('personaUnregistered', event);
    });

    this.registry.on('personaActivated', (event) => {
      this.emit('personaActivated', event);
    });

    this.registry.on('personaDeactivated', (event) => {
      this.emit('personaDeactivated', event);
    });
  }
}