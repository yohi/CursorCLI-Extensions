/**
 * SuperCursor Framework - コンテキスト関連型定義
 * プロジェクト、ユーザー、セッションコンテキストの統合定義
 */

import {
  ProjectId,
  SessionId,
  UserId,
  PersonaId,
  Timestamp,
  VerbosityLevel,
  OutputFormat,
  DeepReadonly,
  BaseEntity
} from './base.js';

// ==========================================
// プロジェクトコンテキスト
// ==========================================

export interface ProjectContext extends BaseEntity<ProjectId> {
  readonly rootPath: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly technologies: TechnologyStack;
  readonly structure: ProjectStructure;
  readonly dependencies: readonly Dependency[];
  readonly configurations: readonly Configuration[];
  readonly metadata: ProjectMetadata;
  readonly environment: ProjectEnvironment;
}

export enum ProjectType {
  WEB_APPLICATION = 'web_application',
  MOBILE_APPLICATION = 'mobile_application',
  API_SERVICE = 'api_service',
  LIBRARY = 'library',
  CLI_TOOL = 'cli_tool',
  MICROSERVICE = 'microservice',
  MONOREPO = 'monorepo',
  DESKTOP_APPLICATION = 'desktop_application',
  GAME = 'game',
  MACHINE_LEARNING = 'machine_learning'
}

// ==========================================
// 技術スタック
// ==========================================

export interface TechnologyStack {
  readonly languages: readonly ProgrammingLanguage[];
  readonly frameworks: readonly Framework[];
  readonly databases: readonly Database[];
  readonly tools: readonly DevelopmentTool[];
  readonly platforms: readonly Platform[];
  readonly cloudServices: readonly CloudService[];
}

export interface ProgrammingLanguage {
  readonly name: string;
  readonly version: string;
  readonly fileExtensions: readonly string[];
  readonly packageManager?: string;
  readonly confidence: number;
  readonly usage: LanguageUsage;
}

export interface LanguageUsage {
  readonly lineCount: number;
  readonly fileCount: number;
  readonly percentage: number;
  readonly complexity: ComplexityMetrics;
}

export interface ComplexityMetrics {
  readonly cyclomaticComplexity: number;
  readonly cognitiveComplexity: number;
  readonly maintainabilityIndex: number;
  readonly technicalDebt: number;
}

export interface Framework {
  readonly name: string;
  readonly version: string;
  readonly type: FrameworkType;
  readonly configFiles: readonly string[];
  readonly dependencies: readonly string[];
  readonly features: readonly FrameworkFeature[];
}

export enum FrameworkType {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FULLSTACK = 'fullstack',
  TESTING = 'testing',
  BUILD_TOOL = 'build_tool',
  STYLING = 'styling',
  STATE_MANAGEMENT = 'state_management'
}

export interface FrameworkFeature {
  readonly name: string;
  readonly enabled: boolean;
  readonly configuration?: unknown;
}

export interface Database {
  readonly name: string;
  readonly type: DatabaseType;
  readonly version?: string;
  readonly connectionString?: string;
  readonly schema?: DatabaseSchema;
}

export enum DatabaseType {
  SQL = 'sql',
  NOSQL = 'nosql',
  GRAPH = 'graph',
  CACHE = 'cache',
  SEARCH = 'search',
  TIME_SERIES = 'time_series',
  VECTOR = 'vector'
}

export interface DatabaseSchema {
  readonly tables?: readonly TableSchema[];
  readonly collections?: readonly CollectionSchema[];
  readonly indexes?: readonly IndexSchema[];
}

export interface TableSchema {
  readonly name: string;
  readonly columns: readonly ColumnSchema[];
  readonly constraints: readonly ConstraintSchema[];
}

export interface ColumnSchema {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
}

export interface ConstraintSchema {
  readonly name: string;
  readonly type: ConstraintType;
  readonly columns: readonly string[];
}

export enum ConstraintType {
  PRIMARY_KEY = 'primary_key',
  FOREIGN_KEY = 'foreign_key',
  UNIQUE = 'unique',
  CHECK = 'check',
  NOT_NULL = 'not_null'
}

