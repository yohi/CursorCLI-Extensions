// ベースクラスとエラー
export { BasePersona, PersonaError, PersonaConfig } from './base-persona.js';

// ペルソナマネージャー
export { 
  PersonaManager, 
  PersonaManagerError, 
  PersonaManagerConfig 
} from './persona-manager.js';

// ペルソナファクトリー
export { 
  PersonaFactory, 
  PersonaFactoryConfig, 
  PersonaInfo 
} from './persona-factory.js';

// 特殊ペルソナクラス
export { BackendArchitectPersona } from './specialized/backend-architect-persona.js';
export { FrontendExpertPersona } from './specialized/frontend-expert-persona.js';
export { DevOpsEngineerPersona } from './specialized/devops-engineer-persona.js';
export { SecuritySpecialistPersona } from './specialized/security-specialist-persona.js';

// 型エクスポート
export type {
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

export type {
  PersonaManager as IPersonaManager,
  PersonaExecutor,
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
  CacheManager,
  PromptTemplate,
  ResponseAnalysis,
  LearningOutcome,
  PerformanceMetrics
} from '../core/interfaces.js';