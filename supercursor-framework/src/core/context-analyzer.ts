/**
 * コンテキストアナライザー
 */

import { readFile, readdir, stat } from 'fs-extra';
import { join, extname, basename, dirname } from 'path';
import { glob } from 'glob';
import {
  ProjectContext,
  ProjectType,
  ProgrammingLanguage,
  Framework,
  Database,
  TechnologyStack,
  ProjectStructure,
  DirectoryNode,
  FileNode,
  Dependency,
  Configuration,
  CodeMetrics,
  Issue
} from '../types';
import { getLogger } from './logger';

export interface ContextAnalysisOptions {
  includeNodeModules: boolean;
  includeDotFiles: boolean;
  maxFileSize: number;
  analysisDepth: number;
  cacheResults: boolean;
}

export class ContextAnalyzer {
  private options: ContextAnalysisOptions;

  constructor(options: Partial<ContextAnalysisOptions> = {}) {
    this.options = {
      includeNodeModules: false,
      includeDotFiles: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      analysisDepth: 5,
      cacheResults: true,
      ...options,
    };
  }

  /**
   * プロジェクトコンテキストを分析
   */
  public async analyzeProject(rootPath: string): Promise<ProjectContext> {
    const startTime = Date.now();
    getLogger().info('プロジェクト分析を開始しています', { rootPath });

    try {
      // 基本情報を収集
      const name = basename(rootPath);
      const structure = await this.analyzeStructure(rootPath);
      const technologies = await this.analyzeTechnologies(rootPath, structure);
      const dependencies = await this.analyzeDependencies(rootPath);
      const configurations = await this.analyzeConfigurations(rootPath);
      const projectType = this.determineProjectType(structure, technologies, dependencies);
      
      const metadata = {
        version: '1.0.0', // デフォルト値
        description: '',
        author: '',
        license: 'MIT',
        keywords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: ProjectContext = {
        rootPath,
        name,
        type: projectType,
        technologies,
        structure,
        dependencies,
        configurations,
        metadata,
      };

      const analysisTime = Date.now() - startTime;
      getLogger().info('プロジェクト分析が完了しました', { 
        rootPath, 
        analysisTime,
        filesAnalyzed: structure.files.length,
        technologiesFound: technologies.languages.length + technologies.frameworks.length
      });

      return context;

    } catch (error) {
      getLogger().error('プロジェクト分析に失敗しました', { rootPath, error });
      throw error;
    }
  }

  /**
   * プロジェクト構造を分析
   */
  public async analyzeStructure(rootPath: string): Promise<ProjectStructure> {
    const directories: DirectoryNode[] = [];
    const files: FileNode[] = [];

    await this.analyzeDirectory(rootPath, rootPath, directories, files, 0);

    return {
      directories,
      files,
      patterns: this.identifyPatterns(directories),
    };
  }

  /**
   * 技術スタックを分析
   */
  public async analyzeTechnologies(rootPath: string, structure?: ProjectStructure): Promise<TechnologyStack> {
    const projectStructure = structure || await this.analyzeStructure(rootPath);

    const languages = this.detectLanguages(projectStructure.files);
    const frameworks = await this.detectFrameworks(rootPath, projectStructure);
    const databases = await this.detectDatabases(rootPath, projectStructure);
    const tools = await this.detectTools(rootPath);
    const platforms = await this.detectPlatforms(rootPath);

    return {
      languages,
      frameworks,
      databases,
      tools,
      platforms,
    };
  }

  /**
   * 依存関係を分析
   */
  public async analyzeDependencies(rootPath: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    // package.json
    const packageJsonPath = join(rootPath, 'package.json');
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      dependencies.push(...this.extractNpmDependencies(packageJson));
    } catch {
      // package.jsonが存在しない場合は無視
    }

    // requirements.txt (Python)
    const requirementsPath = join(rootPath, 'requirements.txt');
    try {
      const requirements = await readFile(requirementsPath, 'utf8');
      dependencies.push(...this.extractPythonDependencies(requirements));
    } catch {
      // requirements.txtが存在しない場合は無視
    }

    // Cargo.toml (Rust)
    const cargoPath = join(rootPath, 'Cargo.toml');
    try {
      const cargoContent = await readFile(cargoPath, 'utf8');
      dependencies.push(...this.extractRustDependencies(cargoContent));
    } catch {
      // Cargo.tomlが存在しない場合は無視
    }

    // pom.xml (Java Maven)
    const pomPath = join(rootPath, 'pom.xml');
    try {
      const pomContent = await readFile(pomPath, 'utf8');
      dependencies.push(...this.extractMavenDependencies(pomContent));
    } catch {
      // pom.xmlが存在しない場合は無視
    }

    return dependencies;
  }

