/**
 * ビルドエンジン (/sc:build)
 */

import { EventEmitter } from 'events';
import { 
  CommandContext,
  CommandResult,
  ProjectContext,
  PersonaContext,
  ActivationTrigger
} from '../types';
import { getLogger } from '../core/logger';
import { PersonaManager } from '../personas/persona-manager';
import { CursorAPIIntegration } from '../integrations/cursor-api-integration';
import { FileSystemHandlerImpl } from '../integrations/file-system-handler';
import { ContextAnalyzer } from '../core/context-analyzer';

export interface BuildRequest {
  target: BuildTarget;
  environment: BuildEnvironment;
  optimization: OptimizationLevel;
  outputPath?: string;
  includeSources?: boolean;
  includeSourceMaps?: boolean;
  minify?: boolean;
  bundleAnalysis?: boolean;
  customConfig?: Record<string, any>;
}

export type BuildTarget = 'development' | 'production' | 'testing' | 'staging' | 'custom';
export type BuildEnvironment = 'node' | 'browser' | 'electron' | 'mobile' | 'serverless';
export type OptimizationLevel = 'none' | 'basic' | 'advanced' | 'aggressive';

export interface BuildResult {
  success: boolean;
  buildTime: number;
  outputFiles: BuildOutput[];
  artifacts: BuildArtifact[];
  warnings: BuildWarning[];
  errors: BuildError[];
  metrics: BuildMetrics;
  suggestions: string[];
  nextSteps: string[];
}

export interface BuildOutput {
  path: string;
  size: number;
  type: 'javascript' | 'css' | 'html' | 'asset' | 'manifest' | 'map';
  compressed?: boolean;
  sourceMap?: string;
  dependencies?: string[];
}

export interface BuildArtifact {
  name: string;
  path: string;
  type: 'bundle' | 'chunk' | 'asset' | 'manifest' | 'report';
  size: number;
  description: string;
}

