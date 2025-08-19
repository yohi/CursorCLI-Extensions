import { EventEmitter } from 'events';
import {
  PersonaManager as IPersonaManager,
  PersonaSelector,
  PersonaTrainer,
  PersonaEvaluator,
  PersonaRegistry,
  SelectionCriteria,
  TrainingConfig,
  EvaluationMetrics,
  RegistrationInfo,
  SelectionResult,
  TrainingResult,
  EvaluationResult,
  CacheManager
} from '../core/interfaces.js';
import {
  AIPersona,
  PersonaContext,
  PersonaPrompt,
  PersonaResponse,
  LearningData,
  PersonaMetrics,
  PersonaState,
  FrameworkError,
  ErrorSeverity
} from '../types/index.js';
import { BasePersona, PersonaError } from './base-persona.js';

export class PersonaManagerError extends FrameworkError {
  code = 'PERSONA_MANAGER_ERROR';
  severity = ErrorSeverity.HIGH;
  recoverable = true;
}

export interface PersonaManagerConfig {
  maxActivePersonas: number;
  selectionStrategy: 'performance' | 'capability' | 'hybrid';
  trainingEnabled: boolean;
  evaluationInterval: number; // ミリ秒
  persistenceEnabled: boolean;
  cacheConfig: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export class PersonaManager extends EventEmitter implements IPersonaManager {
  private personas: Map<string, BasePersona> = new Map();
  private activePersonas: Set<string> = new Set();
  private selectionCache: Map<string, SelectionResult> = new Map();
  private metrics: Map<string, PersonaMetrics> = new Map();
  private evaluationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private config: PersonaManagerConfig,
    private cache: CacheManager
  ) {
    super();
    this.setupPeriodicEvaluation();
  }

