import { EventEmitter } from 'events';
import {
  AIPersona,
  PersonaCapability,
  PersonaContext,
  PersonaResponse,
  PersonaPrompt,
  PersonaMemory,
  LearningData,
  InteractionHistory,
  PersonaMetrics,
  AdaptationStrategy,
  KnowledgeBase,
  PersonaState
} from '../types/index.js';
import {
  PersonaManager as IPersonaManager,
  PersonaExecutor,
  PersonaTrainer,
  PersonaEvaluator,
  PromptTemplate,
  ResponseAnalysis,
  LearningOutcome,
  PerformanceMetrics
} from '../core/interfaces.js';
import { FrameworkError, ErrorSeverity } from '../types/index.js';

export class PersonaError extends FrameworkError {
  code = 'PERSONA_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

export interface PersonaConfig {
  name: string;
  description: string;
  version: string;
  capabilities: PersonaCapability[];
  defaultPromptTemplate: PromptTemplate;
  learningEnabled: boolean;
  adaptationStrategy: AdaptationStrategy;
  memoryRetention: {
    shortTerm: number; // ミリ秒
    longTerm: number;  // ミリ秒
    maxEntries: number;
  };
  responseConstraints: {
    maxLength: number;
    minConfidence: number;
    timeoutMs: number;
  };
  knowledgeBaseConfig: {
    domains: string[];
    sources: string[];
    updateFrequency: number;
  };
}

export abstract class BasePersona extends EventEmitter implements AIPersona, PersonaExecutor {
  protected config: PersonaConfig;
  protected memory: PersonaMemory;
  protected knowledgeBase: KnowledgeBase;
  protected metrics: PersonaMetrics;
  protected state: PersonaState;
  protected interactionHistory: InteractionHistory[];
  protected isActive: boolean = false;

  constructor(config: PersonaConfig) {
    super();
    this.config = config;
    this.memory = this.initializeMemory();
    this.knowledgeBase = this.initializeKnowledgeBase();
    this.metrics = this.initializeMetrics();
    this.state = PersonaState.IDLE;
    this.interactionHistory = [];
    
    this.setupEventHandlers();
  }

  // AIPersona interface implementation
  get id(): string {
    return `${this.config.name.toLowerCase().replace(/\s+/g, '-')}-${this.config.version}`;
  }

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get version(): string {
    return this.config.version;
  }

  get capabilities(): PersonaCapability[] {
    return [...this.config.capabilities];
  }

  get isLearningEnabled(): boolean {
    return this.config.learningEnabled;
  }

  get currentState(): PersonaState {
    return this.state;
  }

  // PersonaExecutor interface implementation
  async executePrompt(prompt: PersonaPrompt, context: PersonaContext): Promise<PersonaResponse> {
    if (!this.isActive) {
      throw new PersonaError('ペルソナが非アクティブ状態です', { personaId: this.id });
    }

    this.setState(PersonaState.PROCESSING);
    const startTime = Date.now();

    try {
      // プロンプトの前処理
      const preprocessedPrompt = await this.preprocessPrompt(prompt, context);
      
      // メモリからの関連情報取得
      const relevantMemories = await this.retrieveRelevantMemories(preprocessedPrompt);
      
      // ナレッジベースからの情報取得
      const relevantKnowledge = await this.queryKnowledgeBase(preprocessedPrompt);
      
      // 拡張コンテキストの作成
      const enhancedContext = await this.enhanceContext(context, relevantMemories, relevantKnowledge);
      
      // 実際の応答生成（サブクラスで実装）
      const response = await this.generateResponse(preprocessedPrompt, enhancedContext);
      
      // 応答の後処理と検証
      const validatedResponse = await this.validateResponse(response, context);
      
      // 学習データの記録
      if (this.config.learningEnabled) {
        await this.recordLearningData({
          prompt: preprocessedPrompt,
          context: enhancedContext,
          response: validatedResponse,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          success: true
        });
      }
      
      // メトリクスの更新
      this.updateMetrics(validatedResponse, Date.now() - startTime);
      
      // インタラクション履歴の記録
      this.recordInteraction(prompt, validatedResponse, context);
      
      this.setState(PersonaState.IDLE);
      this.emit('responseGenerated', { prompt, response: validatedResponse, context });
      
      return validatedResponse;

    } catch (error) {
      this.setState(PersonaState.ERROR);
      const personaError = error instanceof PersonaError ? error : 
        new PersonaError(`応答生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`, { personaId: this.id });
      
      this.emit('executionError', { error: personaError, prompt, context });
      throw personaError;
    }
  }

