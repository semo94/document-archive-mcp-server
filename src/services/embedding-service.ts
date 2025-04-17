/**
 * Embedding service using local all-MiniLM-L6-v2 model via LangChain
 */
import { logger } from '../utils/logger.js';
import { Embeddings } from "@langchain/core/embeddings";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { EMBEDDING_MODEL } from '../utils/config.js';

/**
 * Service for creating text embeddings using all-MiniLM-L6-v2 model
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddingModel: Embeddings | null = null;
  private isReady: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

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
      
      // Initialize HuggingFace Transformers embeddings
      this.embeddingModel = new HuggingFaceTransformersEmbeddings({
        model: EMBEDDING_MODEL
      });
      
      // Test the model to ensure it's working and download it if needed
      logger.info('Testing embedding model with sample text');
      const testEmbedding = await this.embeddingModel.embedQuery('Test the embedding model initialization');
      
      logger.info('Embedding model initialized successfully', { 
        embeddingDimensions: testEmbedding.length 
      });
      
      this.isReady = true;
    } catch (error) {
      logger.error('Failed to initialize embedding model', { error });
      throw new Error(`Embedding model initialization failed: ${error}`);
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
   * Get the LangChain Embeddings interface
   * @returns Embeddings interface
   * @throws Error if model is not initialized
   */
  public getEmbeddingModel(): Embeddings {
    if (!this.isReady || !this.embeddingModel) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }
    return this.embeddingModel;
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
      return await this.embeddingModel.embedQuery(text);
    } catch (error) {
      logger.error('Error embedding text', { error });
      throw new Error(`Failed to embed text: ${error}`);
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
      logger.error('Error embedding multiple texts', { error });
      throw new Error(`Failed to embed texts: ${error}`);
    }
  }
}
