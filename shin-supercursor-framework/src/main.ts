/**
 * SuperCursor Framework - メインエントリーポイント
 * NestJS アプリケーションのブートストラップ
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { SuperCursorModule } from './supercursor.module.js';

/**
 * SuperCursor Framework アプリケーションの起動
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    // NestJS アプリケーションの作成
    const app = await NestFactory.create(SuperCursorModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // セキュリティヘッダーの設定（Helmet）
    app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
      hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false
    }));

    // シャットダウンフックの有効化
    app.enableShutdownHooks();

    // グローバルパイプの設定
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: false,
        skipNullProperties: false,
        skipUndefinedProperties: false,
        disableErrorMessages: process.env.NODE_ENV === 'production',
      })
    );

    // CORS 設定（必要に応じて）
    app.enableCors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    });

    // Swagger API ドキュメント設定
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('SuperCursor Framework API')
        .setDescription(
          'Unified SuperCursor Framework API - Framework-1 design + Framework-2 implementation with NestJS best practices'
        )
        .setVersion('1.0.0')
        .addTag('supercursor', 'SuperCursor Framework endpoints')
        .addTag('commands', 'Command execution endpoints')
        .addTag('personas', 'AI Persona management endpoints')
        .addTag('sessions', 'Session management endpoints')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
        },
      });

      logger.log('Swagger documentation available at /api/docs');
    }

    // ヘルスチェックエンドポイントの設定（Express/Fastify両対応）
    const http = app.getHttpAdapter();
    http.get('/health', (req, res) => {
      http.reply(res, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      }, 200);
    });

    // メトリクスエンドポイントの設定（本番環境は環境変数で明示有効化）
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_METRICS === 'true') {
      const http = app.getHttpAdapter();
      http.get('/metrics', (req, res) => {
        http.reply(res, {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        }, 200);
      });
    }

    // アプリケーション起動
    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`🚀 SuperCursor Framework is running on port ${port}`);
    logger.log(`📖 Health check: http://localhost:${port}/health`);
    
    // メトリクスエンドポイントが登録されている場合のみログ出力
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_METRICS === 'true') {
      logger.log(`📊 Metrics: http://localhost:${port}/metrics`);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    }

    // グレースフルシャットダウンの設定（重複ハンドラー防止のためprocess.once使用）
    process.once('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.once('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start SuperCursor Framework', error);
    process.exit(1);
  }
}

// グローバルエラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  // エラーオブジェクトでない場合は文字列化してスタックトレースを確保
  const errorInfo = reason instanceof Error 
    ? reason.stack ?? reason.message 
    : JSON.stringify(reason);
  logger.error('Unhandled Promise Rejection:', errorInfo);
  
  // 本番環境では適切なエラー報告システムに送信後終了
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  // 必ずスタックトレースを含めてログ出力
  const errorInfo = error.stack ?? error.message ?? String(error);
  logger.error('Uncaught Exception:', errorInfo);
  
  // 本番環境では適切なエラー報告システムに送信後終了
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// アプリケーション起動
bootstrap().catch(error => {
  const logger = new Logger('Bootstrap Error');
  logger.error('Application failed to start:', error);
  process.exit(1);
});