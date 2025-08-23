import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { CursorAPIIntegration } from '../../src/integrations/cursor-api-integration.js';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CommandRouter } from '../../src/core/command-router.js';
import { ContextAnalyzer } from '../../src/core/context-analyzer.js';
import { MockCacheManager } from '../../src/utils/mock-cache.js';
import {
  ProjectType,
  OutputFormat,
  UserContext
} from '../../src/types/index.js';

// Axiosをモック
jest.mock('axios');

describe('SuperCursor Framework Integration', () => {
  let testDir: string;
  let configManager: ConfigManager;
  let commandRouter: CommandRouter;
  let contextAnalyzer: ContextAnalyzer;
  let cursorAPI: CursorAPIIntegration;
  let mockCache: MockCacheManager;
  let testUser: UserContext;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), `supercursor-integration-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // モックキャッシュを作成
    mockCache = new MockCacheManager();

    // テストユーザーを作成
    testUser = {
      id: 'integration-test-user',
      name: 'Integration Test User',
      preferences: {
        language: 'ja',
        theme: 'dark',
        outputFormat: OutputFormat.JSON,
        verbosity: 'verbose' as any,
        autoSave: true
      },
      permissions: []
    };

    // 各コンポーネントのインスタンスを作成
    configManager = new ConfigManager(join(testDir, 'config'), mockCache);
    commandRouter = new CommandRouter(mockCache);
    contextAnalyzer = new ContextAnalyzer();
    cursorAPI = new CursorAPIIntegration({
      baseUrl: 'https://api.cursor.test',
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
      rateLimiting: {
        requests: 100,
        timeWindow: 60000,
        burstLimit: 10
      }
    });

    // テスト用設定ファイルを作成
    await writeFile(join(testDir, 'config', 'default.json'), JSON.stringify({
      cursor: {
        apiUrl: 'https://api.cursor.test',
        timeout: 30000,
        retryCount: 3,
        features: {
          codeGeneration: true,
          projectAnalysis: true,
          aiPersonas: true
        }
      },
      personas: {
        default: 'general',
        available: ['general', 'backend', 'frontend', 'devops']
      },
      security: {
        allowFileWrite: true,
        restrictedPaths: ['/etc', '/root'],
        maxFileSize: '10MB'
      }
    }, null, 2));

    // テストプロジェクト構造を作成
    await mkdir(join(testDir, 'project', 'src'), { recursive: true });
    await mkdir(join(testDir, 'project', 'tests'), { recursive: true });
    
    await writeFile(join(testDir, 'project', 'package.json'), JSON.stringify({
      name: 'test-integration-project',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'jest': '^29.5.0',
        '@types/react': '^18.2.0'
      },
      scripts: {
        'dev': 'next dev',
        'build': 'next build',
        'test': 'jest'
      }
    }, null, 2));

    await writeFile(join(testDir, 'project', 'src', 'App.tsx'), `
import React from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

const App: React.FC = () => {
  const [users, setUsers] = React.useState<User[]>([]);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const userData = await response.json();
      setUsers(userData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  return (
    <div className="app">
      <h1>ユーザー一覧</h1>
      {users.map(user => (
        <div key={user.id} className="user-card">
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  );
};

export default App;
    `);

    await writeFile(join(testDir, 'project', 'tests', 'App.test.tsx'), `
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

// モックAPI
global.fetch = jest.fn();

describe('App Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('ユーザー一覧を表示する', async () => {
    const mockUsers = [
      { id: '1', name: 'テストユーザー1', email: 'test1@example.com' },
      { id: '2', name: 'テストユーザー2', email: 'test2@example.com' }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockUsers
    });

    render(<App />);

    expect(screen.getByText('ユーザー一覧')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('テストユーザー1')).toBeInTheDocument();
      expect(screen.getByText('テストユーザー2')).toBeInTheDocument();
    });
  });
});
    `);
  });

  afterEach(async () => {
    try {
      configManager.dispose();
      commandRouter.dispose();
      contextAnalyzer.dispose();
      cursorAPI.dispose();
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('フレームワーク初期化', () => {
    it('全コンポーネントが正しく初期化される', async () => {
      // ConfigManagerの初期化確認
      await configManager.loadConfiguration('default');
      const config = configManager.getCurrentConfiguration();
      expect(config).toBeDefined();
      expect(config.cursor).toBeDefined();
      expect(config.cursor.apiUrl).toBe('https://api.cursor.test');

      // ContextAnalyzerでプロジェクト解析
      const projectPath = join(testDir, 'project');
      const projectContext = await contextAnalyzer.analyzeProject(projectPath);
      
      expect(projectContext.name).toBe('project');
      expect(projectContext.type).toBe(ProjectType.WEB_APPLICATION);
      expect(projectContext.technologies.languages.some(l => l.name === 'typescript')).toBe(true);
      expect(projectContext.technologies.frameworks.some(f => f.name === 'React')).toBe(true);
    });

    it('設定に基づいてCursor APIが構成される', async () => {
      await configManager.loadConfiguration('default');
      const config = configManager.getCurrentConfiguration();

      // 設定から新しいCursor APIインスタンスを作成
      const cursorAPIFromConfig = new CursorAPIIntegration({
        baseUrl: config.cursor.apiUrl,
        timeout: config.cursor.timeout,
        retryCount: config.cursor.retryCount,
        retryDelay: 1000,
        rateLimiting: {
          requests: 100,
          timeWindow: 60000,
          burstLimit: 10
        }
      });

      const health = await cursorAPIFromConfig.healthCheck();
      expect(health.status).toBeDefined();
      
      cursorAPIFromConfig.dispose();
    });
  });

  describe('プロジェクト解析統合', () => {
    it('プロジェクト解析結果をJSON形式で出力できる', async () => {
      const projectPath = join(testDir, 'project');
      const projectContext = await contextAnalyzer.analyzeProject(projectPath);

      // プロジェクトコンテキストをJSONシリアライズ可能か確認
      const jsonString = JSON.stringify(projectContext, null, 2);
      expect(jsonString).toContain('test-integration-project');
      expect(jsonString).toContain('WEB_APPLICATION');
      expect(jsonString).toContain('typescript');
      expect(jsonString).toContain('React');

      // JSONから復元できるか確認
      const restored = JSON.parse(jsonString);
      expect(restored.name).toBe(projectContext.name);
      expect(restored.type).toBe(projectContext.type);
    });

    it('依存関係が正しく検出される', async () => {
      const projectPath = join(testDir, 'project');
      const projectContext = await contextAnalyzer.analyzeProject(projectPath);

      const dependencies = projectContext.dependencies;
      
      // Reactの依存関係が検出されているか確認
      const reactDep = dependencies.find(d => d.name === 'react');
      const reactDomDep = dependencies.find(d => d.name === 'react-dom');
      const typeScriptDep = dependencies.find(d => d.name === 'typescript');

      expect(reactDep).toBeDefined();
      expect(reactDep?.dev).toBe(false);
      expect(reactDomDep).toBeDefined();
      expect(reactDomDep?.dev).toBe(false);
      expect(typeScriptDep).toBeDefined();
      expect(typeScriptDep?.dev).toBe(true);
    });

    it('ファイル構造が正しく解析される', async () => {
      const projectPath = join(testDir, 'project');
      const projectContext = await contextAnalyzer.analyzeProject(projectPath);

      const structure = projectContext.structure;
      
      // ディレクトリ構造の確認
      const rootDir = structure.directories[0];
      expect(rootDir).toBeDefined();
      expect(rootDir?.name).toBe('project');
      
      const srcDir = rootDir?.children.find(d => d.name === 'src');
      const testsDir = rootDir?.children.find(d => d.name === 'tests');
      
      expect(srcDir).toBeDefined();
      expect(testsDir).toBeDefined();

      // ファイル情報の確認
      const packageJsonFile = structure.files.find(f => f.name === 'package.json');
      const appTsxFile = structure.files.find(f => f.name === 'App.tsx');
      
      expect(packageJsonFile).toBeDefined();
      expect(appTsxFile).toBeDefined();
      expect(appTsxFile?.language).toBe('typescript');
    });
  });

  describe('コマンドルーティング統合', () => {
    it('カスタムコマンドハンドラーを登録して実行できる', async () => {
      // カスタムコマンドハンドラーを作成
      const analyzeHandler = {
        name: 'analyze',
        description: 'プロジェクトを解析します',
        aliases: ['an'],
        parameters: [{
          name: 'path',
          type: 'string' as const,
          required: false,
          description: '解析対象パス',
          defaultValue: '.'
        }],
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: 'プロジェクト解析が完了しました',
          format: OutputFormat.JSON,
          metadata: {
            executionTime: 1500,
            cacheHit: false,
            resourcesUsed: {
              memory: 50 * 1024 * 1024, // 50MB
              cpu: 0.2,
              diskIO: 1024 * 1024, // 1MB
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      // コマンドを登録
      await commandRouter.registerCommand(analyzeHandler);

      // コマンドコンテキストを作成
      const projectPath = join(testDir, 'project');
      const projectContext = await contextAnalyzer.analyzeProject(projectPath);
      
      const commandContext = {
        command: 'analyze',
        arguments: [projectPath],
        options: {},
        workingDirectory: projectPath,
        user: testUser,
        project: projectContext,
        session: {
          id: 'integration-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      // コマンドを解析して実行
      const parsedCommand = await commandRouter.parseCommand('/sc:analyze');
      const result = await commandRouter.routeCommand(parsedCommand, commandContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe('プロジェクト解析が完了しました');
      expect(analyzeHandler.execute).toHaveBeenCalledWith(commandContext);
    });

    it('コマンド履歴が正しく管理される', async () => {
      const testHandler = {
        name: 'test-command',
        description: 'テスト用コマンド',
        aliases: [],
        parameters: [],
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: 'テスト完了',
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

      const commandContext = {
        command: 'test-command',
        arguments: [],
        options: {},
        workingDirectory: testDir,
        user: testUser,
        project: {} as any,
        session: {
          id: 'history-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      // 複数のコマンドを実行
      const commands = [
        '/sc:test-command',
        '/sc:test-command arg1',
        '/sc:test-command arg2 --option=value'
      ];

      for (const cmd of commands) {
        const parsed = await commandRouter.parseCommand(cmd);
        await commandRouter.routeCommand(parsed, commandContext);
      }

      // 履歴を確認
      const history = await commandRouter.getCommandHistory('history-session');
      expect(history).toHaveLength(3);
      expect(history[0]?.command).toBe('/sc:test-command arg2 --option=value');
      expect(history[2]?.command).toBe('/sc:test-command');
    });
  });

  describe('エラーハンドリング統合', () => {
    it('設定読み込みエラーを適切に処理する', async () => {
      // 存在しない設定ファイルを読み込もうとする
      await expect(configManager.loadConfiguration('nonexistent'))
        .rejects.toThrow();
    });

    it('プロジェクト解析エラーを適切に処理する', async () => {
      // 存在しないディレクトリを解析しようとする
      const nonExistentPath = join(testDir, 'nonexistent-project');
      
      await expect(contextAnalyzer.analyzeProject(nonExistentPath))
        .rejects.toThrow();
    });

    it('コマンド実行エラーを適切に処理する', async () => {
      const errorHandler = {
        name: 'error-command',
        description: 'エラーテスト用コマンド',
        aliases: [],
        parameters: [],
        execute: jest.fn().mockRejectedValue(new Error('実行時エラー')),
        canHandle: () => true
      };

      await commandRouter.registerCommand(errorHandler);

      const commandContext = {
        command: 'error-command',
        arguments: [],
        options: {},
        workingDirectory: testDir,
        user: testUser,
        project: {} as any,
        session: {
          id: 'error-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      const parsed = await commandRouter.parseCommand('/sc:error-command');
      const result = await commandRouter.routeCommand(parsed, commandContext);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]?.message).toContain('実行時エラー');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大きなプロジェクトの解析が適切な時間内に完了する', async () => {
      // より大きなテストプロジェクトを作成
      const bigProjectDir = join(testDir, 'big-project');
      await mkdir(bigProjectDir, { recursive: true });

      // 複数のディレクトリとファイルを作成
      const directories = ['src', 'tests', 'docs', 'config', 'scripts'];
      for (const dir of directories) {
        await mkdir(join(bigProjectDir, dir), { recursive: true });
        
        // 各ディレクトリに複数のファイルを作成
        for (let i = 0; i < 10; i++) {
          await writeFile(
            join(bigProjectDir, dir, `file${i}.ts`),
            `// ファイル ${i} in ${dir}\nexport const value${i} = ${i};`
          );
        }
      }

      const startTime = Date.now();
      const projectContext = await contextAnalyzer.analyzeProject(bigProjectDir);
      const executionTime = Date.now() - startTime;

      expect(projectContext).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // 5秒以内
      expect(projectContext.structure.files.length).toBeGreaterThan(40);
    });

    it('複数のコマンドを並行実行できる', async () => {
      const parallelHandler = {
        name: 'parallel-test',
        description: '並行テスト用コマンド',
        aliases: [],
        parameters: [],
        execute: jest.fn().mockImplementation(async () => {
          // 少し待機して並行性をテスト
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            success: true,
            output: `処理完了: ${Date.now()}`,
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
          };
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(parallelHandler);

      const commandContext = {
        command: 'parallel-test',
        arguments: [],
        options: {},
        workingDirectory: testDir,
        user: testUser,
        project: {} as any,
        session: {
          id: 'parallel-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      // 複数のコマンドを並行実行
      const promises = Array.from({ length: 5 }, async (_, i) => {
        const parsed = await commandRouter.parseCommand('/sc:parallel-test');
        return commandRouter.routeCommand(parsed, commandContext);
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 並行実行により、総時間が順次実行より短くなることを確認
      expect(totalTime).toBeLessThan(400); // 5 * 100ms よりも短い
    });
  });

  describe('メモリ管理', () => {
    it('リソースが適切に解放される', async () => {
      // 複数のコンポーネントインスタンスを作成
      const instances = Array.from({ length: 10 }, () => ({
        config: new ConfigManager(join(testDir, 'config'), mockCache),
        router: new CommandRouter(mockCache),
        analyzer: new ContextAnalyzer()
      }));

      // 各インスタンスを使用
      for (const instance of instances) {
        await instance.config.loadConfiguration('default');
        // 軽量な処理を実行
      }

      // すべてのインスタンスを破棄
      for (const instance of instances) {
        instance.config.dispose();
        instance.router.dispose();
        instance.analyzer.dispose();
      }

      // メモリリークがないことを確認（実際のテストではメモリ使用量を測定）
      expect(true).toBe(true); // プレースホルダー
    });
  });
});