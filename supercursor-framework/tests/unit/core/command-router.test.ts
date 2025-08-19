import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CommandRouter, CommandError } from '../../../src/core/command-router.js';
import { MockCacheManager } from '../../../src/utils/mock-cache.js';
import {
  CommandHandler,
  CommandContext,
  CommandResult,
  ParameterType,
  ValidationResult
} from '../../../src/core/interfaces.js';
import {
  UserContext,
  OutputFormat
} from '../../../src/types/index.js';

describe('CommandRouter', () => {
  let commandRouter: CommandRouter;
  let mockCache: MockCacheManager;
  let testUser: UserContext;

  beforeEach(() => {
    mockCache = new MockCacheManager();
    commandRouter = new CommandRouter(mockCache);
    
    testUser = {
      id: 'test-user',
      name: 'Test User',
      preferences: {
        language: 'ja',
        theme: 'dark',
        outputFormat: OutputFormat.TEXT,
        verbosity: 'normal' as any,
        autoSave: true
      },
      permissions: []
    };
  });

  afterEach(() => {
    commandRouter.dispose();
  });

  describe('コマンド解析', () => {
    it('基本的なコマンドを正しく解析する', async () => {
      const input = '/sc:implement feature';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.name).toBe('implement');
      expect(parsed.arguments).toEqual(['feature']);
      expect(parsed.options).toEqual({});
      expect(parsed.raw).toBe(input);
    });

    it('サブコマンドを正しく解析する', async () => {
      const input = '/sc:git create branch feature-x';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.name).toBe('git');
      expect(parsed.subcommand).toBe('create');
      expect(parsed.arguments).toEqual(['branch', 'feature-x']);
    });

    it('オプションを正しく解析する', async () => {
      const input = '/sc:build --env production --verbose --workers=4';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.name).toBe('build');
      expect(parsed.options).toEqual({
        env: 'production',
        verbose: true,
        workers: 4
      });
    });

    it('ショートオプションを正しく解析する', async () => {
      const input = '/sc:test -v -f json';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.name).toBe('test');
      expect(parsed.options).toEqual({
        v: true,
        f: 'json'
      });
    });

    it('引用符で囲まれた引数を正しく解析する', async () => {
      const input = '/sc:implement "user authentication" --description="Add OAuth support"';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.name).toBe('implement');
      expect(parsed.arguments).toEqual(['user authentication']);
      expect(parsed.options).toEqual({
        description: 'Add OAuth support'
      });
    });

    it('エスケープ文字を正しく処理する', async () => {
      const input = '/sc:search "hello \\"world\\"" --pattern=\\'test\\'';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.arguments).toEqual(['hello \"world\"']);
      expect(parsed.options.pattern).toBe(\"'test'\");
    });

    it('値の型変換を正しく行う', async () => {
      const input = '/sc:config --port=3000 --debug=true --ratio=1.5 --tags=[\"a\",\"b\"]';
      const parsed = await commandRouter.parseCommand(input);

      expect(parsed.options).toEqual({
        port: 3000,
        debug: true,
        ratio: 1.5,
        tags: ['a', 'b']
      });
    });

    it('無効な入力でエラーをスローする', async () => {
      await expect(commandRouter.parseCommand('')).rejects.toThrow(CommandError);
      await expect(commandRouter.parseCommand('invalid')).rejects.toThrow(CommandError);
      await expect(commandRouter.parseCommand('/sc:')).rejects.toThrow(CommandError);
    });

    it('閉じられていない引用符でエラーをスローする', async () => {
      const input = '/sc:test "unclosed quote';
      await expect(commandRouter.parseCommand(input)).rejects.toThrow(CommandError);
    });
  });

  describe('コマンド検証', () => {
    let testHandler: CommandHandler;

    beforeEach(async () => {
      testHandler = {
        name: 'test-command',
        description: 'テスト用コマンド',
        aliases: ['test', 'tc'],
        parameters: [
          {
            name: 'target',
            type: ParameterType.STRING,
            required: true,
            description: '対象ファイル'
          },
          {
            name: 'output',
            type: ParameterType.STRING,
            required: false,
            description: '出力先',
            defaultValue: 'stdout'
          }
        ],
        execute: jest.fn<CommandHandler['execute']>().mockResolvedValue({
          success: true,
          output: 'test result',
          format: OutputFormat.TEXT,
          metadata: {
            executionTime: 100,
            cacheHit: false,
            resourcesUsed: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(testHandler);
    });

    it('有効なコマンドの検証が成功する', async () => {
      const command = await commandRouter.parseCommand('/sc:test-command target.txt');
      const validation = await commandRouter.validateCommand(command);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('存在しないコマンドで検証が失敗する', async () => {
      const command = await commandRouter.parseCommand('/sc:unknown-command');
      const validation = await commandRouter.validateCommand(command);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual({
        code: 'UNKNOWN_COMMAND',
        message: '未知のコマンドです: unknown-command',
        field: 'name',
        severity: 'error'
      });
    });

    it('必須パラメータが不足している場合に検証が失敗する', async () => {
      const command = await commandRouter.parseCommand('/sc:test-command');
      const validation = await commandRouter.validateCommand(command);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'MISSING_PARAMETER')).toBe(true);
    });

    it('エイリアスが正しく動作する', async () => {
      const command = await commandRouter.parseCommand('/sc:test target.txt');
      const validation = await commandRouter.validateCommand(command);

      expect(validation.valid).toBe(true);
    });

    it('カスタム検証が実行される', async () => {
      const customValidation = jest.fn<NonNullable<CommandHandler['validate']>>()
        .mockResolvedValue({
          valid: false,
          errors: [{
            code: 'CUSTOM_ERROR',
            message: 'カスタムエラー',
            field: 'custom',
            severity: 'error'
          }],
          warnings: []
        });

      testHandler.validate = customValidation;

      const command = await commandRouter.parseCommand('/sc:test-command target.txt');
      const validation = await commandRouter.validateCommand(command);

      expect(validation.valid).toBe(false);
      expect(customValidation).toHaveBeenCalled();
      expect(validation.errors.some(e => e.code === 'CUSTOM_ERROR')).toBe(true);
    });
  });

  describe('コマンドルーティング', () => {
    let testHandler: CommandHandler;
    let testContext: CommandContext;

    beforeEach(async () => {
      testHandler = {
        name: 'route-test',
        description: 'ルーティングテスト用コマンド',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>().mockResolvedValue({
          success: true,
          output: 'route test result',
          format: OutputFormat.TEXT,
          metadata: {
            executionTime: 150,
            cacheHit: false,
            resourcesUsed: {
              memory: 1024,
              cpu: 0.1,
              diskIO: 0,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(testHandler);

      testContext = {
        command: 'route-test',
        arguments: [],
        options: {},
        workingDirectory: '/test',
        user: testUser,
        project: {} as any,
        session: {
          id: 'test-session',
          startTime: new Date(),
          history: [],
          cache: {} as any,
          preferences: testUser.preferences
        }
      };
    });

    it('正常なコマンド実行が成功する', async () => {
      const command = await commandRouter.parseCommand('/sc:route-test');
      const result = await commandRouter.routeCommand(command, testContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe('route test result');
      expect(testHandler.execute).toHaveBeenCalledWith(testContext);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    it('コマンド実行エラーを適切に処理する', async () => {
      const errorHandler: CommandHandler = {
        name: 'error-command',
        description: 'エラーテスト用コマンド',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>()
          .mockRejectedValue(new Error('テスト実行エラー')),
        canHandle: () => true
      };

      await commandRouter.registerCommand(errorHandler);

      const command = await commandRouter.parseCommand('/sc:error-command');
      const result = await commandRouter.routeCommand(command, testContext);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]?.message).toContain('テスト実行エラー');
    });

    it('キャッシュが正しく動作する', async () => {
      const command = await commandRouter.parseCommand('/sc:route-test');
      
      // 初回実行
      const result1 = await commandRouter.routeCommand(command, testContext);
      expect(result1.metadata.cacheHit).toBe(false);
      expect(testHandler.execute).toHaveBeenCalledTimes(1);

      // 2回目実行（キャッシュヒット）
      const result2 = await commandRouter.routeCommand(command, testContext);
      expect(result2.metadata.cacheHit).toBe(true);
      expect(testHandler.execute).toHaveBeenCalledTimes(1); // 同じ回数
    });

    it('検証エラーの場合は実行しない', async () => {
      const command = await commandRouter.parseCommand('/sc:nonexistent-command');
      const result = await commandRouter.routeCommand(command, testContext);

      expect(result.success).toBe(false);
      expect(testHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('コマンド登録管理', () => {
    it('コマンドを正しく登録できる', async () => {
      const handler: CommandHandler = {
        name: 'register-test',
        description: '登録テスト用',
        aliases: ['rt'],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>(),
        canHandle: () => true
      };

      await commandRouter.registerCommand(handler);

      const registered = commandRouter.getRegisteredCommands();
      expect(registered).toContainEqual(handler);
      
      const retrieved = commandRouter.getCommandHandler('register-test');
      expect(retrieved).toBe(handler);
      
      const retrievedByAlias = commandRouter.getCommandHandler('rt');
      expect(retrievedByAlias).toBe(handler);
    });

    it('重複したコマンド登録でエラーをスローする', async () => {
      const handler1: CommandHandler = {
        name: 'duplicate',
        description: 'テスト1',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>(),
        canHandle: () => true
      };

      const handler2: CommandHandler = {
        name: 'duplicate',
        description: 'テスト2',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>(),
        canHandle: () => true
      };

      await commandRouter.registerCommand(handler1);
      await expect(commandRouter.registerCommand(handler2))
        .rejects.toThrow(CommandError);
    });

    it('コマンドを正しく登録解除できる', async () => {
      const handler: CommandHandler = {
        name: 'unregister-test',
        description: '登録解除テスト用',
        aliases: ['ut'],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>(),
        canHandle: () => true
      };

      await commandRouter.registerCommand(handler);
      expect(commandRouter.getCommandHandler('unregister-test')).toBe(handler);
      
      const unregistered = await commandRouter.unregisterCommand('unregister-test');
      expect(unregistered).toBe(true);
      expect(commandRouter.getCommandHandler('unregister-test')).toBeUndefined();
      expect(commandRouter.getCommandHandler('ut')).toBeUndefined();
    });
  });

  describe('コマンド履歴', () => {
    let testHandler: CommandHandler;
    let testContext: CommandContext;

    beforeEach(async () => {
      testHandler = {
        name: 'history-test',
        description: '履歴テスト用',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>().mockResolvedValue({
          success: true,
          output: 'test result',
          format: OutputFormat.TEXT,
          metadata: {
            executionTime: 100,
            cacheHit: false,
            resourcesUsed: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(testHandler);

      testContext = {
        command: 'history-test',
        arguments: [],
        options: {},
        workingDirectory: '/test',
        user: testUser,
        project: {} as any,
        session: {
          id: 'history-session',
          startTime: new Date(),
          history: [],
          cache: {} as any,
          preferences: testUser.preferences
        }
      };
    });

    it('コマンド実行が履歴に記録される', async () => {
      const command = await commandRouter.parseCommand('/sc:history-test');
      await commandRouter.routeCommand(command, testContext);

      const history = await commandRouter.getCommandHistory('history-session');
      expect(history).toHaveLength(1);
      expect(history[0]?.command).toBe('/sc:history-test');
      expect(history[0]?.success).toBe(true);
    });

    it('複数のコマンドが正しい順序で履歴に記録される', async () => {
      // 複数のコマンドを実行
      const command1 = await commandRouter.parseCommand('/sc:history-test');
      const command2 = await commandRouter.parseCommand('/sc:history-test arg1');
      const command3 = await commandRouter.parseCommand('/sc:history-test arg2');

      await commandRouter.routeCommand(command1, testContext);
      await commandRouter.routeCommand(command2, testContext);
      await commandRouter.routeCommand(command3, testContext);

      const history = await commandRouter.getCommandHistory('history-session');
      expect(history).toHaveLength(3);
      expect(history[0]?.command).toBe('/sc:history-test arg2'); // 最新が最初
      expect(history[1]?.command).toBe('/sc:history-test arg1');
      expect(history[2]?.command).toBe('/sc:history-test');
    });

    it('履歴をクリアできる', async () => {
      const command = await commandRouter.parseCommand('/sc:history-test');
      await commandRouter.routeCommand(command, testContext);

      let history = await commandRouter.getCommandHistory('history-session');
      expect(history).toHaveLength(1);

      await commandRouter.clearHistory('history-session');
      history = await commandRouter.getCommandHistory('history-session');
      expect(history).toHaveLength(0);
    });
  });

  describe('コマンド提案', () => {
    beforeEach(async () => {
      const handlers: CommandHandler[] = [
        {
          name: 'implement',
          description: '実装コマンド',
          aliases: ['impl'],
          parameters: [],
          execute: jest.fn<CommandHandler['execute']>(),
          canHandle: () => true
        },
        {
          name: 'analyze',
          description: '解析コマンド',
          aliases: ['an'],
          parameters: [],
          execute: jest.fn<CommandHandler['execute']>(),
          canHandle: () => true
        },
        {
          name: 'build',
          description: 'ビルドコマンド',
          aliases: ['b'],
          parameters: [],
          execute: jest.fn<CommandHandler['execute']>(),
          canHandle: () => true
        }
      ];

      for (const handler of handlers) {
        await commandRouter.registerCommand(handler);
      }
    });

    it('部分文字列でコマンド提案を取得できる', async () => {
      const suggestions = await commandRouter.getCommandSuggestions('impl');
      expect(suggestions).toContain('implement');
      expect(suggestions).toContain('impl');
    });

    it('提案結果がソートされている', async () => {
      const suggestions = await commandRouter.getCommandSuggestions('a');
      expect(suggestions).toEqual(expect.arrayContaining(['analyze', 'an']));
      
      // ソート順をチェック
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1]! <= suggestions[i]!).toBe(true);
      }
    });

    it('マッチしない場合は空配列を返す', async () => {
      const suggestions = await commandRouter.getCommandSuggestions('xyz');
      expect(suggestions).toEqual([]);
    });
  });

  describe('使用統計', () => {
    let testHandler: CommandHandler;
    let testContext: CommandContext;

    beforeEach(async () => {
      testHandler = {
        name: 'stats-test',
        description: '統計テスト用',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>().mockResolvedValue({
          success: true,
          output: 'test result',
          format: OutputFormat.TEXT,
          metadata: {
            executionTime: 100,
            cacheHit: false,
            resourcesUsed: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(testHandler);

      testContext = {
        command: 'stats-test',
        arguments: [],
        options: {},
        workingDirectory: '/test',
        user: testUser,
        project: {} as any,
        session: {
          id: 'stats-session',
          startTime: new Date(),
          history: [],
          cache: {} as any,
          preferences: testUser.preferences
        }
      };
    });

    it('使用統計が正しく計算される', async () => {
      const command = await commandRouter.parseCommand('/sc:stats-test');
      
      // 複数回実行
      await commandRouter.routeCommand(command, testContext);
      await commandRouter.routeCommand(command, testContext);
      
      const stats = commandRouter.getCommandUsageStats();
      expect(stats['stats-test']).toBeDefined();
      expect(stats['stats-test']?.count).toBe(2);
      expect(stats['stats-test']?.averageExecutionTime).toBeGreaterThan(0);
      expect(stats['stats-test']?.lastUsed).toBeInstanceOf(Date);
    });
  });

  describe('イベント処理', () => {
    it('コマンド登録時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      commandRouter.on('commandRegistered', mockListener);

      const handler: CommandHandler = {
        name: 'event-test',
        description: 'イベントテスト用',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>(),
        canHandle: () => true
      };

      await commandRouter.registerCommand(handler);
      expect(mockListener).toHaveBeenCalledWith(handler);
    });

    it('コマンド実行時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      commandRouter.on('commandExecuted', mockListener);

      const handler: CommandHandler = {
        name: 'execute-event-test',
        description: '実行イベントテスト用',
        aliases: [],
        parameters: [],
        execute: jest.fn<CommandHandler['execute']>().mockResolvedValue({
          success: true,
          output: 'result',
          format: OutputFormat.TEXT,
          metadata: {
            executionTime: 100,
            cacheHit: false,
            resourcesUsed: {
              memory: 0,
              cpu: 0,
              diskIO: 0,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(handler);

      const testContext: CommandContext = {
        command: 'execute-event-test',
        arguments: [],
        options: {},
        workingDirectory: '/test',
        user: testUser,
        project: {} as any,
        session: {
          id: 'event-session',
          startTime: new Date(),
          history: [],
          cache: {} as any,
          preferences: testUser.preferences
        }
      };

      const command = await commandRouter.parseCommand('/sc:execute-event-test');
      await commandRouter.routeCommand(command, testContext);

      expect(mockListener).toHaveBeenCalled();
    });
  });
});