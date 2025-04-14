/**
 * Templates for MCP prompts
 * These define the structure and content of prompts exposed to clients
 */

// Prompt templates for document operations
export const promptTemplates = {
  // Template for document search prompt
  searchDocuments: (query: string) => `Please search my document archive for information about: ${query}

I'd like you to:
1. Find relevant documents in my archive
2. Extract the most useful information related to my query
3. Present the information in a clear, organized way
4. Cite which documents you're referencing

This is an explicit request to consult my personal document archive.`,

  // Template for document analysis prompt
  analyzeDocument: (documentId: string, analysisType: string) => `Please perform a ${analysisType} analysis of the document with ID: ${documentId}

This is an explicit request to:
1. Retrieve the specified document from my archive
2. Perform a ${analysisType} analysis
3. Present your findings in a structured format
4. Include relevant quotes and references from the document

This is an explicit request to consult my personal document archive.`
};