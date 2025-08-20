/**
 * SuperCursor Framework - AnalyzeCommandHandler ユニットテスト
 * NestJSテストユーティリティを使用したユニットテスト
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';

import { AnalyzeCommandHandler } from '../../../src/application/handlers/analyze-command.handler.js';
import {
  Command,
  CommandResult,
  ParameterType,
  createCommandId,
  createSessionId,
  createUserId,
  createTimestamp
} from '../../../src/domain/types/index.js';

describe('AnalyzeCommandHandler', () => {
  let handler: AnalyzeCommandHandler;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(async () => {
    const mockEventBusProvider = {
      provide: EventBus,
      useValue: {
        publish: jest.fn()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeCommandHandler,
        mockEventBusProvider
      ]
    }).compile();

    handler = module.get<AnalyzeCommandHandler>(AnalyzeCommandHandler);
    mockEventBus = module.get(EventBus);
  });

  describe('プロパティ検証', () => {
    it('should have correct basic properties', () => {
      expect(handler.name).toBe('analyze');
      expect(handler.description).toBe('プロジェクトまたはファイルのコード分析を実行します');
      expect(handler.aliases).toEqual(['analyse', 'scan', 'review']);
      expect(handler.version).toBe('1.0.0');
    });

    it('should have correct parameters', () => {
      expect(handler.parameters).toHaveLength(6);
      
      const targetParam = handler.parameters.find(p => p.name === 'target');
      expect(targetParam).toBeDefined();
      expect(targetParam?.required).toBe(true);
      expect(targetParam?.type).toBe(ParameterType.STRING);
      
      const deepParam = handler.parameters.find(p => p.name === 'deep');
      expect(deepParam).toBeDefined();
      expect(deepParam?.required).toBe(false);
      expect(deepParam?.type).toBe(ParameterType.BOOLEAN);
    });
  });

  describe('canHandle', () => {
    it('should handle analyze command', () => {
      const parsedCommand = {
        name: 'analyze',
        arguments: ['src/'],
        options: {},
        raw: 'analyze src/',
        parseMetadata: {
          parser: 'test',
          version: '1.0.0',
          timestamp: createTimestamp(),
          confidence: 1.0
        }
      };

      expect(handler.canHandle(parsedCommand)).toBe(true);
    });

    it('should handle aliases', () => {
      const aliases = ['analyse', 'scan', 'review'];
      
      aliases.forEach(alias => {
        const parsedCommand = {
          name: alias,
          arguments: [],
          options: {},
          raw: alias,
          parseMetadata: {
            parser: 'test',
            version: '1.0.0',
            timestamp: createTimestamp(),
            confidence: 1.0
          }
        };

        expect(handler.canHandle(parsedCommand)).toBe(true);
      });
    });

    it('should not handle other commands', () => {
      const parsedCommand = {
        name: 'implement',
        arguments: [],
        options: {},
        raw: 'implement',
        parseMetadata: {
          parser: 'test',
          version: '1.0.0',
          timestamp: createTimestamp(),
          confidence: 1.0
        }
      };

      expect(handler.canHandle(parsedCommand)).toBe(false);
    });
  });

  describe('validate', () => {
    const createTestCommand = (overrides: Partial<Command> = {}): Command => ({
      id: createCommandId(),
      sessionId: createSessionId(),
      name: 'analyze',
      arguments: ['src/'],
      options: {},
      raw: 'analyze src/',
      executionContext: {
        sessionId: createSessionId(),
        workingDirectory: '/test/project',
        user: {
          id: createUserId(),
          name: 'Test User',
          preferences: {
            language: 'ja',
            theme: 'dark',
            outputFormat: 'text',
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
          permissions: [],
          profile: {
            experience: 'intermediate',
            skills: [],
            interests: [],
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
        },
        project: {
          id: 'project_test' as any,
          rootPath: '/test/project',
          name: 'Test Project',
          type: 'library',
          technologies: {
            languages: [],
            frameworks: [],
            databases: [],
            tools: [],
            platforms: [],
            cloudServices: []
          },
          structure: {
            directories: [],
            files: [],
            patterns: [],
            metrics: {
              totalFiles: 10,
              totalDirectories: 5,
              totalSize: 1024,
              averageFileSize: 102.4,
              maxDepth: 3,
              duplicateFiles: 0,
              emptyDirectories: 0
            }
          },
          dependencies: [],
          configurations: [],
          metadata: {
            version: '1.0.0',
            maintainers: [],
            keywords: [],
            quality: {
              codeQuality: {
                linesOfCode: 1000,
                testCoverage: 80,
                codeSmells: 5,
                duplicatedLines: 0,
                cyclomaticComplexity: 15,
                maintainabilityIndex: 85
              },
              security: {
                vulnerabilities: 0,
                securityRating: 'A',
                securityDebt: 0
              },
              performance: {
                buildTime: 5000,
                testTime: 2000,
                bundleSize: 1024000,
                memoryUsage: 512000
              },
              maintainability: {
                technicalDebt: 1.5,
                reliabilityRating: 'A',
                maintainabilityRating: 'A'
              }
            }
          },
          environment: {
            packageManager: 'npm',
            operatingSystem: 'linux',
            architecture: 'x64',
            environmentVariables: {},
            paths: {
              home: '/home/test',
              temp: '/tmp',
              config: '/home/test/.config',
              cache: '/home/test/.cache',
              data: '/home/test/.local/share'
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        environment: {
          platform: 'linux',
          nodeVersion: 'v18.0.0',
          timestamp: createTimestamp(),
          variables: {}
        }
      },
      metadata: {
        priority: 'normal',
        timeout: 30000,
        retryable: false,
        maxRetries: 0,
        tags: [],
        dependencies: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    it('should validate valid analyze command', async () => {
      const command = createTestCommand();
      const result = await handler.validate(command);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about performance with deep analysis and include-tests', async () => {
      const command = createTestCommand({
        options: {
          deep: true,
          'include-tests': true
        }
      });

      const result = await handler.validate(command);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PERFORMANCE_WARNING');
    });

    it('should reject invalid output format', async () => {
      const command = createTestCommand({
        options: {
          'output-format': 'invalid'
        }
      });

      const result = await handler.validate(command);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_OUTPUT_FORMAT');
    });
  });

  describe('execute', () => {
    const createTestCommand = (overrides: Partial<Command> = {}): Command => ({
      id: createCommandId(),
      sessionId: createSessionId(),
      name: 'analyze',
      arguments: ['src/'],
      options: {},
      raw: 'analyze src/',
      executionContext: {
        sessionId: createSessionId(),
        workingDirectory: '/test/project',
        user: {
          id: createUserId(),
          name: 'Test User',
          preferences: {
            language: 'ja',
            theme: 'dark',
            outputFormat: 'text',
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
          permissions: [],
          profile: {
            experience: 'intermediate',
            skills: [],
            interests: [],
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
        },
        project: {
          id: 'project_test' as any,
          rootPath: '/test/project',
          name: 'Test Project',
          type: 'library',
          technologies: {
            languages: [],
            frameworks: [],
            databases: [],
            tools: [],
            platforms: [],
            cloudServices: []
          },
          structure: {
            directories: [],
            files: [],
            patterns: [],
            metrics: {
              totalFiles: 10,
              totalDirectories: 5,
              totalSize: 1024,
              averageFileSize: 102.4,
              maxDepth: 3,
              duplicateFiles: 0,
              emptyDirectories: 0
            }
          },
          dependencies: [],
          configurations: [],
          metadata: {
            version: '1.0.0',
            maintainers: [],
            keywords: [],
            quality: {
              codeQuality: {
                linesOfCode: 1000,
                testCoverage: 80,
                codeSmells: 5,
                duplicatedLines: 0,
                cyclomaticComplexity: 15,
                maintainabilityIndex: 85
              },
              security: {
                vulnerabilities: 0,
                securityRating: 'A',
                securityDebt: 0
              },
              performance: {
                buildTime: 5000,
                testTime: 2000,
                bundleSize: 1024000,
                memoryUsage: 512000
              },
              maintainability: {
                technicalDebt: 1.5,
                reliabilityRating: 'A',
                maintainabilityRating: 'A'
              }
            }
          },
          environment: {
            packageManager: 'npm',
            operatingSystem: 'linux',
            architecture: 'x64',
            environmentVariables: {},
            paths: {
              home: '/home/test',
              temp: '/tmp',
              config: '/home/test/.config',
              cache: '/home/test/.cache',
              data: '/home/test/.local/share'
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        environment: {
          platform: 'linux',
          nodeVersion: 'v18.0.0',
          timestamp: createTimestamp(),
          variables: {}
        }
      },
      metadata: {
        priority: 'normal',
        timeout: 30000,
        retryable: false,
        maxRetries: 0,
        tags: [],
        dependencies: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    it('should execute analyze command successfully', async () => {
      const command = createTestCommand();
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.commandId).toBe(command.id);
      expect(result.output.data).toBeDefined();
      expect(result.output.summary).toContain('分析完了');
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.performance.duration).toBeGreaterThan(0);
    });

    it('should handle JSON output format', async () => {
      const command = createTestCommand({
        options: { 'output-format': 'json' }
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(typeof result.output.data).toBe('object');
    });

    it('should handle markdown output format', async () => {
      const command = createTestCommand({
        options: { 'output-format': 'markdown' }
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.format).toBe('text');
      expect(typeof result.output.data).toBe('string');
      expect(result.output.data).toContain('# SuperCursor 分析レポート');
    });

    it('should publish analysis completed event', async () => {
      const command = createTestCommand();
      await handler.execute(command);

      // イベント発行のテストは実装に依存
      // 実際のイベントクラスが定義された後に更新
    });
  });

  describe('getHelpText', () => {
    it('should return comprehensive help text', () => {
      const helpText = handler.getHelpText();

      expect(helpText).toContain('使用法:');
      expect(helpText).toContain('analyze');
      expect(helpText).toContain('説明:');
      expect(helpText).toContain('引数:');
      expect(helpText).toContain('オプション:');
      expect(helpText).toContain('例:');
    });
  });
});