  async activate(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.emit('activating');
    
    try {
      await this.initializeResources();
      await this.loadKnowledgeBase();
      await this.loadMemory();
      
      this.isActive = true;
      this.setState(PersonaState.IDLE);
      
      this.emit('activated');
    } catch (error) {
      this.setState(PersonaState.ERROR);
      throw new PersonaError(`ペルソナの有効化に失敗しました: ${error instanceof Error ? error.message : String(error)}`, { personaId: this.id });
    }
  }

  async deactivate(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.emit('deactivating');
    
    try {
      await this.saveMemory();
      await this.saveKnowledgeBase();
      await this.cleanupResources();
      
      this.isActive = false;
      this.setState(PersonaState.INACTIVE);
      
      this.emit('deactivated');
    } catch (error) {
      throw new PersonaError(`ペルソナの無効化に失敗しました: ${error instanceof Error ? error.message : String(error)}`, { personaId: this.id });
    }
  }

  async learn(data: LearningData): Promise<LearningOutcome> {
    if (!this.config.learningEnabled) {
      throw new PersonaError('このペルソナは学習機能が無効です', { personaId: this.id });
    }

    this.emit('learningStarted', { data });

    try {
      // 学習データの検証
      const validatedData = await this.validateLearningData(data);
      
      // 既存の知識との統合
      const integrationResult = await this.integrateKnowledge(validatedData);
      
      // メモリの更新
      await this.updateMemory(validatedData);
      
      // 適応戦略の実行
      const adaptationResult = await this.executeAdaptationStrategy(validatedData, integrationResult);
      
      const outcome: LearningOutcome = {
        success: true,
        knowledgeGain: integrationResult.knowledgeGain,
        adaptationChanges: adaptationResult.changes,
        confidence: adaptationResult.confidence,
        recommendations: adaptationResult.recommendations
      };

      this.emit('learningCompleted', { outcome });
      return outcome;

    } catch (error) {
      const learningError = new PersonaError(`学習処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`, { personaId: this.id });
      this.emit('learningError', { error: learningError, data });
      throw learningError;
    }
  }

