import {
  PersonaCapability,
  PersonaContext,
  PersonaPrompt,
  PersonaResponse,
  OutputFormat,
  ProjectType,
  AdaptationStrategy
} from '../../types/index.js';
import { BasePersona, PersonaConfig } from '../base-persona.js';
import { PromptTemplate } from '../../core/interfaces.js';

export class SecuritySpecialistPersona extends BasePersona {
  constructor() {
    const config: PersonaConfig = {
      name: 'Security Specialist',
      description: 'セキュリティ専門家として、アプリケーションのセキュリティ設計、脆弱性分析、セキュアコーディング、コンプライアンス要件に特化したAIペルソナ。',
      version: '1.0.0',
      capabilities: [
        PersonaCapability.SECURITY_ANALYSIS,
        PersonaCapability.CODE_GENERATION,
        PersonaCapability.VULNERABILITY_ASSESSMENT,
        PersonaCapability.COMPLIANCE_CHECK,
        PersonaCapability.THREAT_MODELING,
        PersonaCapability.DOCUMENTATION,
        PersonaCapability.TESTING_STRATEGY
      ],
      defaultPromptTemplate: {
        id: 'security-specialist-template',
        name: 'Security Specialist Template',
        template: `あなたはサイバーセキュリティ専門家として、以下のリクエストにお答えください：

プロジェクト情報：
- プロジェクト名: {{PROJECT_NAME}}
- プロジェクトタイプ: {{PROJECT_TYPE}}
- 技術スタック: {{TECH_STACK}}
- セキュリティレベル: {{SECURITY_LEVEL}}

ユーザーリクエスト：
{{USER_INPUT}}

以下のセキュリティ観点から専門的な分析とアドバイスを提供してください：
1. 脅威モデリング
2. 脆弱性分析
3. セキュア実装
4. コンプライアンス要件
5. インシデント対応

回答は実装可能で具体的なセキュリティ対策を含めてください。`,
        variables: [
          {
            name: 'PROJECT_NAME',
            description: 'プロジェクト名',
            required: false,
            defaultValue: '不明'
          },
          {
            name: 'PROJECT_TYPE',
            description: 'プロジェクトタイプ',
            required: false,
            defaultValue: 'WEB_APPLICATION'
          },
          {
            name: 'TECH_STACK',
            description: '技術スタック情報',
            required: false,
            defaultValue: '未指定'
          },
          {
            name: 'SECURITY_LEVEL',
            description: 'セキュリティレベル要件',
            required: false,
            defaultValue: 'standard'
          }
        ]
      },
      learningEnabled: true,
      adaptationStrategy: AdaptationStrategy.SECURITY_FOCUSED,
      memoryRetention: {
        shortTerm: 24 * 60 * 60 * 1000, // 24時間
        longTerm: 90 * 24 * 60 * 60 * 1000, // 90日 (セキュリティ情報は長期保持)
        maxEntries: 1500
      },
      responseConstraints: {
        maxLength: 10000, // セキュリティ詳細のため長めに設定
        minConfidence: 0.8, // 高い信頼度を要求
        timeoutMs: 20000
      },
      knowledgeBaseConfig: {
        domains: [
          'web-application-security',
          'network-security',
          'cryptography',
          'compliance-standards',
          'threat-intelligence',
          'incident-response',
          'secure-coding',
          'penetration-testing'
        ],
        sources: [
          'owasp-guidelines',
          'cis-controls',
          'nist-framework',
          'security-advisories',
          'cve-database'
        ],
        updateFrequency: 12 * 60 * 60 * 1000 // 12時間（セキュリティ情報は頻繁に更新）
      }
    };

    super(config);
  }

