import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from '../utils/logger.js';
import { sampleDocuments } from '../data/documents.js';

/**
 * Registers specific resources with the MCP server
 * @param server - The MCP server instance
 */
export function registerResources(
  server: McpServer,
): void {
  logger.info('Registering document archive resources');

  // Resource: documents://metadata - Returns a list of all document metadata
  server.resource(
    "document-metadata",
    "documents://metadata",
    async (uri) => {
      logger.debug('Retrieving document metadata');

      try {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(sampleDocuments)
          }]
        };
      } catch (error) {
        logger.error('Error retrieving document metadata', { error });
        throw new Error(`Failed to retrieve document metadata: ${error}`);
      }
    }
  );

  // Resource template for retrieving specific document metadata by ID
  server.resource(
    "document-by-id",
    new ResourceTemplate("document://{id}", { list: undefined }),
    async (uri, { id }) => {
      logger.debug(`Retrieving document with ID: ${id}`);

      try {
        const document = sampleDocuments.find(doc => doc.id === id);

        if (!document) {
          logger.warn(`Document with ID ${id} not found`);
          throw new Error(`Document with ID ${id} not found`);
        }

        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(document)
          }]
        };
      } catch (error) {
        logger.error(`Error retrieving document with ID ${id}`, { error });
        throw new Error(`Failed to retrieve document with ID ${id}: ${error}`);
      }
    }
  );

  logger.info('Document archive resources registered successfully');
}