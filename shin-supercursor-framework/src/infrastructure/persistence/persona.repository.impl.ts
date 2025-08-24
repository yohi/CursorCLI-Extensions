/**
 * SuperCursor Framework - ペルソナリポジトリ実装
 * TypeORM を使用したペルソナデータ永続化
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, In , Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import {
  PersonaRepository,
  PersonaRepositoryError,
  PersonaNotFoundError,
  PersonaDuplicateError,
  PersonaSortField,
  SortOrder
} from '../../domain/repositories/persona.repository.js';
import {
  PersonaId,
  SessionId,
  UserId,
  createPersonaId
} from '../../domain/types/index.js';
import {
  AIPersona,
  PersonaType,
  PersonaFilter,
  PersonaSearchQuery,
  PersonaSearchResult,
  PersonaInteraction,
  PersonaFeedback
} from '../../domain/types/personas.js';


/**
 * ペルソナエンティティ（TypeORM）
 */

@Entity('personas')
@Index(['type', 'active'])
@Index(['createdAt'])
export class PersonaEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  displayName: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: PersonaType
  })
  type: PersonaType;

  @Column()
  version: string;

  @Column('json')
  expertise: unknown[];

  @Column('json')
  capabilities: unknown[];

  @Column('json')
  activationTriggers: unknown[];

  @Column('json')
  responseStyle: unknown;

  @Column('json')
  configuration: unknown;

  @Column('json')
  metadata: unknown;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * ペルソナインタラクションエンティティ
 */
@Entity('persona_interactions')
@Index(['personaId', 'timestamp'])
@Index(['sessionId'])
@Index(['userId'])
export class PersonaInteractionEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  personaId: string;

  @Column()
  sessionId: string;

  @Column()
  userId: string;

  @Column()
  commandId: string;

  @Column('timestamp')
  timestamp: Date;

  @Column('int')
  duration: number;

  @Column()
  success: boolean;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  userSatisfaction: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * ペルソナフィードバックエンティティ
 */
@Entity('persona_feedbacks')
@Index(['personaId', 'timestamp'])
@Index(['userId'])
export class PersonaFeedbackEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  personaId: string;

  @Column()
  userId: string;

  @Column('timestamp')
  timestamp: Date;

  @Column('int')
  rating: number;

  @Column('text', { nullable: true })
  comment: string | null;

  @Column('json')
  categories: string[];

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * ペルソナリポジトリ実装
 */
@Injectable()
export class PersonaRepositoryImpl extends PersonaRepository {
  private readonly logger = new Logger(PersonaRepositoryImpl.name);

  constructor(
    @InjectRepository(PersonaEntity)
    private readonly personaRepository: Repository<PersonaEntity>,
    
    @InjectRepository(PersonaInteractionEntity)
    private readonly interactionRepository: Repository<PersonaInteractionEntity>,
    
    @InjectRepository(PersonaFeedbackEntity)
    private readonly feedbackRepository: Repository<PersonaFeedbackEntity>
  ) {
    super();
  }

  async findById(id: PersonaId): Promise<AIPersona | null> {
    try {
      const entity = await this.personaRepository.findOne({
        where: { id: id as string }
      });

      return entity ? this.mapEntityToDomain(entity) : null;
    } catch (error) {
      this.logger.error(`Failed to find persona by ID: ${id}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find persona: ${error.message}`, 'findById', id);
    }
  }

  async findByIds(ids: readonly PersonaId[]): Promise<readonly AIPersona[]> {
    try {
      const entities = await this.personaRepository.find({
        where: { id: In(ids as string[]) }
      });

      return entities.map(entity => this.mapEntityToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to find personas by IDs`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find personas: ${error.message}`, 'findByIds');
    }
  }

