/**
 * PersonaManager concrete implementation
 */

import { PersonaRepository } from '../domain/repositories/persona.repository.js';
import { PersonaSelectionService } from '../domain/services/persona-selection.service.js';
import {
  ExecutionContext
} from '../domain/types/commands.js';
import {
  PersonaId,
  SessionId,
  FrameworkError,
  ValidationError
} from '../domain/types/index.js';
import {
  AIPersona,
  PersonaManager,
  PersonaContext,
  PersonaSelectionResult,
  PersonaType,
  PersonaActivationResult,
  PersonaSwitchResult,
  PersonaFilter,
  PersonaSearchQuery,
  PersonaSearchResult,
  PersonaInteraction,
  PersonaFeedback
} from '../domain/types/personas.js';



export interface PersonaManagerConfig {
  readonly enableLearning: boolean;
  readonly enableAutoSelection: boolean;
  readonly confidenceThreshold: number;
  readonly maxConcurrentPersonas: number;
}

export class PersonaManagerImpl implements PersonaManager {
  private activeSessions = new Map<SessionId, PersonaId>();
  private readonly logger = { error: (_message: string): void => { /* TODO: Replace with proper logger */ } }; // Simple logger implementation
  
  private readonly defaultConfig: PersonaManagerConfig = {
    enableLearning: true,
    enableAutoSelection: true,
    confidenceThreshold: 0.7,
    maxConcurrentPersonas: 3
  };

  constructor(
    private readonly personaRepository: PersonaRepository,
    private readonly personaSelectionService: PersonaSelectionService,
    private readonly config: Partial<PersonaManagerConfig> = {}
  ) {}

