import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  PermissionManager, 
  PermissionError, 
  PermissionRule,
  ConditionType,
  ConditionOperator 
} from '../../../src/core/permission-manager.js';
import {
  UserContext,
  PermissionAction,
  PermissionScope,
  Permission
} from '../../../src/types/index.js';
import { SecurityConfiguration } from '../../../src/core/interfaces.js';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let testDir: string;
  let testUser: UserContext;
  let securityConfig: SecurityConfiguration;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), `permission-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // テスト用のセキュリティ設定
    securityConfig = {
      permissions: {
        strictMode: true,
        fileAccess: {
          allowedPaths: [testDir, join(testDir, 'allowed')],
          deniedPaths: [join(testDir, 'denied'), 'node_modules'],
          readOnly: false
        },
        systemAccess: {
          allowedCommands: ['ls', 'cat', 'grep'],
          deniedCommands: ['rm', 'del', 'format', 'sudo'],
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
        logFile: 'test-audit.log',
        events: []
      }
    };

    // テスト用ユーザー
    testUser = {
      id: 'test-user-123',
      name: 'Test User',
      preferences: {
        language: 'ja',
        theme: 'dark',
        outputFormat: 'text' as any,
        verbosity: 'normal' as any,
        autoSave: true
      },
      permissions: [
        {
          resource: join(testDir, 'user-files/**'),
          actions: [PermissionAction.READ, PermissionAction.WRITE],
          scope: PermissionScope.FILE
        },
        {
          resource: 'echo',
          actions: [PermissionAction.EXECUTE],
          scope: PermissionScope.SYSTEM
        }
      ]
    };

    // PermissionManagerのインスタンスを作成
    permissionManager = PermissionManager.getInstance(securityConfig);
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      permissionManager.dispose();
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // エラーは無視（テスト環境での一時的な問題）
    }
  });

  describe('直接権限のチェック', () => {
    it('ユーザーに直接権限がある場合は許可する', async () => {
      const testFile = join(testDir, 'user-files', 'test.txt');
      
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        testFile,
        PermissionScope.FILE
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('直接権限');
    });

    it('ユーザーに直接権限がない場合はルールベースでチェックする', async () => {
      const testFile = join(testDir, 'other-files', 'test.txt');
      
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        testFile,
        PermissionScope.FILE
      );

      // デフォルトルールまたはstrict modeによって拒否される
      expect(result.allowed).toBe(false);
    });
  });

  describe('ルールベースの権限チェック', () => {
    it('許可ルールが適用される場合は許可する', async () => {
      const allowedFile = join(testDir, 'allowed', 'test.txt');
      
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        allowedFile,
        PermissionScope.FILE
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('許可ルール');
    });

    it('拒否ルールが適用される場合は拒否する', async () => {
      const deniedFile = join(testDir, 'denied', 'test.txt');
      
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        deniedFile,
        PermissionScope.FILE
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('拒否ルール');
    });

    it('システムコマンドの許可ルールが正しく動作する', async () => {
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.EXECUTE,
        'ls',
        PermissionScope.SYSTEM
      );

      expect(result.allowed).toBe(true);
    });

    it('危険なシステムコマンドは拒否される', async () => {
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.EXECUTE,
        'rm',
        PermissionScope.SYSTEM
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('カスタムルール', () => {
    it('カスタムルールを追加できる', () => {
      const customRule: PermissionRule = {
        id: 'custom-test-rule',
        name: 'テスト用カスタムルール',
        description: 'テスト用のカスタム権限ルール',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: [join(testDir, 'custom/**')],
        priority: 150,
        enabled: true
      };

      permissionManager.addRule(customRule);
      
      const rules = permissionManager.getRules();
      expect(rules).toContainEqual(customRule);
    });

    it('カスタムルールを削除できる', () => {
      const customRule: PermissionRule = {
        id: 'custom-delete-rule',
        name: '削除テスト用ルール',
        description: '削除テスト用のルール',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: ['test/**'],
        priority: 100,
        enabled: true
      };

      permissionManager.addRule(customRule);
      expect(permissionManager.getRule('custom-delete-rule')).toBeDefined();
      
      const removed = permissionManager.removeRule('custom-delete-rule');
      expect(removed).toBe(true);
      expect(permissionManager.getRule('custom-delete-rule')).toBeUndefined();
    });

    it('カスタムルールを更新できる', () => {
      const customRule: PermissionRule = {
        id: 'custom-update-rule',
        name: '更新前のルール',
        description: '更新前の説明',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: ['test/**'],
        priority: 100,
        enabled: true
      };

      permissionManager.addRule(customRule);
      
      const updated = permissionManager.updateRule('custom-update-rule', {
        name: '更新後のルール',
        description: '更新後の説明',
        enabled: false
      });

      expect(updated).toBe(true);
      
      const updatedRule = permissionManager.getRule('custom-update-rule');
      expect(updatedRule?.name).toBe('更新後のルール');
      expect(updatedRule?.description).toBe('更新後の説明');
      expect(updatedRule?.enabled).toBe(false);
    });
  });

  describe('条件付きルール', () => {
    it('ファイルサイズ条件が正しく評価される', async () => {
      // テストファイルを作成
      const testFile = join(testDir, 'size-test.txt');
      await writeFile(testFile, 'a'.repeat(1000)); // 1KB

      const conditionalRule: PermissionRule = {
        id: 'size-conditional-rule',
        name: 'ファイルサイズ条件ルール',
        description: '大きなファイルの読み取りを制限',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: [join(testDir, '**')],
        priority: 150,
        enabled: true,
        conditions: [{
          type: ConditionType.FILE_SIZE,
          operator: ConditionOperator.LESS_THAN,
          value: 2000 // 2KB未満
        }]
      };

      permissionManager.addRule(conditionalRule);

      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        testFile,
        PermissionScope.FILE
      );

      expect(result.allowed).toBe(true); // 1KB < 2KB なので許可
    });

    it('ファイル拡張子条件が正しく評価される', async () => {
      const conditionalRule: PermissionRule = {
        id: 'extension-conditional-rule',
        name: '拡張子条件ルール',
        description: '特定の拡張子のファイルのみ許可',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: [join(testDir, '**')],
        priority: 150,
        enabled: true,
        conditions: [{
          type: ConditionType.FILE_EXTENSION,
          operator: ConditionOperator.EQUALS,
          value: 'txt'
        }]
      };

      permissionManager.addRule(conditionalRule);

      const txtFile = join(testDir, 'test.txt');
      const jsFile = join(testDir, 'test.js');

      const txtResult = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        txtFile,
        PermissionScope.FILE
      );

      const jsResult = await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        jsFile,
        PermissionScope.FILE
      );

      expect(txtResult.allowed).toBe(true); // .txt は許可
      expect(jsResult.allowed).toBe(false); // .js は条件に合わない
    });

    it('時間条件が正しく評価される', async () => {
      const currentHour = new Date().getHours();
      
      const timeRule: PermissionRule = {
        id: 'time-conditional-rule',
        name: '時間条件ルール',
        description: '営業時間内のみファイルアクセスを許可',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.WRITE],
        patterns: [join(testDir, '**')],
        priority: 150,
        enabled: true,
        conditions: [{
          type: ConditionType.TIME,
          operator: ConditionOperator.GREATER_THAN,
          value: currentHour - 1 // 現在時刻より1時間前
        }]
      };

      permissionManager.addRule(timeRule);

      const testFile = join(testDir, 'time-test.txt');
      const result = await permissionManager.checkPermission(
        testUser,
        PermissionAction.WRITE,
        testFile,
        PermissionScope.FILE
      );

      expect(result.allowed).toBe(true); // 現在時刻 > (現在時刻 - 1) なので許可
    });
  });

  describe('ファイル権限の取得', () => {
    it('存在するファイルの権限を取得できる', async () => {
      const testFile = join(testDir, 'permission-test.txt');
      await writeFile(testFile, 'test content');

      const permissions = await permissionManager.getFilePermissions(testFile);

      expect(permissions).toBeDefined();
      expect(typeof permissions.read).toBe('boolean');
      expect(typeof permissions.write).toBe('boolean');
      expect(typeof permissions.execute).toBe('boolean');
      expect(typeof permissions.mode).toBe('number');
    });

    it('存在しないファイルの権限取得はエラーをスローする', async () => {
      const nonExistentFile = join(testDir, 'non-existent.txt');

      await expect(permissionManager.getFilePermissions(nonExistentFile))
        .rejects.toThrow(PermissionError);
    });
  });

  describe('監査ログ', () => {
    it('権限チェックが監査ログに記録される', async () => {
      const testFile = join(testDir, 'audit-test.txt');
      
      await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        testFile,
        PermissionScope.FILE
      );

      const logs = permissionManager.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      const latestLog = logs[0];
      expect(latestLog?.user).toBe(testUser.id);
      expect(latestLog?.action).toBe('read');
      expect(latestLog?.scope).toBe(PermissionScope.FILE);
    });

    it('監査ログをクリアできる', async () => {
      // いくつかの権限チェックを実行
      await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        join(testDir, 'test1.txt'),
        PermissionScope.FILE
      );
      
      await permissionManager.checkPermission(
        testUser,
        PermissionAction.READ,
        join(testDir, 'test2.txt'),
        PermissionScope.FILE
      );

      expect(permissionManager.getAuditLogs().length).toBeGreaterThan(0);
      
      permissionManager.clearAuditLogs();
      expect(permissionManager.getAuditLogs()).toHaveLength(0);
    });

    it('監査ログの件数制限が機能する', async () => {
      // 制限を超える数の権限チェックを実行
      for (let i = 0; i < 1100; i++) {
        await permissionManager.checkPermission(
          testUser,
          PermissionAction.READ,
          join(testDir, `test${i}.txt`),
          PermissionScope.FILE
        );
      }

      const logs = permissionManager.getAuditLogs();
      expect(logs.length).toBeLessThanOrEqual(1000); // 最新の1000件のみ保持
    });
  });

  describe('イベント処理', () => {
    it('ルール追加時にイベントが発生する', () => {
      const mockListener = jest.fn();
      permissionManager.on('ruleAdded', mockListener);

      const newRule: PermissionRule = {
        id: 'event-test-rule',
        name: 'イベントテストルール',
        description: 'イベントテスト用',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: ['**'],
        priority: 100,
        enabled: true
      };

      permissionManager.addRule(newRule);
      expect(mockListener).toHaveBeenCalledWith(newRule);
    });

    it('ルール削除時にイベントが発生する', () => {
      const mockListener = jest.fn();
      permissionManager.on('ruleRemoved', mockListener);

      const ruleId = 'event-delete-test-rule';
      permissionManager.addRule({
        id: ruleId,
        name: '削除イベントテストルール',
        description: '削除イベントテスト用',
        scope: PermissionScope.FILE,
        actions: [PermissionAction.READ],
        patterns: ['**'],
        priority: 100,
        enabled: true
      });

      permissionManager.removeRule(ruleId);
      expect(mockListener).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('セキュリティ設定の更新', () => {
    it('セキュリティ設定を更新できる', () => {
      const newConfig: SecurityConfiguration = {
        ...securityConfig,
        permissions: {
          ...securityConfig.permissions,
          strictMode: false,
          fileAccess: {
            ...securityConfig.permissions.fileAccess,
            readOnly: true
          }
        }
      };

      permissionManager.updateSecurityConfig(newConfig);

      // 設定更新後、デフォルトルールが再初期化されることを確認
      const rules = permissionManager.getRules();
      const writeRule = rules.find(rule => 
        rule.id === 'default-file-write' && 
        rule.actions.includes(PermissionAction.WRITE)
      );
      
      expect(writeRule?.enabled).toBe(false); // readOnlyがtrueなので無効になる
    });
  });
});