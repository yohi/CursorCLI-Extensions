/**
 * SuperCursor Framework - ペルソナ関連型定義
 * Framework-1とFramework-2のペルソナ型を統合
 */

import {
  PersonaId,
  SessionId,
  CommandId,
  UserId,
  Timestamp,
  ParameterType,
  VerbosityLevel,
  DeepReadonly,
  BaseEntity,
  NonEmptyArray,
  isPersonaId
} from './base.js';

import { Command, ExecutionContext } from './commands.js';

// ==========================================
// ペルソナ基本定義
// ==========================================

export interface AIPersona extends BaseEntity<PersonaId> {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly type: PersonaType;
  readonly version: string;
  readonly expertise: readonly ExpertiseArea[];
  readonly capabilities: readonly Capability[];
  readonly activationTriggers: readonly Trigger[];
  readonly responseStyle: ResponseStyle;
  readonly configuration: PersonaConfiguration;
  readonly metadata: PersonaMetadata;
}

export enum PersonaType {
  ARCHITECT = 'architect',
  DEVELOPER = 'developer',
  TESTER = 'tester',
  DEVOPS = 'devops',
  ANALYST = 'analyst',
  DESIGNER = 'designer',
  REVIEWER = 'reviewer',
  OPTIMIZER = 'optimizer'
}

// ==========================================
// 専門領域
// ==========================================

export interface ExpertiseArea {
  readonly domain: string;
  readonly level: ExpertiseLevel;
  readonly technologies: readonly string[];
  readonly patterns: readonly string[];
  readonly methodologies: readonly string[];
  readonly confidence: number;
}

export enum ExpertiseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
  MASTER = 'master'
}

// ==========================================
// 能力定義
// ==========================================

export interface Capability {
  readonly name: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly prerequisites: readonly string[];
  readonly parameters: readonly CapabilityParameter[];
  readonly outputs: readonly CapabilityOutput[];
  readonly confidence: number;
  readonly resourceRequirements: ResourceRequirements;
}

export enum CapabilityCategory {
  ANALYSIS = 'analysis',
  GENERATION = 'generation',
  OPTIMIZATION = 'optimization',
  VALIDATION = 'validation',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  DEBUGGING = 'debugging'
}

export interface CapabilityParameter {
  readonly name: string;
  readonly type: ParameterType;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: unknown;
  readonly validation?: ParameterValidation;
}

export interface ParameterValidation {
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
  readonly allowedValues?: readonly unknown[];
}

export interface CapabilityOutput {
  readonly name: string;
  readonly type: ParameterType;
  readonly description: string;
  readonly schema?: unknown;
}

export interface ResourceRequirements {
  readonly memory: number;
  readonly cpu: number;
  readonly timeComplexity: ComplexityLevel;
  readonly spaceComplexity: ComplexityLevel;
}

export enum ComplexityLevel {
  CONSTANT = 'O(1)',
  LOGARITHMIC = 'O(log n)',
  LINEAR = 'O(n)',
  LINEARITHMIC = 'O(n log n)',
  QUADRATIC = 'O(n²)',
  EXPONENTIAL = 'O(2^n)'
}

// ==========================================
// アクティベーショントリガー
// ==========================================

export interface Trigger {
  readonly type: TriggerType;
  readonly pattern: string | RegExp;
  readonly weight: number;
  readonly context?: TriggerContext;
  readonly conditions?: readonly TriggerCondition[];
}

export enum TriggerType {
  FILE_PATTERN = 'file_pattern',
  CODE_PATTERN = 'code_pattern',
  COMMAND_PATTERN = 'command_pattern',
  KEYWORD = 'keyword',
  TECHNOLOGY = 'technology',
  PROJECT_TYPE = 'project_type',
  USER_PREFERENCE = 'user_preference'
}

export interface TriggerContext {
  readonly fileTypes?: readonly string[];
  readonly directories?: readonly string[];
  readonly technologies?: readonly string[];
  readonly timeOfDay?: TimeRange;
  readonly userExperience?: ExpertiseLevel;
}

export interface TriggerCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: unknown;
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  MATCHES = 'matches',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than'
}

export interface TimeRange {
  readonly start: string;
  readonly end: string;
  readonly timezone?: string;
}

// ==========================================
// レスポンススタイル
// ==========================================

export interface ResponseStyle {
  readonly tone: ResponseTone;
  readonly verbosity: VerbosityLevel;
  readonly format: ResponseFormat;
  readonly includeExamples: boolean;
  readonly includeExplanations: boolean;
  readonly includeReferences: boolean;
  readonly customization: StyleCustomization;
}

export enum ResponseTone {
  FORMAL = 'formal',
  CASUAL = 'casual',
  TECHNICAL = 'technical',
  FRIENDLY = 'friendly',
  EDUCATIONAL = 'educational',
  PROFESSIONAL = 'professional'
}

export enum ResponseFormat {
  STRUCTURED = 'structured',
  NARRATIVE = 'narrative',
  BULLET_POINTS = 'bullet_points',
  CODE_FOCUSED = 'code_focused',
  STEP_BY_STEP = 'step_by_step'
}

