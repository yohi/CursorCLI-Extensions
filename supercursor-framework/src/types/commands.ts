/**
 * コマンド関連の型定義
 */

export type CommandType = 
  | 'implement' | 'analyze' | 'build' | 'design' | 'test' 
  | 'document' | 'troubleshoot' | 'improve' | 'cleanup' 
  | 'git' | 'estimate' | 'task' | 'index' | 'load' | 'spawn';

export interface Command {
  type: CommandType;
  name: string;
  description: string;
  arguments: CommandArgument[];
  options: CommandOption[];
  examples: CommandExample[];
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array';
  validation?: ValidationRule;
}

export interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue?: any;
}

export interface CommandExample {
  command: string;
  description: string;
  output?: string;
}

export interface ValidationRule {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
}

export interface CommandContext {
  command: string;
  arguments: string[];
  options: Record<string, any>;
  workingDirectory: string;
  user: UserContext;
  project: import('./project').ProjectContext;
  session: SessionContext;
}

export interface UserContext {
  id: string;
  name: string;
  preferences: UserPreferences;
  permissions: string[];
}

export interface UserPreferences {
  outputFormat: string;
  verbosity: string;
  autoSave: boolean;
  confirmActions: boolean;
}

export interface SessionContext {
  id: string;
  startTime: Date;
  history: CommandHistory[];
  cache: SessionCache;
}

export interface CommandHistory {
  command: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  output?: string | undefined;
  error?: string | undefined;
}

export interface SessionCache {
  [key: string]: any;
}

export interface CommandResult {
  success: boolean;
  output: any;
  error?: string | undefined;
  metadata: CommandMetadata;
}

export interface CommandMetadata {
  executionTime: number;
  resourceUsage: ResourceUsage;
  persona?: string;
  confidence?: number;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  diskIO: number;
  networkIO: number;
}