export interface BuildWarning {
  type: 'performance' | 'compatibility' | 'security' | 'best-practice';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface BuildError {
  type: 'syntax' | 'type' | 'dependency' | 'configuration' | 'runtime';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface BuildMetrics {
  totalTime: number;
  bundleSize: number;
  chunksCount: number;
  assetsCount: number;
  compressionRatio?: number;
  treeShakingEfficiency?: number;
  cacheHitRate?: number;
}

export interface BuildConfiguration {
  entry: string | string[] | Record<string, string>;
  output: OutputConfiguration;
  optimization: OptimizationConfiguration;
  module: ModuleConfiguration;
  plugins: PluginConfiguration[];
  devServer?: DevServerConfiguration;
}

export interface OutputConfiguration {
  path: string;
  filename: string;
  publicPath?: string;
  format?: 'cjs' | 'esm' | 'umd' | 'iife';
  libraryName?: string;
}

export interface OptimizationConfiguration {
  minimize: boolean;
  splitChunks?: SplitChunksConfiguration;
  treeShaking: boolean;
  deadCodeElimination: boolean;
  runtimeChunk?: boolean;
}

export interface SplitChunksConfiguration {
  chunks: 'all' | 'async' | 'initial';
  minSize: number;
  maxSize?: number;
  cacheGroups?: Record<string, any>;
}

export interface ModuleConfiguration {
  rules: ModuleRule[];
}

export interface ModuleRule {
  test: string | RegExp;
  use: string | LoaderConfiguration[];
  exclude?: string | RegExp;
  include?: string | RegExp;
}

export interface LoaderConfiguration {
  loader: string;
  options?: Record<string, any>;
}

export interface PluginConfiguration {
  name: string;
  options?: Record<string, any>;
}

export interface DevServerConfiguration {
  port: number;
  host: string;
  hot: boolean;
  open: boolean;
  compress: boolean;
}

export class BuildEngine extends EventEmitter {
  private personaManager: PersonaManager;
  private cursorApi: CursorAPIIntegration;
  private fileSystem: FileSystemHandlerImpl;
  private contextAnalyzer: ContextAnalyzer;

  constructor(
    personaManager: PersonaManager,
    cursorApi: CursorAPIIntegration,
    fileSystem: FileSystemHandlerImpl,
    contextAnalyzer: ContextAnalyzer
  ) {
    super();
    this.personaManager = personaManager;
    this.cursorApi = cursorApi;
    this.fileSystem = fileSystem;
    this.contextAnalyzer = contextAnalyzer;
  }

  /**
   * ビルドリクエストを処理
   */
  public async processBuildRequest(
    request: BuildRequest,
    context: CommandContext
  ): Promise<BuildResult> {
    const logger = getLogger();
    const startTime = Date.now();

    try {
      logger.info('ビルドリクエストを処理開始', {
        target: request.target,
        environment: request.environment,
        optimization: request.optimization,
      });

      // プロジェクトコンテキストを取得
      const projectContext = await this.cursorApi.getProjectContext();

      // ペルソナコンテキストを作成
      const personaContext = this.createPersonaContext(request, projectContext, context);

      // ペルソナを選択・活性化
      const selectedPersonas = await this.personaManager.selectPersonas(personaContext);
      const activatedPersonas = await this.personaManager.activatePersonas(selectedPersonas, personaContext);

      if (activatedPersonas.length === 0) {
        throw new Error('適切なペルソナを活性化できませんでした');
      }

      // ビルド設定を生成
      const buildConfig = await this.generateBuildConfiguration(request, projectContext);

      // ビルドを実行
      const result = await this.executeBuild(buildConfig, request, projectContext);

      const totalTime = Date.now() - startTime;

      this.emit('buildCompleted', {
        request,
        result,
        totalTime,
        activatedPersonas: activatedPersonas.map(p => p.getId()),
      });

      logger.info('ビルドリクエスト処理完了', {
        success: result.success,
        buildTime: result.buildTime,
        outputFiles: result.outputFiles.length,
        totalTime,
      });

      return result;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('ビルドリクエスト処理に失敗', {
        error: errorMessage,
        totalTime,
      });

      return {
        success: false,
        buildTime: totalTime,
        outputFiles: [],
        artifacts: [],
        warnings: [],
        errors: [{
          type: 'runtime',
          message: errorMessage,
        }],
        metrics: {
          totalTime,
          bundleSize: 0,
          chunksCount: 0,
          assetsCount: 0,
        },
        suggestions: ['エラーを修正してから再試行してください'],
        nextSteps: [],
      };
    } finally {
      // ペルソナを非活性化
      await this.personaManager.deactivatePersonas();
    }
  }

  /**
   * ビルド設定を生成
   */
  public async generateBuildConfiguration(
    request: BuildRequest,
    projectContext: ProjectContext
  ): Promise<BuildConfiguration> {
    const logger = getLogger();

    try {
      logger.debug('ビルド設定を生成中', {
        target: request.target,
        environment: request.environment,
      });

      // プロジェクトタイプに基づく基本設定
      const baseConfig = this.getBaseConfiguration(projectContext, request);

      // 環境固有の設定
      const environmentConfig = this.getEnvironmentConfiguration(request.environment);

      // 最適化設定
      const optimizationConfig = this.getOptimizationConfiguration(request.optimization, request.target);

      // モジュール設定
      const moduleConfig = await this.getModuleConfiguration(projectContext, request);

      // プラグイン設定
      const pluginsConfig = await this.getPluginsConfiguration(projectContext, request);

      const buildConfig: BuildConfiguration = {
        entry: baseConfig.entry,
        output: {
          ...baseConfig.output,
          ...environmentConfig.output,
        },
        optimization: {
          ...optimizationConfig,
          minimize: request.minify !== false && request.target === 'production',
        },
        module: moduleConfig,
        plugins: pluginsConfig,
        devServer: request.target === 'development' ? this.getDevServerConfiguration() : undefined,
      };

      // カスタム設定をマージ
      if (request.customConfig) {
        this.mergeCustomConfiguration(buildConfig, request.customConfig);
      }

      logger.info('ビルド設定生成完了', {
        entryPoints: Array.isArray(baseConfig.entry) ? baseConfig.entry.length : 1,
        pluginsCount: pluginsConfig.length,
      });

      return buildConfig;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ビルド設定生成に失敗', { error: errorMessage });
      throw error;
    }
  }

  /**
   * ビルドを実行
   */
  public async executeBuild(
    buildConfig: BuildConfiguration,
    request: BuildRequest,
    projectContext: ProjectContext
  ): Promise<BuildResult> {
    const logger = getLogger();
    const buildStartTime = Date.now();

    try {
      logger.debug('ビルド実行開始');

      // 実際のビルドツールの実行はシミュレーション
      const simulationResult = await this.simulateBuild(buildConfig, request, projectContext);

      const buildTime = Date.now() - buildStartTime;

      // ビルド結果を分析
      const analysis = await this.analyzeBuildResult(simulationResult, request);

      // 提案と次のステップを生成
      const suggestions = this.generateBuildSuggestions(simulationResult, analysis);
      const nextSteps = this.generateNextSteps(simulationResult, request);

      const result: BuildResult = {
        success: simulationResult.success,
        buildTime,
        outputFiles: simulationResult.outputs,
        artifacts: simulationResult.artifacts,
        warnings: simulationResult.warnings,
        errors: simulationResult.errors,
        metrics: {
          totalTime: buildTime,
          bundleSize: simulationResult.outputs.reduce((sum, output) => sum + output.size, 0),
          chunksCount: simulationResult.outputs.filter(o => o.type === 'javascript').length,
          assetsCount: simulationResult.outputs.filter(o => o.type === 'asset').length,
          compressionRatio: simulationResult.compressionRatio,
        },
        suggestions,
        nextSteps,
      };

      logger.info('ビルド実行完了', {
        success: result.success,
        buildTime: result.buildTime,
        bundleSize: result.metrics.bundleSize,
      });

      return result;

    } catch (error) {
      const buildTime = Date.now() - buildStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ビルド実行に失敗', { error: errorMessage, buildTime });
      throw error;
    }
  }

  // プライベートメソッド

  /**
   * ペルソナコンテキストを作成
   */
  private createPersonaContext(
    request: BuildRequest,
    projectContext: ProjectContext,
    commandContext: CommandContext
  ): PersonaContext {
    const trigger: ActivationTrigger = {
      type: 'command',
      data: {
        command: 'build',
        target: request.target,
        environment: request.environment,
        optimization: request.optimization,
      },
      timestamp: new Date(),
    };

    return {
      trigger,
      projectContext,
      command: `build: ${request.target} for ${request.environment}`,
      timestamp: new Date(),
    };
  }

  /**
   * ベース設定を取得
   */
  private getBaseConfiguration(
    projectContext: ProjectContext,
    request: BuildRequest
  ): { entry: string; output: OutputConfiguration } {
    // プロジェクトタイプに基づくエントリーポイント検出
    const entry = this.detectEntryPoint(projectContext);

    const outputPath = request.outputPath || this.getDefaultOutputPath(request.target);

    return {
      entry,
      output: {
        path: outputPath,
        filename: request.target === 'production' ? '[name].[contenthash].js' : '[name].js',
        publicPath: '/',
      },
    };
  }

  /**
   * 環境固有の設定を取得
   */
  private getEnvironmentConfiguration(environment: BuildEnvironment) {
    const configs = {
      node: {
        output: {
          libraryTarget: 'commonjs2',
        },
        target: 'node',
      },
      browser: {
        output: {
          libraryTarget: 'var',
        },
        target: 'web',
      },
      electron: {
        output: {
          libraryTarget: 'commonjs2',
        },
        target: 'electron-main',
      },
      mobile: {
        output: {
          libraryTarget: 'var',
        },
        target: 'web',
      },
      serverless: {
        output: {
          libraryTarget: 'commonjs2',
        },
        target: 'node',
      },
    };

    return configs[environment] || configs.browser;
  }

  /**
   * 最適化設定を取得
   */
  private getOptimizationConfiguration(
    level: OptimizationLevel,
    target: BuildTarget
  ): OptimizationConfiguration {
    const baseConfig: OptimizationConfiguration = {
      minimize: target === 'production',
      treeShaking: true,
      deadCodeElimination: true,
    };

    switch (level) {
      case 'none':
        return {
          ...baseConfig,
          minimize: false,
          treeShaking: false,
          deadCodeElimination: false,
        };
      
      case 'basic':
        return baseConfig;
      
      case 'advanced':
        return {
          ...baseConfig,
          splitChunks: {
            chunks: 'all',
            minSize: 20000,
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
              },
            },
          },
          runtimeChunk: true,
        };
      
      case 'aggressive':
        return {
          ...baseConfig,
          splitChunks: {
            chunks: 'all',
            minSize: 10000,
            maxSize: 200000,
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
              },
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                enforce: true,
              },
            },
          },
          runtimeChunk: 'single',
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * モジュール設定を取得
   */
  private async getModuleConfiguration(
    projectContext: ProjectContext,
    request: BuildRequest
  ): Promise<ModuleConfiguration> {
    const rules: ModuleRule[] = [];

    // TypeScript/JavaScript ルール
    if (projectContext.technologies.languages.includes('typescript')) {
      rules.push({
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: request.target === 'development',
            },
          },
        ],
        exclude: /node_modules/,
      });
    }

    rules.push({
      test: /\.jsx?$/,
      use: [
        {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      ],
      exclude: /node_modules/,
    });

    // CSS ルール
    rules.push({
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    });

    // SCSS/SASS ルール
    rules.push({
      test: /\.s[ac]ss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
    });

    // アセットルール
    rules.push({
      test: /\.(png|jpe?g|gif|svg|woff|woff2|eot|ttf)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            outputPath: 'assets/',
          },
        },
      ],
    });

    return { rules };
  }

  /**
   * プラグイン設定を取得
   */
  private async getPluginsConfiguration(
    projectContext: ProjectContext,
    request: BuildRequest
  ): Promise<PluginConfiguration[]> {
    const plugins: PluginConfiguration[] = [];

    // HTML プラグイン
    if (request.environment === 'browser') {
      plugins.push({
        name: 'HtmlWebpackPlugin',
        options: {
          template: 'public/index.html',
          minify: request.target === 'production',
        },
      });
    }

    // バンドル分析プラグイン
    if (request.bundleAnalysis) {
      plugins.push({
        name: 'BundleAnalyzerPlugin',
        options: {
          analyzerMode: 'static',
          openAnalyzer: false,
        },
      });
    }

    // プロダクションビルド用プラグイン
    if (request.target === 'production') {
      plugins.push({
        name: 'CleanWebpackPlugin',
      });

      if (request.includeSourceMaps) {
        plugins.push({
          name: 'SourceMapDevToolPlugin',
          options: {
            filename: '[file].map',
          },
        });
      }
    }

    // 開発サーバー用プラグイン
    if (request.target === 'development') {
      plugins.push({
        name: 'HotModuleReplacementPlugin',
      });
    }

    return plugins;
  }

  /**
   * 開発サーバー設定を取得
   */
  private getDevServerConfiguration(): DevServerConfiguration {
    return {
      port: 3000,
      host: 'localhost',
      hot: true,
      open: true,
      compress: true,
    };
  }

  /**
   * カスタム設定をマージ
   */
  private mergeCustomConfiguration(
    buildConfig: BuildConfiguration,
    customConfig: Record<string, any>
  ): void {
    // 単純なマージ（実際の実装ではより sophisticated なマージが必要）
    Object.assign(buildConfig, customConfig);
  }

  /**
   * ビルドをシミュレート
   */
  private async simulateBuild(
    buildConfig: BuildConfiguration,
    request: BuildRequest,
    projectContext: ProjectContext
  ): Promise<BuildSimulationResult> {
    // 実際のビルドツール実行の代わりにシミュレーション
    const outputs: BuildOutput[] = [
      {
        path: 'dist/main.js',
        size: 125000,
        type: 'javascript',
        compressed: request.minify,
      },
      {
        path: 'dist/main.css',
        size: 15000,
        type: 'css',
        compressed: request.minify,
      },
    ];

    if (request.includeSourceMaps) {
      outputs.push({
        path: 'dist/main.js.map',
        size: 25000,
        type: 'map',
        compressed: false,
      });
    }

    const artifacts: BuildArtifact[] = [
      {
        name: 'main-bundle',
        path: 'dist/main.js',
        type: 'bundle',
        size: 125000,
        description: 'Main application bundle',
      },
    ];

    const warnings: BuildWarning[] = [];
    const errors: BuildError[] = [];

    // パフォーマンス警告
    if (outputs[0].size > 244000) {
      warnings.push({
        type: 'performance',
        message: 'Bundle size is too large',
        suggestion: 'Consider code splitting or optimization',
      });
    }

    return {
      success: errors.length === 0,
      outputs,
      artifacts,
      warnings,
      errors,
      compressionRatio: request.minify ? 0.7 : 1.0,
    };
  }

  /**
   * ビルド結果を分析
   */
  private async analyzeBuildResult(
    simulationResult: BuildSimulationResult,
    request: BuildRequest
  ): Promise<any> {
    // ビルド結果の分析（簡略化）
    return {
      bundleEfficiency: 0.8,
      performanceScore: 85,
      optimizationOpportunities: [],
    };
  }

  /**
   * ビルド提案を生成
   */
  private generateBuildSuggestions(
    simulationResult: BuildSimulationResult,
    analysis: any
  ): string[] {
    const suggestions: string[] = [];

    if (simulationResult.outputs.some(o => o.size > 200000)) {
      suggestions.push('大きなバンドルサイズが検出されました。コード分割を検討してください');
    }

    if (analysis.performanceScore < 80) {
      suggestions.push('パフォーマンススコアが低いです。最適化設定を見直してください');
    }

    return suggestions;
  }

  /**
   * 次のステップを生成
   */
  private generateNextSteps(
    simulationResult: BuildSimulationResult,
    request: BuildRequest
  ): string[] {
    const nextSteps: string[] = [];

    if (simulationResult.success) {
      nextSteps.push('ビルド出力を確認してください');
      
      if (request.target === 'development') {
        nextSteps.push('開発サーバーを起動してテストしてください');
      } else {
        nextSteps.push('本番環境にデプロイしてください');
      }

      if (request.bundleAnalysis) {
        nextSteps.push('バンドル分析結果を確認してください');
      }
    } else {
      nextSteps.push('エラーを修正してから再試行してください');
    }

    return nextSteps;
  }

  // ヘルパーメソッド

  private detectEntryPoint(projectContext: ProjectContext): string {
    // プロジェクトのエントリーポイントを検出
    const commonEntries = [
      'src/index.ts',
      'src/index.js',
      'src/main.ts',
      'src/main.js',
      'index.ts',
      'index.js',
    ];

    for (const entry of commonEntries) {
      const hasEntry = projectContext.structure.files?.some(f => f.path.endsWith(entry));
      if (hasEntry) {
        return entry;
      }
    }

    return 'src/index.js'; // デフォルト
  }

  private getDefaultOutputPath(target: BuildTarget): string {
    const outputPaths = {
      development: 'dist',
      production: 'build',
      testing: 'test-build',
      staging: 'staging-build',
      custom: 'output',
    };

    return outputPaths[target] || 'dist';
  }
}

// ビルドシミュレーション結果の型定義
interface BuildSimulationResult {
  success: boolean;
  outputs: BuildOutput[];
  artifacts: BuildArtifact[];
  warnings: BuildWarning[];
  errors: BuildError[];
  compressionRatio?: number;
}