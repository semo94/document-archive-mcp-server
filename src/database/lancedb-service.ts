/**
 * LanceDB service for document storage and retrieval
 * Using direct native LanceDB library integration
 */
import { LanceDBConnector } from './db-connector.js';
import { logger } from '../utils/logger.js';
import { DocumentChunk, SearchResult, RetrievalConfig, DocumentUtils } from '../utils/document.js';
import { EmbeddingService } from '../services/embedding-service.js';
import crypto from 'crypto';

// Table name for document chunks
const DOCUMENTS_TABLE = 'document_chunks';

/**
 * Service for LanceDB operations using the native LanceDB library
 */
export class LanceDBService {
  private static instance: LanceDBService;
  private connector: LanceDBConnector;
  private embeddingService: EmbeddingService;
  private table: any = null;
  private isReady: boolean = false;
  private tableInitialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(embeddingModel?: any) {
    this.connector = LanceDBConnector.getInstance();
    if (embeddingModel) {
      this.embeddingService = typeof embeddingModel === 'object' && 'getInstance' in embeddingModel
        ? embeddingModel
        : EmbeddingService.getInstance();
    } else {
      this.embeddingService = EmbeddingService.getInstance();
    }
  }

  /**
   * Get singleton instance
   * @param embeddingService - Embedding service (required on first call)
   * @returns LanceDBService singleton instance
   */
  public static getInstance(embeddingService?: any): LanceDBService {
    if (!LanceDBService.instance) {
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

      // Check if documents table exists
      const tableNames = await connection.tableNames();

      if (tableNames.includes(DOCUMENTS_TABLE)) {
        logger.info(`Using existing table: ${DOCUMENTS_TABLE}`);
        this.table = await connection.openTable(DOCUMENTS_TABLE);
        this.tableInitialized = true;

        // Check if the table has an index
        const indices = await this.table.listIndices();
        const hasVectorIndex = indices.some((index: { column: string; }) => index.column === 'vector');

        if (!hasVectorIndex) {
          logger.info('Creating vector index on existing table');
          // BUG FIX: Use createVectorIndexInternal which doesn't check this.isReady
          await this.createVectorIndexInternal();
        }
      } else {
        logger.info(`Creating new table: ${DOCUMENTS_TABLE}`);

        // Import apache-arrow to define the schema
        const arrow = await import('apache-arrow');

        // Define schema for the document chunks table
        const schema = new arrow.Schema([
          // Vector field needs to be a fixed-size list of float32
          new arrow.Field('vector', new arrow.FixedSizeList(this.embeddingService.getEmbeddingDimension(),
            new arrow.Field('item', new arrow.Float32()))),
          new arrow.Field('document_id', new arrow.Utf8()),
          new arrow.Field('chunk_id', new arrow.Utf8()),
          new arrow.Field('chunk_index', new arrow.Int32()),
          new arrow.Field('content', new arrow.Utf8()),
          new arrow.Field('filename', new arrow.Utf8()),
          new arrow.Field('title', new arrow.Utf8()),
          new arrow.Field('file_type', new arrow.Utf8()),
          new arrow.Field('file_path', new arrow.Utf8()),
          new arrow.Field('language', new arrow.Utf8()),
          new arrow.Field('file_size', new arrow.Int32()),
          new arrow.Field('created_at', new arrow.Utf8()),
          new arrow.Field('updated_at', new arrow.Utf8()),
          new arrow.Field('file_hash', new arrow.Utf8()),
          new arrow.Field('page_number', new arrow.Int32()),
          new arrow.Field('start_index', new arrow.Int32()),
          new arrow.Field('end_index', new arrow.Int32())
        ]);

        // Create empty table with schema
        this.table = await connection.createTable(DOCUMENTS_TABLE, [], {
          schema: schema
        });

        this.tableInitialized = true;
        logger.info(`Table created successfully: ${DOCUMENTS_TABLE}`);
      }

      this.isReady = true;
      logger.info('LanceDBService initialized successfully');      
    } catch (error) {
      logger.error('Failed to initialize LanceDBService', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`LanceDBService initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Internal method for creating a vector index on the table during initialization
   * This doesn't check this.isReady to avoid circular dependency
   * @returns Promise resolving when index is created
   */
  private async createVectorIndexInternal(): Promise<void> {
    if (!this.table) {
      throw new Error('Table is not initialized');
    }

    try {
      // Import the Index class from LanceDB
      const lancedb = await import('@lancedb/lancedb');

      // Get the row count to determine an appropriate index type and parameters
      const rowCount = await this.table.countRows();

      // Log the dataset size
      logger.info(`Creating vector index for table with ${rowCount} vectors`);

      // - IVF-PQ requires at least 256 data points for PQ training
      if (rowCount > 256) {
        // For larger datasets, use IVF-PQ with appropriate parameters
        const numPartitions = Math.max(4, Math.min(Math.floor(Math.sqrt(rowCount)), 100));
        const numSubVectors = Math.min(16, Math.max(1, Math.floor(this.embeddingService.getEmbeddingDimension() / 24)));

        logger.info(`Using IVF-PQ index with ${numPartitions} partitions and ${numSubVectors} sub-vectors`);

        await this.table.createIndex('vector', {
          config: lancedb.Index.ivfPq({
            numPartitions: numPartitions,
            numSubVectors: numSubVectors,
            distanceType: 'cosine'
          })
        });
      }

      logger.info('Vector index created successfully');
    } catch (error) {
      logger.error('Failed to create vector index', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to create vector index: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Create a vector index on the table
   * @returns Promise resolving when index is created
   */
  public async createVectorIndex(): Promise<void> {
    if (!this.isReady || !this.table) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    return this.createVectorIndexInternal();
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
    if (!this.isReady || !this.table) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Upserting ${chunks.length} document chunks`);

      // Batch chunks for processing
      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batchChunks = chunks.slice(i, i + batchSize);

        // Process each chunk in the batch
        const processedData = await Promise.all(
          batchChunks.map(async chunk => {
            // Get embedding for chunk content
            const vector = await this.embeddingService.embedText(chunk.content);

            // Convert chunk to LanceDB record format
            return DocumentUtils.chunkToLanceDBRecord(chunk, vector);
          })
        );

        // Add data to table
        await this.table.add(processedData);
        logger.debug(`Upserted batch of ${processedData.length} chunks`);
      }

      // After adding all chunks, optimize the table and indices
      try {
        await this.table.optimize();
      } catch (error) {
        // Optimization errors are not critical, we can continue
        logger.warn('Table optimization error (non-critical)', {
          error: error instanceof Error ? error.message : error
        });
      }

      logger.info(`Successfully upserted ${chunks.length} document chunks`);
    } catch (error) {
      logger.error('Error upserting document chunks', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to upsert document chunks: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Delete document and all its chunks
   * @param documentId - ID of document to delete
   * @returns Promise resolving to number of chunks deleted
   */
  public async deleteDocument(documentId: string): Promise<number> {
    if (!this.isReady || !this.table) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Deleting document: ${documentId}`);

      // Count chunks for this document
      const count = await this.table.countRows(`document_id = '${documentId}'`);

      if (count > 0) {
        // Delete chunks for this document
        await this.table.delete(`document_id = '${documentId}'`);
        logger.info(`Deleted ${count} chunks for document: ${documentId}`);
      } else {
        logger.info(`No chunks found for document: ${documentId}`);
      }

      return count;
    } catch (error) {
      logger.error(`Error deleting document: ${documentId}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
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
    if (!this.isReady || !this.table) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info('Performing similarity search', { query, distanceType: config.distanceType });

      // Get vector embedding for query
      const queryVector = await this.embeddingService.embedText(query);

      // Create search query builder
      let searchQuery = this.table.search(queryVector)
        .distanceType(config.distanceType === 'cosine' ? 'cosine' : (config.distanceType === 'dot' ? 'dot' : 'l2'))
        .limit(config.k);

      // Configure search parameters based on config
      if (config.refineFactor > 1) {
        searchQuery = searchQuery.refineFactor(config.refineFactor);
      }

      if (config.indexType === 'exact') {
        searchQuery = searchQuery.bypassVectorIndex();
      }

      // Build where clause for filters if provided
      if (filters) {
        const conditions: string[] = [];

        if (filters.documentIds && filters.documentIds.length > 0) {
          // Use IN operator for multiple document IDs
          const docIdList = filters.documentIds.map(id => `'${id}'`).join(', ');
          conditions.push(`document_id IN (${docIdList})`);
        }

        if (filters.fileTypes && filters.fileTypes.length > 0) {
          // Use IN operator for multiple file types
          const fileTypeList = filters.fileTypes.map(type => `'${type}'`).join(', ');
          conditions.push(`file_type IN (${fileTypeList})`);
        }

        if (filters.language) {
          conditions.push(`language = '${filters.language}'`);
        }

        if (filters.dateRange) {
          if (filters.dateRange.start) {
            conditions.push(`created_at >= '${filters.dateRange.start}'`);
          }
          if (filters.dateRange.end) {
            conditions.push(`created_at <= '${filters.dateRange.end}'`);
          }
        }

        // Apply WHERE clause if any conditions exist
        if (conditions.length > 0) {
          searchQuery = searchQuery.where(conditions.join(' AND '));
        }
      }

      // Execute search and get results
      const searchResults = await searchQuery.toArray();

      // Transform results to standardized SearchResult format
      const results: SearchResult[] = searchResults.map((result: { [x: string]: any; _distance: any; vector: any; }) => {
        // Extract raw data from result (excluding vector)
        const {
          _distance, // This is the raw distance value
          vector, // Exclude vector from chunk data
          ...metadata
        } = result;

        // Convert LanceDB field names to our DocumentChunk format
        const chunk: DocumentChunk = DocumentUtils.lanceDBRecordToChunk(metadata);

        // Convert distance to normalized similarity score [0, 1]
        // where 1 = most similar, 0 = least similar
        let score = 0;

        switch (config.distanceType) {
          case 'cosine':
            // Cosine distance range is [0, 2]
            // Normalize to [0, 1] similarity score where 1 is perfect match
            score = 1 - ((_distance as number) / 2);
            break;

          case 'dot':
            // For dot product with normalized vectors, range is typically [-1, 1]
            // But actual range depends on vector magnitudes
            // Since higher values are more similar (opposite of other distances),
            // we need a different transformation
            // This assumes vectors are normalized. If not, different normalization is needed.
            score = Math.max(0, Math.min(1, (_distance as number)));
            break;

          default: // 'l2' and others
            // L2 distance range is [0, ∞)
            // Convert to [0, 1] similarity with exponential decay
            score = Math.exp(-(_distance as number));
            break;
        }

        return { chunk, score };
      });

      logger.info(`Found ${results.length} matching chunks with ${config.distanceType} distance`);
      return results;
    } catch (error) {
      logger.error('Error performing similarity search', {
        error: error instanceof Error ? error.message : error,
        query,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Similarity search failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get metadata for all documents
   * @returns Promise resolving to array of document metadata
   */
  public async getDocumentsMetadata() {
    return this.fetchMetadata();
  }

  /**
   * Get metadata for a specific document
   * @param documentId - ID of document to get metadata for
   * @returns Promise resolving to document metadata or null if not found
   */
  public async getDocumentMetadataByID(documentId: string) {
    return this.fetchMetadata(documentId);
  }

  /**
   * Fetch document metadata from the database
   * @param documentId - Optional ID to fetch metadata for a specific document
   * @returns Promise resolving to document metadata
   */
  private async fetchMetadata(documentId?: string) {
    if (!this.isReady || !this.table) {
      throw new Error('LanceDBService not initialized. Call initialize() first.');
    }

    try {
      logger.info(documentId ? `Fetching metadata for document ID: ${documentId}` : 'Fetching documents metadata');

      // Create base query
      let query = this.table.query()
        .select([
          "document_id",
          "filename",
          "title",
          "file_type",
          "file_path",
          "language",
          "file_size",
          "created_at",
          "updated_at"
        ]);

      // Add filter if a specific document is requested
      if (documentId) {
        query = query.where(`document_id = '${documentId}'`).limit(1);
      }

      // Execute query
      const rows = await query.toArray();

      // Handle single document request
      if (documentId) {
        return rows.length > 0 ? {
          documentId: rows[0].document_id,
          filename: rows[0].filename,
          title: rows[0].title,
          fileType: rows[0].file_type,
          filePath: rows[0].file_path,
          language: rows[0].language,
          fileSize: rows[0].file_size,
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at
        } : null;
      }

      // Deduplicate by document_id (since we may have multiple chunks per document)
      const uniqueDocuments = new Map();

      for (const row of rows) {
        const docId = row.document_id;

        if (!uniqueDocuments.has(docId)) {
          uniqueDocuments.set(docId, {
            documentId: docId,
            filename: row.filename,
            title: row.title,
            fileType: row.file_type,
            filePath: row.file_path,
            language: row.language,
            fileSize: row.file_size,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      }

      return Array.from(uniqueDocuments.values());
    } catch (error) {
      const errorMsg = documentId
        ? `Failed to fetch metadata for document ID: ${documentId}`
        : 'Failed to fetch documents metadata';

      logger.error(errorMsg, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });

      throw new Error(`${errorMsg}: ${error instanceof Error ? error.message : error}`);
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