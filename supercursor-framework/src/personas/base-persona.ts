/**
 * AIペルソナベースクラス
 */

import { EventEmitter } from 'events';
import { 
  PersonaContext,
  PersonaResponse,
  PersonaCapability,
  PersonaType,
  ActivationTrigger,
  ProjectContext 
} from '../types';
import { getLogger } from '../core/logger';

export interface PersonaConfig {
  id: string;
  name: string;
  type: PersonaType;
  description: string;
  version: string;
  capabilities: PersonaCapability[];
  activationScore: number; // 0-100の範囲
  priority: number; // 1-10の範囲（高いほど優先度高）
  contextRequirements: string[];
  conflictingPersonas: string[];
}

export abstract class BasePersona extends EventEmitter {
  protected config: PersonaConfig;
  protected isActive: boolean = false;
  protected context: PersonaContext | null = null;
  protected activatedAt: Date | null = null;

  constructor(config: PersonaConfig) {
    super();
    this.config = config;
  }

  /**
   * ペルソナID取得
   */
  public getId(): string {
    return this.config.id;
  }

  /**
   * ペルソナ名取得
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * ペルソナタイプ取得
   */
  public getType(): PersonaType {
    return this.config.type;
  }

  /**
   * 説明取得
   */
  public getDescription(): string {
    return this.config.description;
  }

  /**
   * 機能一覧取得
   */
  public getCapabilities(): PersonaCapability[] {
    return [...this.config.capabilities];
  }

  /**
   * アクティベーションスコア取得
   */
  public getActivationScore(): number {
    return this.config.activationScore;
  }

  /**
   * 優先度取得
   */
  public getPriority(): number {
    return this.config.priority;
  }

  /**
   * アクティブ状態確認
   */
  public isPersonaActive(): boolean {
    return this.isActive;
  }

