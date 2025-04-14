/**
 * Server configuration values - can be overridden by environment variables
 */

// Basic server information
export const SERVER_NAME = process.env.SERVER_NAME || "document-archive-mcp-server";
export const SERVER_VERSION = process.env.SERVER_VERSION || "1.0.0";

// Server capabilities flags
export const ENABLE_RESOURCES = process.env.ENABLE_RESOURCES !== "false";
export const ENABLE_TOOLS = process.env.ENABLE_TOOLS !== "false";
export const ENABLE_PROMPTS = process.env.ENABLE_PROMPTS !== "false";

// Transport configuration
export const DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);
export const TRANSPORT_TYPE = process.env.TRANSPORT_TYPE || "stdio";

// Logger configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
// Safely handle LOG_DIR 
export const LOG_DIR = (() => {
  const dirPath = process.env.LOG_DIR || "logs";
  // If it's an absolute path, use it as is
  // If it's a relative path, keep it as is (it will be resolved relative to CWD later)
  return dirPath;
})();
export const LOG_FILE = process.env.LOG_FILE || "combined.log";
export const ERROR_LOG_FILE = process.env.ERROR_LOG_FILE || "error.log";
export const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING === "true" || process.env.NODE_ENV !== "development";



/**
 * Get server configuration object
 * @returns Server configuration object for McpServer constructor
 */
export function getServerConfig() {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    capabilities: {
      resources: ENABLE_RESOURCES ? {} : undefined,
      tools: ENABLE_TOOLS ? {} : undefined,
      prompts: ENABLE_PROMPTS ? {} : undefined
    }
  };
} 


/**
 * Logs all configuration values and environment variables
 * This is useful for debugging and verifying the server configuration
 */
export function logConfigValues(logger: any) {
  // Helper function to format objects as JSON strings
  const formatObject = (obj: Record<string, any>): string => {
    return JSON.stringify(obj, null, 2);
  };
  
  // Server configuration values
  logger.info('=== SERVER CONFIGURATION ===');
  logger.info(formatObject({
    SERVER_NAME,
    SERVER_VERSION,
    ENABLE_RESOURCES,
    ENABLE_TOOLS,
    ENABLE_PROMPTS,
    DEFAULT_PORT,
    TRANSPORT_TYPE,
    LOG_LEVEL,
    LOG_DIR,
    LOG_FILE,
    ERROR_LOG_FILE,
    ENABLE_FILE_LOGGING
  }));
}