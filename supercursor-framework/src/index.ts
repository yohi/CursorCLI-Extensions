/**
 * SuperCursor Framework - メインエントリーポイント
 */

// メインアプリケーション
export { SuperCursorApp, SuperCursorConfig, SuperCursorOptions } from './supercursor-app';

// 型定義
export * from './types';

// コアコンポーネント
export { ConfigManager } from './core/config-manager';
export { CommandRouter, CommandProcessor } from './core/command-router';
export { CacheManager } from './core/cache-manager';
export { ContextAnalyzer } from './core/context-analyzer';
export { getLogger, initializeLogger } from './core/logger';

// ペルソナ
export { PersonaManager } from './personas/persona-manager';
export { BasePersona, PersonaCapability } from './personas/base-persona';

// 統合
export { CursorAPIIntegration } from './integrations/cursor-api-integration';
export { FileSystemHandlerImpl } from './integrations/file-system-handler';

// コマンドエンジン
export { ImplementationEngine, ImplementationRequest, ImplementationResult } from './commands/implementation-engine';
export { AnalysisEngine, AnalysisRequest, AnalysisResult } from './commands/analysis-engine';
export { BuildEngine, BuildRequest, BuildResult } from './commands/build-engine';
export { DesignEngine, DesignRequest, DesignResult } from './commands/design-engine';

// コマンドプロセッサー
export {
  ImplementCommandProcessor,
  AnalyzeCommandProcessor,
  BuildCommandProcessor,
  DesignCommandProcessor,
  HelpCommandProcessor,
} from './commands/command-processors';

// フレームワークのバージョン
export const VERSION = '1.0.0';

/**
 * フレームワークのクイックセットアップ用ヘルパー関数
 */
export async function createSuperCursorApp(options?: {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  workingDirectory?: string;
  enableCaching?: boolean;
}): Promise<SuperCursorApp> {
  const { SuperCursorApp } = await import('./supercursor-app');
  
  const app = new SuperCursorApp({
    config: {
      logLevel: options?.logLevel || 'info',
      workingDirectory: options?.workingDirectory || process.cwd(),
      enableCaching: options?.enableCaching !== false,
      cacheTimeout: 300000, // 5分
      maxHistorySize: 100,
      enableValidation: true,
      personas: {
        enableAutoSelection: true,
        enableLearning: true,
      },
    },
  });

  await app.initialize();
  
  return app;
}

/**
 * コマンドコンテキストを作成するヘルパー関数
 */
export function createCommandContext(
  command: string,
  args: string[] = [],
  options: Record<string, any> = {},
  workingDir: string = process.cwd()
) {
  const userContext = {
    id: 'default-user',
    name: 'SuperCursor User',
    preferences: {
      outputFormat: 'json',
      verbosity: 'normal',
      autoSave: false,
      confirmActions: false,
    },
    permissions: ['read', 'write', 'execute'],
  };

  const sessionContext = {
    id: `session-${Date.now()}`,
    startTime: new Date(),
    history: [],
    cache: {},
  };

  const projectContext = {
    name: 'Unknown Project',
    type: 'generic' as const,
    path: workingDir,
    structure: {
      root: workingDir,
      files: [],
      directories: [],
    },
    technologies: {
      languages: [],
      frameworks: [],
      tools: [],
    },
    dependencies: {
      production: [],
      development: [],
    },
    configuration: {},
    metadata: {
      createdAt: new Date(),
      lastModified: new Date(),
      version: '1.0.0',
      description: '',
    },
  };

  return {
    command,
    arguments: args,
    options,
    workingDirectory: workingDir,
    user: userContext,
    session: sessionContext,
    project: projectContext,
  };
}

// デフォルトエクスポート
export default SuperCursorApp;