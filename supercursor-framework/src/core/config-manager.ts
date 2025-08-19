import { readFile, writeFile, access, constants } from 'fs/promises';
import { resolve, dirname, join } from 'path';
import { homedir } from 'os';
import { cosmiconfig } from 'cosmiconfig';
import Joi from 'joi';
import yaml from 'yaml';
import ini from 'ini';
import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import {
  ConfigManager as IConfigManager,
  FrameworkConfiguration,
  ValidationResult,
  EnvironmentConfiguration,
  LogLevel,
  OutputFormat,
  CacheProvider,
  BranchStrategy,
  NotificationType,
  AuditEvent,
  CacheStrategy,
  HealthStatus
} from './interfaces.js';
import { FrameworkError, ErrorSeverity } from '../types/index.js';

export class ConfigurationError extends FrameworkError {
  code = 'CONFIG_ERROR';
  severity = ErrorSeverity.HIGH;
  recoverable = true;
}

export class ConfigManager extends EventEmitter implements IConfigManager {
  private static instance: ConfigManager;
  private config: FrameworkConfiguration | null = null;
  private configPath: string | null = null;
  private watcher: FSWatcher | null = null;
  private readonly explorer = cosmiconfig('supercursor');

  private readonly schema = Joi.object({
    version: Joi.string().required(),
    global: Joi.object({
      language: Joi.string().default('ja'),
      logLevel: Joi.string().valid(...Object.values(LogLevel)).default(LogLevel.INFO),
      outputFormat: Joi.string().valid(...Object.values(OutputFormat)).default(OutputFormat.TEXT),
      cacheEnabled: Joi.boolean().default(true),
      telemetryEnabled: Joi.boolean().default(false)
    }).required(),
    commands: Joi.object({
      timeout: Joi.number().min(1000).max(300000).default(30000),
      retries: Joi.number().min(0).max(10).default(3),
      parallel: Joi.boolean().default(false),
      cache: Joi.object({
        enabled: Joi.boolean().default(true),
        ttl: Joi.number().min(60).max(86400).default(3600),
        maxSize: Joi.number().min(10).max(10000).default(1000),
        provider: Joi.string().valid(...Object.values(CacheProvider)).default(CacheProvider.MEMORY)
      }).required()
    }).required(),
    personas: Joi.object({
      defaultPersona: Joi.string().default('general'),
      switchingEnabled: Joi.boolean().default(true),
      confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
      customPersonas: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        config: Joi.object().required(),
        enabled: Joi.boolean().default(true)
      })).default([])
    }).required(),
    integrations: Joi.object({
      cursor: Joi.object({
        apiKey: Joi.string().allow(''),
        baseUrl: Joi.string().uri().allow(''),
        timeout: Joi.number().min(1000).max(120000).default(30000),
        rateLimiting: Joi.object({
          requests: Joi.number().min(1).max(1000).default(100),
          timeWindow: Joi.number().min(1000).max(3600000).default(60000),
          burstLimit: Joi.number().min(1).max(100).default(10)
        }).required()
      }).required(),
      git: Joi.object({
        autoCommit: Joi.boolean().default(false),
        commitMessageTemplate: Joi.string().default('{type}: {description}'),
        branchStrategy: Joi.string().valid(...Object.values(BranchStrategy)).default(BranchStrategy.MAIN)
      }).required(),
      ci: Joi.object({
        provider: Joi.string().default('bitbucket'),
        webhook: Joi.string().uri().allow(''),
        notifications: Joi.array().items(Joi.object({
          type: Joi.string().valid(...Object.values(NotificationType)).required(),
          endpoint: Joi.string().required(),
          events: Joi.array().items(Joi.string()).required()
        })).default([])
      }).required()
    }).required(),
    security: Joi.object({
      permissions: Joi.object({
        strictMode: Joi.boolean().default(true),
        fileAccess: Joi.object({
          allowedPaths: Joi.array().items(Joi.string()).default(['.']),
          deniedPaths: Joi.array().items(Joi.string()).default(['node_modules', '.git']),
          readOnly: Joi.boolean().default(false)
        }).required(),
        systemAccess: Joi.object({
          allowedCommands: Joi.array().items(Joi.string()).default([]),
          deniedCommands: Joi.array().items(Joi.string()).default(['rm', 'del', 'format']),
          allowShellAccess: Joi.boolean().default(false)
        }).required()
      }).required(),
      encryption: Joi.object({
        algorithm: Joi.string().default('aes-256-gcm'),
        keySize: Joi.number().valid(128, 192, 256).default(256),
        saltRounds: Joi.number().min(8).max(20).default(12)
      }).required(),
      audit: Joi.object({
        enabled: Joi.boolean().default(true),
        logFile: Joi.string().default('audit.log'),
        events: Joi.array().items(Joi.string().valid(...Object.values(AuditEvent))).default(Object.values(AuditEvent))
      }).required()
    }).required(),
    performance: Joi.object({
      monitoring: Joi.object({
        enabled: Joi.boolean().default(true),
        metricsInterval: Joi.number().min(1000).max(300000).default(30000),
        memoryThreshold: Joi.number().min(0.1).max(0.95).default(0.8),
        cpuThreshold: Joi.number().min(0.1).max(0.95).default(0.8)
      }).required(),
      optimization: Joi.object({
        parallelProcessing: Joi.boolean().default(true),
        maxWorkers: Joi.number().min(1).max(16).default(4),
        memoryLimit: Joi.number().min(128).max(8192).default(2048),
        cacheStrategy: Joi.string().valid(...Object.values(CacheStrategy)).default(CacheStrategy.LRU)
      }).required()
    }).required()
  });

  private constructor() {
    super();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async loadConfiguration(path?: string): Promise<FrameworkConfiguration> {
    try {
      const result = path 
        ? await this.loadFromFile(path)
        : await this.explorer.search();

      if (!result) {
        return this.createDefaultConfiguration();
      }

      this.configPath = result.filepath;
      const config = result.config as FrameworkConfiguration;
      
      const validation = await this.validateConfiguration(config);
      if (!validation.valid) {
        throw new ConfigurationError(
          `設定ファイルの検証に失敗しました: ${validation.errors.map(e => e.message).join(', ')}`,
          { errors: validation.errors }
        );
      }

      this.config = config;
      this.startWatching();
      this.emit('configLoaded', config);
      
      return config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  private async loadFromFile(filePath: string): Promise<{ config: any; filepath: string }> {
    const resolvedPath = resolve(filePath);
    
    try {
      await access(resolvedPath, constants.R_OK);
    } catch {
      throw new ConfigurationError(`設定ファイルが見つからないか読み取り権限がありません: ${resolvedPath}`);
    }

    const content = await readFile(resolvedPath, 'utf-8');
    const config = this.parseConfigContent(content, resolvedPath);

    return { config, filepath: resolvedPath };
  }

  private parseConfigContent(content: string, filePath: string): any {
    const ext = filePath.toLowerCase();

    try {
      if (ext.endsWith('.json')) {
        return JSON.parse(content);
      } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
        return yaml.parse(content);
      } else if (ext.endsWith('.ini')) {
        return ini.parse(content);
      } else if (ext.endsWith('.js') || ext.endsWith('.ts')) {
        // 動的インポートは実際の実装では危険なので、より安全な方法を検討
        throw new ConfigurationError('JavaScript/TypeScript設定ファイルは現在サポートされていません');
      } else {
        // デフォルトでJSONとして解析を試行
        return JSON.parse(content);
      }
    } catch (error) {
      throw new ConfigurationError(
        `設定ファイルの解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { filePath, originalError: error }
      );
    }
  }

  private createDefaultConfiguration(): FrameworkConfiguration {
    const defaultConfig: FrameworkConfiguration = {
      version: '0.1.0',
      global: {
        language: 'ja',
        logLevel: LogLevel.INFO,
        outputFormat: OutputFormat.TEXT,
        cacheEnabled: true,
        telemetryEnabled: false
      },
      commands: {
        timeout: 30000,
        retries: 3,
        parallel: false,
        cache: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
          provider: CacheProvider.MEMORY
        }
      },
      personas: {
        defaultPersona: 'general',
        switchingEnabled: true,
        confidenceThreshold: 0.7,
        customPersonas: []
      },
      integrations: {
        cursor: {
          timeout: 30000,
          rateLimiting: {
            requests: 100,
            timeWindow: 60000,
            burstLimit: 10
          }
        },
        git: {
          autoCommit: false,
          commitMessageTemplate: '{type}: {description}',
          branchStrategy: BranchStrategy.MAIN
        },
        ci: {
          provider: 'bitbucket',
          notifications: []
        }
      },
      security: {
        permissions: {
          strictMode: true,
          fileAccess: {
            allowedPaths: ['.'],
            deniedPaths: ['node_modules', '.git'],
            readOnly: false
          },
          systemAccess: {
            allowedCommands: [],
            deniedCommands: ['rm', 'del', 'format'],
            allowShellAccess: false
          }
        },
        encryption: {
          algorithm: 'aes-256-gcm',
          keySize: 256,
          saltRounds: 12
        },
        audit: {
          enabled: true,
          logFile: 'audit.log',
          events: Object.values(AuditEvent)
        }
      },
      performance: {
        monitoring: {
          enabled: true,
          metricsInterval: 30000,
          memoryThreshold: 0.8,
          cpuThreshold: 0.8
        },
        optimization: {
          parallelProcessing: true,
          maxWorkers: 4,
          memoryLimit: 2048,
          cacheStrategy: CacheStrategy.LRU
        }
      }
    };

    this.config = defaultConfig;
    return defaultConfig;
  }

  async validateConfiguration(config: FrameworkConfiguration): Promise<ValidationResult> {
    try {
      const { error, value } = this.schema.validate(config, { 
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        return {
          valid: false,
          errors: error.details.map(detail => ({
            code: 'VALIDATION_ERROR',
            message: detail.message,
            field: detail.path.join('.'),
            severity: 'error' as const
          })),
          warnings: []
        };
      }

      // カスタム検証ロジック
      const warnings = await this.performCustomValidation(value);

      return {
        valid: true,
        errors: [],
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'VALIDATION_EXCEPTION',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error' as const
        }],
        warnings: []
      };
    }
  }

  private async performCustomValidation(config: FrameworkConfiguration): Promise<ValidationResult['warnings']> {
    const warnings: ValidationResult['warnings'] = [];

    // パフォーマンス設定の警告
    if (config.performance.optimization.maxWorkers > 8) {
      warnings.push({
        code: 'PERF_WARNING',
        message: 'maxWorkersが8を超えています。システムのパフォーマンスに影響する可能性があります。',
        suggestion: 'maxWorkersを4-8の範囲に設定することを推奨します。'
      });
    }

    // セキュリティ設定の警告
    if (!config.security.permissions.strictMode) {
      warnings.push({
        code: 'SECURITY_WARNING',
        message: 'strictModeが無効になっています。セキュリティリスクが高まります。',
        suggestion: '本番環境ではstrictModeを有効にすることを強く推奨します。'
      });
    }

    // API キーの警告（環境変数での設定を推奨）
    if (config.integrations.cursor.apiKey) {
      warnings.push({
        code: 'SECURITY_WARNING',
        message: '設定ファイルにAPIキーが含まれています。',
        suggestion: 'APIキーは環境変数CURSOR_API_KEYで設定することを推奨します。'
      });
    }

    return warnings;
  }

  async saveConfiguration(config: FrameworkConfiguration, path?: string): Promise<void> {
    const targetPath = path || this.configPath || join(process.cwd(), 'supercursor.config.json');

    const validation = await this.validateConfiguration(config);
    if (!validation.valid) {
      throw new ConfigurationError(
        `保存する設定が無効です: ${validation.errors.map(e => e.message).join(', ')}`,
        { errors: validation.errors }
      );
    }

    try {
      // バックアップの作成
      await this.createBackup(targetPath);

      const content = this.formatConfigContent(config, targetPath);
      await writeFile(targetPath, content, 'utf-8');

      this.config = config;
      this.configPath = targetPath;
      this.emit('configSaved', config);
    } catch (error) {
      throw new ConfigurationError(
        `設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        { path: targetPath, originalError: error }
      );
    }
  }

  private formatConfigContent(config: FrameworkConfiguration, filePath: string): string {
    const ext = filePath.toLowerCase();

    if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
      return yaml.stringify(config, { indent: 2 });
    } else if (ext.endsWith('.ini')) {
      return ini.stringify(config);
    } else {
      return JSON.stringify(config, null, 2);
    }
  }

  private async createBackup(filePath: string): Promise<void> {
    try {
      await access(filePath, constants.R_OK);
      const backupPath = `${filePath}.backup.${Date.now()}`;
      const content = await readFile(filePath, 'utf-8');
      await writeFile(backupPath, content, 'utf-8');
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  async reloadConfiguration(): Promise<void> {
    if (this.configPath) {
      await this.loadConfiguration(this.configPath);
      this.emit('configReloaded', this.config);
    }
  }

  async getEnvironmentConfig(environment: string): Promise<EnvironmentConfiguration> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    const baseConfig = this.config!;
    const envConfigPath = this.getEnvironmentConfigPath(environment);

    try {
      const result = await this.loadFromFile(envConfigPath);
      const envConfig = result.config as Partial<FrameworkConfiguration>;

      return {
        ...baseConfig,
        environment,
        overrides: envConfig,
        // 環境固有の設定をマージ
        ...this.mergeConfigurations([baseConfig, envConfig as FrameworkConfiguration])
      } as EnvironmentConfiguration;
    } catch {
      // 環境固有の設定ファイルが存在しない場合はベース設定を返す
      return {
        ...baseConfig,
        environment,
        overrides: {}
      } as EnvironmentConfiguration;
    }
  }

  private getEnvironmentConfigPath(environment: string): string {
    const baseDir = this.configPath ? dirname(this.configPath) : process.cwd();
    return join(baseDir, `supercursor.${environment}.config.json`);
  }

  async mergeConfigurations(configs: FrameworkConfiguration[]): Promise<FrameworkConfiguration> {
    if (configs.length === 0) {
      return this.createDefaultConfiguration();
    }

    if (configs.length === 1) {
      return configs[0]!;
    }

    // 深いマージ処理
    return configs.reduce((merged, current) => this.deepMerge(merged, current));
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private startWatching(): void {
    if (this.watcher || !this.configPath) {
      return;
    }

    this.watcher = watch(this.configPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher.on('change', async () => {
      try {
        await this.reloadConfiguration();
      } catch (error) {
        this.emit('configError', error);
      }
    });

    this.watcher.on('error', error => {
      this.emit('configError', error);
    });
  }

  getConfig(): FrameworkConfiguration | null {
    return this.config;
  }

  getConfigPath(): string | null {
    return this.configPath;
  }

  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.removeAllListeners();
  }
}

export default ConfigManager;