export interface CollectionSchema {
  readonly name: string;
  readonly fields: readonly FieldSchema[];
  readonly validation?: unknown;
}

export interface FieldSchema {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly nested?: readonly FieldSchema[];
}

export interface IndexSchema {
  readonly name: string;
  readonly fields: readonly string[];
  readonly unique: boolean;
  readonly type: IndexType;
}

export enum IndexType {
  BTREE = 'btree',
  HASH = 'hash',
  GIN = 'gin',
  GIST = 'gist',
  TEXT = 'text'
}

export interface DevelopmentTool {
  readonly name: string;
  readonly category: ToolCategory;
  readonly version?: string;
  readonly configFiles: readonly string[];
  readonly commands: readonly string[];
  readonly integration: ToolIntegration;
}

export enum ToolCategory {
  LINTER = 'linter',
  FORMATTER = 'formatter',
  BUNDLER = 'bundler',
  TRANSPILER = 'transpiler',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY = 'security'
}

export interface ToolIntegration {
  readonly ide: readonly string[];
  readonly ci: readonly string[];
  readonly scripts: readonly string[];
}

export interface Platform {
  readonly name: string;
  readonly type: PlatformType;
  readonly version?: string;
  readonly configFiles: readonly string[];
  readonly services: readonly PlatformService[];
}

export enum PlatformType {
  CLOUD = 'cloud',
  CONTAINER = 'container',
  SERVERLESS = 'serverless',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  IOT = 'iot',
  EDGE = 'edge'
}

export interface PlatformService {
  readonly name: string;
  readonly type: ServiceType;
  readonly configuration?: unknown;
}

export enum ServiceType {
  COMPUTE = 'compute',
  STORAGE = 'storage',
  DATABASE = 'database',
  MESSAGING = 'messaging',
  AUTHENTICATION = 'authentication',
  MONITORING = 'monitoring'
}

export interface CloudService {
  readonly provider: CloudProvider;
  readonly service: string;
  readonly region?: string;
  readonly configuration?: unknown;
}

export enum CloudProvider {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
  DIGITAL_OCEAN = 'digital_ocean',
  HEROKU = 'heroku',
  VERCEL = 'vercel',
  NETLIFY = 'netlify'
}

// ==========================================
// プロジェクト構造
// ==========================================

export interface ProjectStructure {
  readonly directories: readonly Directory[];
  readonly files: readonly FileInfo[];
  readonly patterns: readonly StructurePattern[];
  readonly metrics: StructureMetrics;
}

export interface Directory {
  readonly name: string;
  readonly path: string;
  readonly children: readonly Directory[];
  readonly fileCount: number;
  readonly totalSize: number;
  readonly purpose: DirectoryPurpose;
  readonly conventions: readonly NamingConvention[];
}

export enum DirectoryPurpose {
  SOURCE = 'source',
  TESTS = 'tests',
  DOCS = 'docs',
  CONFIG = 'config',
  BUILD = 'build',
  ASSETS = 'assets',
  SCRIPTS = 'scripts',
  EXAMPLES = 'examples',
  TOOLS = 'tools'
}

export interface NamingConvention {
  readonly type: ConventionType;
  readonly pattern: RegExp;
  readonly compliance: number;
}

export enum ConventionType {
  CAMEL_CASE = 'camelCase',
  PASCAL_CASE = 'PascalCase',
  SNAKE_CASE = 'snake_case',
  KEBAB_CASE = 'kebab-case',
  SCREAMING_SNAKE_CASE = 'SCREAMING_SNAKE_CASE'
}

export interface FileInfo {
  readonly name: string;
  readonly path: string;
  readonly extension: string;
  readonly size: number;
  readonly lastModified: Date;
  readonly type: FileType;
  readonly language?: string;
  readonly encoding: string;
  readonly lineCount: number;
  readonly complexity?: ComplexityMetrics;
}

export enum FileType {
  SOURCE_CODE = 'source_code',
  TEST = 'test',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  ASSET = 'asset',
  BUILD_OUTPUT = 'build_output',
  SCHEMA = 'schema',
  SCRIPT = 'script'
}