  /**
   * 設定ファイルを分析
   */
  public async analyzeConfigurations(rootPath: string): Promise<Configuration[]> {
    const configurations: Configuration[] = [];
    const configPatterns = [
      '*.json',
      '*.yaml',
      '*.yml',
      '*.toml',
      '*.ini',
      '.env*',
      'Dockerfile*',
      '*config.js',
      '*config.ts',
    ];

    for (const pattern of configPatterns) {
      const files = await glob(pattern, { cwd: rootPath });
      
      for (const file of files) {
        const filePath = join(rootPath, file);
        try {
          const content = await readFile(filePath, 'utf8');
          const config: Configuration = {
            name: basename(file),
            type: this.determineConfigType(file),
            path: filePath,
            format: this.determineConfigFormat(file),
            content: this.parseConfigContent(content, this.determineConfigFormat(file)),
          };
          configurations.push(config);
        } catch (error) {
          getLogger().warn(`設定ファイルの読み込みに失敗しました: ${file}`, { error });
        }
      }
    }

    return configurations;
  }

  /**
   * コードメトリクスを分析
   */
  public async analyzeCodeMetrics(rootPath: string): Promise<CodeMetrics> {
    const structure = await this.analyzeStructure(rootPath);
    const sourceFiles = structure.files.filter(file => this.isSourceFile(file));

    let totalLines = 0;
    const issues: Issue[] = [];

    for (const file of sourceFiles) {
      try {
        const content = await readFile(file.path, 'utf8');
        const lines = content.split('\\n').length;
        totalLines += lines;

        // 簡易的な品質チェック
        const fileIssues = this.analyzeFileQuality(file, content);
        issues.push(...fileIssues);
      } catch (error) {
        getLogger().warn(`ファイルの分析に失敗しました: ${file.path}`, { error });
      }
    }

    return {
      linesOfCode: totalLines,
      files: sourceFiles.length,
      directories: structure.directories.length,
      complexity: {
        cyclomatic: 0, // 実装が必要
        cognitive: 0,  // 実装が必要
        halstead: {
          vocabulary: 0,
          length: 0,
          difficulty: 0,
          effort: 0,
          bugs: 0,
        },
      },
      quality: {
        maintainability: 0,
        readability: 0,
        testability: 0,
        reusability: 0,
        issues,
      },
      coverage: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    };
  }

  /**
   * ディレクトリを再帰的に分析
   */
  private async analyzeDirectory(
    currentPath: string, 
    rootPath: string, 
    directories: DirectoryNode[], 
    files: FileNode[], 
    depth: number
  ): Promise<void> {
    if (depth > this.options.analysisDepth) {
      return;
    }

    try {
      const entries = await readdir(currentPath);

      for (const entry of entries) {
        const fullPath = join(currentPath, entry);
        const relativePath = fullPath.replace(rootPath, '').replace(/^\//, '');

        // スキップ条件
        if (!this.options.includeNodeModules && (entry === 'node_modules' || entry === '.git')) {
          continue;
        }
        if (!this.options.includeDotFiles && entry.startsWith('.')) {
          continue;
        }

        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          const dirNode: DirectoryNode = {
            name: entry,
            path: relativePath,
            type: this.determineDirectoryType(entry),
            children: [],
          };
          directories.push(dirNode);
          await this.analyzeDirectory(fullPath, rootPath, directories, files, depth + 1);

        } else if (stats.isFile() && stats.size <= this.options.maxFileSize) {
          const fileNode: FileNode = {
            name: entry,
            path: relativePath,
            type: this.determineFileType(entry),
            size: stats.size,
            lastModified: stats.mtime,
            language: this.detectFileLanguage(entry) || undefined,
          };
          files.push(fileNode);
        }
      }
    } catch (error) {
      getLogger().warn(`ディレクトリの分析に失敗しました: ${currentPath}`, { error });
    }
  }

