/**
 * SuperCursor Framework - インメモリPersonaRepository実装
 * 開発・テスト用の簡易実装
 */

import {
  PersonaRepository,
  PersonaRepositoryError,
  PersonaNotFoundError,
  PersonaDuplicateError
} from '../domain/repositories/persona.repository.js';

import {
  PersonaId,
  SessionId,
  UserId,
  Timestamp
} from '../domain/types/base.js';

import {
  AIPersona,
  PersonaFilter,
  PersonaSearchQuery,
  PersonaSearchResult,
  PersonaStatistics,
  PersonaInteraction,
  PersonaFeedback,
  PersonaType
} from '../domain/types/personas.js';

export class InMemoryPersonaRepository extends PersonaRepository {
  private personas = new Map<PersonaId, AIPersona>();
  private interactions = new Map<string, PersonaInteraction>();
  private feedbacks = new Map<string, PersonaFeedback>();
  private archivedPersonas = new Set<PersonaId>();

  async findById(id: PersonaId): Promise<AIPersona | null> {
    return this.personas.get(id) || null;
  }

  async findByIds(ids: readonly PersonaId[]): Promise<readonly AIPersona[]> {
    return ids.map(id => this.personas.get(id)).filter(Boolean) as AIPersona[];
  }

  async findByFilter(filter: PersonaFilter): Promise<readonly AIPersona[]> {
    const allPersonas = Array.from(this.personas.values());
    
    return allPersonas.filter(persona => {
      if (filter.types && !filter.types.includes(persona.type)) return false;
      if (filter.active !== undefined && persona.configuration.active !== filter.active) return false;
      if (filter.minConfidence !== undefined && persona.configuration.confidenceThreshold < filter.minConfidence) return false;
      if (filter.expertiseDomains && !filter.expertiseDomains.some(domain => 
        persona.expertise.some(exp => exp.domain === domain)
      )) return false;
      if (filter.technologies && !filter.technologies.some(tech =>
        persona.expertise.some(exp => exp.technologies.includes(tech))
      )) return false;
      
      return true;
    });
  }

  async search(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]> {
    const filteredPersonas = query.filters 
      ? await this.findByFilter(query.filters)
      : Array.from(this.personas.values());

    const results = filteredPersonas
      .map(persona => {
        const searchText = query.query.toLowerCase();
        let relevanceScore = 0;
        const matchedFields: string[] = [];

        // 名前による一致
        if (persona.name.toLowerCase().includes(searchText)) {
          relevanceScore += 0.5;
          matchedFields.push('name');
        }

        // 説明による一致
        if (persona.description.toLowerCase().includes(searchText)) {
          relevanceScore += 0.3;
          matchedFields.push('description');
        }

        // タイプによる一致
        if (persona.type.toLowerCase().includes(searchText)) {
          relevanceScore += 0.4;
          matchedFields.push('type');
        }

        // 専門領域による一致
        if (persona.expertise.some(exp => exp.domain.toLowerCase().includes(searchText))) {
          relevanceScore += 0.3;
          matchedFields.push('expertise');
        }

        return { persona, relevanceScore, matchedFields };
      })
      .filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return query.limit ? results.slice(0, query.limit) : results;
  }

  async findAllActive(): Promise<readonly AIPersona[]> {
    return Array.from(this.personas.values()).filter(persona => persona.configuration.active);
  }

  async findByTechnology(technology: string): Promise<readonly AIPersona[]> {
    return Array.from(this.personas.values()).filter(persona =>
      persona.expertise.some(exp => exp.technologies.includes(technology))
    );
  }

  async findByExpertiseDomain(domain: string): Promise<readonly AIPersona[]> {
    return Array.from(this.personas.values()).filter(persona =>
      persona.expertise.some(exp => exp.domain === domain)
    );
  }

  async findByType(type: PersonaType): Promise<readonly AIPersona[]> {
    return Array.from(this.personas.values()).filter(persona => persona.type === type);
  }