  protected async generateResponse(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<PersonaResponse> {
    const analysis = await this.analyzeSecurityPrompt(prompt, context);
    const securityResponse = await this.applySecurityExpertise(analysis, context);

    const response: PersonaResponse = {
      id: `security-response-${Date.now()}`,
      content: securityResponse.content,
      confidence: securityResponse.confidence,
      format: OutputFormat.MARKDOWN,
      suggestions: securityResponse.suggestions,
      codeExamples: securityResponse.codeExamples,
      metadata: {
        executionTime: 0,
        tokensUsed: this.estimateTokenUsage(securityResponse.content),
        modelUsed: 'security-specialist-v1',
        cacheHit: false,
        resourcesUsed: {
          memory: 0,
          cpu: 0,
          diskIO: 0,
          networkIO: 0
        }
      },
      timestamp: new Date()
    };

    return response;
  }

  protected async initializeResources(): Promise<void> {
    await this.loadSecurityKnowledgeBase();
    await this.loadThreatIntelligence();
    await this.loadComplianceFrameworks();
  }

  protected async cleanupResources(): Promise<void> {
    // セキュリティ関連リソースのクリーンアップ
  }

  private async analyzeSecurityPrompt(
    prompt: PersonaPrompt,
    context: PersonaContext
  ): Promise<SecurityAnalysis> {
    const content = prompt.content.toLowerCase();

    const threatKeywords = [
      'threat', 'attack', 'vulnerability', 'exploit', 'malware',
      'phishing', 'injection', 'xss', 'csrf', 'rce'
    ];

    const authenticationKeywords = [
      'auth', 'authentication', 'authorization', 'oauth', 'jwt',
      'session', 'token', 'mfa', 'sso', 'saml'
    ];

    const cryptographyKeywords = [
      'encryption', 'decrypt', 'hash', 'crypto', 'certificate',
      'ssl', 'tls', 'pki', 'signature', 'key'
    ];

    const complianceKeywords = [
      'gdpr', 'hipaa', 'sox', 'pci', 'compliance',
      'audit', 'regulation', 'privacy', 'data-protection'
    ];

    const incidentKeywords = [
      'incident', 'breach', 'response', 'forensics', 'recovery',
      'monitoring', 'detection', 'alert', 'siem'
    ];

    return {
      category: this.determineSecurityCategory(content, {
        threat: threatKeywords,
        authentication: authenticationKeywords,
        cryptography: cryptographyKeywords,
        compliance: complianceKeywords,
        incident: incidentKeywords
      }),
      riskLevel: this.assessRiskLevel(prompt, context),
      securityDomains: this.identifySecurityDomains(content),
      urgency: this.assessUrgency(prompt),
      compliance: this.identifyComplianceRequirements(context)
    };
  }

  private determineSecurityCategory(
    content: string,
    keywordSets: Record<string, string[]>
  ): string {
    let maxScore = 0;
    let bestCategory = 'general-security';

    for (const [category, keywords] of Object.entries(keywordSets)) {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (content.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private assessRiskLevel(prompt: PersonaPrompt, context: PersonaContext): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    const content = prompt.content.toLowerCase();

    // 高リスクキーワード
    const highRiskKeywords = [
      'production', 'live', 'customer-data', 'payment', 'personal-info',
      'database', 'admin', 'root', 'privilege', 'backdoor'
    ];

    riskScore += highRiskKeywords.reduce((score, keyword) => 
      content.includes(keyword) ? score + 2 : score, 0);

    // プロジェクトタイプによるリスク評価
    if (context.project?.type === ProjectType.E_COMMERCE) riskScore += 3;
    if (context.project?.type === ProjectType.FINTECH) riskScore += 4;
    if (context.project?.type === ProjectType.HEALTHCARE) riskScore += 3;

    // 技術スタックによるリスク評価
    const webTechnologies = context.project?.technologies?.frameworks?.filter(f => 
      ['express', 'react', 'angular', 'vue'].includes(f.toLowerCase())
    );
    if (webTechnologies && webTechnologies.length > 0) riskScore += 1;

    if (riskScore >= 8) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private identifySecurityDomains(content: string): string[] {
    const domains: string[] = [];
    const domainPatterns = [
      { pattern: /web.*(security|vulnerability)/i, domain: 'web-application-security' },
      { pattern: /api.*(security|auth)/i, domain: 'api-security' },
      { pattern: /(network|firewall|proxy)/i, domain: 'network-security' },
      { pattern: /(database|sql|nosql).*(security|injection)/i, domain: 'database-security' },
      { pattern: /(cloud|aws|azure|gcp).*(security)/i, domain: 'cloud-security' },
      { pattern: /(mobile|ios|android).*(security)/i, domain: 'mobile-security' },
      { pattern: /(iot|embedded).*(security)/i, domain: 'iot-security' }
    ];

    domainPatterns.forEach(({ pattern, domain }) => {
      if (pattern.test(content)) {
        domains.push(domain);
      }
    });

    return domains.length > 0 ? domains : ['general-security'];
  }

  private assessUrgency(prompt: PersonaPrompt): 'low' | 'medium' | 'high' | 'emergency' {
    const content = prompt.content.toLowerCase();
    const urgentKeywords = [
      'urgent', 'asap', 'immediately', 'emergency', 'critical',
      'breach', 'attack', 'compromised', 'hacked'
    ];

    const urgentCount = urgentKeywords.reduce((count, keyword) => 
      content.includes(keyword) ? count + 1 : count, 0);

    if (urgentCount >= 3) return 'emergency';
    if (urgentCount >= 2) return 'high';
    if (urgentCount >= 1) return 'medium';
    return 'low';
  }

  private identifyComplianceRequirements(context: PersonaContext): string[] {
    const requirements: string[] = [];

    // プロジェクトタイプに基づくコンプライアンス要件
    switch (context.project?.type) {
      case ProjectType.FINTECH:
        requirements.push('PCI-DSS', 'SOX', 'PSD2');
        break;
      case ProjectType.HEALTHCARE:
        requirements.push('HIPAA', 'HITECH');
        break;
      case ProjectType.E_COMMERCE:
        requirements.push('PCI-DSS', 'GDPR');
        break;
      default:
        requirements.push('GDPR', 'CCPA');
    }

    return requirements;
  }

  private async applySecurityExpertise(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const { category, riskLevel, urgency } = analysis;

    switch (category) {
      case 'threat':
        return this.generateThreatAnalysis(analysis, context);
      case 'authentication':
        return this.generateAuthenticationGuidance(analysis, context);
      case 'cryptography':
        return this.generateCryptographyAdvice(analysis, context);
      case 'compliance':
        return this.generateComplianceGuidance(analysis, context);
      case 'incident':
        return this.generateIncidentResponse(analysis, context);
      default:
        return this.generateGeneralSecurityAdvice(analysis, context);
    }
  }

  private async generateThreatAnalysis(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = this.buildThreatAnalysisResponse(analysis, context);
    const suggestions = this.generateThreatMitigationSuggestions(analysis);
    const codeExamples = await this.generateThreatMitigationExamples(analysis);

    return {
      content,
      confidence: 0.92,
      suggestions,
      codeExamples
    };
  }

  private buildThreatAnalysisResponse(analysis: SecurityAnalysis, context: PersonaContext): string {
    let response = `# 脅威分析とセキュリティ評価\n\n`;

    response += `## リスク評価\n`;
    response += `- **リスクレベル**: ${this.translateRiskLevel(analysis.riskLevel)}\n`;
    response += `- **緊急度**: ${this.translateUrgency(analysis.urgency)}\n`;
    response += `- **セキュリティドメイン**: ${analysis.securityDomains.join(', ')}\n\n`;

    response += `## 脅威モデリング\n\n`;
    response += this.generateThreatModel(analysis, context);

    response += `\n## 推奨セキュリティ対策\n\n`;
    response += this.generateSecurityMeasures(analysis);

    response += `\n## 実装優先度\n\n`;
    response += this.generatePriorityMatrix(analysis);

    return response;
  }

  private translateRiskLevel(riskLevel: string): string {
    const translations = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'critical': '最重要'
    };
    return translations[riskLevel as keyof typeof translations] || riskLevel;
  }

  private translateUrgency(urgency: string): string {
    const translations = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'emergency': '緊急'
    };
    return translations[urgency as keyof typeof translations] || urgency;
  }

  private generateThreatModel(analysis: SecurityAnalysis, context: PersonaContext): string {
    let model = `### STRIDE脅威分析\n\n`;

    model += `#### なりすまし (Spoofing)\n`;
    model += `- 認証メカニズムの強化が必要\n`;
    model += `- 多要素認証の実装を推奨\n\n`;

    model += `#### 改ざん (Tampering)\n`;
    model += `- データ整合性チェックの実装\n`;
    model += `- デジタル署名の活用\n\n`;

    model += `#### 否認 (Repudiation)\n`;
    model += `- 監査ログの強化\n`;
    model += `- デジタル証拠の保全\n\n`;

    model += `#### 情報漏洩 (Information Disclosure)\n`;
    model += `- 暗号化の実装\n`;
    model += `- アクセス制御の強化\n\n`;

    model += `#### サービス拒否 (Denial of Service)\n`;
    model += `- レート制限の実装\n`;
    model += `- リソース監視の強化\n\n`;

    model += `#### 権限昇格 (Elevation of Privilege)\n`;
    model += `- 最小権限の原則の適用\n`;
    model += `- 権限管理の厳格化\n`;

    return model;
  }

  private generateSecurityMeasures(analysis: SecurityAnalysis): string {
    let measures = `### 技術的対策\n\n`;

    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      measures += `#### 最優先対策\n`;
      measures += `- **Web Application Firewall (WAF)** の導入\n`;
      measures += `- **侵入検知システム (IDS/IPS)** の実装\n`;
      measures += `- **暗号化通信 (HTTPS)** の強制\n`;
      measures += `- **セキュリティヘッダー** の設定\n\n`;
    }

    measures += `#### 基本セキュリティ対策\n`;
    measures += `- 入力値検証とサニタイゼーション\n`;
    measures += `- SQLインジェクション対策\n`;
    measures += `- XSS (Cross-Site Scripting) 対策\n`;
    measures += `- CSRF (Cross-Site Request Forgery) 対策\n`;
    measures += `- セッション管理の強化\n\n`;

    measures += `### 運用的対策\n\n`;
    measures += `- セキュリティ監視とログ分析\n`;
    measures += `- 定期的な脆弱性スキャン\n`;
    measures += `- インシデント対応計画の策定\n`;
    measures += `- セキュリティ意識向上トレーニング\n`;

    return measures;
  }

  private generatePriorityMatrix(analysis: SecurityAnalysis): string {
    let matrix = `| 優先度 | 対策 | 実装期間 | 効果 |\n`;
    matrix += `|--------|------|----------|------|\n`;

    if (analysis.riskLevel === 'critical') {
      matrix += `| 🔴 最高 | HTTPS強制 + WAF導入 | 1週間 | 高 |\n`;
      matrix += `| 🔴 最高 | 認証・認可の強化 | 2週間 | 高 |\n`;
    }

    matrix += `| 🟡 高 | 入力値検証の実装 | 1-2週間 | 中 |\n`;
    matrix += `| 🟡 高 | セキュリティヘッダー設定 | 1日 | 中 |\n`;
    matrix += `| 🟢 中 | ログ監視システム | 1ヶ月 | 中 |\n`;
    matrix += `| 🟢 中 | 定期脆弱性スキャン | 継続的 | 低 |\n`;

    return matrix;
  }

  private generateThreatMitigationSuggestions(analysis: SecurityAnalysis): string[] {
    const suggestions = [
      'セキュリティテストを定期的に実行してください',
      'ペネトレーションテストの実施を検討してください',
      'セキュリティ監査ログを適切に保管してください'
    ];

    if (analysis.riskLevel === 'critical') {
      suggestions.unshift('緊急セキュリティパッチの適用を優先してください');
    }

    if (analysis.urgency === 'emergency') {
      suggestions.unshift('即座にインシデント対応チームに連絡してください');
    }

    return suggestions;
  }

  private async generateThreatMitigationExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    const examples: Array<{ language: string; code: string; description: string }> = [];

    // 基本的なセキュリティヘッダー設定
    examples.push({
      language: 'typescript',
      code: `// Express.js セキュリティヘッダー設定
import helmet from 'helmet';
import express from 'express';

const app = express();

// セキュリティヘッダーの設定
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// HTTPS強制リダイレクト
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(\`https://\${req.header('host')}\${req.url}\`);
  } else {
    next();
  }
});`,
      description: 'セキュリティヘッダーとHTTPS強制の実装'
    });

    // 入力値検証の例
    examples.push({
      language: 'typescript',
      code: `// 入力値検証とサニタイゼーション
import { body, validationResult } from 'express-validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// バリデーションルール
export const userInputValidation = [
  body('email').isEmail().normalizeEmail(),
  body('name').isLength({ min: 2, max: 50 }).escape(),
  body('message').isLength({ max: 1000 }).customSanitizer(value => {
    return purify.sanitize(value);
  })
];

// バリデーション結果チェック
export const checkValidationResult = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};`,
      description: '包括的な入力値検証とXSS対策'
    });

    if (analysis.riskLevel === 'high' || analysis.riskLevel === 'critical') {
      examples.push({
        language: 'typescript',
        code: `// 高度な認証とレート制限
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// レート制限設定
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5回の試行
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// レスポンス遅延（ブルートフォース対策）
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: 500,
  maxDelayMs: 20000
});

// セキュアなパスワード認証
export class SecureAuth {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_EXPIRY = '15m';
  
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }
  
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  static generateToken(payload: object): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.JWT_EXPIRY,
      issuer: 'secure-app',
      audience: 'app-users'
    });
  }
}`,
        description: '高度な認証システムとブルートフォース対策'
      });
    }

    return examples;
  }

