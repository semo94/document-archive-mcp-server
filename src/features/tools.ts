import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';

/**
 * Registers specific tools with the MCP server
 * @param server - The MCP server instance
 */
export function registerTools(
  server: McpServer,
): void {
  logger.info('Registering tools');

  server.tool(
    "cross_document_search",
    "Search across all documents for relevant information",
    {
      query: z.string().describe("The search query"),
      max_results: z.number().default(5).describe("Maximum number of results to return")
    },
    async ({ query, max_results }) => {
      // TODO: Implement cross-document semantic search
      const searchResults = [
        {
          document_id: "doc1",
          filename: "example1.pdf",
          passage: "Example relevant passage from document 1..."
        },
        {
          document_id: "doc2",
          filename: "example2.pdf",
          passage: "Example relevant passage from document 2..."
        }
      ];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(searchResults)
          }
        ]
      };
    }
  );

  logger.info('Tools registered successfully');
}