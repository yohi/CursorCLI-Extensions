/**
 * CommandExecutionEngine concrete implementation
 */

import {
  CommandId,
  Timestamp,
  FrameworkError,
  CommandExecutionError,
  DeepReadonly
} from '../domain/types/index.js';

import {
  Command,
  CommandResult,
  CommandExecutionEngine,
  AsyncCommandExecution,
  ExecutionStatus,
  ActiveExecution,
  ExecutionProgress,
  CommandRouter
} from '../domain/types/commands.js';

export interface CommandExecutionEngineConfig {
  readonly maxConcurrentExecutions: number;
  readonly defaultTimeout: number;
  readonly enableMetrics: boolean;
  readonly enableLogging: boolean;
}

interface ExtendedActiveExecution extends ActiveExecution {
  status: ExecutionStatus; // mutableにする
  abortController?: AbortController;
}

export class CommandExecutionEngineImpl implements CommandExecutionEngine {
  private activeExecutions = new Map<CommandId, ExtendedActiveExecution>();
  private executionPromises = new Map<CommandId, Promise<CommandResult>>();

  private readonly defaultConfig: CommandExecutionEngineConfig = {
    maxConcurrentExecutions: 10,
    defaultTimeout: 30000,
    enableMetrics: true,
    enableLogging: true
  };

  constructor(
    private readonly commandRouter: CommandRouter,
    private readonly config: Partial<CommandExecutionEngineConfig> = {}
  ) {}

  private get mergedConfig(): CommandExecutionEngineConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  async execute(command: Command): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Check concurrent execution limit
      if (this.activeExecutions.size >= this.mergedConfig.maxConcurrentExecutions) {
        throw new CommandExecutionError('Maximum concurrent executions exceeded');
      }

      // Create AbortController for cancellation support
      const abortController = new AbortController();

      // Create active execution tracking
      const activeExecution: ExtendedActiveExecution = {
        commandId: command.id,
        status: ExecutionStatus.RUNNING,
        startTime: startTime as Timestamp,
        abortController
      };

      this.activeExecutions.set(command.id, activeExecution);

      // Check if already cancelled
      if (abortController.signal.aborted) {
        throw new CommandExecutionError('Command was cancelled before execution');
      }

      // Route and execute the command
      const result = await this.commandRouter.routeCommand(
        {
          name: command.name,
          arguments: command.arguments,
          options: command.options,
          raw: command.raw,
          parseMetadata: {
            parser: 'CommandExecutionEngine',
            version: '1.0.0',
            timestamp: startTime as Timestamp,
            confidence: 1.0
          }
        },
        command.executionContext
      );

      // Check if cancelled during execution
      if (abortController.signal.aborted) {
        activeExecution.status = ExecutionStatus.CANCELLED;
        throw new CommandExecutionError('Command was cancelled during execution');
      }

      // Update execution status
      activeExecution.status = result.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
      
      // Clean up
      this.activeExecutions.delete(command.id);

      return result;

    } catch (error) {
      // Clean up on error
      this.activeExecutions.delete(command.id);

      throw error instanceof FrameworkError 
        ? error 
        : new CommandExecutionError(`Command execution failed: ${error.message}`);
    }
  }

  async executeAsync(command: Command): Promise<AsyncCommandExecution> {
    const startTime = Date.now();

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.mergedConfig.maxConcurrentExecutions) {
      throw new CommandExecutionError('Maximum concurrent executions exceeded');
    }

    // Create AbortController for cancellation support
    const abortController = new AbortController();

    // Create active execution tracking
    const activeExecution: ExtendedActiveExecution = {
      commandId: command.id,
      status: ExecutionStatus.PENDING,
      startTime: startTime as Timestamp,
      abortController
    };

    this.activeExecutions.set(command.id, activeExecution);

    // Start execution
    const executionPromise = this.execute(command);
    this.executionPromises.set(command.id, executionPromise);

    // Update status to running
    activeExecution.status = ExecutionStatus.RUNNING;

    // Clean up when done
    executionPromise.finally(() => {
      this.executionPromises.delete(command.id);
    });

    return {
      commandId: command.id,
      status: ExecutionStatus.RUNNING,
      promise: executionPromise
    };
  }

  async cancel(commandId: CommandId): Promise<boolean> {
    const activeExecution = this.activeExecutions.get(commandId);
    
    if (!activeExecution) {
      return false;
    }

    // Abort the execution if AbortController is available
    if (activeExecution.abortController) {
      activeExecution.abortController.abort();
    }

    // Update status
    activeExecution.status = ExecutionStatus.CANCELLED;

    // Clean up
    this.activeExecutions.delete(commandId);
    this.executionPromises.delete(commandId);

    return true;
  }

  async getExecutionStatus(commandId: CommandId): Promise<ExecutionStatus> {
    const activeExecution = this.activeExecutions.get(commandId);
    return activeExecution?.status || ExecutionStatus.COMPLETED;
  }

  async getActiveExecutions(): Promise<readonly ActiveExecution[]> {
    // Return readonly view of active executions without AbortController
    return Array.from(this.activeExecutions.values()).map(exec => ({
      commandId: exec.commandId,
      status: exec.status,
      startTime: exec.startTime,
      progress: exec.progress,
      estimatedCompletion: exec.estimatedCompletion
    }));
  }
}