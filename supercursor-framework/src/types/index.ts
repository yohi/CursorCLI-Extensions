// プロジェクトコンテキストの型定義
export interface ProjectContext {
  rootPath: string;
  name: string;
  type: ProjectType;
  technologies: TechnologyStack;
  structure: ProjectStructure;
  dependencies: Dependency[];
  configurations: Configuration[];
  metadata: ProjectMetadata;
}

export interface TechnologyStack {
  languages: ProgrammingLanguage[];
  frameworks: Framework[];
  databases: Database[];
  tools: DevelopmentTool[];
  platforms: Platform[];
}

export interface ProjectStructure {
  directories: Directory[];
  files: FileInfo[];
  patterns: StructurePattern[];
}

// コマンドコンテキストの型定義
export interface CommandContext {
  command: string;
  arguments: string[];
  options: CommandOptions;
  workingDirectory: string;
  user: UserContext;
  project: ProjectContext;
  session: SessionContext;
}

export interface SessionContext {
  id: string;
  startTime: Date;
  history: CommandHistory[];
  cache: SessionCache;
  preferences: UserPreferences;
}

// AIペルソナコンテキストの型定義
export interface PersonaContext {
  activePersona: AIPersona;
  confidence: number;
  reasoning: string;
  alternatives: AIPersona[];
  specializations: Specialization[];
  knowledgeBase: KnowledgeBase;
}

export interface AIPersona {
  id: string;
  name: string;
  description: string;
  expertise: ExpertiseArea[];
  activationTriggers: Trigger[];
  responseStyle: ResponseStyle;
  capabilities: Capability[];
}

// エラーハンドリング関連の型定義
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export abstract class FrameworkError extends Error {
  abstract code: string;
  abstract severity: ErrorSeverity;
  abstract recoverable: boolean;
  
  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ベースタイプと列挙型
export enum ProjectType {
  WEB_APPLICATION = 'web_application',
  MOBILE_APPLICATION = 'mobile_application',
  API_SERVICE = 'api_service',
  LIBRARY = 'library',
  CLI_TOOL = 'cli_tool',
  MICROSERVICE = 'microservice',
  MONOREPO = 'monorepo'
}

export interface ProgrammingLanguage {
  name: string;
  version: string;
  fileExtensions: string[];
  packageManager?: string;
}

export interface Framework {
  name: string;
  version: string;
  type: FrameworkType;
  configFiles: string[];
}

export enum FrameworkType {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FULLSTACK = 'fullstack',
  TESTING = 'testing',
  BUILD_TOOL = 'build_tool'
}

export interface Database {
  name: string;
  type: DatabaseType;
  version?: string;
  connectionString?: string;
}

export enum DatabaseType {
  SQL = 'sql',
  NOSQL = 'nosql',
  GRAPH = 'graph',
  CACHE = 'cache',
  SEARCH = 'search'
}

export interface DevelopmentTool {
  name: string;
  category: ToolCategory;
  configFiles: string[];
  commands: string[];
}

export enum ToolCategory {
  LINTER = 'linter',
  FORMATTER = 'formatter',
  BUNDLER = 'bundler',
  TRANSPILER = 'transpiler',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment'
}

export interface Platform {
  name: string;
  type: PlatformType;
  version?: string;
  configFiles: string[];
}

export enum PlatformType {
  CLOUD = 'cloud',
  CONTAINER = 'container',
  SERVERLESS = 'serverless',
  MOBILE = 'mobile',
  DESKTOP = 'desktop'
}

// ファイルシステム関連の型定義
export interface Directory {
  name: string;
  path: string;
  children: Directory[];
  fileCount: number;
  purpose?: DirectoryPurpose;
}

export enum DirectoryPurpose {
  SOURCE = 'source',
  TESTS = 'tests',
  DOCS = 'docs',
  CONFIG = 'config',
  BUILD = 'build',
  ASSETS = 'assets'
}

export interface FileInfo {
  name: string;
  path: string;
  extension: string;
  size: number;
  lastModified: Date;
  type: FileType;
  language?: string;
}

export enum FileType {
  SOURCE_CODE = 'source_code',
  TEST = 'test',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  ASSET = 'asset',
  BUILD_OUTPUT = 'build_output'
}

export interface StructurePattern {
  name: string;
  description: string;
  files: string[];
  directories: string[];
  confidence: number;
}

// 設定とオプション関連の型定義
export interface Configuration {
  name: string;
  type: ConfigurationType;
  path: string;
  format: ConfigurationFormat;
  content: Record<string, any>;
}

export enum ConfigurationType {
  BUILD = 'build',
  LINT = 'lint',
  TEST = 'test',
  DEPLOY = 'deploy',
  ENVIRONMENT = 'environment',
  FRAMEWORK = 'framework'
}

export enum ConfigurationFormat {
  JSON = 'json',
  YAML = 'yaml',
  TOML = 'toml',
  INI = 'ini',
  JS = 'js',
  TS = 'ts'
}

export interface CommandOptions {
  verbose?: boolean;
  dryRun?: boolean;
  output?: OutputFormat;
  timeout?: number;
  force?: boolean;
  [key: string]: any;
}

export enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  STREAM_JSON = 'stream-json',
  MARKDOWN = 'markdown'
}

