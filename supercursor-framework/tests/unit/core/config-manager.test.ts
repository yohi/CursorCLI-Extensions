/**
 * ConfigManager のテスト
 */

import { ConfigManager } from '../../../src/core/config-manager';
import { existsSync, removeSync, ensureDirSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testConfigPath: string;
  let testDir: string;

  beforeEach(() => {
    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), 'supercursor-test-' + Date.now());
    ensureDirSync(testDir);
    testConfigPath = join(testDir, 'test-config.yaml');
    configManager = new ConfigManager(testConfigPath);
  });

  afterEach(() => {
    // テスト用のファイルをクリーンアップ
    if (existsSync(testDir)) {
      removeSync(testDir);
    }
  });

  describe('loadConfig', () => {
    it('設定ファイルが存在しない場合、デフォルト設定を作成する', async () => {
      const config = await configManager.loadConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toBe('0.1.0');
      expect(config.logLevel).toBe('info');
      expect(config.outputFormat).toBe('text');
      expect(existsSync(testConfigPath)).toBeTruthy();
    });

    it('既存の設定ファイルを正常に読み込む', async () => {
      // 最初にデフォルト設定を作成
      await configManager.loadConfig();
      
      // 再度読み込んで同じ設定が取得できることを確認
      const config = await configManager.loadConfig();
      expect(config.version).toBe('0.1.0');
    });
  });

  describe('updateConfig', () => {
    it('設定を部分的に更新できる', async () => {
      await configManager.loadConfig();
      
      const updatedConfig = await configManager.updateConfig({
        logLevel: 'debug',
      });
      
      expect(updatedConfig.logLevel).toBe('debug');
      expect(updatedConfig.outputFormat).toBe('text'); // 他の設定は変更されない
    });
  });

  describe('getConfig', () => {
    it('設定が読み込まれていない場合はエラーを投げる', () => {
      expect(() => {
        configManager.getConfig();
      }).toThrow('設定が読み込まれていません');
    });

    it('読み込み後は設定を正常に返す', async () => {
      await configManager.loadConfig();
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toBe('0.1.0');
    });
  });
});