  async create(personaData: Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIPersona> {
    const id = `persona_${Math.random().toString(36).substr(2, 12)}` as PersonaId;
    const now = Date.now() as Timestamp;
    
    if (this.personas.has(id)) {
      throw new PersonaDuplicateError(id);
    }

    const persona: AIPersona = {
      ...personaData,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.personas.set(id, persona);
    return persona;
  }

  async update(id: PersonaId, updates: Partial<AIPersona>): Promise<AIPersona> {
    const existing = this.personas.get(id);
    if (!existing) {
      throw new PersonaNotFoundError(id);
    }

    const updated: AIPersona = {
      ...existing,
      ...updates,
      id, // IDは変更不可
      updatedAt: Date.now() as Timestamp
    };

    this.personas.set(id, updated);
    return updated;
  }

  async delete(id: PersonaId): Promise<boolean> {
    return this.personas.delete(id);
  }

  async exists(id: PersonaId): Promise<boolean> {
    return this.personas.has(id);
  }

  async count(filter?: PersonaFilter): Promise<number> {
    if (!filter) {
      return this.personas.size;
    }
    
    const filtered = await this.findByFilter(filter);
    return filtered.length;
  }

  async getStatistics(): Promise<PersonaStatistics> {
    const allPersonas = Array.from(this.personas.values());
    const activePersonas = allPersonas.filter(p => p.configuration.active);
    const archivedCount = this.archivedPersonas.size;
    
    const personasByType = (Object.values(PersonaType) as PersonaType[]).reduce((acc, type) => {
      acc[type] = allPersonas.filter(p => p.type === type).length;
      return acc;
    }, {} as Record<PersonaType, number>);

    const allFeedbacks = Array.from(this.feedbacks.values());
    const averageRating = allFeedbacks.length > 0 
      ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length 
      : 0;

    return {
      totalPersonas: this.personas.size,
      activePersonas: activePersonas.length,
      archivedPersonas: archivedCount,
      personasByType,
      averageRating,
      totalUsage: this.interactions.size,
      lastUpdated: Date.now() as Timestamp
    };
  }

  async saveInteraction(interaction: PersonaInteraction): Promise<void> {
    this.interactions.set(interaction.id, interaction);
  }

  async saveFeedback(feedback: PersonaFeedback): Promise<void> {
    this.feedbacks.set(feedback.id, feedback);
  }

  async getSessionHistory(sessionId: SessionId): Promise<readonly PersonaInteraction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getUserHistory(userId: UserId): Promise<readonly PersonaInteraction[]> {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getPopularPersonas(limit = 10): Promise<readonly {
    persona: AIPersona;
    usageCount: number;
    averageRating: number;
  }[]> {
    const usageCounts = new Map<PersonaId, number>();
    const ratings = new Map<PersonaId, number[]>();

    // インタラクション数をカウント
    for (const interaction of this.interactions.values()) {
      const count = usageCounts.get(interaction.personaId) || 0;
      usageCounts.set(interaction.personaId, count + 1);
    }

    // フィードバック評価を集計
    for (const feedback of this.feedbacks.values()) {
      const personaRatings = ratings.get(feedback.personaId) || [];
      personaRatings.push(feedback.rating);
      ratings.set(feedback.personaId, personaRatings);
    }

    const results = Array.from(this.personas.values())
      .map(persona => {
        const usageCount = usageCounts.get(persona.id) || 0;
        const personaRatings = ratings.get(persona.id) || [];
        const averageRating = personaRatings.length > 0
          ? personaRatings.reduce((sum, r) => sum + r, 0) / personaRatings.length
          : 0;

        return { persona, usageCount, averageRating };
      })
      .sort((a, b) => b.usageCount - a.usageCount);

    return results.slice(0, limit);
  }

  async getRecommendedPersonas(userId: UserId, limit = 5): Promise<readonly AIPersona[]> {
    // 簡易実装：アクティブなペルソナを返す
    const activePersonas = await this.findAllActive();
    return activePersonas.slice(0, limit);
  }

  async findSimilar(personaId: PersonaId, limit = 5): Promise<readonly {
    persona: AIPersona;
    similarityScore: number;
  }[]> {
    const targetPersona = await this.findById(personaId);
    if (!targetPersona) {
      throw new PersonaNotFoundError(personaId);
    }

    const allPersonas = Array.from(this.personas.values())
      .filter(p => p.id !== personaId);

    const similarities = allPersonas.map(persona => {
      let score = 0;
      let factors = 0;

      // タイプの一致
      if (persona.type === targetPersona.type) {
        score += 0.4;
      }
      factors++;

      // 専門領域の重複
      const commonDomains = persona.expertise.filter(exp =>
        targetPersona.expertise.some(tExp => tExp.domain === exp.domain)
      ).length;
      
      if (commonDomains > 0) {
        score += (commonDomains / Math.max(persona.expertise.length, targetPersona.expertise.length)) * 0.6;
      }
      factors++;

      const similarityScore = factors > 0 ? score / factors : 0;
      return { persona, similarityScore };
    });

    return similarities
      .filter(s => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  async createMany(personasData: readonly Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<readonly AIPersona[]> {
    const results: AIPersona[] = [];
    
    for (const personaData of personasData) {
      const created = await this.create(personaData);
      results.push(created);
    }
    
    return results;
  }

  async updateMany(updates: readonly {
    id: PersonaId;
    data: Partial<AIPersona>;
  }[]): Promise<readonly AIPersona[]> {
    const results: AIPersona[] = [];
    
    for (const update of updates) {
      const updated = await this.update(update.id, update.data);
      results.push(updated);
    }
    
    return results;
  }

  async deleteMany(filter: PersonaFilter): Promise<number> {
    const toDelete = await this.findByFilter(filter);
    let deletedCount = 0;
    
    for (const persona of toDelete) {
      if (await this.delete(persona.id)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  async findArchived(): Promise<readonly AIPersona[]> {
    const archived: AIPersona[] = [];
    
    for (const personaId of this.archivedPersonas) {
      const persona = this.personas.get(personaId);
      if (persona) {
        archived.push(persona);
      }
    }
    
    return archived;
  }

  async archive(id: PersonaId): Promise<boolean> {
    if (!this.personas.has(id)) {
      return false;
    }
    
    this.archivedPersonas.add(id);
    return true;
  }

  async unarchive(id: PersonaId): Promise<boolean> {
    return this.archivedPersonas.delete(id);
  }

  async transaction<T>(operation: (repo: PersonaRepository) => Promise<T>): Promise<T> {
    // 簡易実装：トランザクションなしで実行
    return await operation(this);
  }
}