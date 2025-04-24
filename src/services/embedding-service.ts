/**
 * Embedding service for generating vector embeddings
 * Optimized for use with native LanceDB
 */
import { logger } from '../utils/logger.js';
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { EMBEDDING_MODEL } from '../utils/config.js';

/**
 * Service for creating text embeddings using all-MiniLM-L6-v2 model
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddingModel: HuggingFaceTransformersEmbeddings | null = null;
  private isReady: boolean = false;
  private embeddingDimension: number = 384; // all-MiniLM-L6-v2 uses 384 dimensions

  /**
   * Private constructor for singleton pattern
   */
  private constructor() { }

  /**
   * Get singleton instance
   * @returns EmbeddingService singleton instance
   */
  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Initialize the embedding model
   * @returns Promise resolving when model is ready
   */
  public async initialize(): Promise<void> {
    if (this.isReady) {
      logger.debug('Embedding model already initialized');
      return;
    }

    try {
      logger.info('Initializing embedding model', { model: EMBEDDING_MODEL });

      // Initialize HuggingFace Transformers embeddings with correct parameters
      this.embeddingModel = new HuggingFaceTransformersEmbeddings({
        model: EMBEDDING_MODEL,
        // Use correct parameters that are supported by the library
        stripNewLines: true,
      });

      // Test the model to ensure it's working and download it if needed
      logger.info('Testing embedding model with sample text');

      // BUG FIX: Call the model directly instead of using embedText() 
      // embedText() checks this.isReady which is still false at this point
      const testEmbedding = await this.embeddingModel.embedQuery('Test the embedding model initialization');

      // Verify embedding dimension
      if (testEmbedding.length !== this.embeddingDimension) {
        logger.warn(`Unexpected embedding dimension: got ${testEmbedding.length}, expected ${this.embeddingDimension}`);
        // Update the embedding dimension based on the actual model output
        this.embeddingDimension = testEmbedding.length;
      }

      logger.info('Embedding model initialized successfully', {
        embeddingDimensions: testEmbedding.length
      });

      this.isReady = true;
    } catch (error) {
      logger.error('Failed to initialize embedding model', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Embedding model initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check if the embedding model is ready
   * @returns True if model is ready
   */
  public isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Get the embedding model
   * @returns Embedding model instance
   * @throws Error if model is not initialized
   */
  public getEmbeddingModel(): any {
    if (!this.isReady || !this.embeddingModel) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }
    return this.embeddingModel;
  }

  /**
   * Get the embedding dimensions
   * @returns Number of dimensions in the embedding vectors
   */
  public getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }

  /**
   * Generate an embedding for a single text
   * @param text - Text to embed
   * @returns Promise resolving to embedding vector
   */
  public async embedText(text: string): Promise<number[]> {
    if (!this.isReady || !this.embeddingModel) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }

    try {
      const result = await this.embeddingModel.embedQuery(text);

      // Check if the embedding has the expected dimension
      if (result.length !== this.embeddingDimension) {
        logger.warn(`Embedding dimension mismatch: got ${result.length}, expected ${this.embeddingDimension}`);
      }

      return result;
    } catch (error) {
      logger.error('Error embedding text', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to embed text: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   */
  public async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.isReady || !this.embeddingModel) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }

    try {
      return await this.embeddingModel.embedDocuments(texts);
    } catch (error) {
      logger.error('Error embedding multiple texts', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to embed texts: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Normalize a vector to unit length for cosine similarity
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  public normalizeVector(vector: number[]): number[] {
    // Calculate the magnitude (L2 norm)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

    if (magnitude === 0) {
      // Can't normalize a zero vector
      return vector;
    }

    // Divide each element by the magnitude
    return vector.map(val => val / magnitude);
  }
}