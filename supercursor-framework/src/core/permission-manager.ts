import { resolve, normalize, relative, join } from 'path';
import { access, constants, stat } from 'fs/promises';
import { minimatch } from 'minimatch';
import { EventEmitter } from 'events';
import {
  UserContext,
  Permission,
  PermissionAction,
  PermissionScope,
  FrameworkError,
  ErrorSeverity
} from '../types/index.js';
import {
  PermissionCheck,
  FilePermissions,
  SecurityConfiguration
} from './interfaces.js';

export class PermissionError extends FrameworkError {
  code = 'PERMISSION_ERROR';
  severity = ErrorSeverity.HIGH;
  recoverable = false;
}

export interface PermissionRule {
  id: string;
  name: string;
  description: string;
  scope: PermissionScope;
  actions: PermissionAction[];
  patterns: string[];
  priority: number;
  enabled: boolean;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: ConditionType;
  value: any;
  operator: ConditionOperator;
}

export enum ConditionType {
  TIME = 'time',
  FILE_SIZE = 'file_size',
  FILE_EXTENSION = 'file_extension',
  USER_ROLE = 'user_role',
  PROJECT_TYPE = 'project_type',
  COMMAND_TYPE = 'command_type'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  MATCHES = 'matches',
  NOT_MATCHES = 'not_matches'
}

export interface PermissionAuditLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  resource: string;
  scope: PermissionScope;
  result: 'granted' | 'denied';
  reason: string;
  ruleId?: string;
  metadata?: Record<string, any>;
}

export class PermissionManager extends EventEmitter {
  private static instance: PermissionManager;
  private rules: Map<string, PermissionRule> = new Map();
  private auditLogs: PermissionAuditLog[] = [];
  private securityConfig: SecurityConfiguration;

  private constructor(securityConfig: SecurityConfiguration) {
    super();
    this.securityConfig = securityConfig;
    this.initializeDefaultRules();
  }

