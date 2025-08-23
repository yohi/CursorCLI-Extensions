import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import axios from 'axios';
import { CursorAPIIntegration } from '../../src/integrations/cursor-api-integration.js';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CommandRouter } from '../../src/core/command-router.js';
import { ContextAnalyzer } from '../../src/core/context-analyzer.js';
import { PermissionManager } from '../../src/core/permission-manager.js';
import { MockCacheManager } from '../../src/utils/mock-cache.js';
import {
  ProjectType,
  OutputFormat,
  UserContext,
  PermissionScope
} from '../../src/types/index.js';

// Axiosをモック
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SuperCursor Framework E2E Scenarios', () => {
  let testDir: string;
  let projectDir: string;
  let configManager: ConfigManager;
  let commandRouter: CommandRouter;
  let contextAnalyzer: ContextAnalyzer;
  let permissionManager: PermissionManager;
  let cursorAPI: CursorAPIIntegration;
  let mockCache: MockCacheManager;
  let testUser: UserContext;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(async () => {
    // テスト用ディレクトリ作成
    testDir = join(tmpdir(), `e2e-test-${Date.now()}`);
    projectDir = join(testDir, 'my-react-app');
    await mkdir(projectDir, { recursive: true });

    // モックAxiosインスタンスを作成
    mockAxiosInstance = {
      create: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      defaults: {
        baseURL: 'https://api.cursor.test',
        timeout: 30000,
        headers: {}
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // コンポーネントインスタンス作成
    mockCache = new MockCacheManager();
    configManager = new ConfigManager(join(testDir, 'config'), mockCache);
    commandRouter = new CommandRouter(mockCache);
    contextAnalyzer = new ContextAnalyzer();
    permissionManager = new PermissionManager();
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

    // テストユーザー作成
    testUser = {
      id: 'e2e-test-user',
      name: 'E2E Test User',
      preferences: {
        language: 'ja',
        theme: 'dark',
        outputFormat: OutputFormat.JSON,
        verbosity: 'verbose' as any,
        autoSave: true
      },
      permissions: []
    };

    // 基本設定ファイル作成
    await mkdir(join(testDir, 'config'), { recursive: true });
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
        default: 'frontend',
        available: ['frontend', 'backend', 'fullstack', 'devops']
      },
      security: {
        allowFileWrite: true,
        restrictedPaths: ['/etc', '/root'],
        maxFileSize: '10MB'
      },
      development: {
        autoSave: true,
        linting: true,
        formatting: true,
        testing: {
          framework: 'jest',
          coverage: true,
          watchMode: true
        }
      }
    }, null, 2));

    // Reactプロジェクトの基本構造を作成
    await mkdir(join(projectDir, 'src', 'components'), { recursive: true });
    await mkdir(join(projectDir, 'src', 'pages'), { recursive: true });
    await mkdir(join(projectDir, 'src', 'hooks'), { recursive: true });
    await mkdir(join(projectDir, 'src', 'utils'), { recursive: true });
    await mkdir(join(projectDir, 'tests'), { recursive: true });
    await mkdir(join(projectDir, 'public'), { recursive: true });

    // package.json作成
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({
      name: 'my-react-app',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        test: 'jest',
        lint: 'eslint src --ext .ts,.tsx'
      },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'next': '^13.4.0',
        'axios': '^1.4.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'jest': '^29.5.0',
        '@types/react': '^18.2.0',
        '@types/node': '^20.0.0',
        'eslint': '^8.42.0'
      }
    }, null, 2));

    // TypeScript設定
    await writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        jsx: 'preserve',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*', 'tests/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2));

    // サンプルReactコンポーネント
    await writeFile(join(projectDir, 'src', 'components', 'Header.tsx'), `
import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="header">
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </header>
  );
};
`);

    await writeFile(join(projectDir, 'src', 'hooks', 'useApi.ts'), `
import { useState, useEffect } from 'react';
import axios from 'axios';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const response = await axios.get<T>(url);
        setState({ data: response.data, loading: false, error: null });
      } catch (error) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    };

    fetchData();
  }, [url]);

  return state;
}
`);

    await writeFile(join(projectDir, 'src', 'pages', 'index.tsx'), `
import React from 'react';
import { Header } from '../components/Header';
import { useApi } from '../hooks/useApi';

interface User {
  id: number;
  name: string;
  email: string;
}

const HomePage: React.FC = () => {
  const { data: users, loading, error } = useApi<User[]>('/api/users');

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error}</div>;

  return (
    <div>
      <Header title="ユーザー管理" subtitle="アプリケーションへようこそ" />
      <main>
        {users && users.map(user => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        ))}
      </main>
    </div>
  );
};

export default HomePage;
`);
  });

  afterEach(async () => {
    try {
      configManager.dispose();
      commandRouter.dispose();
      contextAnalyzer.dispose();
      permissionManager.dispose();
      cursorAPI.dispose();
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('シナリオ1: 新規プロジェクトの初期セットアップ', () => {
    it('プロジェクト解析から設定まで完全なフローが動作する', async () => {
      // 1. 設定読み込み
      await configManager.loadConfiguration('default');
      const config = configManager.getCurrentConfiguration();
      expect(config.cursor.apiUrl).toBe('https://api.cursor.test');

      // 2. プロジェクト解析実行
      const projectContext = await contextAnalyzer.analyzeProject(projectDir);
      
      expect(projectContext.name).toBe('my-react-app');
      expect(projectContext.type).toBe(ProjectType.WEB_APPLICATION);
      expect(projectContext.technologies.languages.some(l => l.name === 'typescript')).toBe(true);
      expect(projectContext.technologies.frameworks.some(f => f.name === 'React')).toBe(true);

      // 3. 権限設定
      await permissionManager.loadRules();
      const hasReadPermission = await permissionManager.checkPermission(
        testUser,
        PermissionScope.FILE_READ,
        join(projectDir, 'src', 'components', 'Header.tsx')
      );
      expect(hasReadPermission.granted).toBe(true);

      // 4. Cursor API接続テスト（モック）
      mockAxiosInstance.get.mockResolvedValueOnce({ data: 'OK' });
      const health = await cursorAPI.healthCheck();
      expect(health.status).toBe('healthy');
    });
  });

  describe('シナリオ2: コンポーネント実装支援', () => {
    it('新規コンポーネント実装の完全ワークフロー', async () => {
      // 1. 設定とコンテキスト準備
      await configManager.loadConfiguration('default');
      const projectContext = await contextAnalyzer.analyzeProject(projectDir);

      // 2. 実装支援コマンドハンドラーを登録
      const implementHandler = {
        name: 'implement',
        description: 'コンポーネントを実装します',
        aliases: ['impl'],
        parameters: [{
          name: 'componentName',
          type: 'string' as const,
          required: true,
          description: 'コンポーネント名'
        }, {
          name: 'type',
          type: 'string' as const,
          required: false,
          description: 'コンポーネントタイプ',
          defaultValue: 'functional'
        }],
        execute: jest.fn().mockImplementation(async (context) => {
          const componentName = context.arguments[0];
          const componentCode = `
import React from 'react';

interface ${componentName}Props {
  // TODO: プロパティを定義
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div className="${componentName.toLowerCase()}">
      {/* TODO: コンポーネントの内容を実装 */}
      <h2>${componentName} Component</h2>
    </div>
  );
};
`;
          
          return {
            success: true,
            output: JSON.stringify({
              componentName,
              code: componentCode,
              filePath: `src/components/${componentName}.tsx`,
              suggestions: [
                'プロパティインターフェースを定義してください',
                'スタイリングを追加してください',
                'ユニットテストを作成してください'
              ]
            }),
            format: OutputFormat.JSON,
            metadata: {
              executionTime: 1200,
              cacheHit: false,
              resourcesUsed: {
                memory: 30 * 1024 * 1024,
                cpu: 0.1,
                diskIO: 0,
                networkIO: 0
              }
            }
          };
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(implementHandler);

      // 3. コマンド実行
      const commandContext = {
        command: 'implement',
        arguments: ['UserProfile'],
        options: { type: 'functional' },
        workingDirectory: projectDir,
        user: testUser,
        project: projectContext,
        session: {
          id: 'implement-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      const command = await commandRouter.parseCommand('/sc:implement UserProfile --type=functional');
      const result = await commandRouter.routeCommand(command, commandContext);

      // 4. 結果検証
      expect(result.success).toBe(true);
      const output = JSON.parse(result.output);
      expect(output.componentName).toBe('UserProfile');
      expect(output.code).toContain('UserProfile: React.FC');
      expect(output.suggestions).toHaveLength(3);
    });
  });

  describe('シナリオ3: コード品質チェックとリファクタリング', () => {
    it('品質チェックからリファクタリング提案までの完全フロー', async () => {
      // 1. 解析コマンドハンドラーを登録
      const analyzeHandler = {
        name: 'analyze',
        description: 'コード品質を解析します',
        aliases: ['check', 'qa'],
        parameters: [{
          name: 'target',
          type: 'string' as const,
          required: false,
          description: '解析対象パス',
          defaultValue: 'src'
        }],
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: JSON.stringify({
            summary: {
              filesAnalyzed: 4,
              issues: 3,
              suggestions: 5,
              score: 85
            },
            issues: [
              {
                file: 'src/hooks/useApi.ts',
                line: 15,
                type: 'warning',
                rule: 'explicit-return-type',
                message: '戻り値の型を明示的に指定することを推奨します'
              },
              {
                file: 'src/pages/index.tsx',
                line: 8,
                type: 'info',
                rule: 'component-naming',
                message: 'コンポーネントファイル名はPascalCaseにすることを推奨します'
              }
            ],
            suggestions: [
              'TypeScript strictモードを有効にしてください',
              'ESLintルールを追加設定してください',
              'Prettierでコードフォーマットを統一してください',
              'React Hooksの依存関係配列を最適化してください',
              'コンポーネントのメモ化を検討してください'
            ]
          }),
          format: OutputFormat.JSON,
          metadata: {
            executionTime: 2500,
            cacheHit: false,
            resourcesUsed: {
              memory: 45 * 1024 * 1024,
              cpu: 0.3,
              diskIO: 2 * 1024 * 1024,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(analyzeHandler);

      // 2. リファクタリングコマンドハンドラーを登録
      const refactorHandler = {
        name: 'refactor',
        description: 'コードのリファクタリングを行います',
        aliases: ['rf'],
        parameters: [{
          name: 'file',
          type: 'string' as const,
          required: true,
          description: 'リファクタリング対象ファイル'
        }, {
          name: 'type',
          type: 'string' as const,
          required: false,
          description: 'リファクタリングタイプ',
          defaultValue: 'optimize'
        }],
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: JSON.stringify({
            originalFile: 'src/hooks/useApi.ts',
            changes: [
              {
                line: 15,
                type: 'type-annotation',
                before: 'const fetchData = async () => {',
                after: 'const fetchData = async (): Promise<void> => {'
              },
              {
                line: 25,
                type: 'error-handling',
                before: 'error instanceof Error ? error.message : "不明なエラー"',
                after: 'error instanceof Error ? error.message : "不明なエラーが発生しました"'
              }
            ],
            improvements: [
              'TypeScriptの型安全性が向上しました',
              'エラーハンドリングがより明確になりました'
            ]
          }),
          format: OutputFormat.JSON,
          metadata: {
            executionTime: 1800,
            cacheHit: false,
            resourcesUsed: {
              memory: 25 * 1024 * 1024,
              cpu: 0.2,
              diskIO: 1024 * 1024,
              networkIO: 0
            }
          }
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(refactorHandler);

      // 3. プロジェクトコンテキスト準備
      const projectContext = await contextAnalyzer.analyzeProject(projectDir);
      
      const commandContext = {
        command: '',
        arguments: [],
        options: {},
        workingDirectory: projectDir,
        user: testUser,
        project: projectContext,
        session: {
          id: 'qa-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      // 4. 解析実行
      const analyzeCommand = await commandRouter.parseCommand('/sc:analyze src');
      const analyzeResult = await commandRouter.routeCommand(analyzeCommand, commandContext);
      
      expect(analyzeResult.success).toBe(true);
      const analysis = JSON.parse(analyzeResult.output);
      expect(analysis.summary.filesAnalyzed).toBe(4);
      expect(analysis.issues).toHaveLength(2);
      expect(analysis.suggestions).toHaveLength(5);

      // 5. リファクタリング実行
      const refactorCommand = await commandRouter.parseCommand('/sc:refactor src/hooks/useApi.ts');
      const refactorResult = await commandRouter.routeCommand(refactorCommand, commandContext);
      
      expect(refactorResult.success).toBe(true);
      const refactoring = JSON.parse(refactorResult.output);
      expect(refactoring.changes).toHaveLength(2);
      expect(refactoring.improvements).toHaveLength(2);

      // 6. 履歴確認
      const history = await commandRouter.getCommandHistory('qa-session');
      expect(history).toHaveLength(2);
      expect(history[0]?.command).toBe('/sc:refactor src/hooks/useApi.ts');
      expect(history[1]?.command).toBe('/sc:analyze src');
    });
  });

  describe('シナリオ4: Cursor API統合によるAI支援開発', () => {
    it('AI支援による開発ワークフロー', async () => {
      // 1. Cursor API認証（モック）
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { permissions: ['read', 'write', 'execute'] }
      });
      
      const authResult = await cursorAPI.authenticate('test-api-key');
      expect(authResult.success).toBe(true);

      // 2. AI支援コマンドハンドラーを登録
      const aiAssistHandler = {
        name: 'ai-assist',
        description: 'AI支援による開発',
        aliases: ['ai', 'assist'],
        parameters: [{
          name: 'task',
          type: 'string' as const,
          required: true,
          description: 'AIに依頼するタスク'
        }, {
          name: 'context',
          type: 'string' as const,
          required: false,
          description: 'コンテキスト情報'
        }],
        execute: jest.fn().mockImplementation(async (context) => {
          // Cursor APIコマンド実行（モック）
          mockAxiosInstance.request.mockResolvedValueOnce({
            data: {
              success: true,
              output: JSON.stringify({
                task: context.arguments[0],
                aiResponse: {
                  analysis: 'コードを分析しました。以下の改善点があります:',
                  suggestions: [
                    'React.memoを使用してコンポーネントの再レンダリングを最適化',
                    'useCallbackでイベントハンドラーをメモ化',
                    'TypeScriptの厳密な型チェックを有効化'
                  ],
                  codeExample: `
const OptimizedComponent = React.memo(({ data, onUpdate }) => {
  const handleUpdate = useCallback((newData) => {
    onUpdate(newData);
  }, [onUpdate]);

  return <div>{/* コンポーネント内容 */}</div>;
});`
                },
                confidence: 0.92,
                executionTime: 3200
              }),
              format: 'json',
              tokensUsed: 450,
              modelUsed: 'gpt-4'
            }
          });

          // 実際のCursor API呼び出し
          const cursorResult = await cursorAPI.executeCommand(
            `/sc:analyze-and-optimize ${context.arguments[0]}`,
            {
              format: OutputFormat.JSON,
              verbose: true,
              timeout: 10000
            }
          );

          return cursorResult;
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(aiAssistHandler);

      // 3. コマンド実行
      const projectContext = await contextAnalyzer.analyzeProject(projectDir);
      const commandContext = {
        command: 'ai-assist',
        arguments: ['React component optimization'],
        options: { context: 'performance improvement' },
        workingDirectory: projectDir,
        user: testUser,
        project: projectContext,
        session: {
          id: 'ai-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      const command = await commandRouter.parseCommand('/sc:ai-assist "React component optimization"');
      const result = await commandRouter.routeCommand(command, commandContext);

      // 4. 結果検証
      expect(result.success).toBe(true);
      const aiOutput = JSON.parse(result.output);
      expect(aiOutput.task).toBe('React component optimization');
      expect(aiOutput.aiResponse.suggestions).toHaveLength(3);
      expect(aiOutput.confidence).toBeGreaterThan(0.9);
      expect(result.metadata.tokensUsed).toBe(450);
      expect(result.metadata.modelUsed).toBe('gpt-4');
    });
  });

  describe('シナリオ5: 権限制御とセキュリティ', () => {
    it('セキュリティ制約下での安全な操作', async () => {
      // 1. セキュリティルール設定
      await permissionManager.addRule({
        id: 'test-security-rule',
        name: 'テスト用セキュリティルール',
        scope: PermissionScope.FILE_WRITE,
        conditions: [
          {
            type: 'path',
            operator: 'not_starts_with',
            value: '/etc'
          },
          {
            type: 'path',
            operator: 'not_starts_with',
            value: '/root'
          },
          {
            type: 'extension',
            operator: 'in',
            value: ['.ts', '.tsx', '.js', '.jsx', '.json']
          },
          {
            type: 'size',
            operator: 'less_than',
            value: 1024 * 1024 // 1MB
          }
        ],
        action: 'allow',
        priority: 100
      });

      // 2. ファイル書き込みコマンドハンドラー
      const writeFileHandler = {
        name: 'write-file',
        description: 'ファイルを書き込みます',
        aliases: ['write'],
        parameters: [{
          name: 'path',
          type: 'string' as const,
          required: true,
          description: 'ファイルパス'
        }, {
          name: 'content',
          type: 'string' as const,
          required: true,
          description: 'ファイル内容'
        }],
        execute: jest.fn().mockImplementation(async (context) => {
          const filePath = context.arguments[0];
          const content = context.arguments[1];

          // 権限チェック
          const permission = await permissionManager.checkPermission(
            context.user,
            PermissionScope.FILE_WRITE,
            filePath
          );

          if (!permission.granted) {
            throw new Error(`書き込み権限がありません: ${permission.reason}`);
          }

          // ファイル書き込みシミュレーション
          return {
            success: true,
            output: `ファイルを書き込みました: ${filePath}`,
            format: OutputFormat.TEXT,
            metadata: {
              executionTime: 150,
              cacheHit: false,
              resourcesUsed: {
                memory: 0,
                cpu: 0,
                diskIO: content.length,
                networkIO: 0
              }
            }
          };
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(writeFileHandler);

      // 3. 正常なファイル書き込みテスト
      const validCommand = await commandRouter.parseCommand('/sc:write-file src/components/NewComponent.tsx "export const NewComponent = () => <div>Test</div>;"');
      const commandContext = {
        command: 'write-file',
        arguments: ['src/components/NewComponent.tsx', 'export const NewComponent = () => <div>Test</div>;'],
        options: {},
        workingDirectory: projectDir,
        user: testUser,
        project: {} as any,
        session: {
          id: 'security-session',
          startTime: new Date(),
          history: [],
          cache: mockCache,
          preferences: testUser.preferences
        }
      };

      const validResult = await commandRouter.routeCommand(validCommand, commandContext);
      expect(validResult.success).toBe(true);

      // 4. 制限されたパスへの書き込みテスト
      const restrictedCommand = await commandRouter.parseCommand('/sc:write-file /etc/passwd "malicious content"');
      commandContext.arguments = ['/etc/passwd', 'malicious content'];
      
      const restrictedResult = await commandRouter.routeCommand(restrictedCommand, commandContext);
      expect(restrictedResult.success).toBe(false);
      expect(restrictedResult.errors?.[0]?.message).toContain('書き込み権限がありません');

      // 5. セキュリティ統計の確認
      const securityStats = permissionManager.getSecurityStatistics();
      expect(securityStats.accessAttempts).toBeGreaterThan(0);
      expect(securityStats.deniedAttempts).toBeGreaterThan(0);
    });
  });

  describe('シナリオ6: パフォーマンス最適化とリソース管理', () => {
    it('高負荷環境でのパフォーマンステスト', async () => {
      // 1. 重い処理のコマンドハンドラー
      const heavyTaskHandler = {
        name: 'heavy-task',
        description: '重い処理を実行します',
        aliases: ['heavy'],
        parameters: [{
          name: 'iterations',
          type: 'number' as const,
          required: false,
          description: '反復回数',
          defaultValue: 1000
        }],
        execute: jest.fn().mockImplementation(async (context) => {
          const iterations = context.options.iterations || 1000;
          
          // CPU集約的な処理をシミュレーション
          const startTime = Date.now();
          let result = 0;
          for (let i = 0; i < iterations; i++) {
            result += Math.sqrt(i);
          }
          const executionTime = Date.now() - startTime;

          return {
            success: true,
            output: `重い処理が完了しました。結果: ${result.toFixed(2)}`,
            format: OutputFormat.TEXT,
            metadata: {
              executionTime,
              cacheHit: false,
              resourcesUsed: {
                memory: iterations * 8, // バイト単位
                cpu: executionTime / 1000, // CPU使用時間（秒）
                diskIO: 0,
                networkIO: 0
              }
            }
          };
        }),
        canHandle: () => true
      };

      await commandRouter.registerCommand(heavyTaskHandler);

      // 2. 複数の重いタスクを並行実行
      const projectContext = await contextAnalyzer.analyzeProject(projectDir);
      const promises = Array.from({ length: 5 }, (_, i) => {
        const commandContext = {
          command: 'heavy-task',
          arguments: [],
          options: { iterations: 5000 + i * 1000 },
          workingDirectory: projectDir,
          user: testUser,
          project: projectContext,
          session: {
            id: `performance-session-${i}`,
            startTime: new Date(),
            history: [],
            cache: mockCache,
            preferences: testUser.preferences
          }
        };

        return (async () => {
          const command = await commandRouter.parseCommand(`/sc:heavy-task --iterations=${5000 + i * 1000}`);
          return commandRouter.routeCommand(command, commandContext);
        })();
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // 3. パフォーマンス検証
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.metadata.executionTime).toBeLessThan(5000); // 5秒以内
        expect(result.metadata.resourcesUsed.memory).toBeGreaterThan(0);
      });

      // 並行実行により効率的に処理されているか確認
      expect(totalTime).toBeLessThan(10000); // 10秒以内

      // 4. リソース使用量の統計
      const totalMemoryUsed = results.reduce((sum, result) => 
        sum + (result.metadata.resourcesUsed.memory || 0), 0);
      const totalCpuTime = results.reduce((sum, result) => 
        sum + (result.metadata.resourcesUsed.cpu || 0), 0);

      expect(totalMemoryUsed).toBeGreaterThan(0);
      expect(totalCpuTime).toBeGreaterThan(0);

      // 5. コマンド使用統計の確認
      const usageStats = commandRouter.getCommandUsageStats();
      expect(usageStats['heavy-task']).toBeDefined();
      expect(usageStats['heavy-task']?.count).toBe(5);
      expect(usageStats['heavy-task']?.averageExecutionTime).toBeGreaterThan(0);
    });
  });
});