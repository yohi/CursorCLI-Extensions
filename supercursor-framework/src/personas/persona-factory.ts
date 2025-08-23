import { BasePersona } from './base-persona.js';
import { PersonaManager, PersonaManagerConfig } from './persona-manager.js';
import { CacheManager, RegistrationInfo } from '../core/interfaces.js';
import { PersonaCapability } from '../types/index.js';

// 特殊ペルソナのインポート
import { BackendArchitectPersona } from './specialized/backend-architect-persona.js';
import { FrontendExpertPersona } from './specialized/frontend-expert-persona.js';
import { DevOpsEngineerPersona } from './specialized/devops-engineer-persona.js';
import { SecuritySpecialistPersona } from './specialized/security-specialist-persona.js';

export interface PersonaFactoryConfig {
  enabledPersonas: string[];
  managerConfig: PersonaManagerConfig;
  autoRegister: boolean;
}

export class PersonaFactory {
  private personas: Map<string, () => BasePersona> = new Map();
  private manager: PersonaManager | null = null;

  constructor(private config: PersonaFactoryConfig, private cache: CacheManager) {
    this.registerBuiltInPersonas();
  }

  private registerBuiltInPersonas(): void {
    // ビルトインペルソナの登録
    this.personas.set('backend-architect', () => new BackendArchitectPersona());
    this.personas.set('frontend-expert', () => new FrontendExpertPersona());
    this.personas.set('devops-engineer', () => new DevOpsEngineerPersona());
    this.personas.set('security-specialist', () => new SecuritySpecialistPersona());
  }

  async createPersonaManager(): Promise<PersonaManager> {
    if (this.manager) {
      return this.manager;
    }

    this.manager = new PersonaManager(this.config.managerConfig, this.cache);

    if (this.config.autoRegister) {
      await this.registerEnabledPersonas();
    }

    return this.manager;
  }

  async registerEnabledPersonas(): Promise<void> {
    if (!this.manager) {
      throw new Error('PersonaManager が初期化されていません');
    }

    for (const personaType of this.config.enabledPersonas) {
      const factory = this.personas.get(personaType);
      if (!factory) {
        console.warn(`未知のペルソナタイプ: ${personaType}`);
        continue;
      }

      try {
        const persona = factory();
        const registrationInfo = this.createRegistrationInfo(personaType, persona);
        
        await this.manager.registerPersona(persona, registrationInfo);
        console.log(`ペルソナ「${persona.name}」を登録しました`);
        
      } catch (error) {
        console.error(`ペルソナ「${personaType}」の登録に失敗しました:`, error);
      }
    }
  }

  createPersona(type: string): BasePersona {
    const factory = this.personas.get(type);
    if (!factory) {
      throw new Error(`未知のペルソナタイプ: ${type}`);
    }
    return factory();
  }

  registerCustomPersona(type: string, factory: () => BasePersona): void {
    this.personas.set(type, factory);
  }

  getAvailablePersonaTypes(): string[] {
    return Array.from(this.personas.keys());
  }

  getPersonaInfo(type: string): PersonaInfo | null {
    const factory = this.personas.get(type);
    if (!factory) {
      return null;
    }

    try {
      const persona = factory();
      return {
        type,
        name: persona.name,
        description: persona.description,
        version: persona.version,
        capabilities: persona.capabilities,
        isLearningEnabled: persona.isLearningEnabled
      };
    } catch (error) {
      console.error(`ペルソナ情報の取得に失敗しました (${type}):`, error);
      return null;
    }
  }

  private createRegistrationInfo(type: string, persona: BasePersona): RegistrationInfo {
    const baseInfo: RegistrationInfo = {
      registeredBy: 'system',
      registrationTime: new Date(),
      tags: [type, 'built-in'],
      metadata: {
        personaType: type,
        version: persona.version,
        capabilities: persona.capabilities
      }
    };

    // ペルソナタイプ別の固有設定
    switch (type) {
      case 'backend-architect':
        return {
          ...baseInfo,
          requiredCapabilities: [
            PersonaCapability.CODE_GENERATION,
            PersonaCapability.ARCHITECTURE_DESIGN,
            PersonaCapability.DATABASE_DESIGN
          ],
          priority: 'high',
          tags: [...baseInfo.tags, 'architecture', 'backend', 'api-design']
        };

      case 'frontend-expert':
        return {
          ...baseInfo,
          requiredCapabilities: [
            PersonaCapability.CODE_GENERATION,
            PersonaCapability.UI_UX_DESIGN,
            PersonaCapability.PERFORMANCE_OPTIMIZATION
          ],
          priority: 'high',
          tags: [...baseInfo.tags, 'frontend', 'ui-ux', 'responsive-design']
        };

      case 'devops-engineer':
        return {
          ...baseInfo,
          requiredCapabilities: [
            PersonaCapability.INFRASTRUCTURE_MANAGEMENT,
            PersonaCapability.CI_CD_PIPELINE,
            PersonaCapability.MONITORING_SETUP
          ],
          priority: 'high',
          tags: [...baseInfo.tags, 'devops', 'infrastructure', 'deployment']
        };

      case 'security-specialist':
        return {
          ...baseInfo,
          requiredCapabilities: [
            PersonaCapability.SECURITY_ANALYSIS,
            PersonaCapability.VULNERABILITY_ASSESSMENT,
            PersonaCapability.THREAT_MODELING
          ],
          priority: 'critical',
          tags: [...baseInfo.tags, 'security', 'compliance', 'threat-analysis']
        };

      default:
        return baseInfo;
    }
  }

  async createDefaultPersonaManager(): Promise<PersonaManager> {
    const defaultConfig: PersonaManagerConfig = {
      maxActivePersonas: 3,
      selectionStrategy: 'hybrid',
      trainingEnabled: true,
      evaluationInterval: 5 * 60 * 1000, // 5分
      persistenceEnabled: true,
      cacheConfig: {
        enabled: true,
        ttl: 30 * 60 * 1000, // 30分
        maxSize: 100
      }
    };

    const factory = new PersonaFactory({
      enabledPersonas: ['backend-architect', 'frontend-expert', 'devops-engineer', 'security-specialist'],
      managerConfig: defaultConfig,
      autoRegister: true
    }, this.cache);

    return await factory.createPersonaManager();
  }

  dispose(): void {
    if (this.manager) {
      this.manager.dispose();
      this.manager = null;
    }
    this.personas.clear();
  }
}

export interface PersonaInfo {
  type: string;
  name: string;
  description: string;
  version: string;
  capabilities: PersonaCapability[];
  isLearningEnabled: boolean;
}

export default PersonaFactory;