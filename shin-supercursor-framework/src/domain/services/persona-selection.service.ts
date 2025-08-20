/**
 * SuperCursor Framework - ペルソナ選択ドメインサービス
 * ビジネスロジックとしてのペルソナ選択アルゴリズム
 */

import {
  PersonaId,
  SessionId,
  DeepReadonly,
  createTimestamp
} from '../types/index.js';

import {
  AIPersona,
  PersonaType,
  ExpertiseLevel,
  PersonaContext,
  PersonaSelectionResult,
  PersonaCandidate,
  Trigger,
  TriggerType,
  calculatePersonaMatch
} from '../types/personas.js';

import {
  ExecutionContext
} from '../types/commands.js';

import { PersonaRepository } from '../repositories/persona.repository.js';

/**
 * ペルソナ選択戦略
 */
export enum PersonaSelectionStrategy {
  CONFIDENCE_BASED = 'confidence_based',    // 信頼度ベース
  EXPERIENCE_BASED = 'experience_based',    // 経験レベルベース
  TECHNOLOGY_MATCH = 'technology_match',    // 技術マッチング
  HYBRID = 'hybrid',                        // ハイブリッド
  LEARNING_OPTIMIZED = 'learning_optimized' // 学習最適化
}

/**
 * 選択設定
 */
export interface PersonaSelectionConfig {
  readonly strategy: PersonaSelectionStrategy;
  readonly minConfidenceThreshold: number;
  readonly maxCandidates: number;
  readonly enableFallback: boolean;
  readonly fallbackPersonaId?: PersonaId;
  readonly weightings: SelectionWeightings;
}

export interface SelectionWeightings {
  readonly technologyMatch: number;
  readonly expertiseLevel: number;
  readonly pastPerformance: number;
  readonly userPreference: number;
  readonly projectType: number;
  readonly timeOfDay: number;
}

/**
 * ペルソナ選択ドメインサービス
 */
