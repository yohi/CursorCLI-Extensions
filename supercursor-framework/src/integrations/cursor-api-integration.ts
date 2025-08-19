import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  CursorAPIIntegration as ICursorAPIIntegration,
  CursorOptions,
  CursorResult,
  FileContent,
  WriteOptions,
  WriteResult,
  SearchScope,
  SearchResult,
  AuthResult
} from '../core/interfaces.js';
import {
  ProjectContext,
  FrameworkError,
  ErrorSeverity,
  Permission,
  UserContext,
  OutputFormat
} from '../types/index.js';

export class CursorAPIError extends FrameworkError {
  code = 'CURSOR_API_ERROR';
  severity = ErrorSeverity.HIGH;
  recoverable = true;

  constructor(message: string, public statusCode?: number, context?: Record<string, any>) {
    super(message, context);
    this.statusCode = statusCode;
  }
}

export interface CursorAPIConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryCount: number;
  retryDelay: number;
  rateLimiting: {
    requests: number;
    timeWindow: number;
    burstLimit: number;
  };
}

interface RequestQueueItem {
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
}

export class CursorAPIIntegration extends EventEmitter implements ICursorAPIIntegration {
  private client: AxiosInstance;
  private authenticated = false;
  private apiKey: string | null = null;
  private requestQueue: RequestQueueItem[] = [];
  private requestCounts: Map<number, number> = new Map();
  private processingQueue = false;

