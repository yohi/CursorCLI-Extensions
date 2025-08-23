import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename, dirname, relative } from 'path';
import { EventEmitter } from 'events';
import { glob } from 'glob';
import {
  ContextAnalyzer as IContextAnalyzer,
  TechnologyStack,
  PatternAnalysis,
  KnowledgeGraph,
  DetectedLanguage,
  DetectedFramework,
  DetectedTool,
  DetectedDatabase,
  Evidence,
  EvidenceType,
  ArchitecturalPattern,
  DesignPattern,
  CodePattern,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeCluster,
  NodeType,
  EdgeType,
  ClusterType,
  ContextChange,
  ChangeType
} from './interfaces.js';
import {
  ProjectContext,
  TechnologyStack as ITechnologyStack,
  ProjectStructure,
  Directory,
  FileInfo,
  FileType,
  DirectoryPurpose,
  Dependency,
  DependencyType,
  DependencySource,
  FrameworkError,
  ErrorSeverity,
  ProjectType,
  ProgrammingLanguage,
  Framework,
  FrameworkType,
  Database,
  DatabaseType,
  DevelopmentTool,
  ToolCategory,
  Platform,
  PlatformType
} from '../types/index.js';

export class ContextAnalysisError extends FrameworkError {
  code = 'CONTEXT_ANALYSIS_ERROR';
  severity = ErrorSeverity.MEDIUM;
  recoverable = true;
}

interface LanguageDetectionRule {
  extensions: string[];
  patterns: RegExp[];
  packageFiles: string[];
  configFiles: string[];
  weight: number;
}

interface FrameworkDetectionRule {
  name: string;
  type: FrameworkType;
  packageNames: string[];
  filePatterns: string[];
  contentPatterns: RegExp[];
  configFiles: string[];
  weight: number;
}

interface DatabaseDetectionRule {
  name: string;
  type: DatabaseType;
  configFiles: string[];
  connectionPatterns: RegExp[];
  packageNames: string[];
  weight: number;
}

export class ContextAnalyzer extends EventEmitter implements IContextAnalyzer {
  private readonly languageRules: Map<string, LanguageDetectionRule> = new Map();
  private readonly frameworkRules: Map<string, FrameworkDetectionRule> = new Map();
  private readonly databaseRules: Map<string, DatabaseDetectionRule> = new Map();
  private readonly knowledgeGraphs: Map<string, KnowledgeGraph> = new Map();

  constructor() {
    super();
    this.initializeDetectionRules();
  }

