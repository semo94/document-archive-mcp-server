/**
 * Server readiness management
 */
import { logger } from './logger.js';
import { DirectoryWatcher } from '../services/directory-watcher.js';
import { DocumentProcessor } from '../services/document-processor.js';
import { EmbeddingService } from '../services/embedding-service.js';
import { LanceDBService } from '../database/lancedb-service.js';
import { LanceDBConnector } from '../database/db-connector.js';

/**
 * Readiness check result
 */
interface ReadinessStatus {
  isReady: boolean;
  services: {
    [serviceName: string]: {
      ready: boolean;
      error?: string;
    };
  };
  // Add initialization state
  initializationState: 'pending' | 'complete' | 'failed';
  initializationError?: string;
}

/**
 * Service for managing server readiness
 */
export class ReadinessManager {
  private static instance: ReadinessManager;
  private isReady: boolean = false;
  private status: ReadinessStatus = {
    isReady: false,
    services: {},
    initializationState: 'pending'
  };
  private initializationPromise: Promise<void> | null = null;
  private initializationFailed: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() { }

  /**
   * Get singleton instance
   * @returns ReadinessManager singleton instance
   */
  public static getInstance(): ReadinessManager {
    if (!ReadinessManager.instance) {
      ReadinessManager.instance = new ReadinessManager();
    }
    return ReadinessManager.instance;
  }

  /**
   * Initialize all required services
   * @param documentDirectories - Optional array of document directories to watch
   * @returns Promise resolving when all services are ready
   */
  public async initialize(documentDirectories?: string[]): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(documentDirectories);
    return this.initializationPromise;
  }

  /**
   * Get current readiness status
   * @returns Readiness status object
   */
  public getStatus(): ReadinessStatus {
    return { ...this.status };
  }

  /**
   * Check if server is ready
   * @returns True if server is ready
   */
  public isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Check if initialization has permanently failed
   * @returns True if initialization has failed
   */
  public hasInitializationFailed(): boolean {
    return this.initializationFailed;
  }

  /**
   * Perform actual initialization of all services
   * @param documentDirectories - Optional array of document directories to watch
   */
  private async performInitialization(documentDirectories?: string[]): Promise<void> {
    logger.info('Initializing MCP server dependencies');
    this.status.isReady = false;
    this.status.initializationState = 'pending';

    try {
      // 1. Initialize embedding service
      this.status.services.embedding = { ready: false };
      logger.info('Initializing embedding service');
      const embeddingService = EmbeddingService.getInstance();
      await embeddingService.initialize();
      this.status.services.embedding.ready = true;
      logger.info('Embedding service initialized successfully');

      // 2. Initialize database connector and service
      this.status.services.database = { ready: false };
      logger.info('Initializing database service');
      const dbConnector = LanceDBConnector.getInstance();
      await dbConnector.initialize();

      const dbService = LanceDBService.getInstance(embeddingService.getEmbeddingModel());
      await dbService.initialize();
      this.status.services.database.ready = true;
      logger.info('Database service initialized successfully');

      // 3. Initialize document processor
      this.status.services.documentProcessor = { ready: false };
      logger.info('Initializing document processor');
      const documentProcessor = DocumentProcessor.getInstance();
      await documentProcessor.initialize();
      this.status.services.documentProcessor.ready = true;
      logger.info('Document processor initialized successfully');

      // 4. Initialize directory watcher if directories provided
      if (documentDirectories && documentDirectories.length > 0) {
        this.status.services.directoryWatcher = { ready: false };
        logger.info('Initializing directory watcher');
        const directoryWatcher = DirectoryWatcher.getInstance();

        // Watch each directory
        for (const dir of documentDirectories) {
          await directoryWatcher.watchDirectory(dir);
        }

        this.status.services.directoryWatcher.ready = true;
        logger.info('Directory watcher initialized successfully');
      }

      // All services initialized
      this.isReady = true;
      this.status.isReady = true;
      this.status.initializationState = 'complete';
      logger.info('All MCP server dependencies initialized successfully');
    } catch (error) {
      const errorMessage = `Failed to initialize MCP server dependencies: ${error}`;
      logger.error(errorMessage);

      // Update status with error information
      if (error instanceof Error) {
        const failedService = Object.keys(this.status.services).find(
          key => this.status.services[key].ready === false
        );

        if (failedService) {
          this.status.services[failedService].error = error.message;
        }
      }

      // Mark initialization as permanently failed
      this.initializationFailed = true;
      this.status.initializationState = 'failed';
      this.status.initializationError = errorMessage;

      // Clear the promise so future calls can attempt initialization again
      this.initializationPromise = null;
      throw new Error(errorMessage);
    }
  }

  /**
   * Reset initialization state
   * This can be used to retry initialization after a failure
   */
  public reset(): void {
    this.isReady = false;
    this.initializationFailed = false;
    this.initializationPromise = null;
    this.status = {
      isReady: false,
      services: {},
      initializationState: 'pending'
    };
    logger.info('Readiness manager reset');
  }

  /**
   * Wait until the server is ready
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise resolving when server is ready
   * @throws Error if timeout is reached or if initialization has permanently failed
   */
  public async waitForReady(timeoutMs: number = 100000): Promise<void> {
    if (this.isReady) {
      return;
    }

    // If initialization has already failed, don't wait
    if (this.initializationFailed) {
      throw new Error(`Server initialization has permanently failed: ${this.status.initializationError}`);
    }

    return new Promise<void>((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for server to be ready'));
      }, timeoutMs);

      // Check readiness periodically
      const checkReady = () => {
        if (this.isReady) {
          clearTimeout(timeout);
          resolve();
        } else if (this.initializationFailed) {
          // If initialization has failed during this wait, reject immediately
          clearTimeout(timeout);
          reject(new Error(`Server initialization failed during wait: ${this.status.initializationError}`));
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }
}

/**
 * Middleware for checking readiness
 * For use with Express server in SSE transport
 */
export function readinessMiddleware(readinessManager: ReadinessManager) {
  return (req: any, res: any, next: Function) => {
    // Check if initialization has permanently failed
    if (readinessManager.hasInitializationFailed()) {
      return res.status(500).json({
        status: 'error',
        message: 'Server initialization has failed and cannot recover',
        details: readinessManager.getStatus()
      });
    }

    // Check if server is still initializing
    if (!readinessManager.isInitialized()) {
      return res.status(503).json({
        status: 'error',
        message: 'Server is still initializing, please try again later',
        details: readinessManager.getStatus()
      });
    }

    next();
  };
}