/**
 * ペルソナレジストリ - ペルソナの登録と管理
 */

import { EventEmitter } from 'events';
import { BasePersona } from './base-persona';
import { PersonaType, PersonaRegistrationError } from '../types';
import { getLogger } from '../core/logger';

export interface PersonaRegistration {
  persona: BasePersona;
  registeredAt: Date;
  isEnabled: boolean;
  activationCount: number;
  lastActivated?: Date;
  averageActivationDuration: number;
}

export class PersonaRegistry extends EventEmitter {
  private personas = new Map<string, PersonaRegistration>();
  private personasByType = new Map<PersonaType, BasePersona[]>();
  private personasByCapability = new Map<string, BasePersona[]>();

  constructor() {
    super();
  }

  /**
   * ペルソナを登録
   */
  public registerPersona(persona: BasePersona): void {
    const logger = getLogger();
    const personaId = persona.getId();
    
    try {
      logger.debug('ペルソナを登録中', { personaId });

      // 重複チェック
      if (this.personas.has(personaId)) {
        throw new PersonaRegistrationError(`ペルソナは既に登録されています: ${personaId}`);
      }

      // 登録情報を作成
      const registration: PersonaRegistration = {
        persona,
        registeredAt: new Date(),
        isEnabled: true,
        activationCount: 0,
        averageActivationDuration: 0,
      };

      // メインレジストリに追加
      this.personas.set(personaId, registration);

      // タイプ別インデックスに追加
      const type = persona.getType();
      if (!this.personasByType.has(type)) {
        this.personasByType.set(type, []);
      }
      this.personasByType.get(type)!.push(persona);

      // 機能別インデックスに追加
      const capabilities = persona.getCapabilities();
      for (const capability of capabilities) {
        const capabilityKey = capability.name;
        if (!this.personasByCapability.has(capabilityKey)) {
          this.personasByCapability.set(capabilityKey, []);
        }
        this.personasByCapability.get(capabilityKey)!.push(persona);
      }

      // ペルソナイベントをリッスン
      this.setupPersonaEventListeners(persona);

      this.emit('personaRegistered', {
        personaId,
        type,
        capabilities,
        timestamp: registration.registeredAt,
      });

      logger.info('ペルソナ登録完了', { 
        personaId, 
        type, 
        capabilitiesCount: capabilities.length 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ登録に失敗', { personaId, error: errorMessage });
      throw error;
    }
  }

  /**
   * ペルソナ登録を解除
   */
  public unregisterPersona(personaId: string): void {
    const logger = getLogger();
    
    try {
      logger.debug('ペルソナ登録を解除中', { personaId });

      const registration = this.personas.get(personaId);
      if (!registration) {
        logger.warn('ペルソナが見つかりません', { personaId });
        return;
      }

      const persona = registration.persona;

      // アクティブな場合は非活性化
      if (persona.isPersonaActive()) {
        persona.deactivate();
      }

      // メインレジストリから削除
      this.personas.delete(personaId);

      // タイプ別インデックスから削除
      const type = persona.getType();
      const typePersonas = this.personasByType.get(type);
      if (typePersonas) {
        const index = typePersonas.indexOf(persona);
        if (index !== -1) {
          typePersonas.splice(index, 1);
        }
        if (typePersonas.length === 0) {
          this.personasByType.delete(type);
        }
      }

      // 機能別インデックスから削除
      const capabilities = persona.getCapabilities();
      for (const capability of capabilities) {
        const capabilityKey = capability.name;
        const capabilityPersonas = this.personasByCapability.get(capabilityKey);
        if (capabilityPersonas) {
          const index = capabilityPersonas.indexOf(persona);
          if (index !== -1) {
            capabilityPersonas.splice(index, 1);
          }
          if (capabilityPersonas.length === 0) {
            this.personasByCapability.delete(capabilityKey);
          }
        }
      }

      // イベントリスナーを削除
      persona.removeAllListeners();

      this.emit('personaUnregistered', {
        personaId,
        type,
        timestamp: new Date(),
      });

      logger.info('ペルソナ登録解除完了', { personaId });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ペルソナ登録解除に失敗', { personaId, error: errorMessage });
      throw error;
    }
  }

  /**
   * ペルソナを取得
   */
  public getPersona(personaId: string): BasePersona | undefined {
    const registration = this.personas.get(personaId);
    return registration?.persona;
  }

  /**
   * すべてのペルソナを取得
   */
  public getAllPersonas(): BasePersona[] {
    return Array.from(this.personas.values()).map(reg => reg.persona);
  }

  /**
   * 有効なペルソナを取得
   */
  public getEnabledPersonas(): BasePersona[] {
    return Array.from(this.personas.values())
      .filter(reg => reg.isEnabled)
      .map(reg => reg.persona);
  }

  /**
   * タイプ別にペルソナを取得
   */
  public getPersonasByType(type: PersonaType): BasePersona[] {
    return this.personasByType.get(type) || [];
  }

  /**
   * 機能別にペルソナを取得
   */
  public getPersonasByCapability(capability: string): BasePersona[] {
    return this.personasByCapability.get(capability) || [];
  }

  /**
   * アクティブなペルソナを取得
   */
  public getActivePersonas(): BasePersona[] {
    return this.getAllPersonas().filter(persona => persona.isPersonaActive());
  }

  /**
   * ペルソナを有効化/無効化
   */
  public setPersonaEnabled(personaId: string, enabled: boolean): void {
    const logger = getLogger();
    const registration = this.personas.get(personaId);
    
    if (!registration) {
      logger.warn('ペルソナが見つかりません', { personaId });
      return;
    }

    if (registration.isEnabled === enabled) {
      logger.debug('ペルソナの状態は既に設定済み', { personaId, enabled });
      return;
    }

    registration.isEnabled = enabled;

    // 無効化の場合、アクティブなら非活性化
    if (!enabled && registration.persona.isPersonaActive()) {
      registration.persona.deactivate();
    }

    this.emit('personaEnabledChanged', {
      personaId,
      enabled,
      timestamp: new Date(),
    });

    logger.info('ペルソナ有効状態を変更', { personaId, enabled });
  }

  /**
   * ペルソナの統計情報を取得
   */
  public getPersonaStatistics(personaId: string): PersonaRegistration | undefined {
    return this.personas.get(personaId);
  }

  /**
   * 全体の統計情報を取得
   */
  public getOverallStatistics(): {
    totalPersonas: number;
    enabledPersonas: number;
    activePersonas: number;
    personasByType: Record<PersonaType, number>;
    totalActivations: number;
    averageActivationDuration: number;
  } {
    const personas = Array.from(this.personas.values());
    const personasByType: Record<PersonaType, number> = {} as Record<PersonaType, number>;
    
    let totalActivations = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const registration of personas) {
      const type = registration.persona.getType();
      personasByType[type] = (personasByType[type] || 0) + 1;
      
      totalActivations += registration.activationCount;
      if (registration.averageActivationDuration > 0) {
        totalDuration += registration.averageActivationDuration * registration.activationCount;
        durationCount += registration.activationCount;
      }
    }

    return {
      totalPersonas: personas.length,
      enabledPersonas: personas.filter(p => p.isEnabled).length,
      activePersonas: personas.filter(p => p.persona.isPersonaActive()).length,
      personasByType,
      totalActivations,
      averageActivationDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * ペルソナの設定情報を更新
   */
  public updatePersonaConfiguration(personaId: string, updates: Partial<{
    priority: number;
    activationScore: number;
  }>): void {
    const logger = getLogger();
    const persona = this.getPersona(personaId);
    
    if (!persona) {
      logger.warn('ペルソナが見つかりません', { personaId });
      return;
    }

    // プライベートプロパティへの直接アクセスはできないため、
    // この実装では設定更新のインターフェースのみ提供
    logger.info('ペルソナ設定更新', { personaId, updates });

    this.emit('personaConfigurationUpdated', {
      personaId,
      updates,
      timestamp: new Date(),
    });
  }

  /**
   * ペルソナイベントリスナーを設定
   */
  private setupPersonaEventListeners(persona: BasePersona): void {
    const personaId = persona.getId();

    persona.on('activated', (event) => {
      const registration = this.personas.get(personaId);
      if (registration) {
        registration.activationCount++;
        registration.lastActivated = new Date();
      }

      this.emit('personaActivated', event);
    });

    persona.on('deactivated', (event) => {
      const registration = this.personas.get(personaId);
      if (registration && event.activeDuration) {
        // 平均持続時間を更新
        const currentAvg = registration.averageActivationDuration;
        const count = registration.activationCount;
        registration.averageActivationDuration = 
          (currentAvg * (count - 1) + event.activeDuration) / count;
      }

      this.emit('personaDeactivated', event);
    });
  }
}