  private async generateAuthenticationGuidance(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = `# 認証・認可システムのセキュリティ設計\n\n` +
      `認証システムの強化とセキュアな実装方法をご提案します。\n\n` +
      this.generateAuthenticationAdvice(analysis, context);

    return {
      content,
      confidence: 0.90,
      suggestions: [
        '多要素認証 (MFA) の実装を強く推奨します',
        'パスワードポリシーを厳格に設定してください',
        'セッション管理のセキュリティを強化してください'
      ],
      codeExamples: await this.generateAuthenticationExamples(analysis)
    };
  }

  private generateAuthenticationAdvice(analysis: SecurityAnalysis, context: PersonaContext): string {
    return `## 認証システム設計指針\n\n実装の詳細については、プロジェクトのセキュリティ要件に応じてご提案いたします。`;
  }

  private async generateAuthenticationExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// JWT ベースの認証実装
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthToken {
  userId: string;
  email: string;
  roles: string[];
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded as AuthToken;
    next();
  });
};`,
      description: 'JWTベースの認証ミドルウェア実装'
    }];
  }

  private async generateCryptographyAdvice(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = `# 暗号化実装ガイダンス\n\n` +
      `データ保護のための暗号化実装をご提案します。\n\n` +
      this.generateCryptographyGuidance(analysis, context);

    return {
      content,
      confidence: 0.88,
      suggestions: [
        '暗号化アルゴリズムは最新の標準を使用してください',
        'キー管理システムを適切に実装してください',
        '機密データの暗号化を徹底してください'
      ],
      codeExamples: await this.generateCryptographyExamples(analysis)
    };
  }

  private generateCryptographyGuidance(analysis: SecurityAnalysis, context: PersonaContext): string {
    return `## 暗号化ベストプラクティス\n\n暗号化の実装詳細については、セキュリティ要件に応じてご提案いたします。`;
  }

  private async generateCryptographyExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// AES-256-GCM暗号化の実装
