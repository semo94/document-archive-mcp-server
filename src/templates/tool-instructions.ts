/**
 * Templates for tool instructions and descriptions
 * These provide guidance to LLMs on how to use the tools effectively
 */

// Tool descriptions - used when registering tools with the MCP server
export const toolDescriptions = {
  getDocumentsMetadata: `Retrieves a list of available documents from the personal archive. 
ONLY use this tool when:
1. The user explicitly asks to search their documents or archive
2. The user's query implicitly suggests that consulting their personal document archive would provide valuable information
3. The query is about a specific topic that likely requires domain knowledge from stored documents

DO NOT use this tool for:
- General knowledge questions that don't require personalized document context
- Queries that can be answered with your built-in knowledge

This tool helps determine if relevant documents exist in the user's personal archive.`,

  checkQueryRelevance: `Checks the relevance of specific documents to the user's query and provides guidance for intent analysis.
Use this tool AFTER getDocumentsMetadata to validate document selection and prepare for deeper intent analysis.
This tool bridges initial document selection and refined intent understanding.`,

  analyzeIntent: `Analyzes the user's query intent to optimize document context retrieval.
Use this tool AFTER checkQueryRelevance to refine understanding of what the user is seeking.
This tool helps determine HOW to extract and present information from relevant documents.`,

  retrieveContext: `Retrieves highly relevant contextual passages from selected documents based on query and intent analysis.
This is the final step in the document consultation workflow.
The tool returns specific contextual information from documents that you can seamlessly integrate into your response.`
};

// Instruction templates for tool responses
export const instructionTemplates = {
  // Instructions returned with document metadata
  documentsMetadataInstructions: (query: string) => `
Based on the user's query: "${query}", review these document metadata entries to determine which documents might contain relevant information.

For each document, assess:
1. Topic relevance: How closely the document's subject aligns with the query
2. Information recency: Whether the document's publication date is appropriate for the query
3. Specificity match: Whether the document's scope matches the specificity of the query

Next, call the 'checkQueryRelevance' tool with:
- The original query
- A comma-separated list of relevant document IDs
`,

  // Instructions for query relevance assessment
  queryRelevanceInstructions: `
Now analyze the user's query intent to determine precisely what information to extract from the selected documents.

Consider these intent types:
- factual_retrieval: Seeking specific facts or data points
- conceptual_explanation: Seeking understanding of concepts or theories
- comparative_analysis: Seeking comparisons between different elements
- historical_context: Seeking historical development or background
- statistical_data: Seeking numbers, trends, or quantitative information
- methodological_inquiry: Seeking information about processes or methods
- application_examples: Seeking practical applications or case studies

Next, call the 'analyzeIntent' tool with:
- The original query
- The most appropriate intent type from the list above
`,

  // Instructions for intent analysis
  intentAnalysisInstructions: (intentType: string) => `
Based on the query intent analysis (${intentType}), you should now retrieve specific contextual information from the selected documents.

Next, call the 'retrieveContext' tool with:
- The original query
- The intent type (${intentType})
- The comma-separated list of relevant document IDs
`,

  // Instructions for using retrieved context
  contextUsageInstructions: `
Integrate this contextual information naturally into your response to the user's query.
Important guidelines:
1. Do not mention the document retrieval process unless the user explicitly asked about their documents
2. Blend the document information seamlessly with your general knowledge
3. Cite sources where appropriate (e.g., "According to [Document Title]...")
4. Prioritize the most relevant information from the retrieved passages
5. Maintain a conversational tone while incorporating the specialized information
`
};