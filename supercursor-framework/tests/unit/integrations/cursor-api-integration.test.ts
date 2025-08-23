import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { CursorAPIIntegration, CursorAPIError } from '../../../src/integrations/cursor-api-integration.js';
import { OutputFormat, ProjectType } from '../../../src/types/index.js';

// Axiosをモック
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CursorAPIIntegration', () => {
  let cursorAPI: CursorAPIIntegration;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
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
        baseURL: '',
        timeout: 0,
        headers: {}
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // CursorAPIIntegrationのインスタンスを作成
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
  });

  afterEach(() => {
    cursorAPI.dispose();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('初期化と設定', () => {
    it('正しい設定でAxiosインスタンスを作成する', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.cursor.test',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SuperCursor-Framework/0.1.0'
        }
      });
    });

    it('リクエストとレスポンスのインターセプターを設定する', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('認証処理', () => {
    it('有効なAPIキーで認証に成功する', async () => {
      const mockResponse = {
        data: {
          permissions: ['read', 'write']
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await cursorAPI.authenticate('test-api-key');

      expect(result.success).toBe(true);
      expect(result.token).toBe('test-api-key');
      expect(result.permissions).toEqual(['read', 'write']);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/verify');
    });

    it('無効なAPIキーで認証に失敗する', async () => {
      const mockError = {
        response: { status: 401 },
        message: 'Unauthorized'
      };

      mockAxiosInstance.get.mockRejectedValueOnce(mockError);

      const result = await cursorAPI.authenticate('invalid-key');

      expect(result.success).toBe(false);
      expect(result.permissions).toEqual([]);
    });

    it('認証成功時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      cursorAPI.on('authenticated', mockListener);

      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });

      await cursorAPI.authenticate('test-key');

      expect(mockListener).toHaveBeenCalledWith({ success: true });
    });

    it('認証失敗時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      cursorAPI.on('authenticationFailed', mockListener);

      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Auth failed'));

      await cursorAPI.authenticate('invalid-key');

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('コマンド実行', () => {
    beforeEach(async () => {
      // 認証済み状態にセットアップ
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('コマンドを正常に実行する', async () => {
      const mockResponse = {
        data: {
          success: true,
          output: 'Command executed successfully',
          format: OutputFormat.TEXT,
          tokensUsed: 150,
          modelUsed: 'gpt-4'
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const result = await cursorAPI.executeCommand('/sc:analyze project');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Command executed successfully');
      expect(result.metadata.tokensUsed).toBe(150);
      expect(result.metadata.modelUsed).toBe('gpt-4');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/commands/execute',
          data: expect.objectContaining({
            command: '/sc:analyze project',
            options: expect.objectContaining({
              format: OutputFormat.TEXT,
              verbose: false
            })
          })
        })
      );
    });

    it('認証されていない状態でコマンド実行するとエラーをスローする', async () => {
      const unauthenticatedAPI = new CursorAPIIntegration({
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

      await expect(unauthenticatedAPI.executeCommand('/sc:test'))
        .rejects.toThrow(CursorAPIError);
      
      unauthenticatedAPI.dispose();
    });

    it('コマンド実行失敗時に適切なエラーをスローする', async () => {
      const mockError = {
        response: { status: 500 },
        message: 'Internal Server Error'
      };

      mockAxiosInstance.request.mockRejectedValueOnce(mockError);

      await expect(cursorAPI.executeCommand('/sc:test'))
        .rejects.toThrow(CursorAPIError);
    });
  });

  describe('ファイル操作', () => {
    beforeEach(async () => {
      // 認証済み状態にセットアップ
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('ファイルを正常に読み取る', async () => {
      const mockResponse = {
        data: {
          path: '/test/file.txt',
          content: 'Hello, World!',
          encoding: 'utf-8',
          size: 13,
          lastModified: '2023-01-01T00:00:00Z',
          permissions: 0o644,
          owner: 'user',
          group: 'users',
          type: 'file'
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const result = await cursorAPI.readFile('/test/file.txt');

      expect(result.path).toBe('/test/file.txt');
      expect(result.content).toBe('Hello, World!');
      expect(result.encoding).toBe('utf-8');
      expect(result.size).toBe(13);
      expect(result.metadata.permissions).toBe(0o644);
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/files/read',
          params: { path: '/test/file.txt' }
        })
      );
    });

    it('ファイルを正常に書き込む', async () => {
      const mockResponse = {
        data: {
          success: true,
          bytesWritten: 13,
          path: '/test/output.txt'
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const result = await cursorAPI.writeFile(
        '/test/output.txt',
        'Hello, World!',
        { encoding: 'utf-8', backup: true }
      );

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(13);
      expect(result.path).toBe('/test/output.txt');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/files/write',
          data: expect.objectContaining({
            path: '/test/output.txt',
            content: 'Hello, World!',
            encoding: 'utf-8',
            backup: true,
            atomic: true
          })
        })
      );
    });

    it('ファイル読み取り失敗時に適切なエラーをスローする', async () => {
      const mockError = {
        response: { status: 404 },
        message: 'File not found'
      };

      mockAxiosInstance.request.mockRejectedValueOnce(mockError);

      await expect(cursorAPI.readFile('/non/existent.txt'))
        .rejects.toThrow(CursorAPIError);
    });

    it('ファイル書き込み失敗時に適切なエラーをスローする', async () => {
      const mockError = {
        response: { status: 403 },
        message: 'Permission denied'
      };

      mockAxiosInstance.request.mockRejectedValueOnce(mockError);

      await expect(cursorAPI.writeFile('/readonly/file.txt', 'content'))
        .rejects.toThrow(CursorAPIError);
    });
  });

  describe('コード検索', () => {
    beforeEach(async () => {
      // 認証済み状態にセットアップ
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('コード検索を正常に実行する', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              file: '/src/utils.ts',
              line: 42,
              column: 15,
              match: 'function helper()',
              context: ['  // Utility function', '  function helper() {', '    return true;']
            },
            {
              file: '/tests/utils.test.ts',
              line: 10,
              column: 8,
              match: 'helper()',
              context: ['describe("helper", () => {', '  it("works", () => {', '    expect(helper()).toBe(true);']
            }
          ]
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const results = await cursorAPI.searchCode('function helper', {
        fileTypes: ['ts'],
        maxResults: 50
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.file).toBe('/src/utils.ts');
      expect(results[0]?.line).toBe(42);
      expect(results[0]?.match).toBe('function helper()');
      expect(results[1]?.file).toBe('/tests/utils.test.ts');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/code/search',
          data: expect.objectContaining({
            query: 'function helper',
            scope: expect.objectContaining({
              fileTypes: ['ts'],
              maxResults: 50
            })
          })
        })
      );
    });

    it('空の検索結果を正常に処理する', async () => {
      const mockResponse = {
        data: {
          results: []
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const results = await cursorAPI.searchCode('nonexistent function');

      expect(results).toEqual([]);
    });

    it('検索失敗時に適切なエラーをスローする', async () => {
      const mockError = {
        response: { status: 400 },
        message: 'Invalid search query'
      };

      mockAxiosInstance.request.mockRejectedValueOnce(mockError);

      await expect(cursorAPI.searchCode('invalid[regex'))
        .rejects.toThrow(CursorAPIError);
    });
  });

  describe('プロジェクトコンテキスト', () => {
    beforeEach(async () => {
      // 認証済み状態にセットアップ
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('プロジェクトコンテキストを正常に取得する', async () => {
      const mockResponse = {
        data: {
          rootPath: '/project',
          name: 'test-project',
          type: ProjectType.WEB_APPLICATION,
          technologies: {
            languages: [{ name: 'typescript', version: '5.0.0' }],
            frameworks: [{ name: 'React', version: '18.2.0' }],
            databases: [],
            tools: [],
            platforms: []
          },
          structure: {
            directories: [],
            files: [],
            patterns: []
          },
          dependencies: [],
          configurations: [],
          metadata: {
            version: '1.0.0',
            createdAt: '2023-01-01T00:00:00Z',
            lastModified: '2023-01-02T00:00:00Z'
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const context = await cursorAPI.getProjectContext();

      expect(context.name).toBe('test-project');
      expect(context.type).toBe(ProjectType.WEB_APPLICATION);
      expect(context.rootPath).toBe('/project');
      expect(context.technologies.languages).toHaveLength(1);
      expect(context.technologies.frameworks).toHaveLength(1);
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/project/context'
        })
      );
    });

    it('プロジェクトコンテキスト取得失敗時に適切なエラーをスローする', async () => {
      const mockError = {
        response: { status: 500 },
        message: 'Failed to analyze project'
      };

      mockAxiosInstance.request.mockRejectedValueOnce(mockError);

      await expect(cursorAPI.getProjectContext())
        .rejects.toThrow(CursorAPIError);
    });
  });

  describe('レート制限とリトライ', () => {
    beforeEach(async () => {
      // 認証済み状態にセットアップ
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('レート制限エラー時に適切にリトライする', async () => {
      const rateLimitError = {
        response: { 
          status: 429,
          headers: { 'retry-after': '5' }
        },
        message: 'Too Many Requests',
        config: { url: '/test' }
      };

      // 最初はレート制限エラー、次は成功
      mockAxiosInstance.request
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { success: true } });

      // タイマーをモック
      jest.useFakeTimers();

      const promise = cursorAPI.executeCommand('/sc:test');

      // 5秒後にリトライが実行されるはず
      jest.advanceTimersByTime(5000);

      const result = await promise;
      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('サーバーエラー時に指数バックオフでリトライする', async () => {
      const serverError = {
        response: { status: 500 },
        message: 'Internal Server Error',
        config: { url: '/test', _retryCount: 0 }
      };

      // 3回失敗後に成功
      mockAxiosInstance.request
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce({ ...serverError, config: { ...serverError.config, _retryCount: 1 } })
        .mockRejectedValueOnce({ ...serverError, config: { ...serverError.config, _retryCount: 2 } })
        .mockResolvedValueOnce({ data: { success: true } });

      jest.useFakeTimers();

      const promise = cursorAPI.executeCommand('/sc:test');

      // 指数バックオフの遅延をシミュレート
      jest.advanceTimersByTime(1000); // 1秒
      jest.advanceTimersByTime(2000); // 2秒
      jest.advanceTimersByTime(4000); // 4秒

      const result = await promise;
      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('最大リトライ回数を超えた場合はエラーをスローする', async () => {
      const serverError = {
        response: { status: 500 },
        message: 'Internal Server Error',
        config: { url: '/test', _retryCount: 0 }
      };

      // 4回すべて失敗（初回 + 3回リトライ）
      mockAxiosInstance.request
        .mockRejectedValue(serverError);

      await expect(cursorAPI.executeCommand('/sc:test'))
        .rejects.toThrow(CursorAPIError);
    });
  });

  describe('ヘルスチェックと統計', () => {
    it('ヘルスチェックが正常に動作する', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: 'OK' });

      const health = await cursorAPI.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
      expect(health.authenticated).toBe(false); // 認証前
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('ヘルスチェック失敗時にunhealthyステータスを返す', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Server down'));

      const health = await cursorAPI.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.latency).toBeGreaterThan(0);
    });

    it('統計情報を正常に返す', () => {
      const stats = cursorAPI.getStatistics();

      expect(stats).toHaveProperty('authenticated');
      expect(stats).toHaveProperty('queuedRequests');
      expect(stats).toHaveProperty('requestCounts');
      expect(stats).toHaveProperty('rateLimitStatus');
      expect(stats.rateLimitStatus).toHaveProperty('requests');
      expect(stats.rateLimitStatus).toHaveProperty('limit');
      expect(stats.rateLimitStatus).toHaveProperty('windowMs');
    });
  });

  describe('設定更新', () => {
    it('設定を正常に更新する', () => {
      const mockListener = jest.fn();
      cursorAPI.on('configUpdated', mockListener);

      cursorAPI.updateConfig({
        timeout: 60000,
        baseUrl: 'https://new-api.cursor.test'
      });

      expect(mockListener).toHaveBeenCalled();
      expect(mockAxiosInstance.defaults.timeout).toBe(60000);
      expect(mockAxiosInstance.defaults.baseURL).toBe('https://new-api.cursor.test');
    });
  });

  describe('イベント処理', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      await cursorAPI.authenticate('test-key');
      mockAxiosInstance.get.mockClear();
    });

    it('コマンド実行成功時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      cursorAPI.on('commandExecuted', mockListener);

      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { success: true, output: 'test' }
      });

      await cursorAPI.executeCommand('/sc:test');

      expect(mockListener).toHaveBeenCalled();
    });

    it('コマンド実行失敗時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      cursorAPI.on('commandFailed', mockListener);

      mockAxiosInstance.request.mockRejectedValueOnce(new Error('Failed'));

      try {
        await cursorAPI.executeCommand('/sc:test');
      } catch {
        // エラーは予期される
      }

      expect(mockListener).toHaveBeenCalled();
    });

    it('レート制限超過時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      cursorAPI.on('rateLimitExceeded', mockListener);

      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '10' }
        },
        config: { url: '/test' }
      };

      mockAxiosInstance.request.mockRejectedValueOnce(rateLimitError);

      try {
        await cursorAPI.executeCommand('/sc:test');
      } catch {
        // エラーは予期される
      }

      expect(mockListener).toHaveBeenCalledWith({ retryAfter: 10000 });
    });
  });
});