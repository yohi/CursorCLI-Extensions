/**
 * 設定管理システム
 */

import { readFile, writeFile, existsSync, mkdirSync } from 'fs-extra';
import { join, dirname } from 'path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import Joi from 'joi';
import { 
  FrameworkConfig, 
  ConfigurationError, 
  ValidationError,
  LogLevel,
  OutputFormat 
} from '../types';

export class ConfigManager {
  private config: FrameworkConfig | null = null;
  private configPath: string;
  private watchers: Map<string, (config: FrameworkConfig) => void> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), '.supercursor.yaml');
  }

  /**
   * 設定ファイルを読み込み
   */
  public async loadConfig(): Promise<FrameworkConfig> {
    try {
      if (!existsSync(this.configPath)) {
        const defaultConfig = this.getDefaultConfig();
        await this.saveConfig(defaultConfig);
        this.config = defaultConfig;
        return defaultConfig;
      }

      const configContent = await readFile(this.configPath, 'utf8');
      let parsedConfig: any;

      if (this.configPath.endsWith('.json')) {
        parsedConfig = JSON.parse(configContent);
      } else if (this.configPath.endsWith('.yaml') || this.configPath.endsWith('.yml')) {
        parsedConfig = parseYAML(configContent);
      } else {
        throw new ConfigurationError('サポートされていない設定ファイル形式です');
      }

      const validatedConfig = await this.validateConfig(parsedConfig);
      this.config = validatedConfig;

      // 設定変更の監視を通知
      this.notifyWatchers(validatedConfig);

      return validatedConfig;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 設定ファイルを保存
   */
  public async saveConfig(config: FrameworkConfig): Promise<void> {
    try {
      await this.validateConfig(config);
      
      // ディレクトリが存在しない場合は作成
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      let configContent: string;
      if (this.configPath.endsWith('.json')) {
        configContent = JSON.stringify(config, null, 2);
      } else {
        configContent = stringifyYAML(config);
      }

      await writeFile(this.configPath, configContent, 'utf8');
      this.config = config;

      // 設定変更を通知
      this.notifyWatchers(config);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ConfigurationError(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): FrameworkConfig {
    if (!this.config) {
      throw new ConfigurationError('設定が読み込まれていません。まずloadConfig()を呼び出してください。');
    }
    return this.config;
  }

  /**
   * 設定値を更新
   */
  public async updateConfig(updates: Partial<FrameworkConfig>): Promise<FrameworkConfig> {
    const currentConfig = this.getConfig();
    const newConfig = this.mergeConfig(currentConfig, updates);
    await this.saveConfig(newConfig);
    return newConfig;
  }

  /**
   * 環境固有の設定を読み込み
   */
  public async loadEnvironmentConfig(environment: string): Promise<FrameworkConfig> {
    const envConfigPath = this.configPath.replace(
      /(\.[^.]+)$/,
      `.${environment}$1`
    );

    if (!existsSync(envConfigPath)) {
      return this.getConfig();
    }

    const envConfigContent = await readFile(envConfigPath, 'utf8');
    const envConfig = this.configPath.endsWith('.json') 
      ? JSON.parse(envConfigContent)
      : parseYAML(envConfigContent);

    const baseConfig = this.getConfig();
    const mergedConfig = this.mergeConfig(baseConfig, envConfig);
    
    return await this.validateConfig(mergedConfig);
  }

  /**
   * 設定変更の監視を開始
   */
  public watchConfig(callback: (config: FrameworkConfig) => void): string {
    const watcherId = Math.random().toString(36).substr(2, 9);
    this.watchers.set(watcherId, callback);
    return watcherId;
  }

  /**
   * 設定変更の監視を停止
   */
  public unwatchConfig(watcherId: string): void {
    this.watchers.delete(watcherId);
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultConfig(): FrameworkConfig {
    return {
      version: '0.1.0',
      logLevel: 'info' as LogLevel,
      outputFormat: 'text' as OutputFormat,
      cache: {
        providers: ['memory'],
        defaultTTL: 3600,
        maxSize: 100 * 1024 * 1024, // 100MB
        evictionPolicy: 'lru',
      },
      permissions: {
        allowedPaths: ['.'],
        deniedPaths: ['node_modules', '.git'],
        allowFileOperations: true,
        allowSystemOperations: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
      },
      integrations: {
        cursor: {
          timeout: 30000,
          retryAttempts: 3,
        },
        git: {
          enabled: true,
          autoCommit: false,
          commitMessageTemplate: 'feat: ${description}',
        },
        ci: {
          platforms: ['github'],
          webhooks: [],
        },
      },
      personas: {
        autoActivation: true,
        confidenceThreshold: 0.7,
        fallbackPersona: 'generic',
        customPersonas: [],
      },
    };
  }

  /**
   * 設定を検証
   */
  private async validateConfig(config: any): Promise<FrameworkConfig> {
    const schema = Joi.object({
      version: Joi.string().required(),
      logLevel: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').required(),
      outputFormat: Joi.string().valid('text', 'json', 'stream-json').required(),
      cache: Joi.object({
        providers: Joi.array().items(Joi.string().valid('memory', 'file', 'redis')).required(),
        defaultTTL: Joi.number().integer().positive().required(),
        maxSize: Joi.number().integer().positive().required(),
        evictionPolicy: Joi.string().valid('lru', 'lfu', 'ttl').required(),
      }).required(),
      permissions: Joi.object({
        allowedPaths: Joi.array().items(Joi.string()).required(),
        deniedPaths: Joi.array().items(Joi.string()).required(),
        allowFileOperations: Joi.boolean().required(),
        allowSystemOperations: Joi.boolean().required(),
        maxFileSize: Joi.number().integer().positive().required(),
      }).required(),
      integrations: Joi.object({
        cursor: Joi.object({
          apiEndpoint: Joi.string().uri().optional(),
          timeout: Joi.number().integer().positive().required(),
          retryAttempts: Joi.number().integer().min(0).required(),
        }).required(),
        git: Joi.object({
          enabled: Joi.boolean().required(),
          autoCommit: Joi.boolean().required(),
          commitMessageTemplate: Joi.string().required(),
        }).required(),
        ci: Joi.object({
          platforms: Joi.array().items(Joi.string()).required(),
          webhooks: Joi.array().items(
            Joi.object({
              url: Joi.string().uri().required(),
              secret: Joi.string().optional(),
              events: Joi.array().items(Joi.string()).required(),
            })
          ).required(),
        }).required(),
      }).required(),
      personas: Joi.object({
        autoActivation: Joi.boolean().required(),
        confidenceThreshold: Joi.number().min(0).max(1).required(),
        fallbackPersona: Joi.string().required(),
        customPersonas: Joi.array().items(
          Joi.object({
            id: Joi.string().required(),
            name: Joi.string().required(),
            description: Joi.string().required(),
            activationTriggers: Joi.array().items(Joi.string()).required(),
            responseStyle: Joi.object({
              tone: Joi.string().valid('professional', 'casual', 'technical').required(),
              verbosity: Joi.string().valid('brief', 'detailed', 'comprehensive').required(),
              format: Joi.string().valid('structured', 'narrative', 'checklist').required(),
            }).required(),
          })
        ).required(),
      }).required(),
    });

    const { error, value } = schema.validate(config, { allowUnknown: false });
    if (error) {
      throw new ValidationError(`設定の検証に失敗しました: ${error.details.map(d => d.message).join(', ')}`);
    }

    return value as FrameworkConfig;
  }

  /**
   * 設定をマージ
   */
  private mergeConfig(base: FrameworkConfig, updates: Partial<FrameworkConfig>): FrameworkConfig {
    // 深いマージを実行
    return {
      ...base,
      ...updates,
      cache: {
        ...base.cache,
        ...(updates.cache || {}),
      },
      permissions: {
        ...base.permissions,
        ...(updates.permissions || {}),
      },
      integrations: {
        ...base.integrations,
        ...(updates.integrations || {}),
        cursor: {
          ...base.integrations.cursor,
          ...(updates.integrations?.cursor || {}),
        },
        git: {
          ...base.integrations.git,
          ...(updates.integrations?.git || {}),
        },
        ci: {
          ...base.integrations.ci,
          ...(updates.integrations?.ci || {}),
        },
      },
      personas: {
        ...base.personas,
        ...(updates.personas || {}),
      },
    };
  }

  /**
   * 設定変更をウォッチャーに通知
   */
  private notifyWatchers(config: FrameworkConfig): void {
    for (const callback of this.watchers.values()) {
      try {
        callback(config);
      } catch (error) {
        console.error('設定変更の通知中にエラーが発生しました:', error);
      }
    }
  }
}