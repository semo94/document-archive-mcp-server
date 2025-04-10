import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from '../utils/logger.js';

interface DocumentMetadata {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
  mimeType: string;
}

/**
 * Registers specific resources with the MCP server
 * @param server - The MCP server instance
 */
export function registerResources(
  server: McpServer,
): void {
  logger.info('Registering resources');

  // Resource: documents://list
  server.resource(
    "document-list",
    "documents://list",
    async (uri) => {
      // TODO: Implement document list retrieval
      const documentList: DocumentMetadata[] = [
        /* This would be populated with actual documents */
      ];

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(documentList)
        }]
      };
    }
  );

  // Resource: document://{id}
  server.resource(
    "document-info",
    new ResourceTemplate("document://{id}", { list: undefined }),
    async (uri, { id }) => {
      // TODO: Implement document metadata retrieval
      const documentMetadata: DocumentMetadata = {
        id: id as string,
        filename: "example.pdf",
        createdAt: new Date().toISOString(),
        size: 0,
        mimeType: "application/pdf"
      };

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(documentMetadata)
        }]
      };
    }
  );

  logger.info('Resources registered successfully');
}