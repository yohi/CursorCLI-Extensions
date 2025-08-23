/**
 * 統合関連の型定義
 */

export interface CursorIntegration {
  executeCommand(command: string, options: CursorOptions): Promise<CursorResult>;
  readFile(path: string): Promise<FileContent>;
  writeFile(path: string, content: string, options: WriteOptions): Promise<WriteResult>;
  searchCode(query: string, scope: SearchScope): Promise<SearchResult[]>;
  getProjectContext(): Promise<import('./project').ProjectContext>;
}

export interface CursorOptions {
  timeout?: number;
  format?: 'text' | 'json' | 'stream-json';
  verbose?: boolean;
}

export interface CursorResult {
  success: boolean;
  output: string;
  error?: string;
  metadata: ResultMetadata;
}

export interface ResultMetadata {
  executionTime: number;
  tokensUsed?: number;
  model?: string;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: Date;
}

export interface WriteOptions {
  encoding?: string;
  createDirs?: boolean;
  backup?: boolean;
  permissions?: FilePermissions;
}

export interface FilePermissions {
  owner?: string;
  group?: string;
  mode?: string;
}

export interface WriteResult {
  success: boolean;
  path: string;
  size: number;
  checksum?: string;
}

export interface SearchScope {
  directories?: string[];
  fileTypes?: string[];
  excludePatterns?: string[];
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
  score: number;
}

export interface GitIntegration {
  getStatus(): Promise<GitStatus>;
  getBranches(): Promise<Branch[]>;
  getCommits(options: CommitOptions): Promise<Commit[]>;
  createBranch(name: string, from?: string): Promise<void>;
  switchBranch(name: string): Promise<void>;
  commit(message: string, files?: string[]): Promise<CommitResult>;
  push(remote?: string, branch?: string): Promise<void>;
  pull(remote?: string, branch?: string): Promise<void>;
  merge(branch: string): Promise<MergeResult>;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicts: string[];
}

export interface Branch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  lastCommit: CommitSummary;
}

export interface CommitOptions {
  branch?: string;
  since?: Date;
  until?: Date;
  author?: string;
  maxCount?: number;
}

export interface Commit {
  hash: string;
  shortHash: string;
  author: Author;
  date: Date;
  message: string;
  files: FileChange[];
}

export interface Author {
  name: string;
  email: string;
}

export interface CommitSummary {
  hash: string;
  date: Date;
  message: string;
  author: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  insertions: number;
  deletions: number;
}

export interface CommitResult {
  hash: string;
  message: string;
  files: string[];
}

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  merged: string[];
}

export interface CIIntegration {
  getPipelines(): Promise<Pipeline[]>;
  getPipelineStatus(id: string): Promise<PipelineStatus>;
  triggerPipeline(config: PipelineConfig): Promise<PipelineRun>;
  cancelPipeline(id: string): Promise<void>;
  getLogs(runId: string): Promise<PipelineLogs>;
}

export interface Pipeline {
  id: string;
  name: string;
  status: PipelineStatusType;
  branch: string;
  commit: string;
  trigger: PipelineTrigger;
  createdAt: Date;
  duration?: number;
}

export interface PipelineStatus {
  id: string;
  status: PipelineStatusType;
  stages: PipelineStage[];
  startedAt: Date;
  finishedAt?: Date;
  duration?: number;
}

export type PipelineStatusType = 
  | 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';

export interface PipelineStage {
  name: string;
  status: PipelineStatusType;
  jobs: PipelineJob[];
  startedAt?: Date;
  finishedAt?: Date;
}

export interface PipelineJob {
  name: string;
  status: PipelineStatusType;
  commands: string[];
  output?: string;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

export type PipelineTrigger = 'push' | 'pull_request' | 'schedule' | 'manual' | 'api';

export interface PipelineConfig {
  name: string;
  trigger: PipelineTrigger;
  stages: StageConfig[];
  environment?: Record<string, string>;
}

export interface StageConfig {
  name: string;
  jobs: JobConfig[];
  condition?: string;
}

export interface JobConfig {
  name: string;
  image?: string;
  commands: string[];
  environment?: Record<string, string>;
  artifacts?: ArtifactConfig[];
}

export interface ArtifactConfig {
  name: string;
  paths: string[];
  retention?: number;
}

export interface PipelineRun {
  id: string;
  url: string;
  status: PipelineStatusType;
}

export interface PipelineLogs {
  runId: string;
  stages: StageLogs[];
  fullLog: string;
}

export interface StageLogs {
  name: string;
  jobs: JobLogs[];
}

export interface JobLogs {
  name: string;
  output: string;
  error?: string;
}

// ファイルシステム統合用の型定義
export interface FileSystemHandler {
  readDirectory(path: string, recursive?: boolean): Promise<DirectoryListing>;
  createFile(path: string, content: string, permissions?: FilePermissions): Promise<void>;
  updateFile(path: string, changes: FileChange[]): Promise<void>;
  deleteFile(path: string, options?: DeleteOptions): Promise<void>;
  watchFiles(patterns: string[], callback: FileWatchCallback): Promise<FileWatcher>;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  totalItems: number;
  totalSize: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  lastModified?: Date;
  permissions?: string;
}

export interface DeleteOptions {
  recursive?: boolean;
  force?: boolean;
  backup?: boolean;
}

export interface FileWatchEvent {
  type: 'changed' | 'renamed' | 'deleted';
  path: string;
  timestamp: Date;
}

export type FileWatchCallback = (event: FileWatchEvent) => void;

export interface FileWatcher {
  id: string;
  patterns: string[];
  isActive: boolean;
  stop(): void;
}