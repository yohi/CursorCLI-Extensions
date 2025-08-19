import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { ConfigManager, ConfigurationError } from '../../../src/core/config-manager.js';
import {
  FrameworkConfiguration,
  LogLevel,
  OutputFormat,
  CacheProvider,
  BranchStrategy
} from '../../../src/core/interfaces.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), `supercursor-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    configPath = join(testDir, 'test-config.json');

    // ConfigManagerの新しいインスタンスを作成
    configManager = ConfigManager.getInstance();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await configManager.dispose();
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // エラーは無視（テスト環境での一時的な問題）
    }
  });

  describe('デフォルト設定', () => {
    it('デフォルト設定を正しく作成する', async () => {
      const config = await configManager.loadConfiguration();

      expect(config).toBeDefined();
      expect(config.version).toBe('0.1.0');
      expect(config.global.language).toBe('ja');
      expect(config.global.logLevel).toBe(LogLevel.INFO);
      expect(config.global.outputFormat).toBe(OutputFormat.TEXT);
      expect(config.global.cacheEnabled).toBe(true);
      expect(config.global.telemetryEnabled).toBe(false);
    });

    it('デフォルト設定の検証が成功する', async () => {
      const config = await configManager.loadConfiguration();
      const validation = await configManager.validateConfiguration(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('設定ファイルの読み込み', () => {
    it('JSON設定ファイルを正しく読み込む', async () => {
      const testConfig: FrameworkConfiguration = {
        version: '0.2.0',
        global: {
          language: 'en',
          logLevel: LogLevel.DEBUG,
          outputFormat: OutputFormat.JSON,
          cacheEnabled: false,
          telemetryEnabled: true
        },
        commands: {
          timeout: 60000,
          retries: 5,
          parallel: true,
          cache: {
            enabled: true,
            ttl: 7200,
            maxSize: 2000,
            provider: CacheProvider.REDIS
          }
        },
        personas: {
          defaultPersona: 'backend',
          switchingEnabled: true,
          confidenceThreshold: 0.8,
          customPersonas: []
        },
        integrations: {
          cursor: {
            timeout: 45000,
            rateLimiting: {
              requests: 200,
              timeWindow: 120000,
              burstLimit: 20
            }
          },
          git: {
            autoCommit: true,
            commitMessageTemplate: 'feat: {description}',
            branchStrategy: BranchStrategy.FEATURE
          },
          ci: {
            provider: 'github',
            notifications: []
          }
        },
        security: {
          permissions: {
            strictMode: false,
            fileAccess: {
              allowedPaths: ['.', 'src'],
              deniedPaths: ['node_modules'],
              readOnly: true
            },
            systemAccess: {
              allowedCommands: ['ls', 'cat'],
              deniedCommands: ['rm'],
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
            events: []
          }
        },
        performance: {
          monitoring: {
            enabled: true,
            metricsInterval: 60000,
            memoryThreshold: 0.9,
            cpuThreshold: 0.9
          },
          optimization: {
            parallelProcessing: true,
            maxWorkers: 8,
            memoryLimit: 4096,
            cacheStrategy: 'lfu' as any
          }
        }
      };

      await writeFile(configPath, JSON.stringify(testConfig, null, 2));
      const loadedConfig = await configManager.loadConfiguration(configPath);

      expect(loadedConfig.version).toBe('0.2.0');
      expect(loadedConfig.global.language).toBe('en');
      expect(loadedConfig.global.logLevel).toBe(LogLevel.DEBUG);
      expect(loadedConfig.commands.timeout).toBe(60000);
    });

    it('YAML設定ファイルを正しく読み込む', async () => {
      const yamlConfig = `
version: "0.3.0"
global:
  language: "en"
  logLevel: "warn"
  outputFormat: "json"
  cacheEnabled: true
  telemetryEnabled: false
commands:
  timeout: 45000
  retries: 2
  parallel: false
  cache:
    enabled: true
    ttl: 1800
    maxSize: 500
    provider: "memory"
`;

      const yamlPath = join(testDir, 'test-config.yaml');
      await writeFile(yamlPath, yamlConfig);
      const loadedConfig = await configManager.loadConfiguration(yamlPath);

      expect(loadedConfig.version).toBe('0.3.0');
      expect(loadedConfig.global.language).toBe('en');
      expect(loadedConfig.global.logLevel).toBe(LogLevel.WARN);
      expect(loadedConfig.commands.timeout).toBe(45000);
    });

    it('存在しない設定ファイルの場合エラーをスローする', async () => {
      const nonExistentPath = join(testDir, 'non-existent.json');
      
      await expect(configManager.loadConfiguration(nonExistentPath))
        .rejects.toThrow(ConfigurationError);
    });

    it('無効なJSON設定ファイルの場合エラーをスローする', async () => {
      await writeFile(configPath, '{ invalid json }');
      
      await expect(configManager.loadConfiguration(configPath))
        .rejects.toThrow(ConfigurationError);
    });
  });

  describe('設定の検証', () => {
    it('有効な設定の検証が成功する', async () => {
      const validConfig: FrameworkConfiguration = {
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
              deniedPaths: ['node_modules'],
              readOnly: false
            },
            systemAccess: {
              allowedCommands: [],
              deniedCommands: ['rm'],
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
            events: []
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
            cacheStrategy: 'lru' as any
          }
        }
      };

      const validation = await configManager.validateConfiguration(validConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('無効な設定の検証が失敗する', async () => {
      const invalidConfig = {
        version: '0.1.0',
        global: {
          language: 'invalid-language',
          logLevel: 'invalid-level',
          outputFormat: 'invalid-format',
          cacheEnabled: 'not-boolean',
          telemetryEnabled: 123
        }
      } as any;

      const validation = await configManager.validateConfiguration(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('カスタム検証で警告を生成する', async () => {
      const configWithWarnings: FrameworkConfiguration = {
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
            apiKey: 'test-api-key', // 警告を生成するはず
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
            strictMode: false, // 警告を生成するはず
            fileAccess: {
              allowedPaths: ['.'],
              deniedPaths: ['node_modules'],
              readOnly: false
            },
            systemAccess: {
              allowedCommands: [],
              deniedCommands: ['rm'],
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
            events: []
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
            maxWorkers: 10, // 警告を生成するはず
            memoryLimit: 2048,
            cacheStrategy: 'lru' as any
          }
        }
      };

      const validation = await configManager.validateConfiguration(configWithWarnings);

      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      
      const warningCodes = validation.warnings.map(w => w.code);
      expect(warningCodes).toContain('SECURITY_WARNING');
      expect(warningCodes).toContain('PERF_WARNING');
    });
  });

  describe('設定の保存', () => {
    it('設定をJSON形式で保存する', async () => {
      const config = await configManager.loadConfiguration();
      config.global.language = 'en';
      config.global.logLevel = LogLevel.DEBUG;

      await configManager.saveConfiguration(config, configPath);

      // 保存されたファイルを読み込んで確認
      const savedConfig = await configManager.loadConfiguration(configPath);
      expect(savedConfig.global.language).toBe('en');
      expect(savedConfig.global.logLevel).toBe(LogLevel.DEBUG);
    });

    it('設定をYAML形式で保存する', async () => {
      const yamlPath = join(testDir, 'test-save.yaml');
      const config = await configManager.loadConfiguration();
      config.global.language = 'en';

      await configManager.saveConfiguration(config, yamlPath);

      const savedConfig = await configManager.loadConfiguration(yamlPath);
      expect(savedConfig.global.language).toBe('en');
    });

    it('無効な設定の保存時にエラーをスローする', async () => {
      const invalidConfig = { version: 'invalid' } as any;

      await expect(configManager.saveConfiguration(invalidConfig, configPath))
        .rejects.toThrow(ConfigurationError);
    });
  });

  describe('環境固有の設定', () => {
    it('環境固有の設定を正しく読み込む', async () => {
      // ベース設定を作成
      const baseConfig = await configManager.loadConfiguration();
      await configManager.saveConfiguration(baseConfig, configPath);

      // 環境固有の設定を作成
      const envConfigPath = join(testDir, 'supercursor.development.config.json');
      const envConfig = {
        global: {
          logLevel: LogLevel.DEBUG,
          telemetryEnabled: true
        },
        commands: {
          timeout: 60000
        }
      };
      await writeFile(envConfigPath, JSON.stringify(envConfig, null, 2));

      // 設定パスを設定
      (configManager as any).configPath = configPath;

      const environmentConfig = await configManager.getEnvironmentConfig('development');

      expect(environmentConfig.environment).toBe('development');
      expect(environmentConfig.global.logLevel).toBe(LogLevel.DEBUG);
      expect(environmentConfig.global.telemetryEnabled).toBe(true);
      expect(environmentConfig.commands.timeout).toBe(60000);
      // ベース設定の値も保持されているはず
      expect(environmentConfig.global.language).toBe('ja');
    });

    it('環境設定ファイルが存在しない場合ベース設定を返す', async () => {
      const baseConfig = await configManager.loadConfiguration();
      await configManager.saveConfiguration(baseConfig, configPath);

      (configManager as any).configPath = configPath;

      const environmentConfig = await configManager.getEnvironmentConfig('production');

      expect(environmentConfig.environment).toBe('production');
      expect(environmentConfig.global.language).toBe('ja');
      expect(environmentConfig.overrides).toEqual({});
    });
  });

  describe('設定のマージ', () => {
    it('複数の設定を正しくマージする', async () => {
      const config1: FrameworkConfiguration = await configManager.loadConfiguration();
      
      const config2: Partial<FrameworkConfiguration> = {
        global: {
          language: 'en',
          logLevel: LogLevel.DEBUG
        },
        commands: {
          timeout: 60000
        }
      } as any;

      const config3: Partial<FrameworkConfiguration> = {
        global: {
          telemetryEnabled: true
        },
        commands: {
          retries: 5
        }
      } as any;

      const merged = await configManager.mergeConfigurations([
        config1, 
        config2 as FrameworkConfiguration, 
        config3 as FrameworkConfiguration
      ]);

      expect(merged.global.language).toBe('en'); // config2から
      expect(merged.global.logLevel).toBe(LogLevel.DEBUG); // config2から
      expect(merged.global.telemetryEnabled).toBe(true); // config3から
      expect(merged.commands.timeout).toBe(60000); // config2から
      expect(merged.commands.retries).toBe(5); // config3から
      // config1の値も保持される
      expect(merged.global.cacheEnabled).toBe(true);
    });

    it('空の配列の場合デフォルト設定を返す', async () => {
      const merged = await configManager.mergeConfigurations([]);
      const defaultConfig = await configManager.loadConfiguration();

      expect(merged).toEqual(defaultConfig);
    });
  });

  describe('イベント処理', () => {
    it('設定読み込み時にイベントを発生する', async () => {
      const mockListener = jest.fn();
      configManager.on('configLoaded', mockListener);

      await configManager.loadConfiguration();

      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('設定保存時にイベントを発生する', async () => {
      const mockListener = jest.fn();
      configManager.on('configSaved', mockListener);

      const config = await configManager.loadConfiguration();
      await configManager.saveConfiguration(config, configPath);

      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });
});