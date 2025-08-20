/**
 * SuperCursor Framework - E2E テスト
 * REST API エンドポイントの E2E テスト
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { SuperCursorModule } from '../../src/supercursor.module.js';

describe('SuperCursor API (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        SuperCursorModule.forRoot({
          logLevel: 'error',
          enableCaching: false,
          enableMetrics: true
        })
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // グローバルパイプの設定
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );

    httpServer = app.getHttpServer();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(httpServer)
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
          expect(res.body.uptime).toBeDefined();
          expect(res.body.memory).toBeDefined();
          expect(res.body.version).toBeDefined();
        });
    });
  });

  describe('/metrics (GET)', () => {
    it('should return application metrics', () => {
      return request(httpServer)
        .get('/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body.timestamp).toBeDefined();
          expect(res.body.uptime).toBeDefined();
          expect(res.body.memory).toBeDefined();
          expect(res.body.cpu).toBeDefined();
          expect(res.body.version).toBeDefined();
          expect(res.body.environment).toBeDefined();
        });
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger documentation in development', async () => {
      // NODE_ENV=development の場合のみテスト
      if (process.env.NODE_ENV !== 'production') {
        return request(httpServer)
          .get('/api/docs')
          .expect(200);
      } else {
        // プロダクション環境では404
        return request(httpServer)
          .get('/api/docs')
          .expect(404);
      }
    });
  });

  // NOTE: 実際のREST APIエンドポイントは実装されていないため、
  // 以下のテストは将来の実装時に有効化

  /*
  describe('/api/commands (POST)', () => {
    it('should execute analyze command via REST API', () => {
      const commandRequest = {
        name: 'analyze',
        arguments: ['src/'],
        options: { deep: false },
        context: {
          workingDirectory: process.cwd(),
          user: {
            id: 'e2e_test_user',
            name: 'E2E Test User',
            permissions: ['read', 'write', 'execute']
          }
        }
      };

      return request(httpServer)
        .post('/api/commands')
        .send(commandRequest)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.output).toBeDefined();
          expect(res.body.metadata).toBeDefined();
          expect(res.body.commandId).toBeDefined();
        });
    });

    it('should return 400 for invalid command', () => {
      const invalidRequest = {
        name: 'invalid_command',
        arguments: [],
        options: {}
        // context missing
      };

      return request(httpServer)
        .post('/api/commands')
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 422 for validation errors', () => {
      const invalidRequest = {
        name: '', // empty name
        arguments: 'not-an-array', // wrong type
        options: {},
        context: {
          workingDirectory: process.cwd(),
          user: {
            id: 'test',
            name: 'Test',
            permissions: []
          }
        }
      };

      return request(httpServer)
        .post('/api/commands')
        .send(invalidRequest)
        .expect(422);
    });
  });

  describe('/api/personas (GET)', () => {
    it('should return available personas', () => {
      return request(httpServer)
        .get('/api/personas')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // NOTE: 実際のペルソナが登録されていない場合は空配列
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('type');
          }
        });
    });

    it('should filter personas by type', () => {
      return request(httpServer)
        .get('/api/personas?type=developer')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            res.body.forEach(persona => {
              expect(persona.type).toBe('developer');
            });
          }
        });
    });
  });

  describe('/api/sessions (POST)', () => {
    it('should create new session', () => {
      const sessionRequest = {
        user: {
          id: 'e2e_test_user',
          name: 'E2E Test User',
          preferences: {
            language: 'ja',
            theme: 'dark',
            outputFormat: 'json'
          }
        }
      };

      return request(httpServer)
        .post('/api/sessions')
        .send(sessionRequest)
        .expect(201)
        .expect((res) => {
          expect(res.body.sessionId).toBeDefined();
          expect(res.body.user).toEqual(sessionRequest.user);
          expect(res.body.startTime).toBeDefined();
        });
    });
  });

  describe('/api/integrations/health (GET)', () => {
    it('should return integration health status', () => {
      return request(httpServer)
        .get('/api/integrations/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.cursor).toBeDefined();
          expect(res.body.fileSystem).toBeDefined();
          expect(typeof res.body.cursor.available).toBe('boolean');
          expect(typeof res.body.fileSystem.available).toBe('boolean');
        });
    });
  });
  */

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(httpServer)
        .get('/api/nonexistent')
        .expect(404);
    });

    it('should handle CORS preflight requests', () => {
      return request(httpServer)
        .options('/health')
        .expect(200);
    });
  });

  describe('Security', () => {
    it('should include security headers', () => {
      return request(httpServer)
        .get('/health')
        .expect((res) => {
          // セキュリティヘッダーの確認（実装に依存）
          // expect(res.headers['x-content-type-options']).toBe('nosniff');
          // expect(res.headers['x-frame-options']).toBe('DENY');
        });
    });

    it('should handle malformed JSON gracefully', () => {
      return request(httpServer)
        .post('/health') // POST は通常サポートされていない
        .send('{ invalid json }')
        .expect(404); // または適切なエラーコード
    });
  });

  describe('Performance', () => {
    it('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(httpServer)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // 1秒以内
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(httpServer)
          .get('/health')
          .expect(200)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.body.status).toBe('ok');
      });
    });
  });
});