// ユーザーとセッション関連の型定義
export interface UserContext {
  id: string;
  name?: string;
  preferences: UserPreferences;
  permissions: Permission[];
}

export interface UserPreferences {
  language: string;
  theme: string;
  outputFormat: OutputFormat;
  verbosity: VerbosityLevel;
  autoSave: boolean;
  [key: string]: any;
}

export enum VerbosityLevel {
  MINIMAL = 'minimal',
  NORMAL = 'normal',
  VERBOSE = 'verbose',
  DEBUG = 'debug'
}

export interface Permission {
  resource: string;
  actions: PermissionAction[];
  scope?: PermissionScope;
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete'
}

export enum PermissionScope {
  FILE = 'file',
  DIRECTORY = 'directory',
  PROJECT = 'project',
  SYSTEM = 'system'
}

export interface CommandHistory {
  id: string;
  command: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  output?: string;
  error?: string;
}

export interface SessionCache {
  entries: Map<string, CacheEntry>;
  maxSize: number;
  ttl: number;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: Date;
  ttl: number;
  hits: number;
}

// AIペルソナ関連の詳細型定義
export interface ExpertiseArea {
  domain: string;
  level: ExpertiseLevel;
  technologies: string[];
  patterns: string[];
}

export enum ExpertiseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface Trigger {
  type: TriggerType;
  pattern: string | RegExp;
  weight: number;
  context?: TriggerContext;
}

export enum TriggerType {
  FILE_PATTERN = 'file_pattern',
  CODE_PATTERN = 'code_pattern',
  COMMAND_PATTERN = 'command_pattern',
  KEYWORD = 'keyword',
  TECHNOLOGY = 'technology'
}

export interface TriggerContext {
  fileTypes?: string[];
  directories?: string[];
  technologies?: string[];
  timeOfDay?: TimeRange;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface ResponseStyle {
  tone: ResponseTone;
  verbosity: VerbosityLevel;
  format: ResponseFormat;
  examples: boolean;
  explanations: boolean;
}

export enum ResponseTone {
  FORMAL = 'formal',
  CASUAL = 'casual',
  TECHNICAL = 'technical',
  FRIENDLY = 'friendly'
}

export enum ResponseFormat {
  STRUCTURED = 'structured',
  NARRATIVE = 'narrative',
  BULLET_POINTS = 'bullet_points',
  CODE_FOCUSED = 'code_focused'
}

export interface Capability {
  name: string;
  description: string;
  parameters: CapabilityParameter[];
  outputs: CapabilityOutput[];
}

export interface CapabilityParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  validation?: ValidationRule;
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  FILE_PATH = 'file_path',
  DIRECTORY_PATH = 'directory_path'
}