  /**
   * 言語を検出
   */
  private detectLanguages(files: FileNode[]): ProgrammingLanguage[] {
    const languageMap = new Map<ProgrammingLanguage, number>();

    for (const file of files) {
      if (file.language) {
        languageMap.set(file.language, (languageMap.get(file.language) || 0) + 1);
      }
    }

    // ファイル数の多い順にソート
    return Array.from(languageMap.keys()).sort((a, b) => {
      return (languageMap.get(b) || 0) - (languageMap.get(a) || 0);
    });
  }

  /**
   * フレームワークを検出
   */
  private async detectFrameworks(rootPath: string, structure: ProjectStructure): Promise<Framework[]> {
    const frameworks: Framework[] = [];

    // package.jsonからフレームワークを検出
    try {
      const packageJsonPath = join(rootPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['react']) frameworks.push('react');
      if (deps['vue']) frameworks.push('vue');
      if (deps['@angular/core']) frameworks.push('angular');
      if (deps['svelte']) frameworks.push('svelte');
      if (deps['next']) frameworks.push('nextjs');
      if (deps['nuxt']) frameworks.push('nuxtjs');
      if (deps['express']) frameworks.push('express');
      if (deps['fastify']) frameworks.push('fastify');
      if (deps['@nestjs/core']) frameworks.push('nestjs');
    } catch {
      // package.jsonが存在しない場合は無視
    }

    // ファイル名からフレームワークを検出
    const hasFile = (pattern: string): boolean => {
      return structure.files.some(file => file.name.match(pattern));
    };

    if (hasFile('requirements\\.txt') || hasFile('.*\\.py$')) {
      if (hasFile('manage\\.py') || hasFile('django')) frameworks.push('django');
      if (hasFile('app\\.py') || hasFile('flask')) frameworks.push('flask');
    }

    return frameworks;
  }

  /**
   * データベースを検出
   */
  private async detectDatabases(rootPath: string, structure: ProjectStructure): Promise<Database[]> {
    const databases: Database[] = [];

    // 設定ファイルからデータベースを検出
    const configFiles = structure.files.filter(file => 
      file.name.includes('config') || file.name.includes('database') || file.name.includes('db')
    );

    for (const file of configFiles) {
      try {
        const content = await readFile(join(rootPath, file.path), 'utf8');
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('mysql')) databases.push('mysql');
        if (lowerContent.includes('postgres') || lowerContent.includes('postgresql')) databases.push('postgresql');
        if (lowerContent.includes('mongodb') || lowerContent.includes('mongo')) databases.push('mongodb');
        if (lowerContent.includes('sqlite')) databases.push('sqlite');
        if (lowerContent.includes('redis')) databases.push('redis');
        if (lowerContent.includes('elasticsearch')) databases.push('elasticsearch');
      } catch {
        // ファイル読み込みエラーは無視
      }
    }