import crypto from 'crypto';

export class SecureEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;

  static encrypt(text: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, key, { iv });
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }, key: Buffer): string {
    const decipher = crypto.createDecipher(this.ALGORITHM, key, { 
      iv: Buffer.from(encryptedData.iv, 'hex')
    });
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}`,
      description: 'AES-256-GCMを使用したセキュアな暗号化実装'
    }];
  }

  private async generateComplianceGuidance(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = `# コンプライアンス要件対応\n\n` +
      `必要なコンプライアンス要件への対応策をご提案します。\n\n` +
      this.generateComplianceAdvice(analysis, context);

    return {
      content,
      confidence: 0.85,
      suggestions: [
        'コンプライアンス監査の準備を始めてください',
        '必要な文書化を完了してください',
        '継続的なコンプライアンス監視を実装してください'
      ],
      codeExamples: await this.generateComplianceExamples(analysis)
    };
  }

  private generateComplianceAdvice(analysis: SecurityAnalysis, context: PersonaContext): string {
    let advice = `## 適用されるコンプライアンス要件\n\n`;
    
    analysis.compliance.forEach(requirement => {
      advice += `### ${requirement}\n`;
      advice += this.getComplianceDetails(requirement) + `\n\n`;
    });

    return advice;
  }

  private getComplianceDetails(requirement: string): string {
    const details = {
      'GDPR': '個人データ保護規則への準拠が必要です。データの匿名化、削除権、データポータビリティの実装が求められます。',
      'HIPAA': '医療情報の保護基準への準拠が必要です。PHIの暗号化と監査ログが必須です。',
      'PCI-DSS': 'カード会員データの保護基準への準拠が必要です。データの暗号化とネットワークセキュリティが重要です。',
      'SOX': '財務報告の内部統制への準拠が必要です。システムの監査証跡とアクセス制御が求められます。'
    };
    return details[requirement as keyof typeof details] || `${requirement}への準拠が必要です。`;
  }

  private async generateComplianceExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// GDPR準拠のデータ管理
