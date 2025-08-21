/**
 * SuperCursor Framework - コマンド実行DTO
 * NestJS CQRS パターンに基づくコマンド定義
 */

import {
  CommandId,
  SessionId,
  UserId,
  DeepReadonly
} from '../../domain/types/index.js';

import {
  ExecutionContext
} from '../../domain/types/commands.js';

import {
  ParsedCommand
} from '../../domain/types/commands.js';

/**
 * SuperCursorコマンド実行コマンド
 * CQRS パターンに基づく不変のコマンドオブジェクト
 */
export class ExecuteSupercursorCommand {
  public readonly id: CommandId;
  public readonly sessionId: SessionId;
  public readonly parsedCommand: ParsedCommand;
  public readonly executionContext: ExecutionContext;
  public readonly timestamp: number;

  constructor(data: {
    id: CommandId;
    sessionId: SessionId;
    parsedCommand: ParsedCommand;
    workingDirectory: string;
    user: import('../../domain/types/context.js').UserContext;
  }) {
    this.id = data.id;
    this.sessionId = data.sessionId;
    this.parsedCommand = data.parsedCommand;
    this.timestamp = Date.now();
    
    // ExecutionContext を構築
    this.executionContext = {
      sessionId: data.sessionId,
      workingDirectory: data.workingDirectory,
      user: data.user,
      project: this.createMockProjectContext(data.workingDirectory),
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: this.timestamp as import('../../domain/types/base.js').Timestamp,
        variables: process.env as DeepReadonly<Record<string, string | undefined>>
      }
    };
  }

  private createMockProjectContext(workingDirectory: string): import('../../domain/types/context.js').ProjectContext {
    // 最小限のプロジェクトコンテキストを作成
    // 実際の実装では、プロジェクト分析サービスを使用
    return {
      id: 'project_default' as any,
      rootPath: workingDirectory,
      name: 'Unknown Project',
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
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          averageFileSize: 0,
          maxDepth: 0,
          duplicateFiles: 0,
          emptyDirectories: 0
        }
      },
      dependencies: [],
      configurations: [],
      metadata: {
        version: '0.0.0',
        maintainers: [],
        keywords: [],
        quality: {
          codeQuality: {
            linesOfCode: 0,
            testCoverage: 0,
            codeSmells: 0,
            duplicatedLines: 0,
            cyclomaticComplexity: 0,
            maintainabilityIndex: 0
          },
          security: {
            vulnerabilities: 0,
            securityRating: 'A',
            securityDebt: 0
          },
          performance: {
            buildTime: 0,
            testTime: 0,
            bundleSize: 0,
            memoryUsage: 0
          },
          maintainability: {
            technicalDebt: 0,
            reliabilityRating: 'A',
            maintainabilityRating: 'A'
          }
        }
      },
      environment: {
        packageManager: 'npm',
        operatingSystem: process.platform as any,
        architecture: process.arch,
        environmentVariables: process.env as DeepReadonly<Record<string, string>>,
        paths: {
          home: process.env.HOME || process.env.USERPROFILE || '',
          temp: process.env.TMPDIR || process.env.TEMP || '/tmp',
          config: process.env.XDG_CONFIG_HOME || '',
          cache: process.env.XDG_CACHE_HOME || '',
          data: process.env.XDG_DATA_HOME || ''
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}