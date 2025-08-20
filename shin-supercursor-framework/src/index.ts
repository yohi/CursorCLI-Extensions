/**
 * SuperCursor Framework - ライブラリエクスポート
 * 外部アプリケーションから利用するためのメインエクスポート
 */

// ==========================================
// メインモジュール
// ==========================================
export { SuperCursorModule } from './supercursor.module.js';

// ==========================================
// ドメイン型定義
// ==========================================
export * from './domain/types/index.js';

// ==========================================
// エンティティ
// ==========================================
export { FrameworkEntity } from './domain/entities/framework.entity.js';

// ==========================================
// アプリケーションコマンド・ハンドラー
// ==========================================
export { ExecuteSupercursorCommand } from './application/commands/execute-supercursor.command.js';
export { ExecuteSupercursorHandler } from './application/commands/execute-supercursor.handler.js';

// ==========================================
// 設定インターフェース
// ==========================================
export type {
  FrameworkConfiguration,
  PersonaConfiguration,
  SecurityConfiguration,
  PerformanceConfiguration,
  FrameworkInitOptions,
  SuperCursorModuleOptions
} from './domain/entities/framework.entity.js';

// ==========================================
// 定数・設定
// ==========================================
export {
  FRAMEWORK_CONSTANTS,
  ERROR_CODES,
  EVENT_NAMES
} from './domain/types/index.js';

// ==========================================
// バージョン情報
// ==========================================
export const VERSION = '1.0.0';
export const FRAMEWORK_NAME = 'SuperCursor Framework';

// ==========================================
// ライブラリとしての利用例
// ==========================================

/**
 * SuperCursor Framework をライブラリとして利用する場合の例
 * 
 * ```typescript
 * import { SuperCursorModule, FrameworkEntity } from 'shin-supercursor-framework';
 * import { NestFactory } from '@nestjs/core';
 * 
 * async function main() {
 *   // NestJS アプリケーションとして使用
 *   const app = await NestFactory.create(SuperCursorModule.forRoot({
 *     logLevel: 'info',
 *     enableCaching: true,
 *     enableMetrics: true
 *   }));
 *   
 *   await app.listen(3000);
 * 
 *   // または、直接エンティティとして使用
 *   const framework = new FrameworkEntity({
 *     logLevel: 'info',
 *     enableCaching: true
 *   });
 *   
 *   await framework.initialize();
 *   
 *   const result = await framework.executeCommand(
 *     'analyze src/',
 *     executionContext
 *   );
 * }
 * ```
 */