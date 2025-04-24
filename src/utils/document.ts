/**
 * Document utilities
 */

/**
 * Document Chunk interface
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
  distanceType: "cosine" | "euclidean" | "dot";
  // Optional: a factor to refine initial ANN results if using a two-stage process
  refineFactor: number;
  // Include metadata fields in the query result
  includeMetadata?: boolean;
}

/**
 * Intent types for document queries
 * These categorize different kinds of information-seeking behaviors
 */
export const intentTypes: string[] = [
  "factual_retrieval",
  "conceptual_explanation",
  "comparative_analysis",
  "historical_context",
  "statistical_data",
  "methodological_inquiry",
  "application_examples"
];

// Map intents to retrieval configurations.
// Optimized for cosine similarity with all-MiniLM-L6-v2
export const retrievalConfigs: Record<string, RetrievalConfig> = {
  factual_retrieval: {
    indexType: "approximate",
    k: 10,
    distanceType: "cosine",
    refineFactor: 2,
  },
  conceptual_explanation: {
    indexType: "approximate",
    k: 8,
    distanceType: "cosine",
    refineFactor: 2,
  },
  comparative_analysis: {
    indexType: "approximate",
    k: 15,
    distanceType: "cosine",
    refineFactor: 3,
  },
  historical_context: {
    indexType: "approximate",
    k: 12,
    distanceType: "cosine",
    refineFactor: 3,
  },
  statistical_data: {
    indexType: "exact",
    k: 8,
    distanceType: "cosine",
    refineFactor: 2,
  },
  methodological_inquiry: {
    indexType: "approximate",
    k: 12,
    distanceType: "cosine",
    refineFactor: 3,
  },
  application_examples: {
    indexType: "approximate",
    k: 10,
    distanceType: "cosine",
    refineFactor: 2,
  },
};


/**
 * Get retrieval configuration for a specific intent
 * @param intent - Query intent type
 * @returns Retrieval configuration
 */
export function getRetrievalConfig(intent: string): RetrievalConfig {
  // Default to factual_retrieval configuration if no match is found.
  return retrievalConfigs[intent] || retrievalConfigs["factual_retrieval"];
}

/**
 * Utility class for document processing
 */
export class DocumentUtils {
  /**
   * Convert DocumentChunk to LanceDB record format
   * @param chunk - Document chunk
   * @param embedding - Vector embedding for the chunk
   * @returns LanceDB record
   */
  static chunkToLanceDBRecord(chunk: DocumentChunk, embedding: number[]): Record<string, any> {
    return {
      vector: embedding,
      document_id: chunk.documentId,
      chunk_id: chunk.chunkId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
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
    };
  }

  /**
   * Convert LanceDB record to DocumentChunk
   * @param record - LanceDB record
   * @returns Document chunk
   */
  static lanceDBRecordToChunk(record: Record<string, any>): DocumentChunk {
    return {
      documentId: record.document_id,
      chunkId: record.chunk_id,
      chunkIndex: record.chunk_index,
      content: record.content,
      filename: record.filename,
      title: record.title,
      fileType: record.file_type,
      filePath: record.file_path,
      language: record.language,
      fileSize: record.file_size,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      fileHash: record.file_hash,
      pageNumber: record.page_number,
      startIndex: record.start_index,
      endIndex: record.end_index
    };
  }
}