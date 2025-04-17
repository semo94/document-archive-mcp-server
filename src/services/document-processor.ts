/**
 * Document processor for loading, chunking, and embedding documents using LangChain
 */
import { logger } from '../utils/logger.js';
import { EmbeddingService } from './embedding-service.js';
import { LanceDBService } from '../database/lancedb-service.js';
import { DocumentChunk } from '../utils/document.js';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { Document } from '@langchain/core/documents';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { DOCUMENT_CHUNK_OVERLAP, DOCUMENT_CHUNK_SEPERATOR, DOCUMENT_CHUNK_SIZE } from '../utils/config.js';

/**
 * Supported file types and their corresponding loaders
 */
interface LoaderMapping {
  extensions: string[];
  // Accept any constructor signature for loaderClass
  loaderClass: new (...args: any[]) => any;
  loaderArgs?: any;
}

/**
 * Service for processing documents using LangChain
 */
export class DocumentProcessor {
  private static instance: DocumentProcessor;
  private embeddingService: EmbeddingService;
  private dbService: LanceDBService;
  private isReady: boolean = false;

  /**
   * Mapping of file extensions to appropriate document loaders
   */
  private readonly loaderMappings: LoaderMapping[] = [
    { extensions: ['.txt', '.md'], loaderClass: TextLoader },
    { extensions: ['.pdf'], loaderClass: PDFLoader },
    { extensions: ['.docx', '.doc'], loaderClass: DocxLoader },
    { extensions: ['.csv'], loaderClass: CSVLoader },
    { extensions: ['.json'], loaderClass: JSONLoader },
    // Add more loaders as needed
  ];

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.dbService = LanceDBService.getInstance(this.embeddingService.getEmbeddingModel());
  }

  /**
   * Get singleton instance
   * @returns DocumentProcessor singleton instance
   */
  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  /**
   * Initialize the document processor
   * @returns Promise resolving when processor is ready
   */
  public async initialize(): Promise<void> {
    if (this.isReady) {
      logger.debug('DocumentProcessor already initialized');
      return;
    }

    try {
      logger.info('Initializing DocumentProcessor');

      // Ensure embedding service is initialized
      if (!this.embeddingService.isInitialized()) {
        await this.embeddingService.initialize();
      }

      // Ensure database service is initialized
      if (!this.dbService.isInitialized()) {
        await this.dbService.initialize();
      }

      this.isReady = true;
      logger.info('DocumentProcessor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DocumentProcessor', { error });
      throw new Error(`DocumentProcessor initialization failed: ${error}`);
    }
  }

  /**
   * Check if the processor is ready
   * @returns True if processor is ready
   */
  public isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Process a single document file
   * @param filePath - Path to the document file
   * @returns Promise resolving to an array of processed document chunks
   */
  public async processDocument(filePath: string): Promise<DocumentChunk[]> {
    if (!this.isReady) {
      throw new Error('DocumentProcessor not initialized. Call initialize() first.');
    }

    try {
      // Generate document ID from file path
      const documentId = LanceDBService.generateDocumentId(filePath);
      logger.info(`Processing document: ${path.basename(filePath)}`, { documentId });

      // Extract file info
      const fileStats = await fs.stat(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      // Calculate file hash for change detection
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = createHash('md5').update(fileBuffer).digest('hex');

      // Check for appropriate loader
      const loaderMapping = this.loaderMappings.find(
        mapping => mapping.extensions.includes(fileExt)
      );

      if (!loaderMapping) {
        logger.warn(`No suitable loader found for file type: ${fileExt}`, { filePath });
        throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // Create loader instance
      let loader;
      if (loaderMapping.loaderArgs !== undefined) {
        loader = new loaderMapping.loaderClass(filePath, loaderMapping.loaderArgs);
      } else {
        loader = new loaderMapping.loaderClass(filePath);
      }

      // Load document
      logger.debug(`Loading document content`, { filePath });
      const docs: Document[] = await loader.load();

      if (!Array.isArray(docs) || docs.length === 0) {
        logger.warn(`No content extracted from document`, { filePath });
        throw new Error(`Failed to extract content from document: ${fileName}`);
      }

      // Extract base document metadata
      const baseMetadata = {
        filename: fileName,
        title: this.extractTitle(fileName, docs),
        fileType: fileExt.replace('.', ''),
        filePath: filePath,
        fileHash: fileHash,
        fileSize: fileStats.size,
        language: this.detectLanguage(docs),
      };

      // Chunk document using schema
      logger.debug(`Chunking document`, { documentId });
      const chunks = await this.chunkDocument(docs, documentId, baseMetadata);

      // Store in database
      await this.dbService.upsertChunks(chunks);

      logger.info(`Document processed successfully: ${chunks.length} chunks`, { documentId });
      return chunks;
    } catch (error: any) {
      logger.error('Error processing document', { error: error?.message || error, filePath });
      // Preserve error stack if available
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to process document: ${error}`);
    }
  }

  /**
   * Delete a document and all its chunks
   * @param filePath - Path to the document file
   * @returns Promise resolving to number of chunks deleted
   */
  public async deleteDocument(filePath: string): Promise<number> {
    if (!this.isReady) {
      throw new Error('DocumentProcessor not initialized. Call initialize() first.');
    }

    try {
      const documentId = LanceDBService.generateDocumentId(filePath);
      logger.info(`Deleting document: ${path.basename(filePath)}`, { documentId });

      return await this.dbService.deleteDocument(documentId);
    } catch (error) {
      logger.error('Error deleting document', { error, filePath });
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  /**
   * Chunk a document into smaller pieces with schema
   * @param docs - LangChain documents
   * @param documentId - Document ID
   * @param baseMetadata - Base document metadata
   * @returns Promise resolving to array of document chunks
   */
  private async chunkDocument(
    docs: Document[],
    documentId: string,
    baseMetadata: {
      filename: string;
      title: string;
      fileType: string;
      filePath: string;
      fileHash: string;
      fileSize: number;
      language: string;
    }
  ): Promise<DocumentChunk[]> {
    try {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: DOCUMENT_CHUNK_SIZE,
        chunkOverlap: DOCUMENT_CHUNK_OVERLAP,
        separators: DOCUMENT_CHUNK_SEPERATOR
      });

      const allChunks: DocumentChunk[] = [];
      let chunkIndex = 0;

      // Current timestamp for creation
      const timestamp = new Date().toISOString();

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        // Get page number from document metadata if available
        const pageNumber = doc.metadata.loc?.pageNumber
          ?? doc.metadata.pageNumber
          ?? (docs.length > 1 ? i + 1 : 0);

        const splitDocs = await splitter.splitDocuments([doc]);

        for (const splitDoc of splitDocs) {
          const chunkId = `${documentId}_chunk${chunkIndex}`;

          allChunks.push({
            chunkId: chunkId,
            documentId: documentId,
            chunkIndex: chunkIndex,
            content: splitDoc.pageContent,
            filename: baseMetadata.filename,
            title: baseMetadata.title,
            fileType: baseMetadata.fileType,
            filePath: baseMetadata.filePath,
            language: baseMetadata.language,
            fileSize: baseMetadata.fileSize,
            createdAt: timestamp,
            updatedAt: timestamp,
            fileHash: baseMetadata.fileHash,
            pageNumber: pageNumber,
            startIndex: splitDoc.metadata.startIndex || 0,
            endIndex: splitDoc.metadata.endIndex || splitDoc.pageContent.length
          });

          chunkIndex++;
        }
      }

      return allChunks;
    } catch (error: any) {
      logger.error('Error chunking document', { error: error?.message || error });
      throw error;
    }
  }

  /**
   * Extract a title from filename or document content
   * @param filename - Document filename
   * @param docs - LangChain documents
   * @returns Extracted title
   */
  private extractTitle(filename: string, docs: Document[]): string {
    const titleFromFilename = path.basename(filename, path.extname(filename))
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());

    for (const doc of docs) {
      if (doc.metadata?.title) return doc.metadata.title;
      if (doc.metadata?.metadata?.title) return doc.metadata.metadata.title;
    }

    return titleFromFilename;
  }

  /**
   * Detect language from document content (simplified implementation)
   * @param docs - LangChain documents
   * @returns Language code (defaults to 'en')
   */
  private detectLanguage(docs: Document[]): string {
    for (const doc of docs) {
      if (doc.metadata?.language) return doc.metadata.language;
      if (doc.metadata?.metadata?.language) return doc.metadata.metadata.language;
    }

    return 'en';
  }
}