import { PersonaManager, PersonaManagerConfig } from '../../../src/personas/persona-manager.js';
import { BackendArchitectPersona } from '../../../src/personas/specialized/backend-architect-persona.js';
import { FrontendExpertPersona } from '../../../src/personas/specialized/frontend-expert-persona.js';
import { CacheManager, RegistrationInfo, SelectionCriteria } from '../../../src/core/interfaces.js';
import { 
  PersonaCapability, 
  PersonaContext, 
  PersonaPrompt, 
  PersonaState, 
  ProjectType,
  OutputFormat
} from '../../../src/types/index.js';

// モッククラス
class MockCacheManager implements CacheManager {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }
}

describe('PersonaManager', () => {
  let manager: PersonaManager;
  let cache: MockCacheManager;
  let backendPersona: BackendArchitectPersona;
  let frontendPersona: FrontendExpertPersona;

  const defaultConfig: PersonaManagerConfig = {
    maxActivePersonas: 2,
    selectionStrategy: 'hybrid',
    trainingEnabled: true,
    evaluationInterval: 60000, // 1分
    persistenceEnabled: false,
    cacheConfig: {
      enabled: true,
      ttl: 30000, // 30秒
      maxSize: 50
    }
  };

  beforeEach(() => {
    cache = new MockCacheManager();
    manager = new PersonaManager(defaultConfig, cache);
    backendPersona = new BackendArchitectPersona();
    frontendPersona = new FrontendExpertPersona();
  });

  afterEach(async () => {
    if (manager) {
      manager.dispose();
    }
  });

  describe('Persona Registration', () => {
    it('should register a persona successfully', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend', 'architecture'],
        priority: 'high'
      };

      await manager.registerPersona(backendPersona, registrationInfo);

      const registeredPersonas = manager.getRegisteredPersonas();
      expect(registeredPersonas).toHaveLength(1);
      expect(registeredPersonas[0].name).toBe('Backend Architect');
    });

    it('should prevent duplicate persona registration', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);
      
      await expect(
        manager.registerPersona(backendPersona, registrationInfo)
      ).rejects.toThrow('は既に登録されています');
    });

    it('should unregister persona successfully', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);
      expect(manager.getRegisteredPersonas()).toHaveLength(1);

      const result = await manager.unregisterPersona(backendPersona.id);
      expect(result).toBe(true);
      expect(manager.getRegisteredPersonas()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent persona', async () => {
      const result = await manager.unregisterPersona('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Persona Selection', () => {
    beforeEach(async () => {
      const backendInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend'],
        requiredCapabilities: [PersonaCapability.ARCHITECTURE_DESIGN]
      };

      const frontendInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['frontend'],
        requiredCapabilities: [PersonaCapability.UI_UX_DESIGN]
      };

      await manager.registerPersona(backendPersona, backendInfo);
      await manager.registerPersona(frontendPersona, frontendInfo);
    });

    it('should select persona based on capabilities', async () => {
      const criteria: SelectionCriteria = {
        requiredCapabilities: [PersonaCapability.ARCHITECTURE_DESIGN],
        minPerformanceScore: 0.5
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' },
        project: {
          name: 'test-project',
          type: ProjectType.API_SERVICE,
          structure: { files: [], directories: [] },
          technologies: {
            languages: ['typescript'],
            frameworks: ['express'],
            databases: ['postgresql'],
            tools: [],
            platforms: []
          }
        }
      };

      const result = await manager.selectPersona(criteria, context);
      
      expect(result.selectedPersona.name).toBe('Backend Architect');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.alternatives).toBeInstanceOf(Array);
    });

    it('should throw error when no matching persona found', async () => {
      const criteria: SelectionCriteria = {
        requiredCapabilities: [PersonaCapability.BLOCKCHAIN_DEVELOPMENT], // 存在しない機能
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' }
      };

      await expect(
        manager.selectPersona(criteria, context)
      ).rejects.toThrow('選択基準に合致するペルソナがありません');
    });

    it('should use cache for repeated selections', async () => {
      const criteria: SelectionCriteria = {
        requiredCapabilities: [PersonaCapability.ARCHITECTURE_DESIGN],
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' },
        project: {
          name: 'test-project',
          type: ProjectType.API_SERVICE,
          structure: { files: [], directories: [] },
          technologies: {
            languages: ['typescript'],
            frameworks: ['express'],
            databases: ['postgresql'],
            tools: [],
            platforms: []
          }
        }
      };

      const result1 = await manager.selectPersona(criteria, context);
      const result2 = await manager.selectPersona(criteria, context);

      expect(result1.selectedPersona.id).toBe(result2.selectedPersona.id);
      expect(result1.selectionTime.getTime()).toBe(result2.selectionTime.getTime());
    });
  });

  describe('Persona Activation and Execution', () => {
    beforeEach(async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);
    });

    it('should activate persona successfully', async () => {
      expect(manager.getActivePersonas()).toHaveLength(0);
      
      await manager.activatePersona(backendPersona.id);
      
      const activePersonas = manager.getActivePersonas();
      expect(activePersonas).toHaveLength(1);
      expect(activePersonas[0].id).toBe(backendPersona.id);
    });

    it('should deactivate persona successfully', async () => {
      await manager.activatePersona(backendPersona.id);
      expect(manager.getActivePersonas()).toHaveLength(1);
      
      await manager.deactivatePersona(backendPersona.id);
      
      expect(manager.getActivePersonas()).toHaveLength(0);
    });

    it('should execute prompt with persona', async () => {
      const prompt: PersonaPrompt = {
        id: 'test-prompt',
        content: 'API設計のベストプラクティスを教えてください',
        type: 'user-query',
        context: {},
        timestamp: new Date()
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' },
        project: {
          name: 'test-api',
          type: ProjectType.API_SERVICE,
          structure: { files: [], directories: [] },
          technologies: {
            languages: ['typescript'],
            frameworks: ['express'],
            databases: ['postgresql'],
            tools: [],
            platforms: []
          }
        }
      };

      const response = await manager.executeWithPersona(backendPersona.id, prompt, context);

      expect(response.id).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.format).toBe(OutputFormat.MARKDOWN);
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should enforce max active personas limit', async () => {
      const testManager = new PersonaManager(
        { ...defaultConfig, maxActivePersonas: 1 },
        cache
      );

      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['test']
      };

      await testManager.registerPersona(backendPersona, registrationInfo);
      await testManager.registerPersona(frontendPersona, registrationInfo);

      // 最初のペルソナをアクティブ化
      await testManager.activatePersona(backendPersona.id);
      expect(testManager.getActivePersonas()).toHaveLength(1);

      // 2番目のペルソナをアクティブ化（制限により最初のペルソナは非アクティブになる）
      await testManager.activatePersona(frontendPersona.id);
      expect(testManager.getActivePersonas()).toHaveLength(1);
      expect(testManager.getActivePersonas()[0].id).toBe(frontendPersona.id);

      testManager.dispose();
    });
  });

  describe('Persona Evaluation', () => {
    beforeEach(async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);
    });

    it('should evaluate persona performance', async () => {
      const evaluation = await manager.evaluatePersona(backendPersona.id);

      expect(evaluation.personaId).toBe(backendPersona.id);
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.overallScore).toBeLessThanOrEqual(1);
      expect(evaluation.metrics).toHaveProperty('performance');
      expect(evaluation.metrics).toHaveProperty('reliability');
      expect(evaluation.metrics).toHaveProperty('adaptability');
      expect(evaluation.strengths).toBeInstanceOf(Array);
      expect(evaluation.weaknesses).toBeInstanceOf(Array);
      expect(evaluation.recommendations).toBeInstanceOf(Array);
      expect(evaluation.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should get persona metrics', async () => {
      const metrics = manager.getPersonaMetrics(backendPersona.id);
      
      expect(metrics).toBeDefined();
      expect(metrics?.totalInteractions).toBeDefined();
      expect(metrics?.successfulResponses).toBeDefined();
      expect(metrics?.averageResponseTime).toBeDefined();
      expect(metrics?.averageConfidence).toBeDefined();
      expect(metrics?.timestamp).toBeInstanceOf(Date);
    });

    it('should return all metrics', async () => {
      const allMetrics = manager.getAllMetrics();
      
      expect(allMetrics).toBeDefined();
      expect(Object.keys(allMetrics)).toContain(backendPersona.id);
      expect(allMetrics[backendPersona.id]).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    it('should emit persona registration events', async (done) => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      manager.on('personaRegistered', (event) => {
        expect(event.persona.id).toBe(backendPersona.id);
        expect(event.info).toBe(registrationInfo);
        done();
      });

      await manager.registerPersona(backendPersona, registrationInfo);
    });

    it('should emit persona selection events', async (done) => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);

      manager.on('personaSelected', (event) => {
        expect(event.selectedPersona.id).toBe(backendPersona.id);
        done();
      });

      const criteria: SelectionCriteria = {
        requiredCapabilities: [PersonaCapability.ARCHITECTURE_DESIGN]
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' }
      };

      await manager.selectPersona(criteria, context);
    });

    it('should emit activation and deactivation events', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);

      let activationEmitted = false;
      let deactivationEmitted = false;

      manager.on('personaActivated', (event) => {
        expect(event.personaId).toBe(backendPersona.id);
        activationEmitted = true;
      });

      manager.on('personaDeactivated', (event) => {
        expect(event.personaId).toBe(backendPersona.id);
        deactivationEmitted = true;
      });

      await manager.activatePersona(backendPersona.id);
      await manager.deactivatePersona(backendPersona.id);

      expect(activationEmitted).toBe(true);
      expect(deactivationEmitted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors when registering invalid persona', async () => {
      const invalidPersona = {} as any;
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['invalid']
      };

      await expect(
        manager.registerPersona(invalidPersona, registrationInfo)
      ).rejects.toThrow();
    });

    it('should handle activation of non-existent persona', async () => {
      await expect(
        manager.activatePersona('non-existent')
      ).rejects.toThrow('が見つかりません');
    });

    it('should handle execution with non-existent persona', async () => {
      const prompt: PersonaPrompt = {
        id: 'test-prompt',
        content: 'test',
        type: 'user-query',
        context: {},
        timestamp: new Date()
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' }
      };

      await expect(
        manager.executeWithPersona('non-existent', prompt, context)
      ).rejects.toThrow('が見つかりません');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should cleanup selection cache', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);

      const criteria: SelectionCriteria = {
        requiredCapabilities: [PersonaCapability.ARCHITECTURE_DESIGN]
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' }
      };

      // キャッシュが有効であることを確認
      const result1 = await manager.selectPersona(criteria, context);
      const result2 = await manager.selectPersona(criteria, context);
      
      expect(result1.selectionTime).toEqual(result2.selectionTime);

      // 時間を進めてキャッシュを無効化
      const originalTtl = defaultConfig.cacheConfig.ttl;
      defaultConfig.cacheConfig.ttl = 1; // 1ms

      await new Promise(resolve => setTimeout(resolve, 10));

      const result3 = await manager.selectPersona(criteria, context);
      expect(result3.selectionTime).not.toEqual(result1.selectionTime);

      // 設定を復元
      defaultConfig.cacheConfig.ttl = originalTtl;
    });

    it('should handle high load scenarios', async () => {
      const registrationInfo: RegistrationInfo = {
        registeredBy: 'test',
        registrationTime: new Date(),
        tags: ['backend']
      };

      await manager.registerPersona(backendPersona, registrationInfo);

      const prompt: PersonaPrompt = {
        id: 'load-test-prompt',
        content: 'API設計について教えてください',
        type: 'user-query',
        context: {},
        timestamp: new Date()
      };

      const context: PersonaContext = {
        user: { id: 'test-user', name: 'Test User' }
      };

      // 同時に複数のリクエストを実行
      const promises = Array.from({ length: 10 }, (_, i) => 
        manager.executeWithPersona(backendPersona.id, 
          { ...prompt, id: `load-test-prompt-${i}` }, 
          context
        )
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.content).toBeTruthy();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });
});