export class GDPRCompliantDataManager {
  async anonymizePersonalData(userId: string): Promise<void> {
    // 個人識別情報の匿名化
    await this.database.update('users', userId, {
      email: this.generateAnonymousEmail(),
      name: 'Anonymous User',
      phone: null,
      address: null,
      anonymized: true,
      anonymizedAt: new Date()
    });
  }

  async exportUserData(userId: string): Promise<object> {
    // データポータビリティ対応
    const userData = await this.database.findById('users', userId);
    return {
      personalData: userData,
      activities: await this.database.find('user_activities', { userId }),
      preferences: await this.database.find('user_preferences', { userId }),
      exportedAt: new Date().toISOString()
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    // 忘れられる権利への対応
    await this.database.transaction(async (tx) => {
      await tx.delete('users', userId);
      await tx.delete('user_activities', { userId });
      await tx.delete('user_preferences', { userId });
      
      // 監査ログの記録
      await tx.insert('audit_log', {
        action: 'USER_DATA_DELETION',
        userId,
        timestamp: new Date(),
        reason: 'GDPR_RIGHT_TO_BE_FORGOTTEN'
      });
    });
  }
}`,
      description: 'GDPR準拠のデータ管理システム実装'
    }];
  }

  private async generateIncidentResponse(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = `# インシデント対応計画\n\n` +
      `セキュリティインシデントへの適切な対応手順をご提案します。\n\n` +
      this.generateIncidentResponsePlan(analysis, context);