export interface StyleCustomization {
  readonly useEmojis: boolean;
  readonly includeMetrics: boolean;
  readonly showProgress: boolean;
  readonly highlightImportant: boolean;
  readonly language: string;
}

// ==========================================
// ペルソナ設定
// ==========================================

export interface PersonaConfiguration {
  readonly active: boolean;
  readonly priority: PersonaPriority;
  readonly learningEnabled: boolean;
  readonly adaptationRate: number;
  readonly confidenceThreshold: number;
  readonly fallbackPersona?: PersonaId;
  readonly restrictions: readonly PersonaRestriction[];
  readonly customProperties: DeepReadonly<Record<string, unknown>>;
}

export enum PersonaPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PersonaRestriction {
  readonly type: RestrictionType;
  readonly value: unknown;
  readonly reason: string;
}

export enum RestrictionType {
  FILE_ACCESS = 'file_access',
  COMMAND_EXECUTION = 'command_execution',
  NETWORK_ACCESS = 'network_access',
  SYSTEM_ACCESS = 'system_access',
  RESOURCE_LIMIT = 'resource_limit'
}

// ==========================================
// ペルソナメタデータ
// ==========================================

export interface PersonaMetadata {
  readonly author: string;
  readonly maintainer: string;
  readonly license: string;
  readonly homepage?: string;
  readonly repository?: string;
  readonly documentation?: string;
  readonly tags: readonly string[];
  readonly category: string;
  readonly maturityLevel: MaturityLevel;
}

export enum MaturityLevel {
  EXPERIMENTAL = 'experimental',
  ALPHA = 'alpha',
  BETA = 'beta',
  STABLE = 'stable',
  MATURE = 'mature',
  DEPRECATED = 'deprecated'
}

// ==========================================
// ペルソナコンテキスト
// ==========================================

export interface PersonaContext {
  readonly sessionId: SessionId;
  readonly activePersona?: AIPersona;
  readonly confidence: number;
  readonly reasoning: string;
  readonly alternatives: readonly PersonaCandidate[];
  readonly executionContext: ExecutionContext;
  readonly learningData?: LearningData;
}

export interface PersonaCandidate {
  readonly persona: AIPersona;
  readonly confidence: number;
  readonly reasoning: string;
  readonly triggeredBy: readonly Trigger[];
}

export interface LearningData {
  readonly interactions: readonly PersonaInteraction[];
  readonly feedbacks: readonly PersonaFeedback[];
  readonly adaptations: readonly PersonaAdaptation[];
}

export interface PersonaInteraction {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly commandId: CommandId;
  readonly personaId: PersonaId;
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly duration: number;
  readonly success: boolean;
  readonly userSatisfaction?: number;
}

export interface PersonaFeedback {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly personaId: PersonaId;
  readonly userId: UserId;
  readonly rating: number;
  readonly comment?: string;
  readonly categories: readonly FeedbackCategory[];
}

export enum FeedbackCategory {
  ACCURACY = 'accuracy',
  HELPFULNESS = 'helpfulness',
  CLARITY = 'clarity',
  SPEED = 'speed',
  COMPLETENESS = 'completeness'
}

export interface PersonaAdaptation {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly personaId: PersonaId;
  readonly changes: readonly AdaptationChange[];
  readonly reason: string;
  readonly impact: number;
}

export interface AdaptationChange {
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly confidence: number;
}

// ==========================================
// ペルソナマネージャー
// ==========================================

export interface PersonaManager {
  analyzeContext(context: ExecutionContext): Promise<PersonaContext>;
  selectPersona(context: PersonaContext): Promise<PersonaSelectionResult>;
  activatePersona(personaId: PersonaId, context: ExecutionContext): Promise<PersonaActivationResult>;
  deactivatePersona(sessionId: SessionId): Promise<boolean>;
  
  switchPersona(sessionId: SessionId, newPersonaId: PersonaId): Promise<PersonaSwitchResult>;
  getActivePersona(sessionId: SessionId): Promise<AIPersona | null>;
  
  registerPersona(persona: AIPersona): Promise<void>;
  unregisterPersona(personaId: PersonaId): Promise<boolean>;
  updatePersona(personaId: PersonaId, updates: Partial<AIPersona>): Promise<AIPersona>;
  
  listAvailablePersonas(filter?: PersonaFilter): Promise<readonly AIPersona[]>;
  searchPersonas(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]>;
  
  learnFromInteraction(interaction: PersonaInteraction): Promise<void>;
  provideFeedback(feedback: PersonaFeedback): Promise<void>;
}

export interface PersonaFilter {
  readonly types?: readonly PersonaType[];
  readonly expertiseDomains?: readonly string[];
  readonly technologies?: readonly string[];
  readonly minConfidence?: number;
  readonly active?: boolean;
}

export interface PersonaSearchQuery {
  readonly query: string;
  readonly filters?: PersonaFilter;
  readonly limit?: number;
  readonly sortBy?: PersonaSortField;
  readonly sortOrder?: SortOrder;
}

