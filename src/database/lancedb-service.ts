/**
 * LanceDB service for document storage and retrieval
 */
import { LanceDBConnector } from './db-connector.js';
import { logger } from '../utils/logger.js';
import { DocumentChunk, SearchResult, RetrievalConfig, DocumentUtils, getRetrievalConfig } from '../utils/document.js';
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { Embeddings } from "@langchain/core/embeddings";
import crypto from 'crypto';

// Table name for document chunks
const DOCUMENTS_TABLE = 'document_chunks';

/**
 * Service for LanceDB operations via LangChain
 */
export class LanceDBService {
  private static instance: LanceDBService;
  private connector: LanceDBConnector;
  private embeddingService: Embeddings;
  private vectorStore: LanceDB | null = null;
  private isReady: boolean = false;
  private tableInitialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   * @param embeddingService - LangChain embeddings service
   */
  private constructor(embeddingService: Embeddings) {
    this.connector = LanceDBConnector.getInstance();
    this.embeddingService = embeddingService;
  }

  /**
   * Get singleton instance
   * @param embeddingService - LangChain embeddings service (required on first call)
   * @returns LanceDBService singleton instance
   */
  public static getInstance(embeddingService?: Embeddings): LanceDBService {
    if (!LanceDBService.instance) {
      if (!embeddingService) {
        throw new Error('Embedding service is required for LanceDBService initialization');
      }
      LanceDBService.instance = new LanceDBService(embeddingService);
    }
    return LanceDBService.instance;
  }