  private get mergedConfig(): PersonaManagerConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  async analyzeContext(context: ExecutionContext): Promise<PersonaContext> {
    try {
      // Basic context analysis - in a real implementation this would be more sophisticated
      const activePersona = context.persona 
        ? await this.personaRepository.findById(context.persona)
        : undefined;

      let confidence = 0.5; // Default fallback confidence
      let reasoning = 'No active persona selected';

      if (activePersona) {
        // Calculate dynamic confidence based on persona analysis
        confidence = this.calculatePersonaConfidence(activePersona, context);
        reasoning = `Using active persona: ${activePersona.name} (confidence: ${(confidence * 100).toFixed(1)}%)`;
      } else {
        // Try to find suitable personas and calculate confidence
        const suitablePersonas = await this.findSuitablePersonas(context);
        if (suitablePersonas.length > 0) {
          confidence = suitablePersonas[0].confidence;
          reasoning = `No active persona, but found ${suitablePersonas.length} suitable persona(s) (best match confidence: ${(confidence * 100).toFixed(1)}%)`;
        }
      }

      return {
        sessionId: context.sessionId,
        activePersona: activePersona ?? undefined,
        confidence,
        reasoning,
        alternatives: [],
        executionContext: context
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
      throw new FrameworkError(`Context analysis failed: ${errorMessage}`);
    }
  }

  private calculatePersonaConfidence(persona: AIPersona, context: ExecutionContext): number {
    const TECH_WEIGHT = 0.4;
    const TYPE_WEIGHT = 0.3;
    const TRIGGER_WEIGHT = 0.3;

    let score = 0;
    let totalWeight = 0;

    // Factor 1: Technology stack match
    try {
      const projectTechnologies =
        context.project?.technologies?.frameworks?.map(f => f.name.toLowerCase()) ?? [];
      const personaTechnologies =
        persona.expertise?.flatMap(e => (e.technologies ?? []).map(t => t.toLowerCase())) ?? [];

      if (projectTechnologies.length > 0 && personaTechnologies.length > 0) {
        const techMatches = projectTechnologies.filter(tech =>
          personaTechnologies.some(pTech => pTech.includes(tech) || tech.includes(pTech))
        ).length;
        score += (techMatches / projectTechnologies.length) * TECH_WEIGHT;
        totalWeight += TECH_WEIGHT;
      }
    } catch {
      // Ignore technology match errors
    }

    // Factor 2: Project type compatibility
    try {
      const projectType = context.project?.type;
      const projectTypeMapping: Record<string, PersonaType[]> = {
        web_application: [PersonaType.DEVELOPER, PersonaType.DESIGNER, PersonaType.ARCHITECT],
        api_service: [PersonaType.DEVELOPER, PersonaType.ARCHITECT, PersonaType.DEVOPS],
        library: [PersonaType.DEVELOPER, PersonaType.ARCHITECT],
        cli_tool: [PersonaType.DEVELOPER, PersonaType.DEVOPS],
        microservice: [PersonaType.ARCHITECT, PersonaType.DEVOPS, PersonaType.DEVELOPER],
      };

      if (projectType) {
        const suitableTypes = Object.prototype.hasOwnProperty.call(projectTypeMapping, projectType) 
          ? projectTypeMapping[projectType as keyof typeof projectTypeMapping] ?? []
          : [];
        const typeMatch = suitableTypes.includes(persona.type as PersonaType) ? 1 : 0.3;
        score += typeMatch * TYPE_WEIGHT;
        totalWeight += TYPE_WEIGHT;
      }
    } catch {
      // Ignore project type match errors
    }

    // Factor 3: Persona activation triggers
    try {
      const triggers = persona.activationTriggers ?? [];
      const projectType = context.project?.type;
      if (triggers.length > 0 && projectType) {
        const triggerMatches = triggers.filter(trigger => {
          if (String(trigger.type) === 'project_type') {
            if (typeof trigger.pattern === 'string') {
              return trigger.pattern.toLowerCase() === projectType.toLowerCase();
            } else if (trigger.pattern && typeof (trigger.pattern).test === 'function') {
              return (trigger.pattern).test(projectType);
            }
          }
          return false;
        }).length;
        score += (triggerMatches / triggers.length) * TRIGGER_WEIGHT;
        totalWeight += TRIGGER_WEIGHT;
      }
    } catch {
      // Ignore trigger match errors
    }

    const finalConfidence = totalWeight > 0 ? score / totalWeight : 0.5;
    return Math.max(0.1, Math.min(0.95, finalConfidence));
  }

  private async findSuitablePersonas(context: ExecutionContext): Promise<Array<{persona: import('../domain/types/personas.js').AIPersona, confidence: number}>> {
    try {
      const allPersonas = await this.personaRepository.findAllActive();
      const suitablePersonas = [];

      for (const persona of allPersonas) {
        const confidence = this.calculatePersonaConfidence(persona, context);
        if (confidence > 0.3) { // Minimum threshold for suitability
          suitablePersonas.push({ persona, confidence });
        }
      }

      return suitablePersonas.sort((a, b) => b.confidence - a.confidence);
    } catch {
      return [];
    }
  }

  async selectPersona(context: PersonaContext): Promise<PersonaSelectionResult> {
    try {
      return await this.personaSelectionService.selectPersona(
        context.executionContext,
        {
          minConfidenceThreshold: this.mergedConfig.confidenceThreshold
        }
      );
    } catch (error) {
      return {
        success: false,
        confidence: 0,
        reasoning: `Persona selection failed: ${error instanceof Error ? error.message : String(error)}`,
        alternatives: [],
        selectionTime: 0
      };
    }
  }

  async activatePersona(
    personaId: PersonaId, 
    context: ExecutionContext
  ): Promise<PersonaActivationResult> {
    const startTime = Date.now();

    try {
      const persona = await this.personaRepository.findById(personaId);
      if (!persona) {
        throw new FrameworkError(`Persona not found: ${personaId}`);
      }

      if (!persona.configuration.active) {
        throw new FrameworkError(`Persona is not active: ${personaId}`);
      }

      // Track active session
      this.activeSessions.set(context.sessionId, personaId);

      return {
        success: true,
        persona,
        confidence: 1.0,
        reasoning: `Successfully activated persona: ${persona.name}`,
        activationTime: Date.now() - startTime,
        resources: {
          memory: 0,
          cpu: 0,
          diskIO: 0,
          networkIO: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        persona: await this.getFallbackPersona(),
        confidence: 0,
        reasoning: `Activation failed: ${error instanceof Error ? error.message : String(error)}`,
        activationTime: Date.now() - startTime,
        resources: {
          memory: 0,
          cpu: 0,
          diskIO: 0,
          networkIO: 0
        },
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  async deactivatePersona(sessionId: SessionId): Promise<boolean> {
    return Promise.resolve(this.activeSessions.delete(sessionId));
  }

  async switchPersona(
    sessionId: SessionId, 
    newPersonaId: PersonaId
  ): Promise<PersonaSwitchResult> {
    const startTime = Date.now();

    try {
      const previousPersonaId = this.activeSessions.get(sessionId);
      const previousPersona = previousPersonaId 
        ? await this.personaRepository.findById(previousPersonaId)
        : undefined;

      const newPersona = await this.personaRepository.findById(newPersonaId);
      if (!newPersona) {
        throw new ValidationError(`Persona not found: ${newPersonaId}`);
      }

      this.activeSessions.set(sessionId, newPersonaId);

      return {
        success: true,
        previousPersona: previousPersona ?? undefined,
        newPersona,
        reason: `Switched to persona: ${newPersona.name}`,
        switchTime: Date.now() - startTime
      };
    } catch (error) {
      const fallback = await this.getFallbackPersona();
      return {
        success: false,
        newPersona: fallback,
        reason: `Switch failed: ${error instanceof Error ? error.message : String(error)}`,
        switchTime: Date.now() - startTime
      };
    }
  }

  async getActivePersona(sessionId: SessionId): Promise<AIPersona | null> {
    const personaId = this.activeSessions.get(sessionId);
    if (!personaId) {
      return null;
    }

    try {
      return await this.personaRepository.findById(personaId);
    } catch {
      // Clean up invalid reference
      this.activeSessions.delete(sessionId);
      return null;
    }
  }

  async registerPersona(persona: AIPersona): Promise<void> {
    // If persona has an ID, update it, otherwise create new
    if (persona.id) {
      await this.personaRepository.update(persona.id, persona);
    } else {
      // IDがない場合は新規作成用のデータを準備
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, updatedAt, ...personaData } = persona;
      // id, createdAt, updatedAt は新規作成時には不要なので除外
      await this.personaRepository.create(personaData);
    }
  }

  async unregisterPersona(personaId: PersonaId): Promise<boolean> {
    try {
      await this.personaRepository.delete(personaId);
      return true;
    } catch {
      return false;
    }
  }

  async updatePersona(
    personaId: PersonaId, 
    updates: Partial<AIPersona>
  ): Promise<AIPersona> {
    const existing = await this.personaRepository.findById(personaId);
    if (!existing) {
      throw new ValidationError(`Persona not found: ${personaId}`);
    }

    const updated = await this.personaRepository.update(personaId, updates);
    return updated;
  }

  async listAvailablePersonas(filter?: PersonaFilter): Promise<readonly AIPersona[]> {
    if (!filter) {
      return await this.personaRepository.findAllActive();
    }

    // Apply filtering logic
    let personas = await this.personaRepository.findAllActive();

    if (filter.types && filter.types.length > 0) {
      personas = personas.filter(p => filter.types!.includes(p.type));
    }

    if (filter.active !== undefined) {
      personas = personas.filter(p => p.configuration.active === filter.active);
    }

    if (filter.minConfidence !== undefined) {
      personas = personas.filter(p => 
        p.configuration.confidenceThreshold >= filter.minConfidence!
      );
    }

    return personas;
  }

  async searchPersonas(query: PersonaSearchQuery): Promise<readonly PersonaSearchResult[]> {
    const personas = await this.listAvailablePersonas(query.filters);
    const queryLower = query.query.toLowerCase();

    const results = personas
      .map(persona => {
        let relevanceScore = 0;
        const matchedFields: string[] = [];

        // Name matching
        if (persona.name.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.4;
          matchedFields.push('name');
        }

        // Description matching
        if (persona.description.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.3;
          matchedFields.push('description');
        }

        // Expertise matching
        const expertiseMatch = persona.expertise.some(exp =>
          exp.domain.toLowerCase().includes(queryLower) ||
          exp.technologies.some(tech => tech.toLowerCase().includes(queryLower))
        );
        if (expertiseMatch) {
          relevanceScore += 0.3;
          matchedFields.push('expertise');
        }

        return {
          persona,
          relevanceScore,
          matchedFields
        };
      })
      .filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return query.limit ? results.slice(0, query.limit) : results;
  }

  async learnFromInteraction(interaction: PersonaInteraction): Promise<void> {
    if (!this.mergedConfig.enableLearning) {
      return;
    }

    // Store interaction for learning - in a real implementation this would
    // update persona configurations based on performance
    try {
      await this.personaRepository.saveInteraction(interaction);
    } catch (error) {
      // Log error but don't fail the operation
      this.logger.error(`Failed to store interaction for learning: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`);
    }
  }

  async provideFeedback(feedback: PersonaFeedback): Promise<void> {
    try {
      await this.personaRepository.saveFeedback(feedback);
    } catch (error) {
      this.logger.error(`Failed to store feedback: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`);
    }
  }

  private async getFallbackPersona(): Promise<AIPersona | undefined> {
    try {
      const activePersonas = await this.personaRepository.findAllActive();
      const fallback = activePersonas.find(p => p.type === PersonaType.DEVELOPER) ?? activePersonas.at(0);
      return fallback;
    } catch (error) {
      this.logger.error(`Failed to get fallback persona: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}