export enum PersonaSortField {
  NAME = 'name',
  CONFIDENCE = 'confidence',
  USAGE_COUNT = 'usage_count',
  LAST_USED = 'last_used',
  RATING = 'rating'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export interface PersonaSearchResult {
  readonly persona: AIPersona;
  readonly relevanceScore: number;
  readonly matchedFields: readonly string[];
}

// ==========================================
// ペルソナ選択・アクティベーション結果
// ==========================================

export interface PersonaSelectionResult {
  readonly success: boolean;
  readonly selectedPersona?: AIPersona;
  readonly confidence: number;
  readonly reasoning: string;
  readonly alternatives: readonly PersonaCandidate[];
  readonly fallback?: AIPersona;
  readonly selectionTime: number;
}

export interface PersonaActivationResult {
  readonly success: boolean;
  readonly persona: AIPersona;
  readonly confidence: number;
  readonly reasoning: string;
  readonly activationTime: number;
  readonly resources: ResourceUsage;
  readonly warnings?: readonly string[];
}

export interface PersonaSwitchResult {
  readonly success: boolean;
  readonly previousPersona?: AIPersona;
  readonly newPersona: AIPersona;
  readonly reason: string;
  readonly switchTime: number;
  readonly preservedContext?: unknown;
}

// ==========================================
// ペルソナファクトリー
// ==========================================

export interface PersonaFactory {
  createPersona(specification: PersonaSpecification): Promise<AIPersona>;
  clonePersona(personaId: PersonaId, customizations?: PersonaCustomization): Promise<AIPersona>;
  validatePersona(persona: AIPersona): Promise<PersonaValidationResult>;
  buildFromTemplate(template: PersonaTemplate, parameters: TemplateParameters): Promise<AIPersona>;
}

export interface PersonaSpecification {
  readonly name: string;
  readonly type: PersonaType;
  readonly expertise: readonly ExpertiseArea[];
  readonly capabilities: readonly string[];
  readonly responseStyle?: Partial<ResponseStyle>;
  readonly configuration?: Partial<PersonaConfiguration>;
}

export interface PersonaCustomization {
  readonly name?: string;
  readonly responseStyle?: Partial<ResponseStyle>;
  readonly configuration?: Partial<PersonaConfiguration>;
  readonly additionalCapabilities?: readonly string[];
}

export interface PersonaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly suggestions: readonly string[];
}

export interface PersonaTemplate {
  readonly name: string;
  readonly description: string;
  readonly type: PersonaType;
  readonly parameters: readonly TemplateParameter[];
  readonly basePersona: Partial<AIPersona>;
}

export interface TemplateParameter {
  readonly name: string;
  readonly type: ParameterType;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: unknown;
}

export type TemplateParameters = Record<string, unknown>;

// ==========================================
// 型ガード
// ==========================================



export function isAIPersona(value: unknown): value is AIPersona {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    isPersonaId((value as AIPersona).id)
  );
}

export function hasCapability(persona: AIPersona, capabilityName: string): boolean {
  return persona.capabilities.some(cap => cap.name === capabilityName);
}

export function hasExpertise(persona: AIPersona, domain: string, minLevel: ExpertiseLevel = ExpertiseLevel.INTERMEDIATE): boolean {
  return persona.expertise.some(exp => 
    exp.domain === domain && 
    getExpertiseLevelOrder(exp.level) >= getExpertiseLevelOrder(minLevel)
  );
}

function getExpertiseLevelOrder(level: ExpertiseLevel): number {
  const order = {
    [ExpertiseLevel.BEGINNER]: 1,
    [ExpertiseLevel.INTERMEDIATE]: 2,
    [ExpertiseLevel.ADVANCED]: 3,
    [ExpertiseLevel.EXPERT]: 4,
    [ExpertiseLevel.MASTER]: 5
  };
  return order[level] || 0;
}

// ==========================================
// ペルソナ統計情報
// ==========================================

export interface PersonaStatistics {
  readonly totalPersonas: number;
  readonly activePersonas: number;
  readonly archivedPersonas: number;
  readonly personasByType: Record<PersonaType, number>;
  readonly averageRating: number;
  readonly totalUsage: number;
  readonly lastUpdated: Timestamp;
}

// ==========================================
// ユーティリティ関数
// ==========================================

export function calculatePersonaMatch(persona: AIPersona, context: ExecutionContext): number {
  let score = 0;
  let factors = 0;

  // 技術スタック一致度
  const projectTechnologies = context.project.technologies.frameworks.map(f => f.name.toLowerCase());
  const personaTechnologies = persona.expertise.flatMap(e => e.technologies.map(t => t.toLowerCase()));
  
  const techMatches = projectTechnologies.filter(tech => 
    personaTechnologies.some(pTech => pTech.includes(tech) || tech.includes(pTech))
  ).length;
  
  if (projectTechnologies.length > 0) {
    score += (techMatches / projectTechnologies.length) * 0.4;
    factors++;
  }

  // その他の要因も追加可能
  // ...

  return factors > 0 ? score / factors : 0;
}