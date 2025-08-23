/**
 * AIペルソナ関連の型定義
 */

export type PersonaType = 
  | 'backend-architect' | 'frontend-expert' | 'devops-engineer' 
  | 'security-specialist' | 'performance-expert' | 'qa-engineer' 
  | 'database-expert' | 'technical-writer' | 'generic';

export type ExpertiseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface AIPersona {
  id: string;
  name: string;
  type: PersonaType;
  description: string;
  expertise: ExpertiseArea[];
  activationTriggers: Trigger[];
  responseStyle: import('./core').ResponseStyle;
  capabilities: Capability[];
  knowledgeBase: KnowledgeBase;
}

export interface ExpertiseArea {
  domain: string;
  level: ExpertiseLevel;
  technologies: string[];
  patterns: string[];
}

export interface Trigger {
  type: 'file-pattern' | 'content-pattern' | 'command-pattern' | 'context-pattern';
  pattern: string;
  weight: number;
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
  value: any;
}

export interface Capability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  requirements: string[];
}

export interface KnowledgeBase {
  patterns: Pattern[];
  bestPractices: BestPractice[];
  templates: Template[];
  examples: Example[];
}

export interface Pattern {
  name: string;
  description: string;
  applicableContexts: string[];
  implementation: string;
  pros: string[];
  cons: string[];
}

export interface BestPractice {
  title: string;
  description: string;
  category: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  applicableScenarios: string[];
}

export interface Template {
  name: string;
  description: string;
  category: string;
  variables: TemplateVariable[];
  content: string;
}

export interface TemplateVariable {
  name: string;
  type: string;
  description: string;
  defaultValue?: any;
  required: boolean;
}

export interface Example {
  title: string;
  description: string;
  context: string;
  input: string;
  output: string;
  explanation: string;
}

export interface PersonaContext {
  trigger: ActivationTrigger;
  projectContext: import('./project').ProjectContext;
  activePersonas?: string[];
  command?: string;
  timestamp: Date;
}

export interface ActivationTrigger {
  type: 'command' | 'file-change' | 'error' | 'manual' | 'scheduled';
  data: Record<string, any>;
  timestamp: Date;
}

export interface PersonaResponse {
  success: boolean;
  output: string;
  error?: string;
  metadata: PersonaResponseMetadata;
}

export interface PersonaResponseMetadata {
  personaId: string;
  timestamp: Date;
  processingTime: number;
  confidence?: number;
  reasoning?: string;
}

export interface PersonaCapability {
  name: string;
  description: string;
  category: string;
  supported: boolean;
}

export interface PersonaAlternative {
  persona: AIPersona;
  confidence: number;
  reason: string;
}

export interface Specialization {
  area: string;
  confidence: number;
  evidence: string[];
}

export interface ActivationRecord {
  persona: string;
  timestamp: Date;
  confidence: number;
  context: string;
  duration: number;
}