  static getInstance(securityConfig: SecurityConfiguration): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager(securityConfig);
    }
    return PermissionManager.instance;
  }

  private initializeDefaultRules(): void {
    // ファイルアクセス用のデフォルトルール
    this.addRule({
      id: 'default-file-read',
      name: 'デフォルトファイル読み取り',
      description: '許可されたパスでのファイル読み取りを許可',
      scope: PermissionScope.FILE,
      actions: [PermissionAction.READ],
      patterns: this.securityConfig.permissions.fileAccess.allowedPaths,
      priority: 100,
      enabled: true
    });

    this.addRule({
      id: 'default-file-write',
      name: 'デフォルトファイル書き込み',
      description: '許可されたパスでのファイル書き込みを許可',
      scope: PermissionScope.FILE,
      actions: [PermissionAction.WRITE],
      patterns: this.securityConfig.permissions.fileAccess.allowedPaths,
      priority: 100,
      enabled: !this.securityConfig.permissions.fileAccess.readOnly
    });

    this.addRule({
      id: 'deny-sensitive-paths',
      name: 'センシティブパス拒否',
      description: 'センシティブなパスへのアクセスを拒否',
      scope: PermissionScope.FILE,
      actions: [PermissionAction.READ, PermissionAction.WRITE, PermissionAction.DELETE],
      patterns: this.securityConfig.permissions.fileAccess.deniedPaths,
      priority: 200,
      enabled: true
    });

    // システムアクセス用のデフォルトルール
    this.addRule({
      id: 'allow-safe-commands',
      name: '安全なコマンド許可',
      description: '安全なシステムコマンドを許可',
      scope: PermissionScope.SYSTEM,
      actions: [PermissionAction.EXECUTE],
      patterns: this.securityConfig.permissions.systemAccess.allowedCommands,
      priority: 100,
      enabled: true
    });

    this.addRule({
      id: 'deny-dangerous-commands',
      name: '危険なコマンド拒否',
      description: '危険なシステムコマンドを拒否',
      scope: PermissionScope.SYSTEM,
      actions: [PermissionAction.EXECUTE],
      patterns: this.securityConfig.permissions.systemAccess.deniedCommands,
      priority: 200,
      enabled: true
    });
  }

  async checkPermission(
    user: UserContext,
    action: PermissionAction,
    resource: string,
    scope: PermissionScope,
    metadata?: Record<string, any>
  ): Promise<PermissionCheck> {
    const normalizedResource = this.normalizeResource(resource, scope);
    
    try {
      // ユーザーの直接権限をチェック
      const directPermission = this.checkDirectPermission(user, action, normalizedResource, scope);
      if (directPermission.allowed) {
        await this.logPermissionCheck(user, action, normalizedResource, scope, 'granted', 'Direct permission', undefined, metadata);
        return directPermission;
      }

      // ルールベースの権限チェック
      const ruleBasedPermission = await this.checkRuleBasedPermission(user, action, normalizedResource, scope, metadata);
      
      await this.logPermissionCheck(
        user, 
        action, 
        normalizedResource, 
        scope, 
        ruleBasedPermission.allowed ? 'granted' : 'denied',
        ruleBasedPermission.reason,
        undefined,
        metadata
      );

      return ruleBasedPermission;

    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.logPermissionCheck(user, action, normalizedResource, scope, 'denied', reason, undefined, metadata);
      
      return {
        allowed: false,
        permissions: [],
        reason: `権限チェック中にエラーが発生: ${reason}`
      };
    }
  }

  private normalizeResource(resource: string, scope: PermissionScope): string {
    switch (scope) {
      case PermissionScope.FILE:
      case PermissionScope.DIRECTORY:
        return normalize(resolve(resource));
      case PermissionScope.SYSTEM:
        return resource.toLowerCase().trim();
      default:
        return resource;
    }
  }

  private checkDirectPermission(
    user: UserContext,
    action: PermissionAction,
    resource: string,
    scope: PermissionScope
  ): PermissionCheck {
    const matchingPermissions = user.permissions.filter(permission => {
      return permission.actions.includes(action) &&
             (permission.scope === scope || permission.scope === undefined) &&
             this.resourceMatches(resource, permission.resource, scope);
    });

    return {
      allowed: matchingPermissions.length > 0,
      permissions: matchingPermissions,
      reason: matchingPermissions.length > 0 
        ? 'ユーザーに直接権限が付与されています'
        : '該当する直接権限が見つかりません'
    };
  }

  private async checkRuleBasedPermission(
    user: UserContext,
    action: PermissionAction,
    resource: string,
    scope: PermissionScope,
    metadata?: Record<string, any>
  ): Promise<PermissionCheck> {
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => 
        rule.enabled &&
        rule.scope === scope &&
        rule.actions.includes(action)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      const ruleApplies = await this.doesRuleApply(rule, resource, user, metadata);
      
      if (ruleApplies) {
        // 拒否ルール（高優先度）が適用された場合
        if (this.isDenyRule(rule)) {
          return {
            allowed: false,
            permissions: [],
            reason: `拒否ルール "${rule.name}" により拒否されました`
          };
        }
        
        // 許可ルールが適用された場合
        return {
          allowed: true,
          permissions: [{
            resource: rule.patterns.join(', '),
            actions: rule.actions,
            scope: rule.scope
          }],
          reason: `許可ルール "${rule.name}" により許可されました`
        };
      }
    }

    // デフォルト動作（strict mode の場合は拒否）
    return {
      allowed: !this.securityConfig.permissions.strictMode,
      permissions: [],
      reason: this.securityConfig.permissions.strictMode 
        ? 'Strict modeにより、明示的な許可がない場合は拒否されます'
        : 'デフォルトで許可されています'
    };
  }

  private async doesRuleApply(
    rule: PermissionRule,
    resource: string,
    user: UserContext,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    // パターンマッチング
    const patternMatches = rule.patterns.some(pattern => 
      this.resourceMatches(resource, pattern, rule.scope)
    );
    
    if (!patternMatches) {
      return false;
    }

    // 条件チェック
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        const conditionMet = await this.checkCondition(condition, resource, user, metadata);
        if (!conditionMet) {
          return false;
        }
      }
    }

    return true;
  }

  private resourceMatches(resource: string, pattern: string, scope: PermissionScope): boolean {
    switch (scope) {
      case PermissionScope.FILE:
      case PermissionScope.DIRECTORY:
        return minimatch(resource, pattern, { dot: true });
      case PermissionScope.SYSTEM:
        return minimatch(resource.toLowerCase(), pattern.toLowerCase());
      default:
        return resource === pattern;
    }
  }

  private async checkCondition(
    condition: PermissionCondition,
    resource: string,
    user: UserContext,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    let actualValue: any;

    switch (condition.type) {
      case ConditionType.TIME:
        actualValue = new Date().getHours();
        break;

      case ConditionType.FILE_SIZE:
        try {
          const stats = await stat(resource);
          actualValue = stats.size;
        } catch {
          return false;
        }
        break;

      case ConditionType.FILE_EXTENSION:
        actualValue = resource.split('.').pop()?.toLowerCase() || '';
        break;

      case ConditionType.USER_ROLE:
        actualValue = metadata?.userRole || 'user';
        break;

      case ConditionType.PROJECT_TYPE:
        actualValue = metadata?.projectType || 'unknown';
        break;

      case ConditionType.COMMAND_TYPE:
        actualValue = metadata?.commandType || 'unknown';
        break;

      default:
        return false;
    }

    return this.evaluateCondition(actualValue, condition.operator, condition.value);
  }

  private evaluateCondition(actual: any, operator: ConditionOperator, expected: any): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return actual === expected;
      case ConditionOperator.NOT_EQUALS:
        return actual !== expected;
      case ConditionOperator.CONTAINS:
        return String(actual).includes(String(expected));
      case ConditionOperator.NOT_CONTAINS:
        return !String(actual).includes(String(expected));
      case ConditionOperator.GREATER_THAN:
        return Number(actual) > Number(expected);
      case ConditionOperator.LESS_THAN:
        return Number(actual) < Number(expected);
      case ConditionOperator.MATCHES:
        return minimatch(String(actual), String(expected));
      case ConditionOperator.NOT_MATCHES:
        return !minimatch(String(actual), String(expected));
      default:
        return false;
    }
  }

  private isDenyRule(rule: PermissionRule): boolean {
    return rule.id.includes('deny') || rule.name.includes('拒否') || rule.priority >= 200;
  }

  async checkFilePermission(filePath: string, user: UserContext): Promise<PermissionCheck> {
    const resolvedPath = resolve(filePath);
    
    try {
      await access(resolvedPath, constants.F_OK);
    } catch {
      return {
        allowed: false,
        permissions: [],
        reason: 'ファイルが存在しません'
      };
    }

    return this.checkPermission(user, PermissionAction.READ, resolvedPath, PermissionScope.FILE);
  }

  async getFilePermissions(filePath: string): Promise<FilePermissions> {
    try {
      const stats = await stat(filePath);
      const mode = stats.mode;

      return {
        read: !!(mode & constants.S_IRUSR),
        write: !!(mode & constants.S_IWUSR),
        execute: !!(mode & constants.S_IXUSR),
        owner: process.getuid?.()?.toString() || 'unknown',
        group: process.getgid?.()?.toString() || 'unknown',
        mode: mode
      };
    } catch (error) {
      throw new PermissionError(
        `ファイル権限の取得に失敗: ${error instanceof Error ? error.message : String(error)}`,
        { filePath }
      );
    }
  }

  addRule(rule: PermissionRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.emit('ruleRemoved', ruleId);
    }
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<PermissionRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.emit('ruleUpdated', updatedRule);
    return true;
  }

  getRules(): PermissionRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): PermissionRule | undefined {
    return this.rules.get(ruleId);
  }

  private async logPermissionCheck(
    user: UserContext,
    action: string,
    resource: string,
    scope: PermissionScope,
    result: 'granted' | 'denied',
    reason: string,
    ruleId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.securityConfig.audit.enabled) {
      return;
    }

    const logEntry: PermissionAuditLog = {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      user: user.id,
      action,
      resource,
      scope,
      result,
      reason,
      ruleId,
      metadata
    };

    this.auditLogs.push(logEntry);

    // ログサイズの制限（最新の1000件を保持）
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    this.emit('permissionChecked', logEntry);
  }

  getAuditLogs(limit?: number): PermissionAuditLog[] {
    const logs = this.auditLogs.slice().reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
    this.emit('auditLogsCleared');
  }

  updateSecurityConfig(config: SecurityConfiguration): void {
    this.securityConfig = config;
    this.rules.clear();
    this.initializeDefaultRules();
    this.emit('securityConfigUpdated', config);
  }

  dispose(): void {
    this.rules.clear();
    this.auditLogs = [];
    this.removeAllListeners();
  }
}

export default PermissionManager;