export class PersonaSelectionService {
  private readonly defaultConfig: PersonaSelectionConfig = {
    strategy: PersonaSelectionStrategy.HYBRID,
    minConfidenceThreshold: 0.7,
    maxCandidates: 5,
    enableFallback: true,
    weightings: {
      technologyMatch: 0.3,
      expertiseLevel: 0.25,
      pastPerformance: 0.2,
      userPreference: 0.15,
      projectType: 0.07,
      timeOfDay: 0.03
    }
  };

  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly config: Partial<PersonaSelectionConfig> = {}
  ) {}

  /**
   * コンテキストに基づいてペルソナを選択
   */
  async selectPersona(
    executionContext: ExecutionContext,
    config?: Partial<PersonaSelectionConfig>
  ): Promise<PersonaSelectionResult> {
    const startTime = Date.now();
    const selectionConfig = { ...this.defaultConfig, ...this.config, ...config };

    try {
      // 1. 候補ペルソナを取得
      const candidates = await this.getCandidatePersonas(executionContext, selectionConfig);

      // 2. 各候補をスコアリング
      const scoredCandidates = await this.scoreCandidates(
        candidates,
        executionContext,
        selectionConfig
      );

      // 3. 最適なペルソナを選択
      const selectedPersona = this.selectBestCandidate(scoredCandidates, selectionConfig);

      // 4. フォールバック処理
      const finalPersona = selectedPersona || await this.getFallbackPersona(selectionConfig);

      const selectionTime = Date.now() - startTime;

      // Find confidence for the selected persona
      const selectedCandidate = scoredCandidates.find(c => 
        c.persona.id === selectedPersona?.id
      );
      const selectedConfidence = selectedCandidate?.confidence || 0;

      // Create alternatives list excluding the selected persona
      const alternatives = scoredCandidates
        .filter(c => c.persona.id !== selectedPersona?.id)
        .slice(0, selectionConfig.maxCandidates - 1);

      return {
        success: finalPersona !== null,
        selectedPersona: finalPersona || undefined,
        confidence: selectedPersona ? selectedConfidence : 0,
        reasoning: this.generateReasoning(selectedPersona, scoredCandidates, selectionConfig),
        alternatives,
        fallback: !selectedPersona ? finalPersona : undefined,
        selectionTime
      };

    } catch (error) {
      return {
        success: false,
        confidence: 0,
        reasoning: `ペルソナ選択エラー: ${error.message}`,
        alternatives: [],
        selectionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 複数のペルソナを組み合わせて選択
   */
  async selectPersonaEnsemble(
    executionContext: ExecutionContext,
    maxPersonas: number = 3,
    config?: Partial<PersonaSelectionConfig>
  ): Promise<{
    personas: AIPersona[];
    combinedConfidence: number;
    reasoning: string;
  }> {
    const selectionConfig = { ...this.defaultConfig, ...this.config, ...config };
    
    // 候補を取得してスコアリング
    const candidates = await this.getCandidatePersonas(executionContext, selectionConfig);
    const scoredCandidates = await this.scoreCandidates(
      candidates,
      executionContext,
      selectionConfig
    );

    // 相互補完的なペルソナの組み合わせを選択
    const selectedPersonas = this.selectComplementaryPersonas(
      scoredCandidates,
      maxPersonas
    );

    const combinedConfidence = this.calculateCombinedConfidence(selectedPersonas);

    return {
      personas: selectedPersonas.map(c => c.persona),
      combinedConfidence,
      reasoning: this.generateEnsembleReasoning(selectedPersonas)
    };
  }

  /**
   * 候補ペルソナを取得
   */
  private async getCandidatePersonas(
    context: ExecutionContext,
    config: PersonaSelectionConfig
  ): Promise<AIPersona[]> {
    const candidates: AIPersona[] = [];

    // 技術スタックベースの候補
    const projectTechnologies = context.project.technologies.frameworks.map(f => f.name);
    for (const tech of projectTechnologies) {
      const techPersonas = await this.personaRepository.findByTechnology(tech);
      candidates.push(...techPersonas);
    }

    // プロジェクトタイプベースの候補
    const typePersonas = await this.getPersonasByProjectType(context.project.type);
    candidates.push(...typePersonas);

    // アクティブなペルソナ
    const activePersonas = await this.personaRepository.findAllActive();
    candidates.push(...activePersonas);

    // 重複を除去
    const uniqueCandidates = Array.from(
      new Map(candidates.map(p => [p.id, p])).values()
    );

    return uniqueCandidates;
  }

  /**
   * 候補をスコアリング
   */
  private async scoreCandidates(
    candidates: AIPersona[],
    context: ExecutionContext,
    config: PersonaSelectionConfig
  ): Promise<PersonaCandidate[]> {
    const scoredCandidates: PersonaCandidate[] = [];

    for (const persona of candidates) {
      const confidence = await this.calculatePersonaConfidence(persona, context, config);
      const reasoning = this.generatePersonaReasoning(persona, context, confidence);
      const triggeredBy = this.getTriggeredBy(persona, context);

      if (confidence >= config.minConfidenceThreshold) {
        scoredCandidates.push({
          persona,
          confidence,
          reasoning,
          triggeredBy
        });
      }
    }

    // 信頼度でソート
    return scoredCandidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * ペルソナの信頼度を計算
   */
  private async calculatePersonaConfidence(
    persona: AIPersona,
    context: ExecutionContext,
    config: PersonaSelectionConfig
  ): Promise<number> {
    const weights = config.weightings;
    let totalScore = 0;

    // 技術マッチング
    const techScore = this.calculateTechnologyMatch(persona, context);
    totalScore += techScore * weights.technologyMatch;

    // 専門レベル
    const expertiseScore = this.calculateExpertiseMatch(persona, context);
    totalScore += expertiseScore * weights.expertiseLevel;

    // 過去のパフォーマンス
    const performanceScore = await this.calculatePastPerformance(persona, context);
    totalScore += performanceScore * weights.pastPerformance;

    // ユーザー設定
    const userScore = this.calculateUserPreference(persona, context);
    totalScore += userScore * weights.userPreference;

    // プロジェクトタイプ
    const projectScore = this.calculateProjectTypeMatch(persona, context);
    totalScore += projectScore * weights.projectType;

    // 時間要素
    const timeScore = this.calculateTimeBonus(persona, context);
    totalScore += timeScore * weights.timeOfDay;

    return Math.min(Math.max(totalScore, 0), 1);
  }

  /**
   * 技術マッチングスコアを計算
   */
  private calculateTechnologyMatch(persona: AIPersona, context: ExecutionContext): number {
    const projectTechnologies = new Set([
      ...context.project.technologies.frameworks.map(f => f.name.toLowerCase()),
      ...context.project.technologies.languages.map(l => l.name.toLowerCase())
    ]);

    if (projectTechnologies.size === 0) return 0.5; // 中性的なスコア

    let matchCount = 0;
    let totalExpertise = 0;

    for (const expertise of persona.expertise) {
      for (const tech of expertise.technologies) {
        if (projectTechnologies.has(tech.toLowerCase())) {
          matchCount++;
          totalExpertise += this.getExpertiseLevelScore(expertise.level);
        }
      }
    }

    if (matchCount === 0) return 0;

    const averageExpertise = totalExpertise / matchCount;
    const coverageRatio = matchCount / projectTechnologies.size;

    return (averageExpertise * 0.7) + (coverageRatio * 0.3);
  }

  /**
   * 専門性マッチングスコアを計算
   */
  private calculateExpertiseMatch(persona: AIPersona, context: ExecutionContext): number {
    const projectComplexity = this.estimateProjectComplexity(context);
    const averageExpertiseLevel = this.getAverageExpertiseLevel(persona);

    // プロジェクトの複雑度とペルソナの専門レベルのマッチング
    const complexityScore = Math.abs(projectComplexity - averageExpertiseLevel);
    return Math.max(0, 1 - (complexityScore / 4)); // 4レベル差で0になる
  }

  /**
   * 過去のパフォーマンススコアを計算
   */
  private async calculatePastPerformance(
    persona: AIPersona,
    context: ExecutionContext
  ): Promise<number> {
    try {
      // 過去のインタラクション履歴から計算
      const userHistory = await this.personaRepository.getUserHistory(context.user.id);
      const personaInteractions = userHistory.filter(h => h.personaId === persona.id);

      if (personaInteractions.length === 0) return 0.5; // 中性的なスコア

      const successRate = personaInteractions.filter(i => i.success).length / personaInteractions.length;
      const averageSatisfaction = personaInteractions.reduce((sum, i) => 
        sum + (i.userSatisfaction || 0), 0) / personaInteractions.length;

      return (successRate * 0.6) + (averageSatisfaction / 5 * 0.4); // 5点満点を1点満点に正規化
    } catch {
      return 0.5; // エラー時は中性的なスコア
    }
  }

  /**
   * ユーザー設定スコアを計算
   */
  private calculateUserPreference(persona: AIPersona, context: ExecutionContext): number {
    // ユーザーの経験レベルとペルソナのレスポンススタイルのマッチング
    const userExperience = context.user.profile?.experience || 'intermediate';
    const verbosity = persona.responseStyle.verbosity;

    const experienceMatchScore = this.getExperienceVerbosityMatch(userExperience, verbosity);
    
    // ユーザーの言語設定とペルソナの言語能力
    const languageMatch = persona.responseStyle.customization.language === context.user.preferences.language ? 1 : 0.7;

    return (experienceMatchScore * 0.7) + (languageMatch * 0.3);
  }

  /**
   * プロジェクトタイプマッチングスコアを計算
   */
  private calculateProjectTypeMatch(persona: AIPersona, context: ExecutionContext): number {
    const projectTypeMapping: Record<string, PersonaType[]> = {
      'web_application': [PersonaType.DEVELOPER, PersonaType.DESIGNER, PersonaType.ARCHITECT],
      'api_service': [PersonaType.DEVELOPER, PersonaType.ARCHITECT, PersonaType.DEVOPS],
      'library': [PersonaType.DEVELOPER, PersonaType.ARCHITECT],
      'cli_tool': [PersonaType.DEVELOPER, PersonaType.DEVOPS],
      'microservice': [PersonaType.ARCHITECT, PersonaType.DEVOPS, PersonaType.DEVELOPER]
    };

    const suitableTypes = projectTypeMapping[context.project.type] || [];
    return suitableTypes.includes(persona.type) ? 1 : 0.3;
  }

  /**
   * 時間要素ボーナスを計算
   */
  private calculateTimeBonus(persona: AIPersona, context: ExecutionContext): number {
    const currentHour = new Date().getHours();
    
    // 複雑なタスクは集中しやすい時間帯に高スコア
    if (persona.type === PersonaType.ARCHITECT || persona.type === PersonaType.ANALYST) {
      return (currentHour >= 9 && currentHour <= 11) || (currentHour >= 14 && currentHour <= 16) ? 1 : 0.8;
    }

    // 一般的なペルソナは営業時間内で高スコア
    return (currentHour >= 9 && currentHour <= 17) ? 1 : 0.7;
  }

  /**
   * 最適な候補を選択
   */
  private selectBestCandidate(
    candidates: PersonaCandidate[],
    config: PersonaSelectionConfig
  ): AIPersona | null {
    if (candidates.length === 0) return null;

    switch (config.strategy) {
      case PersonaSelectionStrategy.CONFIDENCE_BASED:
        return candidates[0].persona;
        
      case PersonaSelectionStrategy.LEARNING_OPTIMIZED:
        // 学習のために時々異なる選択肢を試す
        if (Math.random() < 0.1 && candidates.length > 1) {
          return candidates[1].persona;
        }
        return candidates[0].persona;
        
      default:
        return candidates[0].persona;
    }
  }

  /**
   * フォールバックペルソナを取得
   */
  private async getFallbackPersona(config: PersonaSelectionConfig): Promise<AIPersona | null> {
    if (!config.enableFallback) return null;

    if (config.fallbackPersonaId) {
      return await this.personaRepository.findById(config.fallbackPersonaId);
    }

    // デフォルトの汎用ペルソナを探す
    const allPersonas = await this.personaRepository.findAllActive();
    return allPersonas.find(p => p.type === PersonaType.DEVELOPER) || allPersonas[0] || null;
  }

  /**
   * 選択理由を生成
   */
  private generateReasoning(
    selected: AIPersona | null,
    candidates: PersonaCandidate[],
    config: PersonaSelectionConfig
  ): string {
    if (!selected) {
      return '適切なペルソナが見つかりませんでした。';
    }

    const selectedCandidate = candidates.find(c => c.persona.id === selected.id);
    if (!selectedCandidate) {
      return 'フォールバックペルソナが選択されました。';
    }

    const reasons = [
      `信頼度: ${(selectedCandidate.confidence * 100).toFixed(1)}%`,
      `タイプ: ${selected.type}`,
      `専門分野: ${selected.expertise.map(e => e.domain).join(', ')}`
    ];

    return `${selected.name} を選択。${reasons.join(', ')}`;
  }

  // ヘルパーメソッド群
  private async getPersonasByProjectType(projectType: string): Promise<AIPersona[]> {
    if (!projectType) {
      return [];
    }

    // 大文字小文字を無視してプロジェクトタイプに基づいてペルソナを検索
    const allPersonas = await this.personaRepository.findAllActive();
    
    return allPersonas.filter(persona => {
      // ペルソナがプロジェクトタイプをサポートしているかチェック
      // ここでは activationTriggers の中で PROJECT_TYPE トリガーを持つペルソナを検索
      const projectTypeTriggers = persona.activationTriggers.filter(trigger => 
        trigger.type === TriggerType.PROJECT_TYPE
      );
      
      if (projectTypeTriggers.length === 0) {
        // プロジェクトタイプトリガーがない場合は汎用ペルソナとして扱う
        return true;
      }
      
      // プロジェクトタイプが一致するかチェック（大文字小文字を無視）
      return projectTypeTriggers.some(trigger => {
        if (typeof trigger.pattern === 'string') {
          return trigger.pattern.toLowerCase() === projectType.toLowerCase();
        } else if (trigger.pattern && typeof trigger.pattern.test === 'function') {
          // RegExpオブジェクトまたはRegExp-likeオブジェクト
          return trigger.pattern.test(projectType);
        }
        return false;
      });
    });
  }

  private getExpertiseLevelScore(level: ExpertiseLevel): number {
    const scores = {
      [ExpertiseLevel.BEGINNER]: 0.2,
      [ExpertiseLevel.INTERMEDIATE]: 0.4,
      [ExpertiseLevel.ADVANCED]: 0.7,
      [ExpertiseLevel.EXPERT]: 0.9,
      [ExpertiseLevel.MASTER]: 1.0
    };
    return scores[level] || 0.4;
  }

  private estimateProjectComplexity(context: ExecutionContext): number {
    // プロジェクトの複雑度を推定（0-4のスケール）
    let complexity = 1; // ベース複雑度

    if (context.project.technologies.frameworks.length > 3) complexity++;
    if (context.project.dependencies.length > 50) complexity++;
    if (context.project.structure.metrics.totalFiles > 1000) complexity++;

    return Math.min(complexity, 4);
  }

  private getAverageExpertiseLevel(persona: AIPersona): number {
    if (persona.expertise.length === 0) return 2;

    const sum = persona.expertise.reduce((acc, exp) => 
      acc + this.getExpertiseLevelScore(exp.level) * 4, 0);
    return sum / persona.expertise.length;
  }

  private getExperienceVerbosityMatch(experience: string, verbosity: import('../types/index.js').VerbosityLevel): number {
    // 経験レベルと冗長性のマッチングロジック
    const matchMatrix = {
      'beginner': { 'verbose': 1, 'normal': 0.8, 'minimal': 0.3 },
      'intermediate': { 'verbose': 0.7, 'normal': 1, 'minimal': 0.6 },
      'advanced': { 'verbose': 0.5, 'normal': 0.8, 'minimal': 1 },
      'expert': { 'verbose': 0.3, 'normal': 0.6, 'minimal': 1 }
    };

    return matchMatrix[experience]?.[verbosity] || 0.5;
  }

  private generatePersonaReasoning(persona: AIPersona, context: ExecutionContext, confidence: number): string {
    return `信頼度 ${(confidence * 100).toFixed(1)}% - ${persona.type}ペルソナ`;
  }

  private getTriggeredBy(persona: AIPersona, context: ExecutionContext): Trigger[] {
    // 実際のトリガー分析ロジック
    return [];
  }

  private selectComplementaryPersonas(candidates: PersonaCandidate[], maxPersonas: number): PersonaCandidate[] {
    // 相互補完的なペルソナを選択
    return candidates.slice(0, maxPersonas);
  }

  private calculateCombinedConfidence(personas: PersonaCandidate[]): number {
    if (personas.length === 0) return 0;
    return personas.reduce((sum, p) => sum + p.confidence, 0) / personas.length;
  }

  private generateEnsembleReasoning(personas: PersonaCandidate[]): string {
    return `${personas.length}個のペルソナを組み合わせて選択`;
  }
}