/**
 * LanceDB connection management with native LanceDB library
 */
import { connect, Connection } from '@lancedb/lancedb';
import { logger } from '../utils/logger.js';
import { LANCEDB_PATH } from '../utils/config.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * LanceDB connection manager
 */
export class LanceDBConnector {
  private static instance: LanceDBConnector;
  private connection: Connection | null = null;
  private isReady: boolean = false;
  private dbPath: string;

  /**
   * Private constructor for singleton pattern
   * @param dbPath - Path for LanceDB storage
   */
  private constructor(dbPath: string = LANCEDB_PATH) {
    this.dbPath = dbPath;
  }

  /**
   * Get the singleton instance
   * @param dbPath - Optional custom DB path
   * @returns LanceDBConnector singleton instance
   */
  public static getInstance(dbPath?: string): LanceDBConnector {
    if (!LanceDBConnector.instance) {
      LanceDBConnector.instance = new LanceDBConnector(dbPath);
    }
    return LanceDBConnector.instance;
  }

  /**
   * Initialize the LanceDB connection
   * @returns Promise resolving when connection is ready
   */
  public async initialize(): Promise<void> {
    if (this.isReady) {
      logger.debug('LanceDB connection already initialized');
      return;
    }

    try {
      logger.info('Initializing LanceDB connection', { path: this.dbPath });

      // Ensure DB directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      // Create connection to LanceDB with only supported options
      // Only include readConsistencyInterval which is likely supported
      this.connection = await connect(this.dbPath, {
        readConsistencyInterval: 0
      });

      logger.info('LanceDB connection established successfully');
      this.isReady = true;
    } catch (error) {
      logger.error('Failed to initialize LanceDB connection', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`LanceDB initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check if the connection is ready
   * @returns True if connection is ready
   */
  public isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Check if a table exists in the database
   * @param tableName - Name of the table to check
   * @returns True if the table exists, false otherwise
   * @throws Error if connection is not initialized
   */
  public async tableExists(tableName: string): Promise<boolean> {
    if (!this.isReady || !this.connection) {
      throw new Error('LanceDB connection not initialized');
    }
    const tableNames = await this.connection.tableNames();
    return tableNames.includes(tableName);
  }

  /**
   * Open a table in the database
   * @param tableName - Name of the table to open
   * @returns LanceDB table object
   * @throws Error if connection is not initialized
   */
  public async getTable(tableName: string) {
    if (!this.isReady || !this.connection) {
      throw new Error('LanceDB connection not initialized');
    }

    try {
      return await this.connection.openTable(tableName);
    } catch (error) {
      logger.error(`Error opening table: ${tableName}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Create a new table in the database
   * @param tableName - Name of the new table
   * @param data - Initial data for the table (can be empty array)
   * @param options - Table creation options, including schema
   * @returns LanceDB table object
   * @throws Error if connection is not initialized
   */
  public async createTable(tableName: string, data: any[] = [], options: any = {}): Promise<any> {
    if (!this.connection) throw new Error('Connection not initialized');

    try {
      return this.connection.createTable(tableName, data, options);
    } catch (error) {
      logger.error(`Error creating table: ${tableName}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get the LanceDB connection
   * @returns LanceDB connection object
   * @throws Error if connection is not initialized
   */
  public getConnection(): Connection {
    if (!this.isReady || !this.connection) {
      throw new Error('LanceDB connection not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  /**
   * Get the database path
   * @returns The path to the LanceDB database
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Close the LanceDB connection
   */
  public async close(): Promise<void> {
    if (this.connection) {
      logger.info('Closing LanceDB connection');
      // LanceDB handles clean shutdown automatically
      this.connection = null;
      this.isReady = false;
    }
  }
}