  getMetrics(): PersonaMetrics {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  getMemorySnapshot(): PersonaMemory {
    return {
      shortTerm: [...this.memory.shortTerm],
      longTerm: [...this.memory.longTerm],
      workingMemory: { ...this.memory.workingMemory },
      contextualMemory: [...this.memory.contextualMemory]
    };
  }

  // 抽象メソッド（サブクラスで実装）
  protected abstract generateResponse(prompt: PersonaPrompt, context: PersonaContext): Promise<PersonaResponse>;
  protected abstract initializeResources(): Promise<void>;
  protected abstract cleanupResources(): Promise<void>;

  // プライベートメソッド
  private initializeMemory(): PersonaMemory {
    return {
      shortTerm: [],
      longTerm: [],
      workingMemory: {},
      contextualMemory: []
    };
  }

  private initializeKnowledgeBase(): KnowledgeBase {
    return {
      domains: this.config.knowledgeBaseConfig.domains.map(domain => ({
        name: domain,
        concepts: [],
        relationships: [],
        confidence: 0.5
      })),
      facts: [],
      patterns: [],
      lastUpdated: new Date()
    };
  }

  private initializeMetrics(): PersonaMetrics {
    return {
      totalInteractions: 0,
      successfulResponses: 0,
      averageResponseTime: 0,
      averageConfidence: 0,
      learningProgress: 0,
      adaptationCount: 0,
      errorRate: 0,
      userSatisfactionScore: 0,
      knowledgeGrowth: 0,
      timestamp: new Date()
    };
  }

  private setState(newState: PersonaState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChanged', { from: oldState, to: newState });
  }

  private setupEventHandlers(): void {
    // メモリの定期クリーンアップ
    setInterval(() => {
      this.cleanupMemory();
    }, this.config.memoryRetention.shortTerm);
  }

  private async preprocessPrompt(prompt: PersonaPrompt, context: PersonaContext): Promise<PersonaPrompt> {
    // プロンプトテンプレートの適用
    const template = this.config.defaultPromptTemplate;
    const processedContent = this.applyTemplate(prompt.content, template, context);
    
    return {
      ...prompt,
      content: processedContent,
      timestamp: new Date()
    };
  }

  private applyTemplate(content: string, template: PromptTemplate, context: PersonaContext): string {
    let processed = template.template;
    
    // テンプレート変数の置換
    processed = processed.replace('{{USER_INPUT}}', content);
    processed = processed.replace('{{PERSONA_NAME}}', this.name);
    processed = processed.replace('{{PROJECT_CONTEXT}}', JSON.stringify(context.project, null, 2));
    
    // 動的変数の処理
    template.variables.forEach(variable => {
      const value = this.resolveTemplateVariable(variable.name, context);
      processed = processed.replace(new RegExp(`{{${variable.name}}}`, 'g'), value);
    });
    
    return processed;
  }

  private resolveTemplateVariable(variableName: string, context: PersonaContext): string {
    switch (variableName) {
      case 'CURRENT_TIME':
        return new Date().toISOString();
      case 'USER_NAME':
        return context.user?.name || 'ユーザー';
      case 'PROJECT_TYPE':
        return context.project?.type || 'unknown';
      default:
        return `{{${variableName}}}`;
    }
  }

  private async retrieveRelevantMemories(prompt: PersonaPrompt): Promise<any[]> {
    const relevantMemories: any[] = [];
    
    // 短期記憶から関連する情報を検索
    const shortTermRelevant = this.memory.shortTerm.filter(memory => 
      this.isMemoryRelevant(memory, prompt)
    );
    
    // 長期記憶から関連する情報を検索
    const longTermRelevant = this.memory.longTerm.filter(memory => 
      this.isMemoryRelevant(memory, prompt)
    );
    
    relevantMemories.push(...shortTermRelevant, ...longTermRelevant);
    
    return relevantMemories.slice(0, 10); // 最大10件に制限
  }

  private isMemoryRelevant(memory: any, prompt: PersonaPrompt): boolean {
    // 簡単なキーワードベースの関連性チェック
    const promptKeywords = prompt.content.toLowerCase().split(/\s+/);
    const memoryText = JSON.stringify(memory).toLowerCase();
    
    return promptKeywords.some(keyword => 
      keyword.length > 3 && memoryText.includes(keyword)
    );
  }

  private async queryKnowledgeBase(prompt: PersonaPrompt): Promise<any[]> {
    const relevantKnowledge: any[] = [];
    
    for (const domain of this.knowledgeBase.domains) {
      const relevantConcepts = domain.concepts.filter(concept =>
        prompt.content.toLowerCase().includes(concept.name.toLowerCase())
      );
      relevantKnowledge.push(...relevantConcepts);
    }
    
    return relevantKnowledge.slice(0, 5); // 最大5件に制限
  }

  private async enhanceContext(
    originalContext: PersonaContext,
    memories: any[],
    knowledge: any[]
  ): Promise<PersonaContext> {
    return {
      ...originalContext,
      relevantMemories: memories,
      relevantKnowledge: knowledge,
      enhancedAt: new Date()
    };
  }

  private async validateResponse(response: PersonaResponse, context: PersonaContext): Promise<PersonaResponse> {
    // 応答の長さチェック
    if (response.content.length > this.config.responseConstraints.maxLength) {
      throw new PersonaError('応答が最大長制限を超えています');
    }
    
    // 信頼度チェック
    if (response.confidence < this.config.responseConstraints.minConfidence) {
      throw new PersonaError('応答の信頼度が最小値を下回っています');
    }
    
    return {
      ...response,
      validatedAt: new Date()
    };
  }

  private async recordLearningData(data: LearningData): Promise<void> {
    // 短期記憶に追加
    this.memory.shortTerm.push({
      type: 'interaction',
      data,
      timestamp: new Date(),
      importance: this.calculateImportance(data)
    });
    
    // メモリサイズ制限チェック
    if (this.memory.shortTerm.length > this.config.memoryRetention.maxEntries) {
      this.memory.shortTerm.shift(); // 古いエントリを削除
    }
  }

  private calculateImportance(data: LearningData): number {
    // 実行時間、成功率、複雑性に基づいて重要度を計算
    let importance = 0.5;
    
    if (data.success) importance += 0.2;
    if (data.executionTime < 1000) importance += 0.1;
    if (data.prompt.content.length > 100) importance += 0.1;
    
    return Math.min(importance, 1.0);
  }

  private updateMetrics(response: PersonaResponse, executionTime: number): void {
    this.metrics.totalInteractions++;
    
    if (response.confidence >= this.config.responseConstraints.minConfidence) {
      this.metrics.successfulResponses++;
    }
    
    // 移動平均の更新
    const alpha = 0.1; // 平滑化係数
    this.metrics.averageResponseTime = 
      alpha * executionTime + (1 - alpha) * this.metrics.averageResponseTime;
    
    this.metrics.averageConfidence = 
      alpha * response.confidence + (1 - alpha) * this.metrics.averageConfidence;
    
    this.metrics.errorRate = 
      1 - (this.metrics.successfulResponses / this.metrics.totalInteractions);
    
    this.metrics.timestamp = new Date();
  }

  private recordInteraction(prompt: PersonaPrompt, response: PersonaResponse, context: PersonaContext): void {
    const interaction: InteractionHistory = {
      id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      response,
      context,
      timestamp: new Date(),
      executionTime: response.metadata?.executionTime || 0,
      success: response.confidence >= this.config.responseConstraints.minConfidence
    };
    
    this.interactionHistory.push(interaction);
    
    // 履歴サイズ制限
    if (this.interactionHistory.length > 1000) {
      this.interactionHistory.shift();
    }
  }

  private cleanupMemory(): void {
    const now = Date.now();
    const shortTermCutoff = now - this.config.memoryRetention.shortTerm;
    const longTermCutoff = now - this.config.memoryRetention.longTerm;
    
    // 期限切れの短期記憶を削除または長期記憶に移動
    this.memory.shortTerm = this.memory.shortTerm.filter(memory => {
      if (memory.timestamp.getTime() < shortTermCutoff) {
        if (memory.importance > 0.7) {
          // 重要な記憶は長期記憶に移動
          this.memory.longTerm.push(memory);
        }
        return false;
      }
      return true;
    });
    
    // 期限切れの長期記憶を削除
    this.memory.longTerm = this.memory.longTerm.filter(memory => 
      memory.timestamp.getTime() >= longTermCutoff
    );
  }

  private async validateLearningData(data: LearningData): Promise<LearningData> {
    // 学習データの妥当性をチェック
    if (!data.prompt || !data.response) {
      throw new PersonaError('学習データが不完全です');
    }
    
    return data;
  }

  private async integrateKnowledge(data: LearningData): Promise<{ knowledgeGain: number }> {
    // 新しい知識をナレッジベースに統合
    const knowledgeGain = Math.random() * 0.1; // プレースホルダー実装
    
    return { knowledgeGain };
  }

  private async updateMemory(data: LearningData): Promise<void> {
    // 学習データに基づいてメモリを更新
    this.memory.workingMemory[`learning-${Date.now()}`] = {
      data,
      integrated: new Date()
    };
  }

  private async executeAdaptationStrategy(
    data: LearningData, 
    integrationResult: { knowledgeGain: number }
  ): Promise<{ changes: string[]; confidence: number; recommendations: string[] }> {
    // 適応戦略に基づいてペルソナを調整
    return {
      changes: ['プロンプトテンプレートの調整'],
      confidence: 0.8,
      recommendations: ['より多くの学習データが必要です']
    };
  }

  private async loadKnowledgeBase(): Promise<void> {
    // ナレッジベースの読み込み（サブクラスで具体的な実装）
  }

  private async saveKnowledgeBase(): Promise<void> {
    // ナレッジベースの保存（サブクラスで具体的な実装）
  }

  private async loadMemory(): Promise<void> {
    // メモリの読み込み（サブクラスで具体的な実装）
  }

  private async saveMemory(): Promise<void> {
    // メモリの保存（サブクラスで具体的な実装）
  }

  dispose(): void {
    if (this.isActive) {
      this.deactivate().catch(error => {
        console.error('ペルソナの無効化中にエラーが発生しました:', error);
      });
    }
    
    this.removeAllListeners();
    this.interactionHistory.length = 0;
    this.memory.shortTerm.length = 0;
    this.memory.longTerm.length = 0;
  }
}

export default BasePersona;