/**
 * Templates for MCP prompts
 * These define the structure and content of prompts exposed to clients
 */

// Prompt templates for document operations
export const promptTemplates = {
  // Template for document Q&A prompt
  documentQA: (question: string, intentType: string, contextText: object) =>
    `You are answering a user question using the provided document context.\n` +
    `Question intent: ${intentType}\n` +
    `Question: ${question}\n` +
    `\nContext from selected documents in a stringified JSON format:\n${JSON.stringify(contextText)}\n` +
    `\nAnswer the question based solely on the information in the context above. Cite document titles where appropriate. If the context does not contain the answer, say so explicitly.`
};