export interface StructurePattern {
  readonly name: string;
  readonly description: string;
  readonly files: readonly string[];
  readonly directories: readonly string[];
  readonly confidence: number;
  readonly category: PatternCategory;
}

export enum PatternCategory {
  ARCHITECTURE = 'architecture',
  FRAMEWORK = 'framework',
  CONVENTION = 'convention',
  ANTI_PATTERN = 'anti_pattern'
}

export interface StructureMetrics {
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly totalSize: number;
  readonly averageFileSize: number;
  readonly maxDepth: number;
  readonly duplicateFiles: number;
  readonly emptyDirectories: number;
}

// ==========================================
// 依存関係
// ==========================================

export interface Dependency {
  readonly name: string;
  readonly version: string;
  readonly type: DependencyType;
  readonly source: DependencySource;
  readonly description?: string;
  readonly homepage?: string;
  readonly license?: string;
  readonly vulnerabilities: readonly SecurityVulnerability[];
  readonly outdated: boolean;
  readonly usageAnalysis: DependencyUsage;
}

export enum DependencyType {
  RUNTIME = 'runtime',
  DEVELOPMENT = 'development',
  PEER = 'peer',
  OPTIONAL = 'optional',
  BUNDLED = 'bundled'
}

export enum DependencySource {
  NPM = 'npm',
  YARN = 'yarn',
  PIP = 'pip',
  CARGO = 'cargo',
  MAVEN = 'maven',
  GRADLE = 'gradle',
  GO_MOD = 'go_mod',
  NUGET = 'nuget',
  COCOAPODS = 'cocoapods'
}

export interface SecurityVulnerability {
  readonly id: string;
  readonly severity: VulnerabilitySeverity;
  readonly description: string;
  readonly cve?: string;
  readonly patchedIn?: string;
  readonly recommendation: string;
}

