import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { toolDescriptions, instructionTemplates } from '../templates/tool-instructions.js';
import { getRetrievalConfig, intentTypes } from "../utils/document.js";
import { LanceDBService } from '../database/lancedb-service.js';

/**
 * Registers specific tools with the MCP server
 * @param server - The MCP server instance
 */
export function registerTools(
  server: McpServer,
): void {
  logger.info('Registering document archive tools');

  // Tool 1: getDocumentsMetadata
  // Retrieves metadata of available documents when archive consultation is warranted
  server.tool(
    "getDocumentsMetadata",
    toolDescriptions.getDocumentsMetadata,
    {
      query: z.string().describe("The user's original query or question"),
    },
    async ({ query }) => {
      logger.info('getDocumentsMetadata tool called', { query });

      const dbService = LanceDBService.getInstance();
      const documentsMetaData = await dbService.getDocumentsMetadata();

      try {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                documents: documentsMetaData,
                instructions: instructionTemplates.documentsMetadataInstructions(query)
              })
            }
          ]
        };
      } catch (error) {
        logger.error('Error in getDocumentsMetadata tool', { error, query });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to retrieve document metadata",
                message: `${error}`
              })
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 2: checkQueryRelevance
  // Takes assessment of relevant documents and returns instructions for intent analysis
  server.tool(
    "checkQueryRelevance",
    toolDescriptions.checkQueryRelevance,
    {
      query: z.string().describe("The user's original query or question"),
      relevantDocIds: z.string().describe("Comma-separated list of document IDs that appear relevant to the query"),
    },
    async ({ query, relevantDocIds }) => {
      logger.info('checkQueryRelevance tool called', { query, relevantDocIds });

      try {
        // Parse document IDs
        const docIds = relevantDocIds.split(',').map(id => id.trim());

        if (docIds.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  instructions: `No relevant documents were found. Inform user that there's no relevant information in their archive.`,
                })
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                intentTypes: intentTypes,
                instructions: instructionTemplates.queryRelevanceInstructions,
              })
            }
          ]
        };
      } catch (error) {
        logger.error('Error in checkQueryRelevance tool', { error, query, relevantDocIds });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to check query relevance",
                message: `${error}`
              })
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 3: analyzeIntent
  // Takes intent classification and returns instructions for context retrieval
  server.tool(
    "analyzeIntent",
    toolDescriptions.analyzeIntent,
    {
      query: z.string().describe("The user's original query or question"),
      intentType: z.string().describe("The classified intent type of the query"),
    },
    async ({ query, intentType }) => {
      logger.info('analyzeIntent tool called', { query, intentType });

      try {
        // Validate intent type
        if (!intentTypes.includes(intentType)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Invalid intent type",
                  validIntentTypes: intentTypes,
                  message: `Please select a valid intent type from the list provided.`
                })
              }
            ],
            isError: true
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                analyzedIntent: intentType,
                instructions: instructionTemplates.intentAnalysisInstructions(intentType)
              })
            }
          ]
        };
      } catch (error) {
        logger.error('Error in analyzeIntent tool', { error, query, intentType });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to analyze query intent",
                message: `${error}`
              })
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 4: retrieveContext
  // Retrieves relevant passages from selected documents
  server.tool(
    "retrieveContext",
    toolDescriptions.retrieveContext,
    {
      query: z.string().describe("The user's original query or question"),
      intentType: z.string().describe("The classified intent type of the query"),
      relevantDocIds: z.string().describe("Comma-separated list of document IDs to retrieve context from"),
    },
    async ({ query, intentType, relevantDocIds }) => {
      logger.info('retrieveContext tool called', { query, intentType, relevantDocIds });

      try {
        // Parse document IDs
        const docIds = relevantDocIds.split(',').map(id => id.trim());

        // Prepare retrieval configuration and filter
        const config = getRetrievalConfig(intentType);
        const filter= {
          documentIds: docIds
        };

        const dbService = LanceDBService.getInstance();
        const searchResult = await dbService.similaritySearch(query, config, filter);
        logger.info('Search result', { searchResult });

        if (searchResult.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "No valid documents were found",
                  message: "No relevant documents were found for the given query."
                })
              }
            ],
            isError: true
          };
        }

        // Group chunks by document ID
        const documentMap = new Map();

        for (const doc of searchResult) {
          const { documentId, title, filename, fileType, language, content } = doc.chunk;

          if (!documentMap.has(documentId)) {
            // Create a new document entry if it doesn't exist
            documentMap.set(documentId, {
              metadata: {
                documentId,
                title,
                filename,
                fileType,
                language
              },
              context: []
            });
          }

          // Add the chunk content to the document's context array
          documentMap.get(documentId).context.push(content);
        }

        // Convert the map to an array for the final response
        const contextualInformation = Array.from(documentMap.values());
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                contextualInformation: contextualInformation,
                instructions: instructionTemplates.contextUsageInstructions
              })
            }
          ]
        };
      } catch (error) {
        logger.error('Error in retrieveContext tool', { error, query, intentType, relevantDocIds });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to retrieve document context",
                message: `${error}`
              })
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info('Document archive tools registered successfully');
}