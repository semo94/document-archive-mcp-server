import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';

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
      document_id: z.string().describe("The ID of the document to query"),
      question: z.string().describe("The question to ask about the document")
    },
    async ({ document_id, question }) => {
      // TODO: Implement semantic search to find relevant passages
      const relevantPassages = "This would contain relevant document passages...";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please answer the following question based on the provided document context:
Question: ${question}
Context from document ${document_id}:
${relevantPassages}
Answer the question based solely on the information in the context above.`
            }
          }
        ]
      };
    }
  );

  logger.info('prompts registered successfully');
}