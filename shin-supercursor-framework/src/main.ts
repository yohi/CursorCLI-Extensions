/**
 * SuperCursor Framework - メインエントリーポイント
 * NestJS アプリケーションのブートストラップ
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

    // ヘルスチェックエンドポイントの設定
    app.getHttpAdapter().get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // メトリクスエンドポイントの設定
    app.getHttpAdapter().get('/metrics', (req, res) => {
      res.status(200).json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // アプリケーション起動
    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`🚀 SuperCursor Framework is running on port ${port}`);
    logger.log(`📖 Health check: http://localhost:${port}/health`);
    logger.log(`📊 Metrics: http://localhost:${port}/metrics`);
    
    if (process.env.NODE_ENV !== 'production') {
      logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    }

    // グレースフルシャットダウンの設定
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start SuperCursor Framework', error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled Promise Rejection:', reason);
  // プロダクション環境では適切なエラー報告システムに送信
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught Exception:', error);
  // プロダクション環境では適切なエラー報告システムに送信
  process.exit(1);
});

// アプリケーション起動
bootstrap().catch(error => {
  const logger = new Logger('Bootstrap Error');
  logger.error('Application failed to start:', error);
  process.exit(1);
});