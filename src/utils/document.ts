/**
 * Document metadata and chunk interfaces aligned with LanceDB storage
 */
import { Document } from '@langchain/core/documents';

/**
 * Document Chunk
 */
export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  filename: string;
  title: string;
  fileType: string;
  filePath: string;
  language: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  fileHash: string;
  pageNumber: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Vector search result with document and relevance info
 */
export interface SearchResult {
  // The document chunk
  chunk: DocumentChunk;
  // Similarity score [0 1] (higher is better)
  score: number;
}

/**
 * Retrieval configuration for different query intents
 */
export interface RetrievalConfig {
  // How to perform the search: 'exact' for full scan vs. 'approximate' for ANN indexes
  indexType: "exact" | "approximate";
  // Number of nearest neighbors to retrieve
  k: number;
  // Which similarity metric to use
  distanceMetric: "cosine" | "euclidean" | "dot";
  // Optional: a factor to refine initial ANN results if using a two-stage process
  refineFactor: number;
  // Include metadata fields in the query result
  includeMetadata?: boolean;
  // Minimum similarity threshold (0-1)
  minScore?: number;
}

// Map intents to retrieval configurations.
// You can adjust these parameters based on your empirical tests.
export const retrievalConfigs: Record<string, RetrievalConfig> = {
  factual_retrieval: { indexType: "exact", k: 10, distanceMetric: "cosine", refineFactor: 1 },
  conceptual_explanation: { indexType: "exact", k: 8, distanceMetric: "cosine", refineFactor: 1 },
  comparative_analysis: { indexType: "approximate", k: 15, distanceMetric: "cosine", refineFactor: 2 },
  historical_context: { indexType: "approximate", k: 12, distanceMetric: "cosine", refineFactor: 2 },
  statistical_data: { indexType: "exact", k: 8, distanceMetric: "cosine", refineFactor: 1 },
  methodological_inquiry: { indexType: "approximate", k: 12, distanceMetric: "cosine", refineFactor: 2 },
  application_examples: { indexType: "exact", k: 10, distanceMetric: "cosine", refineFactor: 1 },
};

export function getRetrievalConfig(intent: string): RetrievalConfig {
  // Default to factual_retrieval configuration if no match is found.
  return retrievalConfigs[intent] || retrievalConfigs["factual_retrieval"];
}


/**
 * Helper functions for document processing
 */
export class DocumentUtils {
  /**
   * Create a LangChain Document from our DocumentChunk
   */
  static chunkToLangChainDoc(chunk: DocumentChunk): Document {
    return new Document({
      id: chunk.chunkId,
      pageContent: chunk.content,
      metadata: {
      document_id: chunk.documentId,
      chunk_index: chunk.chunkIndex,
      filename: chunk.filename,
      title: chunk.title,
      file_type: chunk.fileType,
      file_path: chunk.filePath,
      language: chunk.language,
      file_size: chunk.fileSize,
      created_at: chunk.createdAt,
      updated_at: chunk.updatedAt,
      file_hash: chunk.fileHash,
      page_number: chunk.pageNumber,
      start_index: chunk.startIndex,
      end_index: chunk.endIndex
      }
    });
  }

  /**
   * Create DocumentChunk from LangChain Document result
   */
  static langChainDocToChunk(doc: Document): DocumentChunk {
    return {
      chunkId: doc.id || '',
      content: doc.pageContent,
      documentId: doc.metadata?.document_id || '',
      chunkIndex: doc.metadata?.chunk_index || 0,
      filename: doc.metadata?.filename || '',
      title: doc.metadata?.title || '',
      fileType: doc.metadata?.file_type || '',
      filePath: doc.metadata?.file_path || '',
      language: doc.metadata?.language || 'en',
      fileSize: doc.metadata?.file_size || 0,
      createdAt: doc.metadata?.created_at || '',
      updatedAt: doc.metadata?.updated_at || '',
      fileHash: doc.metadata?.file_hash || '',
      pageNumber: doc.metadata?.page_number || 0,
      startIndex: doc.metadata?.start_index || 0,
      endIndex: doc.metadata?.end_index || 0
    };
  }
}