    return {
      content,
      confidence: 0.87,
      suggestions: [
        'インシデント対応チームを組織してください',
        '緊急連絡網を整備してください',
        '定期的な対応訓練を実施してください'
      ],
      codeExamples: await this.generateIncidentResponseExamples(analysis)
    };
  }

  private generateIncidentResponsePlan(analysis: SecurityAnalysis, context: PersonaContext): string {
    return `## インシデント対応手順\n\nセキュリティインシデント発生時の対応手順については、組織の体制に応じてご提案いたします。`;
  }

  private async generateIncidentResponseExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// セキュリティ監視とアラート
import winston from 'winston';

export class SecurityMonitor {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'security.log' }),
        new winston.transports.Console()
      ]
    });
  }

  logSecurityEvent(event: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source: string;
    details: object;
  }): void {
    this.logger.warn('SECURITY_EVENT', {
      timestamp: new Date().toISOString(),
      ...event
    });

    // 高重要度イベントの場合は即座に通知
    if (event.severity === 'CRITICAL') {
      this.triggerEmergencyAlert(event);
    }
  }

  private async triggerEmergencyAlert(event: object): Promise<void> {
    // 緊急アラートの送信
    console.log('CRITICAL SECURITY EVENT DETECTED:', event);
    // 実装: メール、Slack、SMS等での通知
  }
}`,
      description: 'セキュリティイベント監視とアラート系'
    }];
  }

  private async generateGeneralSecurityAdvice(
    analysis: SecurityAnalysis,
    context: PersonaContext
  ): Promise<SecurityResponse> {
    const content = `# 包括的セキュリティガイダンス\n\n` +
      `システム全体のセキュリティ強化をご提案します。\n\n` +
      this.generateGeneralSecurityGuidance(analysis, context);

    return {
      content,
      confidence: 0.83,
      suggestions: [
        'セキュリティ監査を定期的に実施してください',
        'セキュリティ意識向上研修を実施してください',
        'セキュリティポリシーを策定・更新してください'
      ],
      codeExamples: await this.generateGeneralSecurityExamples(analysis)
    };
  }

  private generateGeneralSecurityGuidance(analysis: SecurityAnalysis, context: PersonaContext): string {
    return `## 総合セキュリティ戦略\n\nシステム全体のセキュリティ強化については、包括的なアプローチをご提案いたします。`;
  }

  private async generateGeneralSecurityExamples(analysis: SecurityAnalysis): Promise<Array<{ language: string; code: string; description: string }>> {
    return [{
      language: 'typescript',
      code: `// セキュリティ設定の中央管理
export class SecurityConfig {
  static readonly CONFIG = {
    // 認証設定
    auth: {
      sessionTimeout: 30 * 60 * 1000, // 30分
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15分
      passwordMinLength: 12,
      requireMFA: true
    },
    
    // 暗号化設定
    encryption: {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      iterations: 100000,
      saltLength: 32
    },
    
    // セッション設定
    session: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict' as const,
      maxAge: 30 * 60 * 1000
    },
    
    // CORS設定
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
      credentials: true,
      optionsSuccessStatus: 200
    }
  };
  
  static validateSecurityHeaders(headers: Record<string, string>): boolean {
    const requiredHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'content-security-policy'
    ];
    
    return requiredHeaders.every(header => 
      header in headers
    );
  }
}`,
      description: 'セキュリティ設定の中央管理システム'
    }];
  }

  private estimateTokenUsage(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private async loadSecurityKnowledgeBase(): Promise<void> {
    // セキュリティナレッジベースの読み込み
  }

  private async loadThreatIntelligence(): Promise<void> {
    // 脅威インテリジェンス情報の読み込み
  }

  private async loadComplianceFrameworks(): Promise<void> {
    // コンプライアンスフレームワーク情報の読み込み
  }
}

// 型定義
interface SecurityAnalysis {
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  securityDomains: string[];
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  compliance: string[];
}

interface SecurityResponse {
  content: string;
  confidence: number;
  suggestions: string[];
  codeExamples: Array<{
    language: string;
    code: string;
    description: string;
  }>;
}

export default SecuritySpecialistPersona;