export interface ValidationRule {
  pattern?: string | RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
}

export interface CapabilityOutput {
  name: string;
  type: ParameterType;
  description: string;
  format?: OutputFormat;
}

export interface Specialization {
  area: string;
  skills: Skill[];
  tools: Tool[];
  methodologies: Methodology[];
}

export interface Skill {
  name: string;
  level: ExpertiseLevel;
  experience: string;
  certifications?: string[];
}

export interface Tool {
  name: string;
  category: ToolCategory;
  proficiency: ExpertiseLevel;
  version?: string;
}

export interface Methodology {
  name: string;
  type: MethodologyType;
  applicability: string[];
  principles: string[];
}

export enum MethodologyType {
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  ARCHITECTURE = 'architecture',
  PROJECT_MANAGEMENT = 'project_management'
}

export interface KnowledgeBase {
  documents: KnowledgeDocument[];
  patterns: KnowledgePattern[];
  bestPractices: BestPractice[];
  references: Reference[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
  lastUpdated: Date;
  source: string;
  relevance: number;
}

export interface KnowledgePattern {
  name: string;
  description: string;
  context: string;
  solution: string;
  consequences: string[];
  examples: CodeExample[];
}

export interface CodeExample {
  language: string;
  code: string;
  description: string;
  tags: string[];
}

export interface BestPractice {
  title: string;
  description: string;
  rationale: string;
  examples: string[];
  antiPatterns: string[];
  applicability: string[];
}

export interface Reference {
  title: string;
  url: string;
  type: ReferenceType;
  tags: string[];
  lastVerified: Date;
}

export enum ReferenceType {
  DOCUMENTATION = 'documentation',
  TUTORIAL = 'tutorial',
  ARTICLE = 'article',
  VIDEO = 'video',
  BOOK = 'book',
  COURSE = 'course'
}

// 依存関係関連の型定義
export interface Dependency {
  name: string;
  version: string;
  type: DependencyType;
  source: DependencySource;
  description?: string;
  homepage?: string;
  license?: string;
  dev?: boolean;
}

export enum DependencyType {
  RUNTIME = 'runtime',
  DEVELOPMENT = 'development',
  PEER = 'peer',
  OPTIONAL = 'optional'
}

export enum DependencySource {
  NPM = 'npm',
  YARN = 'yarn',
  PIP = 'pip',
  CARGO = 'cargo',
  MAVEN = 'maven',
  GRADLE = 'gradle',
  GO_MOD = 'go_mod'
}

// メタデータの型定義
export interface ProjectMetadata {
  createdAt: Date;
  lastModified: Date;
  version: string;
  author?: string;
  license?: string;
  repository?: RepositoryInfo;
  issues?: IssueTracker;
  ci?: CIConfiguration;
}

export interface RepositoryInfo {
  type: RepositoryType;
  url: string;
  branch?: string;
  commit?: string;
}

export enum RepositoryType {
  GIT = 'git',
  SVN = 'svn',
  MERCURIAL = 'mercurial'
}

export interface IssueTracker {
  type: IssueTrackerType;
  url: string;
}

export enum IssueTrackerType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JIRA = 'jira',
  BITBUCKET = 'bitbucket'
}

export interface CIConfiguration {
  provider: CIProvider;
  configFile: string;
  status?: CIStatus;
  lastBuild?: BuildInfo;
}

export enum CIProvider {
  GITHUB_ACTIONS = 'github_actions',
  GITLAB_CI = 'gitlab_ci',
  BITBUCKET_PIPELINES = 'bitbucket_pipelines',
  JENKINS = 'jenkins',
  TRAVIS_CI = 'travis_ci',
  CIRCLE_CI = 'circle_ci'
}

export enum CIStatus {
  PASSING = 'passing',
  FAILING = 'failing',
  PENDING = 'pending',
  UNKNOWN = 'unknown'
}

export interface BuildInfo {
  id: string;
  status: CIStatus;
  timestamp: Date;
  duration: number;
  branch: string;
  commit: string;
}