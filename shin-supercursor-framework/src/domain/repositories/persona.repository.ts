/**
 * SuperCursor Framework - ペルソナリポジトリ（抽象）
 * ドメイン層でのペルソナデータアクセス抽象化
 */

import {
  PersonaId,
  SessionId,
  UserId
} from '../types/index.js';
import {
  AIPersona,
  PersonaFilter,
  PersonaSearchQuery,
  PersonaSearchResult,
  PersonaStatistics,
  PersonaInteraction,
  PersonaFeedback
} from '../types/personas.js';

/**
 * ペルソナリポジトリ抽象インターフェース
 * データソースに依存しない永続化操作を定義
 */
export abstract class PersonaRepository {
  /**
   * ペルソナをIDで取得
   */
  abstract findById(id: PersonaId): Promise<AIPersona | null>;

  /**
   * 複数のペルソナをIDで取得
   */
  abstract findByIds(ids: readonly PersonaId[]): Promise<readonly AIPersona[]>;

  /**
   * 条件に基づいてペルソナを検索
   */
  abstract findByFilter(filter: PersonaFilter): Promise<readonly AIPersona[]>;

  /**
   * テキスト検索でペルソナを検索
   */
  abstract search(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]>;

  /**
   * すべてのアクティブなペルソナを取得
   */
  abstract findAllActive(): Promise<readonly AIPersona[]>;

  /**
   * 技術に基づいてペルソナを検索
   */
  abstract findByTechnology(technology: string): Promise<readonly AIPersona[]>;

  /**
   * 専門領域に基づいてペルソナを検索
   */
  abstract findByExpertiseDomain(domain: string): Promise<readonly AIPersona[]>;

  /**
   * ペルソナタイプに基づいて検索
   */
  abstract findByType(type: import('../types/personas.js').PersonaType): Promise<readonly AIPersona[]>;

  /**
   * ペルソナを作成
   */
  abstract create(persona: Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIPersona>;

  /**
   * ペルソナを更新
   */
  abstract update(id: PersonaId, updates: Partial<AIPersona>): Promise<AIPersona>;

  /**
   * ペルソナを削除
   */
  abstract delete(id: PersonaId): Promise<boolean>;

  /**
   * ペルソナの存在確認
   */
  abstract exists(id: PersonaId): Promise<boolean>;

  /**
   * ペルソナ数をカウント
   */
  abstract count(filter?: PersonaFilter): Promise<number>;

  /**
   * ペルソナ統計情報を取得
   */
  abstract getStatistics(): Promise<PersonaStatistics>;

  /**
   * ペルソナインタラクション記録を保存
   */
  abstract saveInteraction(interaction: PersonaInteraction): Promise<void>;

  /**
   * ペルソナフィードバックを保存
   */
  abstract saveFeedback(feedback: PersonaFeedback): Promise<void>;

  /**
   * セッションでのペルソナ使用履歴を取得
   */
  abstract getSessionHistory(sessionId: SessionId): Promise<readonly PersonaInteraction[]>;

  /**
   * ユーザーのペルソナ使用履歴を取得
   */
  abstract getUserHistory(userId: UserId): Promise<readonly PersonaInteraction[]>;

  /**
   * 人気ペルソナランキングを取得
   */
  abstract getPopularPersonas(limit?: number): Promise<readonly {
    persona: AIPersona;
    usageCount: number;
    averageRating: number;
  }[]>;

  /**
   * 推奨ペルソナを取得
   */
  abstract getRecommendedPersonas(userId: UserId, limit?: number): Promise<readonly AIPersona[]>;

  /**
   * 類似ペルソナを検索
   */
  abstract findSimilar(personaId: PersonaId, limit?: number): Promise<readonly {
    persona: AIPersona;
    similarityScore: number;
  }[]>;

  /**
   * バッチでペルソナを作成
   */
  abstract createMany(personas: readonly Omit<AIPersona, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<readonly AIPersona[]>;

  /**
   * バッチでペルソナを更新
   */
  abstract updateMany(updates: readonly {
    id: PersonaId;
    data: Partial<AIPersona>;
  }[]): Promise<readonly AIPersona[]>;

  /**
   * 条件に基づいてペルソナを削除
   */
  abstract deleteMany(filter: PersonaFilter): Promise<number>;

  /**
   * アーカイブされたペルソナを取得
   */
  abstract findArchived(): Promise<readonly AIPersona[]>;

  /**
   * ペルソナをアーカイブ
   */
  abstract archive(id: PersonaId): Promise<boolean>;

  /**
   * ペルソナのアーカイブを解除
   */
  abstract unarchive(id: PersonaId): Promise<boolean>;

  /**
   * トランザクション内でペルソナ操作を実行
   */
  abstract transaction<T>(operation: (repo: PersonaRepository) => Promise<T>): Promise<T>;
}

/**
 * ペルソナクエリオプション
 */
export interface PersonaQueryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: PersonaSortField;
  readonly sortOrder?: SortOrder;
  readonly includeArchived?: boolean;
  readonly includeMetrics?: boolean;
}

export enum PersonaSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  TYPE = 'type',
  CONFIDENCE = 'confidence',
  USAGE_COUNT = 'usageCount',
  RATING = 'rating'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * ペルソナリポジトリエラー
 */
export class PersonaRepositoryError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly personaId?: PersonaId
  ) {
    super(message);
    this.name = 'PersonaRepositoryError';
  }
}

export class PersonaNotFoundError extends PersonaRepositoryError {
  constructor(personaId: PersonaId) {
    super(`Persona not found: ${personaId}`, 'find', personaId);
    this.name = 'PersonaNotFoundError';
  }
}

export class PersonaDuplicateError extends PersonaRepositoryError {
  constructor(personaId: PersonaId) {
    super(`Persona already exists: ${personaId}`, 'create', personaId);
    this.name = 'PersonaDuplicateError';
  }
}

export class PersonaValidationError extends PersonaRepositoryError {
  constructor(message: string, personaId?: PersonaId) {
    super(`Persona validation failed: ${message}`, 'validate', personaId);
    this.name = 'PersonaValidationError';
  }
}