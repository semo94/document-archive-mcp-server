import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { getRetrievalConfig, intentTypes } from '../utils/document.js';
import { LanceDBService } from '../database/lancedb-service.js';
import { promptTemplates } from '../templates/prompt-templates.js';

/**
 * Registers specific prompts with the MCP server
 * @param server - The MCP server instance
 */
export function registerPrompts(
  server: McpServer,
): void {
  logger.info('Registering prompts');

  server.prompt(
    "document_qa",
    {
      question: z.string().describe("The user's question about the documents"),
      relevantDocIds: z.string().describe("Comma-separated list of relevant document IDs (from the archive)"),
      intentType: z.enum([...intentTypes] as [string, ...string[]]).describe("The intent of the question (select from dropdown)")
    },
    async ({ question, relevantDocIds, intentType }) => {
      // Validate intentType
      if (!intentTypes.includes(intentType)) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: Invalid intent type. Please select one of: ${intentTypes.join(", ")}`
              }
            }
          ]
        };
      }

      // Parse and validate document IDs
      const docIds = relevantDocIds.split(',').map(id => id.trim()).filter(Boolean);
      if (docIds.length === 0) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: No valid documents selected. Please provide valid document IDs from the archive.`
              },
              isError: true
            }
          ]
        };
      }

      // Retrieve relevant context from the vector database
      const dbService = LanceDBService.getInstance();
      const searchResults = await dbService.similaritySearch(question, getRetrievalConfig(intentType), { documentIds: docIds });

      if (!searchResults || searchResults.length === 0) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `No relevant context found for the provided documents.`
              },
              isError: true
            }
          ]
        };
      }

      // Group chunks by document ID
      const documentMap = new Map();

      for (const doc of searchResults) {
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
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptTemplates.documentQA(question, intentType, contextualInformation)
            }
          }
        ]
      };
    }
  );

  logger.info('Prompts registered successfully');
}