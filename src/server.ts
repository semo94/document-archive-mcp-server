import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from './utils/logger.js';
import { registerResources } from './features/resources.js';
import { registerTools } from './features/tools.js';
import { registerPrompts } from './features/prompts.js';
import { getServerConfig } from './utils/config.js';

/**
 * Singleton class for managing the MCP server instance
 */
export class McpServerInstance {
  private static instance: McpServerInstance;
  private server!: McpServer;
  private initialized: boolean = false;
  private initializationPromise: Promise<McpServer> | null = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() { }

  /**
   * Get the singleton instance of McpServerInstance
   * @returns The McpServerInstance singleton
   */
  public static getInstance(): McpServerInstance {
    if (!McpServerInstance.instance) {
      McpServerInstance.instance = new McpServerInstance();
    }
    return McpServerInstance.instance;
  }

  /**
   * Initialize the MCP server and its services
   * @param dependenciesReady - Optional promise that resolves when dependencies are ready
   * @returns Promise resolving to the initialized server
   */
  public async initialize(dependenciesReady?: Promise<void>): Promise<McpServer> {
    if (this.initialized) {
      logger.info('MCP server already initialized');
      return this.server;
    }

    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create and store the initialization promise
    this.initializationPromise = this.performInitialization(dependenciesReady);
    return this.initializationPromise;
  }

  /**
   * Perform actual initialization
   * @param dependenciesReady - Optional promise that resolves when dependencies are ready
   * @returns Promise resolving to the initialized server
   */
  private async performInitialization(dependenciesReady?: Promise<void>): Promise<McpServer> {
    try {
      // Create a new MCP server with configuration from config.ts
      const serverConfig = getServerConfig();
      this.server = new McpServer(serverConfig);

      // Log server initialization with config details
      logger.info('Creating MCP server', {
        name: serverConfig.name,
        version: serverConfig.version
      });

      // Wait for dependencies to be ready if a promise was provided
      if (dependenciesReady) {
        logger.info('Waiting for server dependencies to be ready');

        try {
          await dependenciesReady;
        } catch (error) {
          logger.error('Server dependencies failed to initialize', { error: error instanceof Error ? error.message : error });
          throw new Error(`MCP server initialization failed: dependencies not ready: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Register features
      logger.info('Registering server features');
      registerResources(this.server);
      registerTools(this.server);
      registerPrompts(this.server);

      logger.info('MCP server created and configured successfully');
      this.initialized = true;
      return this.server;
    } catch (error) {
      // Clear the initialization promise on failure
      this.initializationPromise = null;
      logger.error('Failed to initialize MCP server', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Check if server is initialized
   * @returns True if server is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Terminate the server and close all connections gracefully
   */
  public async terminate(): Promise<void> {
    if (!this.initialized) {
      logger.info('MCP server not initialized, nothing to terminate');
      return;
    }

    logger.info('Shutting down MCP server gracefully');

    try {
      // Import here to avoid circular dependencies
      const { DirectoryWatcher } = await import('./services/directory-watcher.js');
      const directoryWatcher = DirectoryWatcher.getInstance();
      if (directoryWatcher.isActive()) {
        await directoryWatcher.stopWatching();
      }
    } catch (error) {
      logger.warn('Error stopping directory watcher', { error: error instanceof Error ? error.message : error });
    }

    // Close database connection
    try {
      const { LanceDBConnector } = await import('./database/db-connector.js');
      const dbConnector = LanceDBConnector.getInstance();
      if (dbConnector.isInitialized()) {
        await dbConnector.close();
      }
    } catch (error) {
      logger.warn('Error closing database connection', { error: error instanceof Error ? error.message : error });
    }

    this.initialized = false;
    this.initializationPromise = null;
    logger.info('MCP server terminated successfully');
  }

  /**
   * Get the McpServer instance
   * @returns The McpServer instance
   */
  public getServer(): McpServer {
    if (!this.initialized) {
      throw new Error('MCP server not initialized. Call initialize() first.');
    }
    return this.server;
  }
}