    return [...new Set(databases)]; // 重複を除去
  }

  /**
   * 開発ツールを検出
   */
  private async detectTools(rootPath: string): Promise<Array<{name: string; version: string; category: 'bundler' | 'linter' | 'formatter' | 'tester' | 'deployer' | 'other'}>> {
    const tools: Array<{name: string; version: string; category: 'bundler' | 'linter' | 'formatter' | 'tester' | 'deployer' | 'other'}> = [];

    try {
      const packageJsonPath = join(rootPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // 各種ツールを検出
      const toolMappings = [
        { name: 'webpack', category: 'bundler' as const },
        { name: 'vite', category: 'bundler' as const },
        { name: 'rollup', category: 'bundler' as const },
        { name: 'eslint', category: 'linter' as const },
        { name: 'tslint', category: 'linter' as const },
        { name: 'prettier', category: 'formatter' as const },
        { name: 'jest', category: 'tester' as const },
        { name: 'mocha', category: 'tester' as const },
        { name: 'cypress', category: 'tester' as const },
        { name: 'docker', category: 'deployer' as const },
      ];

      for (const tool of toolMappings) {
        if (deps[tool.name]) {
          tools.push({
            name: tool.name,
            version: deps[tool.name],
            category: tool.category,
          });
        }
      }
    } catch {
      // package.jsonが存在しない場合は無視
    }

    return tools;
  }

  /**
   * プラットフォームを検出
   */
  private async detectPlatforms(rootPath: string): Promise<Array<{name: string; version: string; type: 'runtime' | 'cloud' | 'container' | 'ci-cd'}>> {
    const platforms: Array<{name: string; version: string; type: 'runtime' | 'cloud' | 'container' | 'ci-cd'}> = [];

    // Node.jsバージョンを検出
    try {
      const packageJsonPath = join(rootPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      
      if (packageJson.engines?.node) {
        platforms.push({
          name: 'Node.js',
          version: packageJson.engines.node,
          type: 'runtime',
        });
      }
    } catch {
      // package.jsonが存在しない場合は無視
    }

    // Dockerを検出
    try {
      await readFile(join(rootPath, 'Dockerfile'), 'utf8');
      platforms.push({
        name: 'Docker',
        version: 'latest',
        type: 'container',
      });
    } catch {
      // Dockerfileが存在しない場合は無視
    }

    return platforms;
  }

  /**
   * プロジェクトタイプを決定
   */
  private determineProjectType(structure: ProjectStructure, technologies: TechnologyStack, dependencies: Dependency[]): ProjectType {
    // フレームワークベースの判定
    if (technologies.frameworks.some(fw => ['react', 'vue', 'angular', 'svelte'].includes(fw))) {
      return 'web-application';
    }

    if (technologies.frameworks.some(fw => ['express', 'fastify', 'nestjs', 'django', 'flask'].includes(fw))) {
      return 'api';
    }

    // ディレクトリ構造ベースの判定
    const hasPublicDir = structure.directories.some(dir => dir.name === 'public');
    const hasSrcDir = structure.directories.some(dir => dir.name === 'src');
    const hasLibDir = structure.directories.some(dir => dir.name === 'lib');

    if (hasPublicDir && hasSrcDir) {
      return 'web-application';
    }

    if (hasLibDir) {
      return 'library';
    }

    // デフォルト
    return 'unknown';
  }

  private identifyPatterns(directories: DirectoryNode[]): Array<{name: string; type: 'mvc' | 'component' | 'layer' | 'module' | 'package'; directories: string[]; conventions: Array<{type: 'naming' | 'structure' | 'organization'; pattern: string; description: string}>}> {
    // パターン識別ロジックの実装
    return [];
  }

  private determineDirectoryType(name: string): 'source' | 'test' | 'config' | 'docs' | 'build' | 'assets' | 'other' {
    if (name.includes('test') || name.includes('spec')) return 'test';
    if (name.includes('config') || name === 'conf') return 'config';
    if (name.includes('doc') || name === 'docs') return 'docs';
    if (name === 'build' || name === 'dist' || name === 'out') return 'build';
    if (name === 'assets' || name === 'static' || name === 'public') return 'assets';
    if (name === 'src' || name === 'lib' || name === 'source') return 'source';
    return 'other';
  }

  private determineFileType(name: string): 'source' | 'config' | 'test' | 'doc' | 'asset' | 'other' {
    const ext = extname(name).toLowerCase();
    
    if (name.includes('test') || name.includes('spec')) return 'test';
    if (name.includes('config') || ['.json', '.yaml', '.yml', '.toml', '.ini'].includes(ext)) return 'config';
    if (['.md', '.txt', '.rst'].includes(ext)) return 'doc';
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) return 'asset';
    if (['.ts', '.js', '.py', '.java', '.cpp', '.c', '.rs', '.go'].includes(ext)) return 'source';
    
    return 'other';
  }

  private detectFileLanguage(filename: string): ProgrammingLanguage | undefined {
    const ext = extname(filename).toLowerCase();
    const languageMap: Record<string, ProgrammingLanguage> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cpp': 'cpp',
      '.c': 'c',
    };

    return languageMap[ext];
  }

  private extractNpmDependencies(packageJson: any): Dependency[] {
    const dependencies: Dependency[] = [];
    
    const addDeps = (deps: Record<string, string>, type: 'runtime' | 'development'): void => {
      for (const [name, version] of Object.entries(deps)) {
        dependencies.push({
          name,
          version,
          type,
          source: 'npm',
        });
      }
    };

    if (packageJson.dependencies) {
      addDeps(packageJson.dependencies, 'runtime');
    }
    if (packageJson.devDependencies) {
      addDeps(packageJson.devDependencies, 'development');
    }

    return dependencies;
  }

  private extractPythonDependencies(requirementsContent: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = requirementsContent.split('\\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)([>=<~!]+(.+))?$/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[3] ?? 'latest',
            type: 'runtime',
            source: 'pip',
          });
        }
      }
    }

    return dependencies;
  }

  private extractRustDependencies(cargoContent: string): Dependency[] {
    // Cargo.tomlのパースは簡略化
    return [];
  }

  private extractMavenDependencies(pomContent: string): Dependency[] {
    // pom.xmlのパースは簡略化
    return [];
  }

  private determineConfigType(filename: string): 'build' | 'lint' | 'test' | 'deploy' | 'env' | 'other' {
    const name = filename.toLowerCase();
    
    if (name.includes('webpack') || name.includes('vite') || name.includes('rollup')) return 'build';
    if (name.includes('eslint') || name.includes('tslint') || name.includes('prettier')) return 'lint';
    if (name.includes('jest') || name.includes('test') || name.includes('spec')) return 'test';
    if (name.includes('docker') || name.includes('deploy') || name.includes('ci')) return 'deploy';
    if (name.includes('env')) return 'env';
    
    return 'other';
  }

  private determineConfigFormat(filename: string): 'json' | 'yaml' | 'toml' | 'xml' | 'ini' | 'js' | 'ts' {
    const ext = extname(filename).toLowerCase();
    
    switch (ext) {
      case '.json': return 'json';
      case '.yaml':
      case '.yml': return 'yaml';
      case '.toml': return 'toml';
      case '.xml': return 'xml';
      case '.ini': return 'ini';
      case '.js': return 'js';
      case '.ts': return 'ts';
      default: return 'json';
    }
  }

  private parseConfigContent(content: string, format: 'json' | 'yaml' | 'toml' | 'xml' | 'ini' | 'js' | 'ts'): any {
    try {
      switch (format) {
        case 'json':
          return JSON.parse(content);
        case 'yaml':
          // YAML パースの実装が必要
          return {};
        default:
          return {};
      }
    } catch {
      return {};
    }
  }

  private isSourceFile(file: FileNode): boolean {
    return file.type === 'source';
  }

  private analyzeFileQuality(file: FileNode, content: string): Issue[] {
    const issues: Issue[] = [];
    
    // 簡易的な品質チェック
    const lines = content.split('\\n');
    
    // 長すぎる行をチェック
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          type: 'warning',
          category: 'style',
          message: '行が長すぎます',
          file: file.path,
          line: index + 1,
          column: line.length,
          severity: 'low',
        });
      }
    });

    // TODO コメントをチェック
    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          type: 'info',
          category: 'logic',
          message: 'TODOまたはFIXMEコメントが見つかりました',
          file: file.path,
          line: index + 1,
          column: line.indexOf('TODO') !== -1 ? line.indexOf('TODO') : line.indexOf('FIXME'),
          severity: 'low',
        });
      }
    });

    return issues;
  }
}