  /**
   * Initialize the LanceDB service
   * @returns Promise resolving when service is ready
   */
  public async initialize(): Promise<void> {
    if (this.isReady) {
      logger.debug('LanceDBService already initialized');
      return;
    }

    try {
      logger.info('Initializing LanceDBService');

      // Ensure DB connection is ready
      if (!this.connector.isInitialized()) {
        await this.connector.initialize();
      }

      const connection = this.connector.getConnection();

      // Check if documents table exists, create if it doesn't
      if (await this.connector.tableExists(DOCUMENTS_TABLE)) {
        logger.info(`Using existing table: ${DOCUMENTS_TABLE}`);
        const table = await this.connector.getTable(DOCUMENTS_TABLE);

        // Create LanceDB instance with existing table
        this.vectorStore = new LanceDB(this.embeddingService, { table });
        this.tableInitialized = true;
      } else {
        logger.info(`Creating new table: ${DOCUMENTS_TABLE}`);
        const docId = 'sample_doc_id';

        // Create a sample document with the full schema
        const sampleDoc = DocumentUtils.createSampleDocument(docId);

        // According to lancedb.d.ts, LanceDB.fromDocuments only accepts:
        // table, textKey, uri, tableName, and mode in the dbConfig
        this.vectorStore = await LanceDB.fromDocuments(
          [sampleDoc],
          this.embeddingService,
          {
            uri: this.connector.getDbPath(),
            tableName: DOCUMENTS_TABLE,
            mode: "create",
          }
        );

        this.tableInitialized = true;

        // Remove the sample document
        if (this.vectorStore && this.tableInitialized) {
          const table = await connection.openTable(DOCUMENTS_TABLE);
          const count = await table.countRows(`document_id = '${docId}'`);
          logger.debug(`Sample document count: ${count}`);
          const result = await table.delete(`document_id = '${docId}'`);
          logger.debug('Removed initialization sample document', result);
        }
      }
      this.isReady = true;
      logger.info('LanceDBService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LanceDBService', { error: error instanceof Error ? error.message : error });
      throw new Error(`LanceDBService initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check if the service is ready
   * @returns True if service is ready
   */
  public isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Insert or update document chunks
   * @param chunks - Document chunks to insert or update
   * @returns Promise resolving when completed
   */
  public async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.isReady || !this.vectorStore) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Upserting ${chunks.length} document chunks`);

      // Convert chunks to LangChain documents
      // No need to flatten since our schema is already flat
      const documents = chunks.map(chunk => DocumentUtils.chunkToLangChainDoc(chunk));

      // Use LangChain's addDocuments method which handles embeddings automatically
      await this.vectorStore.addDocuments(documents);

      logger.info(`Successfully upserted ${chunks.length} document chunks`);
    } catch (error) {
      logger.error('Error upserting document chunks', { error: error instanceof Error ? error.message : error });
      throw new Error(`Failed to upsert document chunks: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Delete document and all its chunks
   * @param documentId - ID of document to delete
   * @returns Promise resolving to number of chunks deleted
   */
  public async deleteDocument(documentId: string): Promise<number> {
    if (!this.isReady || !this.vectorStore) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Deleting document: ${documentId}`);

      // Get access to the underlying connection and table
      const connection = this.connector.getConnection();
      const table = await connection.openTable(DOCUMENTS_TABLE);

      // Use direct filter on documentId field
      const filter = `document_id = '${documentId}'`;

      // Count the rows that match our filter
      const count = await table.countRows(filter);

      if (count > 0) {
        // Delete the rows that match our filter
        await table.delete(filter);
        logger.info(`Deleted ${count} chunks for document: ${documentId}`);
      } else {
        logger.info(`No chunks found for document: ${documentId}`);
      }

      return count;
    } catch (error) {
      logger.error(`Error deleting document: ${documentId}`, { error: error instanceof Error ? error.message : error });
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Search for similar document chunks by query with advanced filtering
   * @param query - Text query to search for
   * @param config - Retrieval configuration
   * @param filters - Optional filters for metadata
   * @returns Promise resolving to search results
   */
  public async similaritySearch(
    query: string,
    config: RetrievalConfig,
    filters?: {
      documentIds?: string[];
      fileTypes?: string[];
      language?: string;
      dateRange?: { start?: string; end?: string };
    }
  ): Promise<SearchResult[]> {
    if (!this.isReady || !this.vectorStore) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info('Performing similarity search', { query });

      // Build filter based on provided filter options
      let filterConditions: string[] = [];

      // Direct filtering on flat fields
      if (filters?.documentIds && filters.documentIds.length > 0) {
        const docIdFilter = filters.documentIds.map(id => `document_id = '${id}'`).join(' OR ');
        filterConditions.push(`(${docIdFilter})`);
      }

      if (filters?.fileTypes && filters.fileTypes.length > 0) {
        const typeFilter = filters.fileTypes.map(type => `file_type = '${type}'`).join(' OR ');
        filterConditions.push(`(${typeFilter})`);
      }

      if (filters?.language) {
        filterConditions.push(`language = '${filters.language}'`);
      }

      if (filters?.dateRange) {
        if (filters.dateRange.start) {
          filterConditions.push(`created_at >= '${filters.dateRange.start}'`);
        }
        if (filters.dateRange.end) {
          filterConditions.push(`created_at <= '${filters.dateRange.end}'`);
        }
      }

      // Combine all filters with AND
      let filter: string | undefined;
      if (filterConditions.length > 0) {
        filter = filterConditions.join(' AND ');
        logger.debug('Applying filter', { filter });
      }

      // Use LangChain's built-in similaritySearch
      const searchResults = await this.vectorStore.similaritySearch(
        query,
        config.k,
        filter
      );

      // Transform results to our DocumentChunk format
      const results: SearchResult[] = searchResults.map((result, index) => {
        const chunk = DocumentUtils.langChainDocToChunk(result);

        return {
          chunk,
          score :result.metadata?._distance
        };
      });

      logger.info(`Found ${results.length} matching chunks`);
      return results;
    } catch (error) {
      logger.error('Error performing similarity search', { error: error instanceof Error ? error.message : error, query });
      throw new Error(`Similarity search failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate a unique document ID from file path
   * @param filePath - Path to the document file
   * @returns Unique document ID
   */
  public static generateDocumentId(filePath: string): string {
    return `doc_${crypto.createHash('md5').update(filePath).digest('hex').substring(0, 12)}`;
  }
}