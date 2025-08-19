import {
  ProjectContext,
  CommandContext,
  PersonaContext,
  AIPersona,
  SessionContext,
  FrameworkError,
  OutputFormat,
  CacheEntry,
  Permission,
  UserContext,
  Configuration
} from '../types/index.js';

// コマンドルーター インターフェース
export interface CommandRouter {
  parseCommand(input: string): Promise<ParsedCommand>;
  validateCommand(command: ParsedCommand): Promise<ValidationResult>;
  routeCommand(command: ParsedCommand, context: CommandContext): Promise<CommandResult>;
  registerCommand(handler: CommandHandler): Promise<void>;
  getCommandHistory(sessionId: string): Promise<CommandHistory[]>;
}

export interface ParsedCommand {
  name: string;
  subcommand?: string;
  arguments: string[];
  options: Record<string, any>;
  raw: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface CommandResult {
  success: boolean;
  output: any;
  format: OutputFormat;
  metadata: CommandMetadata;
  errors?: FrameworkError[];
}

export interface CommandMetadata {
  executionTime: number;
  persona?: string;
  cacheHit: boolean;
  resourcesUsed: ResourceUsage;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  diskIO: number;
  networkIO: number;
}

// コマンドハンドラー インターフェース
export interface CommandHandler {
  name: string;
  description: string;
  aliases: string[];
  parameters: CommandParameter[];
  execute(context: CommandContext): Promise<CommandResult>;
  validate?(context: CommandContext): Promise<ValidationResult>;
  canHandle(command: ParsedCommand): boolean;
}

export interface CommandParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  defaultValue?: any;
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  FILE = 'file',
  DIRECTORY = 'directory'
}

export interface CommandHistory {
  id: string;
  command: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  output?: any;
  error?: string;
}

// ペルソナマネージャー インターフェース
export interface PersonaManager {
  analyzeContext(context: CommandContext): Promise<PersonaContext>;
  selectPersona(context: PersonaContext): Promise<AIPersona>;
  activatePersona(persona: AIPersona, context: CommandContext): Promise<PersonaActivationResult>;
  getActivePersona(sessionId: string): Promise<AIPersona | null>;
  switchPersona(sessionId: string, newPersona: AIPersona): Promise<PersonaSwitchResult>;
  registerPersona(persona: AIPersona): Promise<void>;
  listAvailablePersonas(): Promise<AIPersona[]>;
}

export interface PersonaActivationResult {
  success: boolean;
  persona: AIPersona;
  confidence: number;
  reasoning: string;
  fallback?: AIPersona;
}

export interface PersonaSwitchResult {
  success: boolean;
  previousPersona: AIPersona;
  newPersona: AIPersona;
  reason: string;
}

// コンテキストアナライザー インターフェース
export interface ContextAnalyzer {
  analyzeProject(rootPath: string): Promise<ProjectContext>;
  detectTechnologyStack(projectPath: string): Promise<TechnologyStack>;
  identifyPatterns(files: string[]): Promise<PatternAnalysis>;
  buildKnowledgeGraph(project: ProjectContext): Promise<KnowledgeGraph>;
  updateContext(context: ProjectContext, changes: ContextChange[]): Promise<ProjectContext>;
}

export interface TechnologyStack {
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  tools: DetectedTool[];
  databases: DetectedDatabase[];
}

export interface DetectedLanguage {
  name: string;
  version?: string;
  confidence: number;
  fileCount: number;
  evidence: Evidence[];
}

export interface DetectedFramework {
  name: string;
  version?: string;
  confidence: number;
  configFiles: string[];
  evidence: Evidence[];
}

export interface DetectedTool {
  name: string;
  version?: string;
  confidence: number;
  configFile?: string;
  evidence: Evidence[];
}

export interface DetectedDatabase {
  name: string;
  type: string;
  confidence: number;
  evidence: Evidence[];
}

export interface Evidence {
  type: EvidenceType;
  source: string;
  content: string;
  weight: number;
}

export enum EvidenceType {
  FILE_EXTENSION = 'file_extension',
  PACKAGE_JSON = 'package_json',
  CONFIG_FILE = 'config_file',
  IMPORT_STATEMENT = 'import_statement',
  COMMENT = 'comment',
  DIRECTORY_STRUCTURE = 'directory_structure'
}

export interface PatternAnalysis {
  architecturalPatterns: ArchitecturalPattern[];
  designPatterns: DesignPattern[];
  codePatterns: CodePattern[];
}

export interface ArchitecturalPattern {
  name: string;
  confidence: number;
  evidence: string[];
  description: string;
}

export interface DesignPattern {
  name: string;
  confidence: number;
  location: string;
  implementation: string;
}

export interface CodePattern {
  name: string;
  occurrences: number;
  locations: string[];
  suggestion?: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
}

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  name: string;
  properties: Record<string, any>;
}

