/**
 * SuperCursor Framework - 統合テスト
 * 各モジュールの統合動作を検証
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { SuperCursorModule } from '../../src/supercursor.module.js';
import {
  ExecuteSupercursorCommand
} from '../../src/application/commands/execute-supercursor.command.js';
import {
  createCommandId,
  createSessionId,
  createUserId,
  createTimestamp
} from '../../src/domain/types/index.js';

describe('SuperCursor Integration', () => {
  let app: INestApplication;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        SuperCursorModule.forRoot({
          logLevel: 'error', // テスト時はエラーログのみ
          enableCaching: false, // テスト時はキャッシュ無効
          enableMetrics: false
        })
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // グローバル設定は本番用設定を簡略化
    await app.init();

    commandBus = app.get<CommandBus>(CommandBus);
    queryBus = app.get<QueryBus>(QueryBus);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Command Execution Flow', () => {
    it('should execute analyze command end-to-end', async () => {
      // Given
      const sessionId = createSessionId();
      const command = new ExecuteSupercursorCommand({
        id: createCommandId(),
        sessionId,
        parsedCommand: {
          name: 'analyze',
          arguments: ['src/'],
          options: { deep: false },
          raw: 'analyze src/',
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 1.0
          }
        },
        workingDirectory: process.cwd(),
        user: {
          id: createUserId(),
          name: 'Integration Test User',
          preferences: {
            language: 'ja',
            theme: 'dark',
            outputFormat: 'json',
            verbosity: 'normal',
            autoSave: false,
            confirmActions: false,
            shortcuts: {},
            notifications: {
              email: false,
              desktop: true,
              sound: false,
              types: []
            }
          },
          permissions: [
            {
              resource: 'commands',
              actions: ['read', 'write', 'execute'],
              scope: 'project'
            }
          ],
          profile: {
            experience: 'intermediate',
            skills: [
              {
                name: 'TypeScript',
                level: 'advanced',
                yearsOfExperience: 3,
                certifications: []
              }
            ],
            interests: ['web-development', 'testing'],
            timezone: 'Asia/Tokyo',
            workingHours: {
              start: '09:00',
              end: '17:00',
              timezone: 'Asia/Tokyo',
              days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            }
          },
          activity: {
            lastLogin: new Date(),
            sessionCount: 1,
            totalTime: 0,
            recentProjects: [],
            statistics: {
              commandsExecuted: 0,
              projectsWorked: 0,
              favoritePersonas: [],
              averageSessionTime: 0,
              productivity: {
                linesOfCodeGenerated: 0,
                bugsFixed: 0,
                testsWritten: 0,
                documentsCreated: 0,
                refactoringsPerformed: 0
              }
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // When
      const result = await commandBus.execute(command);

      // Then
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.commandId).toBe(command.id);
    }, 10000); // 10秒タイムアウト

    it('should handle invalid command gracefully', async () => {
      // Given
      const sessionId = createSessionId();
      const command = new ExecuteSupercursorCommand({
        id: createCommandId(),
        sessionId,
        parsedCommand: {
          name: 'invalid_command',
          arguments: [],
          options: {},
          raw: 'invalid_command',
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 0.5
          }
        },
        workingDirectory: process.cwd(),
        user: createTestUser()
      });

      // When
      const result = await commandBus.execute(command);

      // Then
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should execute command with persona selection', async () => {
      // Given
      const sessionId = createSessionId();
      const command = new ExecuteSupercursorCommand({
        id: createCommandId(),
        sessionId,
        parsedCommand: {
          name: 'analyze',
          arguments: ['test/'],
          options: {
            'output-format': 'json',
            deep: true
          },
          raw: 'analyze test/ --output-format json --deep',
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 0.9
          }
        },
        workingDirectory: process.cwd(),
        user: createTestUser()
      });

      // When
      const result = await commandBus.execute(command);

      // Then
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.metadata.persona).toBeDefined();
    });
  });

  describe('Module Integration', () => {
    it('should have all required modules loaded', () => {
      // PersonaModule のサービスが利用可能か確認
      const personaService = app.get('PERSONA_SERVICE', { strict: false });
      expect(personaService).toBeDefined();

      // CommandModule のルーターが利用可能か確認
      const commandRouter = app.get('COMMAND_ROUTER', { strict: false });
      expect(commandRouter).toBeDefined();

      // IntegrationModule のサービスが利用可能か確認
      const integrationServices = app.get('INTEGRATION_SERVICES', { strict: false });
      expect(integrationServices).toBeDefined();
    });

    it('should provide framework configuration', () => {
      const frameworkConfig = app.get('FRAMEWORK_CONFIG', { strict: false });
      expect(frameworkConfig).toBeDefined();
      expect(frameworkConfig.logLevel).toBeDefined();
      expect(frameworkConfig.enableCaching).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle system errors gracefully', async () => {
      // Given - 不正な作業ディレクトリを指定
      const sessionId = createSessionId();
      const command = new ExecuteSupercursorCommand({
        id: createCommandId(),
        sessionId,
        parsedCommand: {
          name: 'analyze',
          arguments: ['/nonexistent/path'],
          options: {},
          raw: 'analyze /nonexistent/path',
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 1.0
          }
        },
        workingDirectory: '/nonexistent/directory',
        user: createTestUser()
      });

      // When
      const result = await commandBus.execute(command);

      // Then - エラーでも適切にレスポンスが返される
      expect(result).toBeDefined();
      expect(result.commandId).toBe(command.id);
      expect(result.performance).toBeDefined();
      expect(result.performance.duration).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should complete commands within reasonable time', async () => {
      const startTime = Date.now();
      
      const sessionId = createSessionId();
      const command = new ExecuteSupercursorCommand({
        id: createCommandId(),
        sessionId,
        parsedCommand: {
          name: 'analyze',
          arguments: ['package.json'],
          options: { 'output-format': 'text' },
          raw: 'analyze package.json --output-format text',
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 1.0
          }
        },
        workingDirectory: process.cwd(),
        user: createTestUser()
      });

      const result = await commandBus.execute(command);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // 5秒以内
      expect(result.metadata.executionTime).toBeLessThan(5000);
    });
  });

  // ヘルパー関数
  function createTestUser() {
    return {
      id: createUserId(),
      name: 'Integration Test User',
      preferences: {
        language: 'ja',
        theme: 'dark',
        outputFormat: 'json' as const,
        verbosity: 'normal' as const,
        autoSave: false,
        confirmActions: false,
        shortcuts: {},
        notifications: {
          email: false,
          desktop: true,
          sound: false,
          types: []
        }
      },
      permissions: [
        {
          resource: 'commands',
          actions: ['read', 'write', 'execute'] as const,
          scope: 'project' as const
        }
      ],
      profile: {
        experience: 'intermediate' as const,
        skills: [],
        interests: [],
        timezone: 'Asia/Tokyo',
        workingHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'Asia/Tokyo',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
        }
      },
      activity: {
        lastLogin: new Date(),
        sessionCount: 1,
        totalTime: 0,
        recentProjects: [],
        statistics: {
          commandsExecuted: 0,
          projectsWorked: 0,
          favoritePersonas: [],
          averageSessionTime: 0,
          productivity: {
            linesOfCodeGenerated: 0,
            bugsFixed: 0,
            testsWritten: 0,
            documentsCreated: 0,
            refactoringsPerformed: 0
          }
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
});