  /**
   * 活性化可能性を評価
   */
  public async canActivate(context: PersonaContext): Promise<boolean> {
    const logger = getLogger();
    
    try {
      logger.debug('ペルソナ活性化可能性を評価', { 
        personaId: this.config.id, 
        contextType: context.trigger.type 
      });

      // 基本的な前提条件をチェック
      if (!this.checkBasicRequirements(context)) {
        return false;
      }

      // コンテキスト要件をチェック
      if (!this.checkContextRequirements(context)) {
        return false;
      }

      // カスタム活性化ロジックを実行
      const customCheck = await this.evaluateCustomActivation(context);
      
      logger.debug('ペルソナ活性化評価結果', {
        personaId: this.config.id,
        canActivate: customCheck,
        activationScore: this.config.activationScore
      });

      return customCheck;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ活性化評価に失敗', { 
        personaId: this.config.id, 
        error: errorMessage 
      });
      return false;
    }
  }

  /**
   * ペルソナを活性化
   */
  public async activate(context: PersonaContext): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('ペルソナを活性化中', { personaId: this.config.id });

      if (this.isActive) {
        logger.warn('ペルソナは既に活性化されています', { personaId: this.config.id });
        return;
      }

      this.context = context;
      this.isActive = true;
      this.activatedAt = new Date();

      // カスタム活性化処理を実行
      await this.performActivation(context);

      this.emit('activated', {
        personaId: this.config.id,
        context,
        timestamp: this.activatedAt,
      });

      logger.info('ペルソナ活性化完了', { 
        personaId: this.config.id,
        activatedAt: this.activatedAt 
      });

    } catch (error) {
      this.isActive = false;
      this.context = null;
      this.activatedAt = null;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ活性化に失敗', { 
        personaId: this.config.id, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * ペルソナを非活性化
   */
  public async deactivate(): Promise<void> {
    const logger = getLogger();
    
    try {
      logger.info('ペルソナを非活性化中', { personaId: this.config.id });

      if (!this.isActive) {
        logger.warn('ペルソナは既に非活性化されています', { personaId: this.config.id });
        return;
      }

      // カスタム非活性化処理を実行
      await this.performDeactivation();

      const deactivatedAt = new Date();
      const activeDuration = this.activatedAt 
        ? deactivatedAt.getTime() - this.activatedAt.getTime()
        : 0;

      this.emit('deactivated', {
        personaId: this.config.id,
        context: this.context,
        activeDuration,
        timestamp: deactivatedAt,
      });

      this.isActive = false;
      this.context = null;
      this.activatedAt = null;

      logger.info('ペルソナ非活性化完了', { 
        personaId: this.config.id,
        activeDuration 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ非活性化に失敗', { 
        personaId: this.config.id, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * 命令を処理
   */
  public async processCommand(command: string, context: PersonaContext): Promise<PersonaResponse> {
    const logger = getLogger();
    
    try {
      logger.debug('コマンド処理開始', { 
        personaId: this.config.id, 
        command: command.substring(0, 100) 
      });

      if (!this.isActive) {
        throw new Error('ペルソナが活性化されていません');
      }

      // 入力の検証
      this.validateCommandInput(command, context);

      // カスタムコマンド処理を実行
      const response = await this.executeCommand(command, context);

      logger.info('コマンド処理完了', { 
        personaId: this.config.id,
        success: response.success,
        hasOutput: !!response.output 
      });

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('コマンド処理に失敗', { 
        personaId: this.config.id, 
        error: errorMessage 
      });

      return {
        success: false,
        output: '',
        error: errorMessage,
        metadata: {
          personaId: this.config.id,
          timestamp: new Date(),
          processingTime: 0,
        },
      };
    }
  }

  /**
   * 信頼度スコアを計算
   */
  public calculateConfidenceScore(context: PersonaContext): number {
    const logger = getLogger();
    
    try {
      let confidence = this.config.activationScore;

      // プロジェクトタイプマッチング
      confidence += this.calculateProjectTypeMatch(context.projectContext);

      // トリガータイプマッチング
      confidence += this.calculateTriggerMatch(context.trigger);

      // カスタム信頼度計算
      confidence += this.calculateCustomConfidence(context);

      // 正規化（0-100の範囲に収める）
      confidence = Math.max(0, Math.min(100, confidence));

      logger.debug('信頼度スコア計算完了', {
        personaId: this.config.id,
        confidence,
        baseScore: this.config.activationScore
      });

      return confidence;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('信頼度スコア計算に失敗', { 
        personaId: this.config.id, 
        error: errorMessage 
      });
      return 0;
    }
  }

  // 抽象メソッド - 各ペルソナで実装が必要

  /**
   * カスタム活性化評価ロジック
   */
  protected abstract evaluateCustomActivation(context: PersonaContext): Promise<boolean>;

  /**
   * ペルソナ固有の活性化処理
   */
  protected abstract performActivation(context: PersonaContext): Promise<void>;

  /**
   * ペルソナ固有の非活性化処理
   */
  protected abstract performDeactivation(): Promise<void>;

  /**
   * コマンド実行の具体的な処理
   */
  protected abstract executeCommand(command: string, context: PersonaContext): Promise<PersonaResponse>;

  /**
   * カスタム信頼度計算
   */
  protected abstract calculateCustomConfidence(context: PersonaContext): number;

  // プライベートメソッド

  /**
   * 基本要件をチェック
   */
  private checkBasicRequirements(context: PersonaContext): boolean {
    // 競合するペルソナが活性化されていないかチェック
    const activePersonas = context.activePersonas || [];
    const hasConflict = activePersonas.some(activeId => 
      this.config.conflictingPersonas.includes(activeId)
    );

    return !hasConflict;
  }

  /**
   * コンテキスト要件をチェック
   */
  private checkContextRequirements(context: PersonaContext): boolean {
    if (this.config.contextRequirements.length === 0) {
      return true;
    }

    // プロジェクトコンテキストから要件をチェック
    const projectTech: string[] = [
      ...context.projectContext.technologies.languages,
      ...context.projectContext.technologies.frameworks.map(String),
      ...context.projectContext.technologies.tools.map(String),
    ];

    return this.config.contextRequirements.some(requirement =>
      projectTech.map(tech => tech.toLowerCase()).includes(requirement.toLowerCase())
    );
  }

  /**
   * 入力検証
   */
  private validateCommandInput(command: string, context: PersonaContext): void {
    if (!command || command.trim().length === 0) {
      throw new Error('コマンドが空です');
    }

    if (!context) {
      throw new Error('コンテキストが提供されていません');
    }
  }

  /**
   * プロジェクトタイプマッチングスコア計算
   */
  private calculateProjectTypeMatch(projectContext: ProjectContext): number {
    // 基本実装（各ペルソナでオーバーライド可能）
    return 0;
  }

  /**
   * トリガーマッチングスコア計算
   */
  private calculateTriggerMatch(trigger: ActivationTrigger): number {
    // 基本実装（各ペルソナでオーバーライド可能）
    return 0;
  }
}