export enum NodeType {
  FILE = 'file',
  CLASS = 'class',
  FUNCTION = 'function',
  MODULE = 'module',
  DEPENDENCY = 'dependency',
  CONFIG = 'config'
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, any>;
}

export enum EdgeType {
  IMPORTS = 'imports',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  CALLS = 'calls',
  USES = 'uses',
  CONFIGURES = 'configures'
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  nodes: string[];
  type: ClusterType;
  confidence: number;
}

export enum ClusterType {
  MODULE = 'module',
  FEATURE = 'feature',
  LAYER = 'layer',
  SERVICE = 'service'
}

export interface ContextChange {
  type: ChangeType;
  path: string;
  content?: string;
  metadata?: Record<string, any>;
}

export enum ChangeType {
  FILE_ADDED = 'file_added',
  FILE_MODIFIED = 'file_modified',
  FILE_DELETED = 'file_deleted',
  DEPENDENCY_ADDED = 'dependency_added',
  DEPENDENCY_REMOVED = 'dependency_removed',
  CONFIG_CHANGED = 'config_changed'
}

// 設定マネージャー インターフェース
export interface ConfigManager {
  loadConfiguration(path?: string): Promise<FrameworkConfiguration>;
  validateConfiguration(config: FrameworkConfiguration): Promise<ValidationResult>;
  saveConfiguration(config: FrameworkConfiguration, path?: string): Promise<void>;
  reloadConfiguration(): Promise<void>;
  getEnvironmentConfig(environment: string): Promise<EnvironmentConfiguration>;
  mergeConfigurations(configs: FrameworkConfiguration[]): Promise<FrameworkConfiguration>;
}

export interface FrameworkConfiguration {
  version: string;
  global: GlobalConfiguration;
  commands: CommandConfiguration;
  personas: PersonaConfiguration;
  integrations: IntegrationConfiguration;
  security: SecurityConfiguration;
  performance: PerformanceConfiguration;
}

export interface GlobalConfiguration {
  language: string;
  logLevel: LogLevel;
  outputFormat: OutputFormat;
  cacheEnabled: boolean;
  telemetryEnabled: boolean;
}

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface CommandConfiguration {
  timeout: number;
  retries: number;
  parallel: boolean;
  cache: CacheConfiguration;
}

export interface CacheConfiguration {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  provider: CacheProvider;
}

export enum CacheProvider {
  MEMORY = 'memory',
  REDIS = 'redis',
  FILE = 'file'
}

export interface PersonaConfiguration {
  defaultPersona: string;
  switchingEnabled: boolean;
  confidenceThreshold: number;
  customPersonas: CustomPersona[];
}

export interface CustomPersona {
  id: string;
  name: string;
  config: AIPersona;
  enabled: boolean;
}

export interface IntegrationConfiguration {
  cursor: CursorIntegrationConfig;
  git: GitIntegrationConfig;
  ci: CIIntegrationConfig;
}

export interface CursorIntegrationConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout: number;
  rateLimiting: RateLimitConfig;
}

export interface RateLimitConfig {
  requests: number;
  timeWindow: number;
  burstLimit: number;
}

export interface GitIntegrationConfig {
  autoCommit: boolean;
  commitMessageTemplate: string;
  branchStrategy: BranchStrategy;
}

export enum BranchStrategy {
  MAIN = 'main',
  FEATURE = 'feature',
  DEVELOP = 'develop'
}

export interface CIIntegrationConfig {
  provider: string;
  webhook?: string;
  notifications: NotificationConfig[];
}

export interface NotificationConfig {
  type: NotificationType;
  endpoint: string;
  events: string[];
}

export enum NotificationType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook'
}

export interface SecurityConfiguration {
  permissions: PermissionConfiguration;
  encryption: EncryptionConfiguration;
  audit: AuditConfiguration;
}

export interface PermissionConfiguration {
  strictMode: boolean;
  fileAccess: FileAccessConfig;
  systemAccess: SystemAccessConfig;
}

export interface FileAccessConfig {
  allowedPaths: string[];
  deniedPaths: string[];
  readOnly: boolean;
}

export interface SystemAccessConfig {
  allowedCommands: string[];
  deniedCommands: string[];
  allowShellAccess: boolean;
}

export interface EncryptionConfiguration {
  algorithm: string;
  keySize: number;
  saltRounds: number;
}

export interface AuditConfiguration {
  enabled: boolean;
  logFile: string;
  events: AuditEvent[];
}

export enum AuditEvent {
  COMMAND_EXECUTED = 'command_executed',
  FILE_ACCESSED = 'file_accessed',
  CONFIG_CHANGED = 'config_changed',
  PERSONA_ACTIVATED = 'persona_activated'
}

export interface PerformanceConfiguration {
  monitoring: MonitoringConfiguration;
  optimization: OptimizationConfiguration;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  metricsInterval: number;
  memoryThreshold: number;
  cpuThreshold: number;
}