  private initializeDetectionRules(): void {
    // 言語検出ルール
    this.languageRules.set('javascript', {
      extensions: ['.js', '.mjs', '.cjs'],
      patterns: [/^\/\*[\s\S]*?\*\//, /^\/\/.*$/m, /require\(['"][^'"]+['"]\)/, /import .+ from ['"][^'"]+['"]/],
      packageFiles: ['package.json'],
      configFiles: ['.eslintrc.js', '.babelrc.js', 'webpack.config.js'],
      weight: 100
    });

    this.languageRules.set('typescript', {
      extensions: ['.ts', '.tsx', '.d.ts'],
      patterns: [/interface\s+\w+/, /type\s+\w+\s*=/, /import\s+.*\s+from\s+['"][^'"]+['"]/, /<.*>/],
      packageFiles: ['package.json'],
      configFiles: ['tsconfig.json', '.eslintrc.js'],
      weight: 120
    });

    this.languageRules.set('python', {
      extensions: ['.py', '.pyw', '.pyx'],
      patterns: [/def\s+\w+\s*\(/, /class\s+\w+/, /import\s+\w+/, /from\s+\w+\s+import/],
      packageFiles: ['requirements.txt', 'setup.py', 'pyproject.toml'],
      configFiles: ['setup.cfg', 'tox.ini', '.flake8'],
      weight: 100
    });

    this.languageRules.set('java', {
      extensions: ['.java'],
      patterns: [/public\s+class\s+\w+/, /package\s+[\w.]+;/, /import\s+[\w.]+;/],
      packageFiles: ['pom.xml', 'build.gradle'],
      configFiles: ['maven.config', 'gradle.properties'],
      weight: 100
    });

    this.languageRules.set('go', {
      extensions: ['.go'],
      patterns: [/package\s+\w+/, /func\s+\w+\s*\(/, /import\s+"[^"]+"/],
      packageFiles: ['go.mod', 'go.sum'],
      configFiles: ['go.work'],
      weight: 100
    });

    // フレームワーク検出ルール
    this.frameworkRules.set('react', {
      name: 'React',
      type: FrameworkType.FRONTEND,
      packageNames: ['react', 'react-dom'],
      filePatterns: ['*.jsx', '*.tsx'],
      contentPatterns: [/import React/, /from ['"]react['"]/, /useState/, /useEffect/],
      configFiles: ['.babelrc', 'webpack.config.js'],
      weight: 100
    });

    this.frameworkRules.set('vue', {
      name: 'Vue.js',
      type: FrameworkType.FRONTEND,
      packageNames: ['vue'],
      filePatterns: ['*.vue'],
      contentPatterns: [/<template>/, /<script>/, /Vue\.component/, /createApp/],
      configFiles: ['vue.config.js'],
      weight: 100
    });

    this.frameworkRules.set('next', {
      name: 'Next.js',
      type: FrameworkType.FULLSTACK,
      packageNames: ['next'],
      filePatterns: ['pages/**/*.js', 'pages/**/*.tsx', 'app/**/*.js', 'app/**/*.tsx'],
      contentPatterns: [/getServerSideProps/, /getStaticProps/, /useRouter/],
      configFiles: ['next.config.js'],
      weight: 120
    });

    this.frameworkRules.set('express', {
      name: 'Express.js',
      type: FrameworkType.BACKEND,
      packageNames: ['express'],
      filePatterns: [],
      contentPatterns: [/express\(\)/, /app\.get\(/, /app\.post\(/],
      configFiles: [],
      weight: 100
    });

    this.frameworkRules.set('fastapi', {
      name: 'FastAPI',
      type: FrameworkType.BACKEND,
      packageNames: ['fastapi'],
      filePatterns: [],
      contentPatterns: [/from fastapi/, /FastAPI\(\)/, /@app\.get/, /@app\.post/],
      configFiles: [],
      weight: 100
    });

    this.frameworkRules.set('django', {
      name: 'Django',
      type: FrameworkType.BACKEND,
      packageNames: ['django'],
      filePatterns: ['*/settings.py', '*/urls.py', '*/models.py'],
      contentPatterns: [/from django/, /INSTALLED_APPS/, /urlpatterns/],
      configFiles: ['manage.py'],
      weight: 120
    });

    // データベース検出ルール
    this.databaseRules.set('postgresql', {
      name: 'PostgreSQL',
      type: DatabaseType.SQL,
      configFiles: ['postgresql.conf'],
      connectionPatterns: [/postgresql:\/\//, /psycopg2/, /pg_config/],
      packageNames: ['pg', 'psycopg2', 'postgresql'],
      weight: 100
    });

    this.databaseRules.set('mysql', {
      name: 'MySQL',
      type: DatabaseType.SQL,
      configFiles: ['my.cnf', 'my.ini'],
      connectionPatterns: [/mysql:\/\//, /mysql2/, /pymysql/],
      packageNames: ['mysql', 'mysql2', 'pymysql'],
      weight: 100
    });

    this.databaseRules.set('mongodb', {
      name: 'MongoDB',
      type: DatabaseType.NOSQL,
      configFiles: ['mongod.conf'],
      connectionPatterns: [/mongodb:\/\//, /mongoose/, /pymongo/],
      packageNames: ['mongodb', 'mongoose', 'pymongo'],
      weight: 100
    });

    this.databaseRules.set('redis', {
      name: 'Redis',
      type: DatabaseType.CACHE,
      configFiles: ['redis.conf'],
      connectionPatterns: [/redis:\/\//, /ioredis/],
      packageNames: ['redis', 'ioredis'],
      weight: 100
    });
  }

  async analyzeProject(rootPath: string): Promise<ProjectContext> {
    try {
      this.emit('analysisStarted', { rootPath });

      // プロジェクト構造の解析
      const structure = await this.analyzeProjectStructure(rootPath);
      
      // 技術スタックの検出
      const technologies = await this.detectTechnologyStack(rootPath);
      
      // 依存関係の解析
      const dependencies = await this.analyzeDependencies(rootPath, structure);
      
      // プロジェクトタイプの推定
      const projectType = this.inferProjectType(structure, technologies, dependencies);
      
      // プロジェクトメタデータの収集
      const metadata = await this.collectProjectMetadata(rootPath, structure);

      const projectContext: ProjectContext = {
        rootPath,
        name: basename(rootPath),
        type: projectType,
        technologies: this.convertTechnologyStack(technologies),
        structure,
        dependencies,
        configurations: await this.detectConfigurations(rootPath, structure),
        metadata
      };

      this.emit('analysisCompleted', { projectContext });
      return projectContext;

    } catch (error) {
      const analysisError = error instanceof ContextAnalysisError ? error :
        new ContextAnalysisError(
          `プロジェクト解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          { rootPath }
        );
      
      this.emit('analysisError', { error: analysisError });
      throw analysisError;
    }
  }

  private async analyzeProjectStructure(rootPath: string): Promise<ProjectStructure> {
    const directories: Directory[] = [];
    const files: FileInfo[] = [];

    const traverseDirectory = async (dirPath: string, level: number = 0): Promise<Directory> => {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const directory: Directory = {
        name: basename(dirPath),
        path: dirPath,
        children: [],
        fileCount: 0,
        purpose: this.inferDirectoryPurpose(dirPath, basename(dirPath))
      };

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // 無視するディレクトリ・ファイル
        if (this.shouldIgnore(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (level < 3) { // 深すぎる階層は避ける
            const childDir = await traverseDirectory(fullPath, level + 1);
            directory.children.push(childDir);
            directory.fileCount += childDir.fileCount;
          }
        } else {
          directory.fileCount++;
          
          if (level < 2) { // ファイル情報は浅い階層のみ
            const stats = await stat(fullPath);
            const fileInfo: FileInfo = {
              name: entry.name,
              path: fullPath,
              extension: extname(entry.name),
              size: stats.size,
              lastModified: stats.mtime,
              type: this.inferFileType(entry.name, fullPath),
              language: this.inferLanguageFromExtension(extname(entry.name))
            };
            files.push(fileInfo);
          }
        }
      }

      return directory;
    };

    const rootDirectory = await traverseDirectory(rootPath);
    directories.push(rootDirectory);

    const patterns = await this.identifyStructurePatterns(directories, files);

    return {
      directories,
      files,
      patterns
    };
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'out', 'target',
      '.next', '.nuxt', '.vscode', '.idea',
      '__pycache__', '.pytest_cache', 'venv', 'env',
      'coverage', '.nyc_output', 'logs'
    ];
    
    return ignorePatterns.includes(name) || name.startsWith('.');
  }

  private inferDirectoryPurpose(fullPath: string, name: string): DirectoryPurpose | undefined {
    const purposeMap: Record<string, DirectoryPurpose> = {
      'src': DirectoryPurpose.SOURCE,
      'source': DirectoryPurpose.SOURCE,
      'lib': DirectoryPurpose.SOURCE,
      'app': DirectoryPurpose.SOURCE,
      'test': DirectoryPurpose.TESTS,
      'tests': DirectoryPurpose.TESTS,
      '__tests__': DirectoryPurpose.TESTS,
      'spec': DirectoryPurpose.TESTS,
      'docs': DirectoryPurpose.DOCS,
      'documentation': DirectoryPurpose.DOCS,
      'config': DirectoryPurpose.CONFIG,
      'conf': DirectoryPurpose.CONFIG,
      'build': DirectoryPurpose.BUILD,
      'dist': DirectoryPurpose.BUILD,
      'out': DirectoryPurpose.BUILD,
      'assets': DirectoryPurpose.ASSETS,
      'static': DirectoryPurpose.ASSETS,
      'public': DirectoryPurpose.ASSETS
    };

    return purposeMap[name.toLowerCase()];
  }

  private inferFileType(name: string, fullPath: string): FileType {
    const ext = extname(name).toLowerCase();
    const baseName = basename(name).toLowerCase();

    // 設定ファイル
    if (baseName.includes('config') || baseName.includes('.env') || 
        ['.json', '.yaml', '.yml', '.toml', '.ini'].includes(ext) ||
        ['package.json', 'tsconfig.json', 'webpack.config.js'].includes(baseName)) {
      return FileType.CONFIG;
    }

    // テストファイル
    if (baseName.includes('test') || baseName.includes('spec') || 
        fullPath.includes('/test/') || fullPath.includes('/__tests__/')) {
      return FileType.TEST;
    }

    // ドキュメントファイル
    if (['.md', '.txt', '.rst', '.adoc'].includes(ext) || 
        baseName.includes('readme') || baseName.includes('changelog')) {
      return FileType.DOCUMENTATION;
    }

    // アセットファイル
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.scss', '.sass', '.less'].includes(ext)) {
      return FileType.ASSET;
    }

    // ビルド出力
    if (fullPath.includes('/dist/') || fullPath.includes('/build/') || fullPath.includes('/out/')) {
      return FileType.BUILD_OUTPUT;
    }

    // ソースコードファイル
    if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs'].includes(ext)) {
      return FileType.SOURCE_CODE;
    }

    return FileType.SOURCE_CODE; // デフォルト
  }

  private inferLanguageFromExtension(ext: string): string | undefined {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };

    return languageMap[ext.toLowerCase()];
  }

  private async identifyStructurePatterns(directories: Directory[], files: FileInfo[]): Promise<any[]> {
    const patterns = [];

    // モノレポパターン
    const hasPackages = directories.some(d => d.name === 'packages');
    const hasApps = directories.some(d => d.name === 'apps');
    const hasLernaConfig = files.some(f => f.name === 'lerna.json');
    
    if (hasPackages || hasApps || hasLernaConfig) {
      patterns.push({
        name: 'monorepo',
        description: 'モノレポ構造',
        files: ['lerna.json', 'nx.json', 'rush.json'],
        directories: ['packages', 'apps'],
        confidence: 0.8
      });
    }

    // MVC パターン
    const hasModels = directories.some(d => d.name.includes('model'));
    const hasViews = directories.some(d => d.name.includes('view'));
    const hasControllers = directories.some(d => d.name.includes('controller'));
    
    if (hasModels && hasViews && hasControllers) {
      patterns.push({
        name: 'mvc',
        description: 'Model-View-Controller構造',
        files: [],
        directories: ['models', 'views', 'controllers'],
        confidence: 0.9
      });
    }

    return patterns;
  }

  async detectTechnologyStack(projectPath: string): Promise<TechnologyStack> {
    const languages: DetectedLanguage[] = [];
    const frameworks: DetectedFramework[] = [];
    const tools: DetectedTool[] = [];
    const databases: DetectedDatabase[] = [];

    // ファイル拡張子による言語検出
    const fileExtensions = await this.collectFileExtensions(projectPath);
    for (const [language, rule] of this.languageRules) {
      const confidence = this.calculateLanguageConfidence(fileExtensions, rule);
      if (confidence > 0.1) {
        languages.push({
          name: language,
          confidence,
          fileCount: this.countFilesByExtensions(fileExtensions, rule.extensions),
          evidence: await this.collectLanguageEvidence(projectPath, rule)
        });
      }
    }

    // package.json からの依存関係分析
    const packageInfo = await this.analyzePackageFiles(projectPath);
    for (const [frameworkName, rule] of this.frameworkRules) {
      const confidence = this.calculateFrameworkConfidence(packageInfo, rule);
      if (confidence > 0.1) {
        frameworks.push({
          name: rule.name,
          confidence,
          configFiles: await this.findConfigFiles(projectPath, rule.configFiles),
          evidence: await this.collectFrameworkEvidence(projectPath, rule)
        });
      }
    }

    // データベース検出
    for (const [dbName, rule] of this.databaseRules) {
      const confidence = this.calculateDatabaseConfidence(packageInfo, rule);
      if (confidence > 0.1) {
        databases.push({
          name: rule.name,
          type: rule.type,
          confidence,
          evidence: await this.collectDatabaseEvidence(projectPath, rule)
        });
      }
    }

    return {
      languages: languages.sort((a, b) => b.confidence - a.confidence),
      frameworks: frameworks.sort((a, b) => b.confidence - a.confidence),
      tools,
      databases: databases.sort((a, b) => b.confidence - a.confidence)
    };
  }

  private async collectFileExtensions(projectPath: string): Promise<Map<string, number>> {
    const extensions = new Map<string, number>();
    const files = await glob('**/*', { cwd: projectPath, ignore: ['node_modules/**', '.git/**'] });
    
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext) {
        extensions.set(ext, (extensions.get(ext) || 0) + 1);
      }
    }
    
    return extensions;
  }

  private calculateLanguageConfidence(extensions: Map<string, number>, rule: LanguageDetectionRule): number {
    let score = 0;
    let totalFiles = Array.from(extensions.values()).reduce((sum, count) => sum + count, 0);
    
    if (totalFiles === 0) return 0;
    
    for (const ext of rule.extensions) {
      const count = extensions.get(ext) || 0;
      score += (count / totalFiles) * rule.weight;
    }
    
    return Math.min(score / 100, 1);
  }

  private countFilesByExtensions(extensions: Map<string, number>, targetExtensions: string[]): number {
    return targetExtensions.reduce((count, ext) => count + (extensions.get(ext) || 0), 0);
  }

  private async collectLanguageEvidence(projectPath: string, rule: LanguageDetectionRule): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // パッケージファイルの存在確認
    for (const packageFile of rule.packageFiles) {
      try {
        await stat(join(projectPath, packageFile));
        evidence.push({
          type: EvidenceType.PACKAGE_JSON,
          source: packageFile,
          content: `パッケージファイル: ${packageFile}`,
          weight: 50
        });
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    return evidence;
  }

  private async analyzePackageFiles(projectPath: string): Promise<any> {
    const packageInfo = { dependencies: new Set<string>(), devDependencies: new Set<string>() };

    try {
      // package.json 解析
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => packageInfo.dependencies.add(dep));
      }
      if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => packageInfo.devDependencies.add(dep));
      }
    } catch {
      // package.json が存在しない場合は無視
    }

    return packageInfo;
  }

  private calculateFrameworkConfidence(packageInfo: any, rule: FrameworkDetectionRule): number {
    let score = 0;
    
    for (const packageName of rule.packageNames) {
      if (packageInfo.dependencies.has(packageName) || packageInfo.devDependencies.has(packageName)) {
        score += rule.weight;
        break;
      }
    }
    
    return Math.min(score / 100, 1);
  }

  private calculateDatabaseConfidence(packageInfo: any, rule: DatabaseDetectionRule): number {
    let score = 0;
    
    for (const packageName of rule.packageNames) {
      if (packageInfo.dependencies.has(packageName) || packageInfo.devDependencies.has(packageName)) {
        score += rule.weight;
        break;
      }
    }
    
    return Math.min(score / 100, 1);
  }

  private async findConfigFiles(projectPath: string, configFiles: string[]): Promise<string[]> {
    const foundFiles: string[] = [];
    
    for (const configFile of configFiles) {
      try {
        await stat(join(projectPath, configFile));
        foundFiles.push(configFile);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
    
    return foundFiles;
  }

  private async collectFrameworkEvidence(projectPath: string, rule: FrameworkDetectionRule): Promise<Evidence[]> {
    return []; // 簡略化のため空配列を返す
  }

  private async collectDatabaseEvidence(projectPath: string, rule: DatabaseDetectionRule): Promise<Evidence[]> {
    return []; // 簡略化のため空配列を返す
  }

  async identifyPatterns(files: string[]): Promise<PatternAnalysis> {
    return {
      architecturalPatterns: [],
      designPatterns: [],
      codePatterns: []
    };
  }

  async buildKnowledgeGraph(project: ProjectContext): Promise<KnowledgeGraph> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const clusters: KnowledgeCluster[] = [];

    // プロジェクトをルートノードとして追加
    nodes.push({
      id: 'project-root',
      type: NodeType.MODULE,
      name: project.name,
      properties: {
        type: project.type,
        rootPath: project.rootPath
      }
    });

    this.knowledgeGraphs.set(project.rootPath, { nodes, edges, clusters });
    
    return { nodes, edges, clusters };
  }

  async updateContext(context: ProjectContext, changes: ContextChange[]): Promise<ProjectContext> {
    for (const change of changes) {
      switch (change.type) {
        case ChangeType.FILE_ADDED:
          // ファイル追加時の処理
          break;
        case ChangeType.FILE_MODIFIED:
          // ファイル変更時の処理
          break;
        case ChangeType.FILE_DELETED:
          // ファイル削除時の処理
          break;
        default:
          break;
      }
    }

    return context;
  }

  private convertTechnologyStack(techStack: TechnologyStack): ITechnologyStack {
    return {
      languages: techStack.languages.map(lang => ({
        name: lang.name,
        version: lang.version || 'unknown',
        fileExtensions: this.getExtensionsForLanguage(lang.name),
        packageManager: this.getPackageManagerForLanguage(lang.name)
      })),
      frameworks: techStack.frameworks.map(fw => ({
        name: fw.name,
        version: fw.version || 'unknown',
        type: this.getFrameworkType(fw.name),
        configFiles: fw.configFiles
      })),
      databases: [],
      tools: [],
      platforms: []
    };
  }

  private getExtensionsForLanguage(language: string): string[] {
    const rule = this.languageRules.get(language);
    return rule ? rule.extensions : [];
  }

  private getPackageManagerForLanguage(language: string): string | undefined {
    const packageManagerMap: Record<string, string> = {
      'javascript': 'npm',
      'typescript': 'npm',
      'python': 'pip',
      'java': 'maven',
      'go': 'go mod'
    };
    
    return packageManagerMap[language];
  }

  private getFrameworkType(frameworkName: string): FrameworkType {
    const rule = Array.from(this.frameworkRules.values()).find(r => r.name === frameworkName);
    return rule ? rule.type : FrameworkType.FULLSTACK;
  }

  private inferProjectType(structure: ProjectStructure, technologies: TechnologyStack, dependencies: any[]): ProjectType {
    // Next.js や Nuxt.js などのフルスタックフレームワーク
    if (technologies.frameworks.some(fw => ['Next.js', 'Nuxt.js'].includes(fw.name))) {
      return ProjectType.WEB_APPLICATION;
    }

    // React, Vue などのフロントエンドフレームワーク
    if (technologies.frameworks.some(fw => ['React', 'Vue.js', 'Angular'].includes(fw.name))) {
      return ProjectType.WEB_APPLICATION;
    }

    // Express, FastAPI などのバックエンドフレームワーク
    if (technologies.frameworks.some(fw => ['Express.js', 'FastAPI', 'Django'].includes(fw.name))) {
      return ProjectType.API_SERVICE;
    }

    // パッケージの構造からライブラリと判定
    if (structure.files.some(f => f.name === 'package.json')) {
      try {
        // package.json の main フィールドの確認など
        return ProjectType.LIBRARY;
      } catch {
        // エラーの場合はデフォルトに戻る
      }
    }

    // デフォルト
    return ProjectType.WEB_APPLICATION;
  }

  private async collectProjectMetadata(rootPath: string, structure: ProjectStructure): Promise<any> {
    return {
      createdAt: new Date(),
      lastModified: new Date(),
      version: '0.1.0'
    };
  }

  private async analyzeDependencies(rootPath: string, structure: ProjectStructure): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    try {
      const packageJsonPath = join(rootPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      // 実行時依存関係
      if (packageJson.dependencies) {
        Object.entries(packageJson.dependencies).forEach(([name, version]) => {
          dependencies.push({
            name,
            version: version as string,
            type: DependencyType.RUNTIME,
            source: DependencySource.NPM,
            dev: false
          });
        });
      }

      // 開発時依存関係
      if (packageJson.devDependencies) {
        Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
          dependencies.push({
            name,
            version: version as string,
            type: DependencyType.DEVELOPMENT,
            source: DependencySource.NPM,
            dev: true
          });
        });
      }
    } catch {
      // package.json が存在しない場合は空の配列を返す
    }

    return dependencies;
  }

  private async detectConfigurations(rootPath: string, structure: ProjectStructure): Promise<any[]> {
    return []; // 簡略化のため空配列を返す
  }

  dispose(): void {
    this.languageRules.clear();
    this.frameworkRules.clear();
    this.databaseRules.clear();
    this.knowledgeGraphs.clear();
    this.removeAllListeners();
  }
}

export default ContextAnalyzer;