  async findByFilter(filter: PersonaFilter): Promise<readonly AIPersona[]> {
    try {
      const where: FindOptionsWhere<PersonaEntity> = {};

      if (filter.types) {
        where.type = In(filter.types);
      }

      if (filter.active !== undefined) {
        where.active = filter.active;
      }

      const entities = await this.personaRepository.find({
        where,
        take: filter.limit ?? 50,
        order: { createdAt: 'DESC' }
      });

      let results = entities.map(entity => this.mapEntityToDomain(entity));

      // 追加フィルタリング
      if (filter.expertiseDomains?.length) {
        results = results.filter(persona => 
          persona.expertise.some(exp => 
            filter.expertiseDomains!.some(domain => 
              exp.domain.toLowerCase().includes(domain.toLowerCase())
            )
          )
        );
      }

      if (filter.technologies?.length) {
        results = results.filter(persona =>
          persona.expertise.some(exp =>
            exp.technologies.some(tech =>
              filter.technologies!.some(filterTech =>
                tech.toLowerCase().includes(filterTech.toLowerCase())
              )
            )
          )
        );
      }

      if (filter.minConfidence !== undefined) {
        results = results.filter(persona =>
          persona.expertise.some(exp => exp.confidence >= filter.minConfidence!)
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to find personas by filter`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find personas: ${error.message}`, 'findByFilter');
    }
  }

  async search(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]> {
    try {
      const searchTerm = `%${query.query}%`;
      const entities = await this.personaRepository.find({
        where: [
          { name: Like(searchTerm) },
          { description: Like(searchTerm) },
          { displayName: Like(searchTerm) }
        ],
        take: query.limit ?? 20,
        order: this.buildOrderOptions(query.sortBy, query.sortOrder)
      });

      let personas = entities.map(entity => this.mapEntityToDomain(entity));

      // フィルタを適用（既存の検索結果に対して）
      if (query.filters) {
        const filteredPersonas = await this.findByFilter(query.filters) as AIPersona[];
        const filteredIds = new Set(filteredPersonas.map(p => p.id));
        personas = personas.filter(p => filteredIds.has(p.id));
      }

      // 検索結果をマップ
      return personas.map(persona => ({
        persona,
        relevanceScore: this.calculateRelevanceScore(persona, query.query),
        matchedFields: this.getMatchedFields(persona, query.query)
      }));
    } catch (error) {
      this.logger.error(`Failed to search personas`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to search personas: ${error.message}`, 'search');
    }
  }

  async findAllActive(): Promise<readonly AIPersona[]> {
    try {
      const entities = await this.personaRepository.find({
        where: { active: true },
        order: { name: 'ASC' }
      });

      return entities.map(entity => this.mapEntityToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to find active personas`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find active personas: ${error.message}`, 'findAllActive');
    }
  }

  async findByTechnology(technology: string): Promise<readonly AIPersona[]> {
    try {
      const allPersonas = await this.findAllActive();
      
      return allPersonas.filter(persona =>
        persona.expertise.some(exp =>
          exp.technologies.some(tech =>
            tech.toLowerCase().includes(technology.toLowerCase())
          )
        )
      );
    } catch (error) {
      this.logger.error(`Failed to find personas by technology: ${technology}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find personas by technology: ${error.message}`, 'findByTechnology');
    }
  }

  async findByExpertiseDomain(domain: string): Promise<readonly AIPersona[]> {
    try {
      const allPersonas = await this.findAllActive();
      
      return allPersonas.filter(persona =>
        persona.expertise.some(exp =>
          exp.domain.toLowerCase().includes(domain.toLowerCase())
        )
      );
    } catch (error) {
      this.logger.error(`Failed to find personas by domain: ${domain}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find personas by domain: ${error.message}`, 'findByExpertiseDomain');
    }
  }

  async findByType(type: PersonaType): Promise<readonly AIPersona[]> {
    try {
      const entities = await this.personaRepository.find({
        where: { type, active: true },
        order: { name: 'ASC' }
      });

      return entities.map(entity => this.mapEntityToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to find personas by type: ${type}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to find personas by type: ${error.message}`, 'findByType');
    }
  }

  async create(persona: Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIPersona> {
    try {
      const id = createPersonaId();
      
      // 既存チェック
      const existing = await this.personaRepository.findOne({
        where: { name: persona.name }
      });

      if (existing) {
        throw new PersonaDuplicateError(id);
      }

      const entity = this.personaRepository.create({
        id,
        ...this.mapDomainToEntity({ ...persona, id } as AIPersona)
      });

      const saved = await this.personaRepository.save(entity);
      return this.mapEntityToDomain(saved);
    } catch (error) {
      if (error instanceof PersonaDuplicateError) {
        throw error;
      }
      this.logger.error(`Failed to create persona`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to create persona: ${error.message}`, 'create');
    }
  }

  async update(id: PersonaId, updates: Partial<AIPersona>): Promise<AIPersona> {
    try {
      const existing = await this.personaRepository.findOne({
        where: { id: id as string }
      });

      if (!existing) {
        throw new PersonaNotFoundError(id);
      }

      await this.personaRepository.update(id as string, {
        ...this.mapDomainToEntity(updates as AIPersona),
        updatedAt: new Date()
      });

      const updated = await this.personaRepository.findOne({
        where: { id: id as string }
      });

      return this.mapEntityToDomain(updated!);
    } catch (error) {
      if (error instanceof PersonaNotFoundError) {
        throw error;
      }
      this.logger.error(`Failed to update persona: ${id}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to update persona: ${error.message}`, 'update', id);
    }
  }

  async delete(id: PersonaId): Promise<boolean> {
    try {
      const result = await this.personaRepository.delete(id as string);
      return result.affected !== undefined && result.affected > 0;
    } catch (error) {
      this.logger.error(`Failed to delete persona: ${id}`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to delete persona: ${error.message}`, 'delete', id);
    }
  }

  async exists(id: PersonaId): Promise<boolean> {
    try {
      const count = await this.personaRepository.count({
        where: { id: id as string }
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check persona existence: ${id}`, error instanceof Error ? error.stack : error);
      return false;
    }
  }

  async count(filter?: PersonaFilter): Promise<number> {
    try {
      if (!filter) {
        return await this.personaRepository.count();
      }

      const where: FindOptionsWhere<PersonaEntity> = {};
      
      if (filter.types) {
        where.type = In(filter.types);
      }
      
      if (filter.active !== undefined) {
        where.active = filter.active;
      }

      return await this.personaRepository.count({ where });
    } catch (error) {
      this.logger.error(`Failed to count personas`, error instanceof Error ? error.stack : error);
      return 0;
    }
  }

  async getStatistics(): Promise<import('../../domain/types/personas.js').PersonaStatistics> {
    try {
      // TODO: 統計情報の実装
      const result: import('../../domain/types/personas.js').PersonaStatistics = {
        totalPersonas: await this.count(),
        activePersonas: await this.count({ active: true }),
        typeDistribution: {},
        averageConfidence: 0.8,
        lastUpdated: Date.now() as import('../../domain/types/base.js').Timestamp
      };
      return result;
    } catch (error) {
      this.logger.error(`Failed to get statistics`, error instanceof Error ? error.stack : error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new PersonaRepositoryError(`Failed to get statistics: ${errorMessage}`, 'getStatistics');
    }
  }

  async saveInteraction(interaction: PersonaInteraction): Promise<void> {
    try {
      const entity = this.interactionRepository.create({
        id: interaction.id,
        personaId: interaction.personaId as string,
        sessionId: interaction.sessionId as string,
        userId: interaction.userId as string,
        commandId: interaction.commandId as string,
        timestamp: new Date(interaction.timestamp),
        duration: interaction.duration,
        success: interaction.success,
        userSatisfaction: interaction.userSatisfaction,
        createdAt: new Date()
      });

      await this.interactionRepository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to save interaction`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to save interaction: ${error.message}`, 'saveInteraction');
    }
  }

  async saveFeedback(feedback: PersonaFeedback): Promise<void> {
    try {
      const entity = this.feedbackRepository.create({
        id: feedback.id,
        personaId: feedback.personaId as string,
        userId: feedback.userId as string,
        timestamp: new Date(feedback.timestamp),
        rating: feedback.rating,
        comment: feedback.comment,
        categories: feedback.categories,
        createdAt: new Date()
      });

      await this.feedbackRepository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to save feedback`, error instanceof Error ? error.stack : error);
      throw new PersonaRepositoryError(`Failed to save feedback: ${error.message}`, 'saveFeedback');
    }
  }

  async getSessionHistory(sessionId: SessionId): Promise<readonly PersonaInteraction[]> {
    try {
      const entities = await this.interactionRepository.find({
        where: { sessionId: sessionId as string },
        order: { timestamp: 'DESC' }
      });

      return entities.map(entity => this.mapInteractionEntityToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to get session history`, error instanceof Error ? error.stack : error);
      return [];
    }
  }

  async getUserHistory(userId: UserId): Promise<readonly PersonaInteraction[]> {
    try {
      const entities = await this.interactionRepository.find({
        where: { userId: userId as string },
        order: { timestamp: 'DESC' },
        take: 100 // 最新100件
      });

      return entities.map(entity => this.mapInteractionEntityToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to get user history`, error instanceof Error ? error.stack : error);
      return [];
    }
  }

  async getPopularPersonas(limit: number = 10): Promise<readonly { persona: AIPersona; usageCount: number; averageRating: number; }[]> {
    try {
      // インタラクション数による人気ペルソナの計算
      const popularPersonaQuery = `
        SELECT 
          p.id,
          COUNT(i.id) as usage_count,
          COALESCE(AVG(f.rating), 0) as average_rating
        FROM personas p
        LEFT JOIN persona_interactions i ON p.id = i.persona_id
        LEFT JOIN persona_feedbacks f ON p.id = f.persona_id
        WHERE p.active = true
        GROUP BY p.id
        HAVING COUNT(i.id) > 0
        ORDER BY COUNT(i.id) DESC, COALESCE(AVG(f.rating), 0) DESC
        LIMIT ?
      `;

      const results: Array<{ id: string; usage_count: string; average_rating: string }> = await this.personaRepository.query(popularPersonaQuery, [limit]);
      const popularPersonas: { persona: AIPersona; usageCount: number; averageRating: number; }[] = [];

      for (const result of results) {
        const persona = await this.findById(result.id as PersonaId);
        if (persona) {
          popularPersonas.push({
            persona,
            usageCount: parseInt(result.usage_count, 10),
            averageRating: parseFloat(result.average_rating) || 0
          });
        }
      }

      return popularPersonas;
    } catch (error) {
      this.logger.error(`Failed to get popular personas`, error instanceof Error ? error.stack : error);
      return [];
    }
  }

  async getRecommendedPersonas(_userId: UserId, _limit: number = 5): Promise<readonly AIPersona[]> {
    return await this.findAllActive();
  }

  async findSimilar(_personaId: PersonaId, _limit: number = 5): Promise<readonly { persona: AIPersona; similarityScore: number; }[]> {
    return [];
  }

  async createMany(personas: readonly Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<readonly AIPersona[]> {
    return await this.transaction(async () => {
      const results: AIPersona[] = [];
      for (const persona of personas) {
        results.push(await this.create(persona));
      }
      return results;
    });
  }

  async updateMany(updates: readonly { id: PersonaId; data: Partial<AIPersona>; }[]): Promise<readonly AIPersona[]> {
    const results: AIPersona[] = [];
    for (const update of updates) {
      results.push(await this.update(update.id, update.data));
    }
    return results;
  }

  async deleteMany(filter: PersonaFilter): Promise<number> {
    const personas = await this.findByFilter(filter);
    let deletedCount = 0;
    for (const persona of personas) {
      if (await this.delete(persona.id)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async findArchived(): Promise<readonly AIPersona[]> {
    return await this.findByFilter({ active: false });
  }

  async archive(id: PersonaId): Promise<boolean> {
    try {
      await this.personaRepository.update(id as string, { active: false, updatedAt: new Date() });
      return true;
    } catch {
      return false;
    }
  }

  async unarchive(id: PersonaId): Promise<boolean> {
    try {
      await this.personaRepository.update(id as string, { active: true, updatedAt: new Date() });
      return true;
    } catch {
      return false;
    }
  }

  async transaction<T>(operation: (repo: PersonaRepository) => Promise<T>): Promise<T> {
    // TypeORMのトランザクション実装
    return await this.personaRepository.manager.transaction(async () => {
      return await operation(this);
    });
  }

  // マッピングメソッド
  private mapEntityToDomain(entity: PersonaEntity): AIPersona {
    return {
      id: entity.id as PersonaId,
      name: entity.name,
      displayName: entity.displayName,
      description: entity.description,
      type: entity.type,
      version: entity.version,
      expertise: entity.expertise,
      capabilities: entity.capabilities,
      activationTriggers: entity.activationTriggers,
      responseStyle: entity.responseStyle as import('../../domain/types/personas.js').PersonaResponseStyle,
      configuration: entity.configuration as import('../../domain/types/personas.js').PersonaConfiguration,
      metadata: entity.metadata as import('../../domain/types/personas.js').PersonaMetadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private mapDomainToEntity(domain: AIPersona): Partial<PersonaEntity> {
    return {
      name: domain.name,
      displayName: domain.displayName,
      description: domain.description,
      type: domain.type,
      version: domain.version,
      expertise: domain.expertise,
      capabilities: domain.capabilities,
      activationTriggers: domain.activationTriggers,
      responseStyle: domain.responseStyle,
      configuration: domain.configuration,
      metadata: domain.metadata,
      active: domain.configuration?.active ?? true
    };
  }

  private mapInteractionEntityToDomain(entity: PersonaInteractionEntity): PersonaInteraction {
    return {
      id: entity.id,
      personaId: entity.personaId as PersonaId,
      sessionId: entity.sessionId as SessionId,
      userId: entity.userId as UserId,
      commandId: entity.commandId as import('../../domain/types/index.js').CommandId,
      timestamp: entity.timestamp.getTime() as import('../../domain/types/index.js').Timestamp,
      duration: entity.duration,
      success: entity.success,
      userSatisfaction: entity.userSatisfaction
    };
  }

  private buildOrderOptions(sortBy?: import('../../domain/types/personas.js').PersonaSortField, sortOrder?: import('../../domain/types/personas.js').SortOrder): Record<string, 'ASC' | 'DESC'> {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    
    if (sortBy === PersonaSortField.NAME) {
      order.name = sortOrder === SortOrder.DESC ? 'DESC' : 'ASC';
    } else if (sortBy === PersonaSortField.CREATED_AT) {
      order.createdAt = sortOrder === SortOrder.DESC ? 'DESC' : 'ASC';
    } else {
      order.createdAt = 'DESC';
    }
    
    return order;
  }

  private calculateRelevanceScore(persona: AIPersona, query: string): number {
    const normalizedQuery = query.toLowerCase();
    let score = 0;

    if (persona.name.toLowerCase().includes(normalizedQuery)) score += 0.5;
    if (persona.description.toLowerCase().includes(normalizedQuery)) score += 0.3;
    if (persona.displayName.toLowerCase().includes(normalizedQuery)) score += 0.2;

    return Math.min(score, 1);
  }

  private getMatchedFields(persona: AIPersona, query: string): readonly string[] {
    const normalizedQuery = query.toLowerCase();
    const matchedFields: string[] = [];

    if (persona.name.toLowerCase().includes(normalizedQuery)) matchedFields.push('name');
    if (persona.description.toLowerCase().includes(normalizedQuery)) matchedFields.push('description');
    if (persona.displayName.toLowerCase().includes(normalizedQuery)) matchedFields.push('displayName');

    return matchedFields;
  }
}