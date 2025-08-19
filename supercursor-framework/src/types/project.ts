/**
 * プロジェクト関連の型定義
 */

export type ProjectType = 
  | 'web-application' | 'mobile-application' | 'desktop-application'
  | 'library' | 'framework' | 'tool' | 'service' | 'api' | 'unknown';

export type ProgrammingLanguage = 
  | 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' 
  | 'go' | 'rust' | 'php' | 'ruby' | 'swift' | 'kotlin' | 'cpp' | 'c';

export type Framework = 
  | 'react' | 'vue' | 'angular' | 'svelte' | 'nextjs' | 'nuxtjs'
  | 'express' | 'fastify' | 'nestjs' | 'django' | 'flask' | 'spring'
  | 'laravel' | 'rails' | 'gin' | 'fiber' | 'axum' | 'actix';

export type Database = 
  | 'mysql' | 'postgresql' | 'mongodb' | 'sqlite' | 'redis'
  | 'elasticsearch' | 'cassandra' | 'dynamodb' | 'firestore';

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

export interface DevelopmentTool {
  name: string;
  version: string;
  category: 'bundler' | 'linter' | 'formatter' | 'tester' | 'deployer' | 'other';
}

export interface Platform {
  name: string;
  version: string;
  type: 'runtime' | 'cloud' | 'container' | 'ci-cd';
}

export interface ProjectStructure {
  directories: DirectoryNode[];
  files: FileNode[];
  patterns: StructuralPattern[];
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'source' | 'test' | 'config' | 'docs' | 'build' | 'assets' | 'other';
  children: (DirectoryNode | FileNode)[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'source' | 'config' | 'test' | 'doc' | 'asset' | 'other';
  size: number;
  lastModified: Date;
  language?: ProgrammingLanguage | undefined;
}

export interface StructuralPattern {
  name: string;
  type: 'mvc' | 'component' | 'layer' | 'module' | 'package';
  directories: string[];
  conventions: Convention[];
}

export interface Convention {
  type: 'naming' | 'structure' | 'organization';
  pattern: string;
  description: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer' | 'optional';
  source: 'npm' | 'pip' | 'cargo' | 'maven' | 'nuget' | 'other';
  description?: string;
}

export interface Configuration {
  name: string;
  type: 'build' | 'lint' | 'test' | 'deploy' | 'env' | 'other';
  path: string;
  format: 'json' | 'yaml' | 'toml' | 'xml' | 'ini' | 'js' | 'ts';
  content: any;
}

export interface ProjectMetadata {
  version: string;
  description: string;
  author: string;
  license: string;
  repository?: RepositoryInfo;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryInfo {
  type: 'git' | 'svn' | 'mercurial';
  url: string;
  branch: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'other';
}

export interface CodeMetrics {
  linesOfCode: number;
  files: number;
  directories: number;
  complexity: ComplexityMetrics;
  quality: QualityMetrics;
  coverage: CoverageMetrics;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  halstead: HalsteadMetrics;
}

export interface HalsteadMetrics {
  vocabulary: number;
  length: number;
  difficulty: number;
  effort: number;
  bugs: number;
}

export interface QualityMetrics {
  maintainability: number;
  readability: number;
  testability: number;
  reusability: number;
  issues: Issue[];
}

export interface Issue {
  type: 'error' | 'warning' | 'info' | 'suggestion';
  category: 'syntax' | 'logic' | 'style' | 'performance' | 'security';
  message: string;
  file: string;
  line: number;
  column: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}