  // PersonaManager interface implementation
  async registerPersona(persona: BasePersona, info: RegistrationInfo): Promise<void> {
    if (this.personas.has(persona.id)) {
      throw new PersonaManagerError(`ペルソナ「${persona.id}」は既に登録されています`);
    }

    try {
      // ペルソナの検証
      await this.validatePersona(persona, info);
      
      // ペルソナの登録
      this.personas.set(persona.id, persona);
      
      // イベントリスナーの設定
      this.setupPersonaEventListeners(persona);
      
      // メトリクスの初期化
      this.metrics.set(persona.id, persona.getMetrics());
      
      // 評価タイマーの設定
      this.setupEvaluationTimer(persona.id);
      
      this.emit('personaRegistered', { persona, info });
      
      console.log(`ペルソナ「${persona.name}」を登録しました`);

    } catch (error) {
      throw new PersonaManagerError(
        `ペルソナの登録に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId: persona.id }
      );
    }
  }

  async unregisterPersona(personaId: string): Promise<boolean> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      return false;
    }

    try {
      // アクティブな場合は非アクティブ化
      if (this.activePersonas.has(personaId)) {
        await persona.deactivate();
        this.activePersonas.delete(personaId);
      }
      
      // 評価タイマーの停止
      const timer = this.evaluationTimers.get(personaId);
      if (timer) {
        clearInterval(timer);
        this.evaluationTimers.delete(personaId);
      }
      
      // イベントリスナーの削除
      persona.removeAllListeners();
      
      // 登録解除
      this.personas.delete(personaId);
      this.metrics.delete(personaId);
      
      // キャッシュのクリア
      this.clearPersonaCache(personaId);
      
      // リソースの解放
      persona.dispose();
      
      this.emit('personaUnregistered', { personaId });
      
      console.log(`ペルソナ「${personaId}」の登録を解除しました`);
      return true;

    } catch (error) {
      throw new PersonaManagerError(
        `ペルソナの登録解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId }
      );
    }
  }

  async selectPersona(criteria: SelectionCriteria, context: PersonaContext): Promise<SelectionResult> {
    if (this.personas.size === 0) {
      throw new PersonaManagerError('登録されたペルソナがありません');
    }

    // キャッシュチェック
    const cacheKey = this.generateSelectionCacheKey(criteria, context);
    if (this.config.cacheConfig.enabled) {
      const cached = this.selectionCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }
    }

    try {
      this.emit('selectionStarted', { criteria, context });

      const candidates = await this.findCandidatePersonas(criteria);
      if (candidates.length === 0) {
        throw new PersonaManagerError('選択基準に合致するペルソナがありません');
      }

      const scoredCandidates = await this.scorePersonas(candidates, criteria, context);
      const selectedPersona = this.selectBestPersona(scoredCandidates);

      const result: SelectionResult = {
        selectedPersona: selectedPersona.persona,
        confidence: selectedPersona.score,
        alternatives: scoredCandidates
          .filter(c => c.persona.id !== selectedPersona.persona.id)
          .slice(0, 3)
          .map(c => ({ persona: c.persona, confidence: c.score })),
        criteria,
        selectionTime: new Date()
      };

      // キャッシュに保存
      if (this.config.cacheConfig.enabled) {
        this.selectionCache.set(cacheKey, result);
        this.cleanupSelectionCache();
      }

      this.emit('personaSelected', result);
      return result;

    } catch (error) {
      const selectionError = error instanceof PersonaManagerError ? error :
        new PersonaManagerError(`ペルソナ選択中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      
      this.emit('selectionError', { error: selectionError, criteria, context });
      throw selectionError;
    }
  }

  async activatePersona(personaId: string): Promise<void> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」が見つかりません`);
    }

    if (this.activePersonas.has(personaId)) {
      return; // 既にアクティブ
    }

    // 最大アクティブ数チェック
    if (this.activePersonas.size >= this.config.maxActivePersonas) {
      const oldestPersona = this.findOldestActivePersona();
      if (oldestPersona) {
        await this.deactivatePersona(oldestPersona);
      }
    }

    try {
      await persona.activate();
      this.activePersonas.add(personaId);
      
      this.emit('personaActivated', { personaId, persona });

    } catch (error) {
      throw new PersonaManagerError(
        `ペルソナ「${personaId}」の有効化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId }
      );
    }
  }

  async deactivatePersona(personaId: string): Promise<void> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」が見つかりません`);
    }

    if (!this.activePersonas.has(personaId)) {
      return; // 既に非アクティブ
    }

    try {
      await persona.deactivate();
      this.activePersonas.delete(personaId);
      
      this.emit('personaDeactivated', { personaId, persona });

    } catch (error) {
      throw new PersonaManagerError(
        `ペルソナ「${personaId}」の無効化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId }
      );
    }
  }

  async executeWithPersona(
    personaId: string,
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<PersonaResponse> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」が見つかりません`);
    }

    // アクティブ化（必要に応じて）
    if (!this.activePersonas.has(personaId)) {
      await this.activatePersona(personaId);
    }

    try {
      const startTime = Date.now();
      const response = await persona.executePrompt(prompt, context);
      const executionTime = Date.now() - startTime;

      // メトリクスの更新
      await this.updatePersonaMetrics(personaId, response, executionTime);

      this.emit('promptExecuted', { personaId, prompt, response, context, executionTime });

      return response;

    } catch (error) {
      const executionError = error instanceof PersonaError ? error :
        new PersonaManagerError(
          `ペルソナ「${personaId}」での実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          { personaId }
        );

      this.emit('executionError', { error: executionError, personaId, prompt, context });
      throw executionError;
    }
  }

  async trainPersona(personaId: string, config: TrainingConfig): Promise<TrainingResult> {
    if (!this.config.trainingEnabled) {
      throw new PersonaManagerError('トレーニング機能が無効です');
    }

    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」が見つかりません`);
    }

    if (!persona.isLearningEnabled) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」は学習機能が無効です`);
    }

    try {
      this.emit('trainingStarted', { personaId, config });

      const trainingData = await this.prepareTrainingData(config);
      const results: any[] = [];

      for (const data of trainingData) {
        const outcome = await persona.learn(data);
        results.push({ data, outcome });
      }

      const trainingResult: TrainingResult = {
        success: true,
        personaId,
        trainingData: trainingData.length,
        improvements: this.calculateImprovements(results),
        newCapabilities: this.identifyNewCapabilities(results),
        performance: await this.evaluatePostTrainingPerformance(personaId)
      };

      this.emit('trainingCompleted', { result: trainingResult });

      return trainingResult;

    } catch (error) {
      const trainingError = new PersonaManagerError(
        `ペルソナ「${personaId}」のトレーニングに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId }
      );

      this.emit('trainingError', { error: trainingError, personaId, config });
      throw trainingError;
    }
  }

  async evaluatePersona(personaId: string): Promise<EvaluationResult> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new PersonaManagerError(`ペルソナ「${personaId}」が見つかりません`);
    }

    try {
      const metrics = persona.getMetrics();
      const evaluation: EvaluationResult = {
        personaId,
        overallScore: this.calculateOverallScore(metrics),
        metrics: {
          performance: this.calculatePerformanceScore(metrics),
          reliability: this.calculateReliabilityScore(metrics),
          adaptability: this.calculateAdaptabilityScore(metrics),
          userSatisfaction: metrics.userSatisfactionScore
        },
        strengths: this.identifyStrengths(metrics),
        weaknesses: this.identifyWeaknesses(metrics),
        recommendations: this.generateRecommendations(metrics),
        evaluatedAt: new Date()
      };

      // メトリクスの更新
      this.metrics.set(personaId, metrics);

      this.emit('personaEvaluated', { result: evaluation });

      return evaluation;

    } catch (error) {
      throw new PersonaManagerError(
        `ペルソナ「${personaId}」の評価に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { personaId }
      );
    }
  }

  getRegisteredPersonas(): AIPersona[] {
    return Array.from(this.personas.values()).map(persona => ({
      id: persona.id,
      name: persona.name,
      description: persona.description,
      version: persona.version,
      capabilities: persona.capabilities,
      isLearningEnabled: persona.isLearningEnabled,
      currentState: persona.currentState
    }));
  }

  getActivePersonas(): AIPersona[] {
    return Array.from(this.activePersonas)
      .map(id => this.personas.get(id))
      .filter((persona): persona is BasePersona => persona !== undefined)
      .map(persona => ({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        version: persona.version,
        capabilities: persona.capabilities,
        isLearningEnabled: persona.isLearningEnabled,
        currentState: persona.currentState
      }));
  }

  getPersonaMetrics(personaId: string): PersonaMetrics | undefined {
    return this.metrics.get(personaId);
  }

  getAllMetrics(): Record<string, PersonaMetrics> {
    const result: Record<string, PersonaMetrics> = {};
    for (const [id, metrics] of this.metrics) {
      result[id] = metrics;
    }
    return result;
  }

  // プライベートメソッド
  private async validatePersona(persona: BasePersona, info: RegistrationInfo): Promise<void> {
    if (!persona.id || !persona.name || !persona.version) {
      throw new PersonaManagerError('ペルソナの必須情報が不足しています');
    }

    if (info.requiredCapabilities) {
      const missingCapabilities = info.requiredCapabilities.filter(
        cap => !persona.capabilities.includes(cap)
      );
      
      if (missingCapabilities.length > 0) {
        throw new PersonaManagerError(
          `必要な機能が不足しています: ${missingCapabilities.join(', ')}`
        );
      }
    }
  }

  private setupPersonaEventListeners(persona: BasePersona): void {
    persona.on('stateChanged', (event) => {
      this.emit('personaStateChanged', { personaId: persona.id, ...event });
    });

    persona.on('responseGenerated', (event) => {
      this.emit('responseGenerated', { personaId: persona.id, ...event });
    });

    persona.on('executionError', (event) => {
      this.emit('personaExecutionError', { personaId: persona.id, ...event });
    });

    persona.on('learningCompleted', (event) => {
      this.emit('personaLearningCompleted', { personaId: persona.id, ...event });
    });
  }

  private setupEvaluationTimer(personaId: string): void {
    const timer = setInterval(async () => {
      try {
        await this.evaluatePersona(personaId);
      } catch (error) {
        console.error(`ペルソナ「${personaId}」の定期評価中にエラーが発生しました:`, error);
      }
    }, this.config.evaluationInterval);

    this.evaluationTimers.set(personaId, timer);
  }

  private setupPeriodicEvaluation(): void {
    // 定期的なシステム全体の評価とクリーンアップ
    setInterval(() => {
      this.cleanupSelectionCache();
      this.updateSystemMetrics();
    }, 300000); // 5分間隔
  }

  private generateSelectionCacheKey(criteria: SelectionCriteria, context: PersonaContext): string {
    return `selection-${JSON.stringify(criteria)}-${JSON.stringify(context.project?.type || 'unknown')}`;
  }

  private isCacheValid(result: SelectionResult): boolean {
    const now = Date.now();
    const cacheAge = now - result.selectionTime.getTime();
    return cacheAge < this.config.cacheConfig.ttl;
  }

  private async findCandidatePersonas(criteria: SelectionCriteria): Promise<BasePersona[]> {
    const candidates: BasePersona[] = [];

    for (const persona of this.personas.values()) {
      if (await this.matchesCriteria(persona, criteria)) {
        candidates.push(persona);
      }
    }

    return candidates;
  }

  private async matchesCriteria(persona: BasePersona, criteria: SelectionCriteria): Promise<boolean> {
    // 必要な機能チェック
    if (criteria.requiredCapabilities) {
      const hasAllCapabilities = criteria.requiredCapabilities.every(
        cap => persona.capabilities.includes(cap)
      );
      if (!hasAllCapabilities) return false;
    }

    // 状態チェック
    if (criteria.preferredState && persona.currentState !== criteria.preferredState) {
      return false;
    }

    // パフォーマンス基準
    if (criteria.minPerformanceScore) {
      const metrics = this.metrics.get(persona.id);
      if (!metrics || this.calculatePerformanceScore(metrics) < criteria.minPerformanceScore) {
        return false;
      }
    }

    return true;
  }

  private async scorePersonas(
    candidates: BasePersona[],
    criteria: SelectionCriteria,
    context: PersonaContext
  ): Promise<Array<{ persona: BasePersona; score: number }>> {
    const scoredCandidates: Array<{ persona: BasePersona; score: number }> = [];

    for (const persona of candidates) {
      const score = await this.calculatePersonaScore(persona, criteria, context);
      scoredCandidates.push({ persona, score });
    }

    return scoredCandidates.sort((a, b) => b.score - a.score);
  }

  private async calculatePersonaScore(
    persona: BasePersona,
    criteria: SelectionCriteria,
    context: PersonaContext
  ): Promise<number> {
    let score = 0;

    // 基本スコア
    score += 0.5;

    // パフォーマンスメトリクスに基づくスコア
    const metrics = this.metrics.get(persona.id);
    if (metrics) {
      score += this.calculatePerformanceScore(metrics) * 0.3;
      score += this.calculateReliabilityScore(metrics) * 0.2;
    }

    // 機能マッチングスコア
    if (criteria.requiredCapabilities) {
      const matchRatio = criteria.requiredCapabilities.filter(
        cap => persona.capabilities.includes(cap)
      ).length / criteria.requiredCapabilities.length;
      score += matchRatio * 0.2;
    }

    // コンテキスト適合性スコア
    score += this.calculateContextFitScore(persona, context) * 0.1;

    return Math.min(score, 1.0);
  }

  private calculateContextFitScore(persona: BasePersona, context: PersonaContext): number {
    // プロジェクトタイプとペルソナの適合性を評価
    // 実装はペルソナの種類によって異なる
    return 0.7; // プレースホルダー
  }

  private selectBestPersona(scoredCandidates: Array<{ persona: BasePersona; score: number }>): { persona: BasePersona; score: number } {
    if (scoredCandidates.length === 0) {
      throw new PersonaManagerError('候補ペルソナがありません');
    }

    return scoredCandidates[0]!;
  }

  private findOldestActivePersona(): string | null {
    // 最も古くからアクティブなペルソナを見つける
    // 簡易実装として最初のアクティブペルソナを返す
    const activeArray = Array.from(this.activePersonas);
    return activeArray.length > 0 ? activeArray[0]! : null;
  }

  private async updatePersonaMetrics(
    personaId: string,
    response: PersonaResponse,
    executionTime: number
  ): Promise<void> {
    const persona = this.personas.get(personaId);
    if (persona) {
      const currentMetrics = persona.getMetrics();
      this.metrics.set(personaId, currentMetrics);
    }
  }

  private clearPersonaCache(personaId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.selectionCache.keys()) {
      if (key.includes(personaId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.selectionCache.delete(key));
  }

  private cleanupSelectionCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, result] of this.selectionCache) {
      if (!this.isCacheValid(result)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.selectionCache.delete(key));

    // サイズ制限チェック
    if (this.selectionCache.size > this.config.cacheConfig.maxSize) {
      const entries = Array.from(this.selectionCache.entries());
      entries.sort((a, b) => a[1].selectionTime.getTime() - b[1].selectionTime.getTime());
      
      const deleteCount = this.selectionCache.size - this.config.cacheConfig.maxSize;
      for (let i = 0; i < deleteCount; i++) {
        this.selectionCache.delete(entries[i]![0]);
      }
    }
  }

  private updateSystemMetrics(): void {
    // システム全体のメトリクスを更新
    this.emit('systemMetricsUpdated', {
      totalPersonas: this.personas.size,
      activePersonas: this.activePersonas.size,
      cacheSize: this.selectionCache.size,
      timestamp: new Date()
    });
  }

  private calculatePerformanceScore(metrics: PersonaMetrics): number {
    // パフォーマンススコアの計算
    const successRate = metrics.totalInteractions > 0 ? 
      metrics.successfulResponses / metrics.totalInteractions : 0;
    
    const responseTimeScore = Math.max(0, 1 - (metrics.averageResponseTime / 10000)); // 10秒を最大とする
    const confidenceScore = metrics.averageConfidence;
    
    return (successRate * 0.4 + responseTimeScore * 0.3 + confidenceScore * 0.3);
  }

  private calculateReliabilityScore(metrics: PersonaMetrics): number {
    return Math.max(0, 1 - metrics.errorRate);
  }

  private calculateAdaptabilityScore(metrics: PersonaMetrics): number {
    // 適応性スコア（学習進歩と適応回数に基づく）
    return (metrics.learningProgress * 0.6 + Math.min(metrics.adaptationCount / 10, 1) * 0.4);
  }

  private calculateOverallScore(metrics: PersonaMetrics): number {
    const performance = this.calculatePerformanceScore(metrics);
    const reliability = this.calculateReliabilityScore(metrics);
    const adaptability = this.calculateAdaptabilityScore(metrics);
    const satisfaction = metrics.userSatisfactionScore;
    
    return (performance * 0.3 + reliability * 0.3 + adaptability * 0.2 + satisfaction * 0.2);
  }

  private identifyStrengths(metrics: PersonaMetrics): string[] {
    const strengths: string[] = [];
    
    if (this.calculatePerformanceScore(metrics) > 0.8) {
      strengths.push('高いパフォーマンス');
    }
    if (this.calculateReliabilityScore(metrics) > 0.9) {
      strengths.push('優れた信頼性');
    }
    if (metrics.averageConfidence > 0.8) {
      strengths.push('高い応答信頼度');
    }
    if (metrics.learningProgress > 0.7) {
      strengths.push('良好な学習能力');
    }
    
    return strengths;
  }

  private identifyWeaknesses(metrics: PersonaMetrics): string[] {
    const weaknesses: string[] = [];
    
    if (this.calculatePerformanceScore(metrics) < 0.5) {
      weaknesses.push('パフォーマンスの向上が必要');
    }
    if (metrics.errorRate > 0.2) {
      weaknesses.push('エラー率が高い');
    }
    if (metrics.averageResponseTime > 5000) {
      weaknesses.push('応答時間が長い');
    }
    if (metrics.userSatisfactionScore < 0.6) {
      weaknesses.push('ユーザー満足度の改善が必要');
    }
    
    return weaknesses;
  }

  private generateRecommendations(metrics: PersonaMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.learningProgress < 0.5) {
      recommendations.push('より多くの学習データを提供してください');
    }
    if (metrics.averageResponseTime > 3000) {
      recommendations.push('応答時間の最適化を検討してください');
    }
    if (metrics.errorRate > 0.1) {
      recommendations.push('エラーハンドリングの改善が必要です');
    }
    if (metrics.adaptationCount < 5) {
      recommendations.push('適応機能の活用を増やしてください');
    }
    
    return recommendations;
  }

  private async prepareTrainingData(config: TrainingConfig): Promise<LearningData[]> {
    // トレーニング設定に基づいて学習データを準備
    return []; // プレースホルダー実装
  }

  private calculateImprovements(results: any[]): string[] {
    // トレーニング結果から改善点を計算
    return ['応答品質の向上', '処理速度の改善'];
  }

  private identifyNewCapabilities(results: any[]): string[] {
    // 新しく獲得した機能を特定
    return [];
  }

  private async evaluatePostTrainingPerformance(personaId: string): Promise<number> {
    // トレーニング後のパフォーマンス評価
    return 0.85; // プレースホルダー
  }

  dispose(): void {
    // すべてのタイマーを停止
    for (const timer of this.evaluationTimers.values()) {
      clearInterval(timer);
    }
    this.evaluationTimers.clear();

    // すべてのペルソナを非アクティブ化
    for (const personaId of this.activePersonas) {
      this.deactivatePersona(personaId).catch(error => {
        console.error(`ペルソナ「${personaId}」の無効化中にエラーが発生しました:`, error);
      });
    }

    // ペルソナの解放
    for (const persona of this.personas.values()) {
      persona.dispose();
    }

    // クリーンアップ
    this.personas.clear();
    this.activePersonas.clear();
    this.selectionCache.clear();
    this.metrics.clear();
    this.removeAllListeners();
  }
}

export default PersonaManager;