export interface OptimizationConfiguration {
  parallelProcessing: boolean;
  maxWorkers: number;
  memoryLimit: number;
  cacheStrategy: CacheStrategy;
}

export enum CacheStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  TTL = 'ttl'
}

export interface EnvironmentConfiguration extends FrameworkConfiguration {
  environment: string;
  overrides: Record<string, any>;
}

// Cursor API統合インターフェース
export interface CursorAPIIntegration {
  executeCommand(command: string, options: CursorOptions): Promise<CursorResult>;
  readFile(path: string): Promise<FileContent>;
  writeFile(path: string, content: string, options: WriteOptions): Promise<WriteResult>;
  searchCode(query: string, scope: SearchScope): Promise<SearchResult[]>;
  getProjectContext(): Promise<ProjectContext>;
  authenticate(apiKey: string): Promise<AuthResult>;
}

export interface CursorOptions {
  timeout?: number;
  format?: OutputFormat;
  verbose?: boolean;
  [key: string]: any;
}

export interface CursorResult {
  success: boolean;
  output: any;
  format: OutputFormat;
  metadata: CursorMetadata;
}

export interface CursorMetadata {
  executionTime: number;
  tokensUsed: number;
  modelUsed: string;
  cacheHit: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: Date;
  metadata: FileMetadata;
}

export interface FileMetadata {
  permissions: number;
  owner: string;
  group: string;
  type: string;
}

export interface WriteOptions {
  encoding?: string;
  mode?: number;
  backup?: boolean;
  atomic?: boolean;
}

export interface WriteResult {
  success: boolean;
  bytesWritten: number;
  path: string;
  backup?: string;
}

export interface SearchScope {
  paths?: string[];
  fileTypes?: string[];
  excludePaths?: string[];
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string[];
}

export interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  permissions?: Permission[];
}

// ファイルシステムハンドラー インターフェース
export interface FileSystemHandler {
  readDirectory(path: string, recursive: boolean): Promise<DirectoryListing>;
  createFile(path: string, content: string, permissions: FilePermissions): Promise<void>;
  updateFile(path: string, changes: FileChange[]): Promise<void>;
  deleteFile(path: string, options: DeleteOptions): Promise<void>;
  watchFiles(patterns: string[], callback: FileWatchCallback): Promise<FileWatcher>;
  checkPermissions(path: string, user: UserContext): Promise<PermissionCheck>;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  totalSize: number;
  fileCount: number;
  directoryCount: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: EntryType;
  size: number;
  lastModified: Date;
  permissions: FilePermissions;
}

export enum EntryType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMLINK = 'symlink'
}

export interface FilePermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
  owner: string;
  group: string;
  mode: number;
}

export interface FileChange {
  type: FileChangeType;
  position?: FilePosition;
  content: string;
  length?: number;
}

export enum FileChangeType {
  INSERT = 'insert',
  DELETE = 'delete',
  REPLACE = 'replace'
}

export interface FilePosition {
  line: number;
  column: number;
  offset?: number;
}

export interface DeleteOptions {
  recursive?: boolean;
  force?: boolean;
  backup?: boolean;
}

export interface FileWatcher {
  id: string;
  patterns: string[];
  active: boolean;
  stop(): Promise<void>;
}

export type FileWatchCallback = (event: FileWatchEvent) => void;

export interface FileWatchEvent {
  type: WatchEventType;
  path: string;
  timestamp: Date;
  metadata?: any;
}

export enum WatchEventType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  MOVED = 'moved'
}

export interface PermissionCheck {
  allowed: boolean;
  permissions: Permission[];
  reason?: string;
}

// キャッシュマネージャー インターフェース
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  invalidate(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(pattern?: string): Promise<string[]>;
}

// パフォーマンスモニター インターフェース
export interface PerformanceMonitor {
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  startTimer(name: string): Timer;
  recordError(error: Error, context?: Record<string, any>): void;
  getMetrics(timeRange: TimeRange): Promise<Metrics>;
  getHealthCheck(): Promise<HealthCheck>;
}

export interface Timer {
  name: string;
  startTime: number;
  stop(): number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Metrics {
  counters: Record<string, number>;
  timers: Record<string, TimerMetrics>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramMetrics>;
}

export interface TimerMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  p95: number;
  p99: number;
}

export interface HistogramMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface HealthCheck {
  status: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: Date;
  uptime: number;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
}

// イベントエミッター インターフェース
export interface EventEmitter {
  on(event: string, listener: EventListener): void;
  off(event: string, listener: EventListener): void;
  emit(event: string, ...args: any[]): Promise<void>;
  once(event: string, listener: EventListener): void;
  removeAllListeners(event?: string): void;
  listenerCount(event: string): number;
}

export type EventListener = (...args: any[]) => void | Promise<void>;