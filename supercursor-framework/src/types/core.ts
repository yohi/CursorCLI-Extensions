/**
 * フレームワークのコア型定義
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export type OutputFormat = 'text' | 'json' | 'stream-json';

export type CacheProvider = 'memory' | 'file' | 'redis';

export type EvictionPolicy = 'lru' | 'lfu' | 'ttl';

export interface FrameworkConfig {
  version: string;
  logLevel: LogLevel;
  outputFormat: OutputFormat;
  cache: CacheConfiguration;
  permissions: PermissionConfiguration;
  integrations: IntegrationConfiguration;
  personas: PersonaConfiguration;
}

export interface CacheConfiguration {
  providers: CacheProvider[];
  defaultTTL: number;
  maxSize: number;
  evictionPolicy: EvictionPolicy;
}

export interface PermissionConfiguration {
  allowedPaths: string[];
  deniedPaths: string[];
  allowFileOperations: boolean;
  allowSystemOperations: boolean;
  maxFileSize: number;
}

export interface IntegrationConfiguration {
  cursor: CursorIntegrationConfig;
  git: GitIntegrationConfig;
  ci: CIIntegrationConfig;
}

export interface CursorIntegrationConfig {
  apiEndpoint?: string;
  timeout: number;
  retryAttempts: number;
}

export interface GitIntegrationConfig {
  enabled: boolean;
  autoCommit: boolean;
  commitMessageTemplate: string;
}

export interface CIIntegrationConfig {
  platforms: string[];
  webhooks: WebhookConfig[];
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
}

export interface PersonaConfiguration {
  autoActivation: boolean;
  confidenceThreshold: number;
  fallbackPersona: string;
  customPersonas: CustomPersonaConfig[];
}

export interface CustomPersonaConfig {
  id: string;
  name: string;
  description: string;
  activationTriggers: string[];
  responseStyle: ResponseStyle;
}

export interface ResponseStyle {
  tone: 'professional' | 'casual' | 'technical';
  verbosity: 'brief' | 'detailed' | 'comprehensive';
  format: 'structured' | 'narrative' | 'checklist';
}