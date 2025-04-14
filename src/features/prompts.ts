import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { sampleDocuments } from '../data/documents.js';
import { documentContent } from '../data/content.js';
import { intentTypes } from '../data/intent-types.js';
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
      const selectedDocs = sampleDocuments.filter(doc => docIds.includes(doc.id));
      if (selectedDocs.length === 0) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: No valid documents selected. Please provide valid document IDs from the archive.`
              }
            }
          ]
        };
      }
      // Gather context from selected documents
      const contextualInformation = selectedDocs.map(doc => {
        const passages = documentContent[doc.id as keyof typeof documentContent] || [];
        return {
          documentId: doc.id,
          title: doc.title,
          author: doc.author,
          publicationDate: doc.publicationDate,
          relevantPassages: passages
        };
      });
      // Build the prompt message using the template
      const contextText = contextualInformation.map(docInfo =>
        `Document: ${docInfo.title} (ID: ${docInfo.documentId})\nAuthor: ${docInfo.author}\nPublished: ${docInfo.publicationDate}\nPassages:\n- ${docInfo.relevantPassages.join("\n- ")}`
      ).join("\n\n");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptTemplates.documentQA(question, intentType, contextText)
            }
          }
        ]
      };
    }
  );

  logger.info('prompts registered successfully');
}