  constructor(private config: CursorAPIConfig) {
    super();
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SuperCursor-Framework/0.1.0'
      }
    });

    this.setupInterceptors();
    this.initializeRateLimiting();
  }

  private setupInterceptors(): void {
    // リクエストインターセプター
    this.client.interceptors.request.use(
      (config) => {
        // API キーの追加
        if (this.apiKey) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        // リクエストログ
        this.emit('requestStarted', {
          method: config.method,
          url: config.url,
          timestamp: new Date()
        });

        return config;
      },
      (error) => {
        this.emit('requestError', { error });
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        this.emit('requestCompleted', {
          status: response.status,
          url: response.config.url,
          duration: this.calculateRequestDuration(response)
        });
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 認証エラーの場合
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          this.authenticated = false;
          this.emit('authenticationRequired');
          throw new CursorAPIError('認証が必要です', 401);
        }

        // レート制限エラーの場合
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryDelay;
          
          this.emit('rateLimitExceeded', { retryAfter: delay });
          
          return this.retryAfterDelay(originalRequest, delay);
        }

        // サーバーエラーの場合のリトライ
        if (error.response?.status >= 500 && originalRequest._retryCount < this.config.retryCount) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          const delay = this.calculateBackoffDelay(originalRequest._retryCount);
          
          return this.retryAfterDelay(originalRequest, delay);
        }

        this.emit('requestFailed', {
          error: error.message,
          status: error.response?.status,
          url: originalRequest?.url
        });

        throw new CursorAPIError(
          `Cursor API リクエストが失敗しました: ${error.message}`,
          error.response?.status,
          {
            url: originalRequest?.url,
            method: originalRequest?.method
          }
        );
      }
    );
  }

  private calculateRequestDuration(response: AxiosResponse): number {
    const start = response.config.metadata?.startTime;
    return start ? Date.now() - start : 0;
  }

  private async retryAfterDelay(config: AxiosRequestConfig, delay: number): Promise<AxiosResponse> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.client.request(config).then(resolve).catch(reject);
      }, delay);
    });
  }

  private calculateBackoffDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
  }

  private initializeRateLimiting(): void {
    // レート制限のリセット処理
    setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.config.rateLimiting.timeWindow;
      
      for (const [timestamp] of this.requestCounts) {
        if (timestamp < windowStart) {
          this.requestCounts.delete(timestamp);
        }
      }
    }, this.config.rateLimiting.timeWindow / 10);

    // キュー処理
    setInterval(() => {
      if (!this.processingQueue && this.requestQueue.length > 0) {
        this.processRequestQueue();
      }
    }, 100);
  }

  private async processRequestQueue(): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        if (!this.canMakeRequest()) {
          break;
        }

        const item = this.requestQueue.shift();
        if (!item) break;

        try {
          const response = await this.client.request(item.config);
          this.recordRequest();
          item.resolve(response);
        } catch (error) {
          if (item.retryCount < this.config.retryCount) {
            item.retryCount++;
            item.timestamp = Date.now() + this.calculateBackoffDelay(item.retryCount);
            this.requestQueue.push(item);
          } else {
            item.reject(error);
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.rateLimiting.timeWindow;
    const recentRequests = Array.from(this.requestCounts.keys())
      .filter(timestamp => timestamp >= windowStart).length;

    return recentRequests < this.config.rateLimiting.requests;
  }

  private recordRequest(): void {
    this.requestCounts.set(Date.now(), 1);
  }

  private async queueRequest<T>(config: AxiosRequestConfig): Promise<T> {
    if (this.canMakeRequest()) {
      this.recordRequest();
      const response = await this.client.request(config);
      return response.data;
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        config,
        resolve: (response) => resolve(response.data),
        reject,
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  async authenticate(apiKey: string): Promise<AuthResult> {
    try {
      this.apiKey = apiKey;
      
      // 認証テストリクエスト
      const response = await this.client.get('/auth/verify');
      
      this.authenticated = true;
      this.emit('authenticated', { success: true });

      return {
        success: true,
        token: apiKey,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間
        permissions: response.data.permissions || []
      };
    } catch (error) {
      this.authenticated = false;
      this.apiKey = null;
      
      const authError = new CursorAPIError(
        `認証に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined
      );

      this.emit('authenticationFailed', { error: authError });
      
      return {
        success: false,
        permissions: []
      };
    }
  }

  async executeCommand(command: string, options: CursorOptions = {}): Promise<CursorResult> {
    if (!this.authenticated) {
      throw new CursorAPIError('認証されていません。先に authenticate() を呼び出してください。');
    }

    const startTime = Date.now();

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'POST',
        url: '/commands/execute',
        data: {
          command,
          options: {
            timeout: options.timeout || this.config.timeout,
            format: options.format || OutputFormat.TEXT,
            verbose: options.verbose || false,
            ...options
          }
        },
        metadata: { startTime }
      };

      const response = await this.queueRequest<any>(requestConfig);

      const result: CursorResult = {
        success: response.success || true,
        output: response.output,
        format: response.format || options.format || OutputFormat.TEXT,
        metadata: {
          executionTime: Date.now() - startTime,
          tokensUsed: response.tokensUsed || 0,
          modelUsed: response.modelUsed || 'unknown',
          cacheHit: response.cacheHit || false
        }
      };

      this.emit('commandExecuted', { command, options, result });
      return result;

    } catch (error) {
      const commandError = new CursorAPIError(
        `コマンド実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined,
        { command, options }
      );

      this.emit('commandFailed', { command, options, error: commandError });
      throw commandError;
    }
  }

  async readFile(path: string): Promise<FileContent> {
    if (!this.authenticated) {
      throw new CursorAPIError('認証されていません。先に authenticate() を呼び出してください。');
    }

    try {
      const response = await this.queueRequest<any>({
        method: 'GET',
        url: '/files/read',
        params: { path }
      });

      return {
        path: response.path,
        content: response.content,
        encoding: response.encoding || 'utf-8',
        size: response.size || response.content.length,
        lastModified: new Date(response.lastModified),
        metadata: {
          permissions: response.permissions || 0o644,
          owner: response.owner || 'unknown',
          group: response.group || 'unknown',
          type: response.type || 'file'
        }
      };
    } catch (error) {
      throw new CursorAPIError(
        `ファイル読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined,
        { path }
      );
    }
  }

  async writeFile(path: string, content: string, options: WriteOptions = {}): Promise<WriteResult> {
    if (!this.authenticated) {
      throw new CursorAPIError('認証されていません。先に authenticate() を呼び出してください。');
    }

    try {
      const response = await this.queueRequest<any>({
        method: 'POST',
        url: '/files/write',
        data: {
          path,
          content,
          encoding: options.encoding || 'utf-8',
          mode: options.mode || 0o644,
          backup: options.backup || false,
          atomic: options.atomic || true
        }
      });

      return {
        success: response.success || true,
        bytesWritten: response.bytesWritten || content.length,
        path: response.path || path,
        backup: response.backup
      };
    } catch (error) {
      throw new CursorAPIError(
        `ファイル書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined,
        { path, contentLength: content.length }
      );
    }
  }

  async searchCode(query: string, scope: SearchScope = {}): Promise<SearchResult[]> {
    if (!this.authenticated) {
      throw new CursorAPIError('認証されていません。先に authenticate() を呼び出してください。');
    }

    try {
      const response = await this.queueRequest<any>({
        method: 'POST',
        url: '/code/search',
        data: {
          query,
          scope: {
            paths: scope.paths || [],
            fileTypes: scope.fileTypes || [],
            excludePaths: scope.excludePaths || [],
            maxResults: scope.maxResults || 100
          }
        }
      });

      return (response.results || []).map((result: any) => ({
        file: result.file,
        line: result.line,
        column: result.column,
        match: result.match,
        context: result.context || []
      }));
    } catch (error) {
      throw new CursorAPIError(
        `コード検索に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined,
        { query, scope }
      );
    }
  }

  async getProjectContext(): Promise<ProjectContext> {
    if (!this.authenticated) {
      throw new CursorAPIError('認証されていません。先に authenticate() を呼び出してください。');
    }

    try {
      const response = await this.queueRequest<any>({
        method: 'GET',
        url: '/project/context'
      });

      // CursorAPIのレスポンスをProjectContextに変換
      return {
        rootPath: response.rootPath,
        name: response.name,
        type: response.type,
        technologies: response.technologies,
        structure: response.structure,
        dependencies: response.dependencies || [],
        configurations: response.configurations || [],
        metadata: response.metadata
      };
    } catch (error) {
      throw new CursorAPIError(
        `プロジェクトコンテキスト取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error && 'response' in error ? (error as any).response?.status : undefined
      );
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<{ status: string; latency: number; authenticated: boolean }> {
    const startTime = Date.now();
    
    try {
      await this.client.get('/health');
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        authenticated: this.authenticated
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        authenticated: this.authenticated
      };
    }
  }

  // 統計情報取得
  getStatistics(): {
    authenticated: boolean;
    queuedRequests: number;
    requestCounts: number;
    rateLimitStatus: {
      requests: number;
      limit: number;
      windowMs: number;
    };
  } {
    const now = Date.now();
    const windowStart = now - this.config.rateLimiting.timeWindow;
    const recentRequests = Array.from(this.requestCounts.keys())
      .filter(timestamp => timestamp >= windowStart).length;

    return {
      authenticated: this.authenticated,
      queuedRequests: this.requestQueue.length,
      requestCounts: this.requestCounts.size,
      rateLimitStatus: {
        requests: recentRequests,
        limit: this.config.rateLimiting.requests,
        windowMs: this.config.rateLimiting.timeWindow
      }
    };
  }

  // 設定更新
  updateConfig(newConfig: Partial<CursorAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // クライアント設定の更新
    if (newConfig.baseUrl) {
      this.client.defaults.baseURL = newConfig.baseUrl;
    }
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
    
    this.emit('configUpdated', { config: this.config });
  }

  // リソースの解放
  dispose(): void {
    this.authenticated = false;
    this.apiKey = null;
    this.requestQueue.length = 0;
    this.requestCounts.clear();
    this.removeAllListeners();
  }
}

export default CursorAPIIntegration;