export enum VulnerabilitySeverity {
  INFO = 'info',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DependencyUsage {
  readonly imported: boolean;
  readonly used: boolean;
  readonly essential: boolean;
  readonly usageLocations: readonly string[];
  readonly alternatives: readonly string[];
}

// ==========================================
// 設定
// ==========================================

export interface Configuration {
  readonly name: string;
  readonly type: ConfigurationType;
  readonly path: string;
  readonly format: ConfigurationFormat;
  readonly content: DeepReadonly<Record<string, unknown>>;
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export enum ConfigurationType {
  BUILD = 'build',
  LINT = 'lint',
  TEST = 'test',
  DEPLOY = 'deploy',
  ENVIRONMENT = 'environment',
  FRAMEWORK = 'framework',
  DATABASE = 'database',
  SECURITY = 'security'
}

export enum ConfigurationFormat {
  JSON = 'json',
  YAML = 'yaml',
  TOML = 'toml',
  INI = 'ini',
  JS = 'js',
  TS = 'ts',
  XML = 'xml',
  PROPERTIES = 'properties'
}

// ==========================================
// プロジェクトメタデータ
// ==========================================

export interface ProjectMetadata {
  readonly version: string;
  readonly author?: string;
  readonly maintainers: readonly string[];
  readonly license?: string;
  readonly description?: string;
  readonly keywords: readonly string[];
  readonly repository?: RepositoryInfo;
  readonly issues?: IssueTracker;
  readonly ci?: CIConfiguration;
  readonly quality: QualityMetrics;
}

export interface RepositoryInfo {
  readonly type: RepositoryType;
  readonly url: string;
  readonly branch?: string;
  readonly commit?: string;
  readonly isClean: boolean;
  readonly ahead: number;
  readonly behind: number;
}

export enum RepositoryType {
  GIT = 'git',
  SVN = 'svn',
  MERCURIAL = 'mercurial',
  PERFORCE = 'perforce'
}

export interface IssueTracker {
  readonly type: IssueTrackerType;
  readonly url: string;
  readonly openIssues?: number;
  readonly closedIssues?: number;
}

export enum IssueTrackerType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JIRA = 'jira',
  BITBUCKET = 'bitbucket',
  LINEAR = 'linear'
}

export interface CIConfiguration {
  readonly provider: CIProvider;
  readonly configFile: string;
  readonly status?: CIStatus;
  readonly lastBuild?: BuildInfo;
  readonly coverage?: CoverageInfo;
}

export enum CIProvider {
  GITHUB_ACTIONS = 'github_actions',
  GITLAB_CI = 'gitlab_ci',
  BITBUCKET_PIPELINES = 'bitbucket_pipelines',
  JENKINS = 'jenkins',
  TRAVIS_CI = 'travis_ci',
  CIRCLE_CI = 'circle_ci',
  AZURE_DEVOPS = 'azure_devops'
}

export enum CIStatus {
  PASSING = 'passing',
  FAILING = 'failing',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  UNKNOWN = 'unknown'
}

export interface BuildInfo {
  readonly id: string;
  readonly status: CIStatus;
  readonly timestamp: Date;
  readonly duration: number;
  readonly branch: string;
  readonly commit: string;
  readonly logs?: string;
}

export interface CoverageInfo {
  readonly percentage: number;
  readonly lines: CoverageDetails;
  readonly functions: CoverageDetails;
  readonly branches: CoverageDetails;
  readonly statements: CoverageDetails;
}

export interface CoverageDetails {
  readonly covered: number;
  readonly total: number;
  readonly percentage: number;
}

export interface QualityMetrics {
  readonly codeQuality: CodeQualityMetrics;
  readonly security: SecurityMetrics;
  readonly performance: ProjectPerformanceMetrics;
  readonly maintainability: MaintainabilityMetrics;
}

export interface CodeQualityMetrics {
  readonly linesOfCode: number;
  readonly testCoverage: number;
  readonly codeSmells: number;
  readonly duplicatedLines: number;
  readonly cyclomaticComplexity: number;
  readonly maintainabilityIndex: number;
}

export interface SecurityMetrics {
  readonly vulnerabilities: number;
  readonly securityRating: SecurityRating;
  readonly lastSecurityScan?: Date;
  readonly securityDebt: number;
}

export enum SecurityRating {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

export interface ProjectPerformanceMetrics {
  readonly buildTime: number;
  readonly testTime: number;
  readonly bundleSize: number;
  readonly memoryUsage: number;
}

export interface MaintainabilityMetrics {
  readonly technicalDebt: number;
  readonly reliabilityRating: ReliabilityRating;
  readonly maintainabilityRating: MaintainabilityRating;
  readonly lastAnalysis?: Date;
}

export enum ReliabilityRating {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

export enum MaintainabilityRating {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

// ==========================================
// プロジェクト環境
// ==========================================

export interface ProjectEnvironment {
  readonly nodeVersion?: string;
  readonly packageManager: PackageManager;
  readonly operatingSystem: OperatingSystem;
  readonly architecture: string;
  readonly environmentVariables: DeepReadonly<Record<string, string>>;
  readonly paths: EnvironmentPaths;
}

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BUN = 'bun',
  PIP = 'pip',
  CARGO = 'cargo',
  MAVEN = 'maven',
  GRADLE = 'gradle'
}

export enum OperatingSystem {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  FREEBSD = 'freebsd',
  OPENBSD = 'openbsd'
}

export interface EnvironmentPaths {
  readonly home: string;
  readonly temp: string;
  readonly config: string;
  readonly cache: string;
  readonly data: string;
}

// ==========================================
// ユーザーコンテキスト
// ==========================================

export interface UserContext extends BaseEntity<UserId> {
  readonly name: string;
  readonly email?: string;
  readonly preferences: UserPreferences;
  readonly permissions: readonly Permission[];
  readonly profile: UserProfile;
  readonly activity: UserActivity;
}

export interface UserPreferences {
  readonly language: string;
  readonly theme: Theme;
  readonly outputFormat: OutputFormat;
  readonly verbosity: VerbosityLevel;
  readonly autoSave: boolean;
  readonly confirmActions: boolean;
  readonly shortcuts: DeepReadonly<Record<string, string>>;
  readonly notifications: NotificationPreferences;
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
  HIGH_CONTRAST = 'high_contrast'
}

export interface NotificationPreferences {
  readonly email: boolean;
  readonly desktop: boolean;
  readonly sound: boolean;
  readonly types: readonly NotificationType[];
}

export enum NotificationType {
  BUILD_COMPLETE = 'build_complete',
  TEST_FAILURE = 'test_failure',
  SECURITY_ALERT = 'security_alert',
  UPDATE_AVAILABLE = 'update_available'
}

export interface Permission {
  readonly resource: string;
  readonly actions: readonly PermissionAction[];
  readonly scope: PermissionScope;
  readonly conditions?: readonly PermissionCondition[];
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  ADMIN = 'admin'
}

export enum PermissionScope {
  FILE = 'file',
  DIRECTORY = 'directory',
  PROJECT = 'project',
  SYSTEM = 'system',
  GLOBAL = 'global'
}

export interface PermissionCondition {
  readonly field: string;
  readonly operator: string;
  readonly value: unknown;
}

export interface UserProfile {
  readonly experience: ExperienceLevel;
  readonly skills: readonly Skill[];
  readonly interests: readonly string[];
  readonly timezone: string;
  readonly workingHours: WorkingHours;
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface Skill {
  readonly name: string;
  readonly level: ExperienceLevel;
  readonly yearsOfExperience: number;
  readonly certifications: readonly string[];
}

export interface WorkingHours {
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
  readonly days: readonly DayOfWeek[];
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export interface UserActivity {
  readonly lastLogin: Date;
  readonly sessionCount: number;
  readonly totalTime: number;
  readonly recentProjects: readonly ProjectId[];
  readonly statistics: UserStatistics;
}

export interface UserStatistics {
  readonly commandsExecuted: number;
  readonly projectsWorked: number;
  readonly favoritePersonas: readonly PersonaId[];
  readonly averageSessionTime: number;
  readonly productivity: ProductivityMetrics;
}

export interface ProductivityMetrics {
  readonly linesOfCodeGenerated: number;
  readonly bugsFixed: number;
  readonly testsWritten: number;
  readonly documentsCreated: number;
  readonly refactoringsPerformed: number;
}

// ==========================================
// セッションコンテキスト
// ==========================================

export interface SessionContext extends BaseEntity<SessionId> {
  readonly userId: UserId;
  readonly startTime: Date;
  readonly lastActivity: Date;
  readonly status: SessionStatus;
  readonly environment: SessionEnvironment;
  readonly history: readonly SessionHistoryEntry[];
  readonly cache: SessionCache;
  readonly state: SessionState;
}

export enum SessionStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}

export interface SessionEnvironment {
  readonly ip: string;
  readonly userAgent: string;
  readonly platform: string;
  readonly workingDirectory: string;
  readonly terminalType?: string;
}

export interface SessionHistoryEntry {
  readonly timestamp: Timestamp;
  readonly action: string;
  readonly data?: unknown;
  readonly duration?: number;
}

export interface SessionCache {
  readonly entries: Map<string, CacheEntry>;
  readonly maxSize: number;
  readonly ttl: number;
  readonly hits: number;
  readonly misses: number;
}

export interface CacheEntry {
  readonly key: string;
  readonly value: unknown;
  readonly timestamp: Timestamp;
  readonly ttl: number;
  readonly hits: number;
  readonly size: number;
}

export interface SessionState {
  readonly currentProject?: ProjectId;
  readonly activePersona?: PersonaId;
  readonly variables: DeepReadonly<Record<string, unknown>>;
  readonly flags: readonly string[];
  readonly bookmarks: readonly SessionBookmark[];
}

export interface SessionBookmark {
  readonly name: string;
  readonly path: string;
  readonly type: BookmarkType;
  readonly metadata?: unknown;
}

export enum BookmarkType {
  FILE = 'file',
  DIRECTORY = 'directory',
  URL = 'url',
  COMMAND = 'command'
}

// ==========================================
// 型ガード
// ==========================================

export function isProjectContext(value: unknown): value is ProjectContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rootPath' in value &&
    'name' in value &&
    'type' in value
  );
}

export function isUserContext(value: unknown): value is UserContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'preferences' in value
  );
}

export function isSessionContext(value: unknown): value is SessionContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'userId' in value &&
    'startTime' in value
  );
}