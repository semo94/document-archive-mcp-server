# MCP Server

A Model Context Protocol (MCP) server implementation using Node.js and TypeScript.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs (Large Language Models). It allows for seamless communication between AI applications and various data sources and tools.

## Features

This server implementation provides:

- Cross-document search tool for retrieving relevant information
- Document management with document listing and metadata resources
- Document Q&A prompt template for answering questions about documents
- Support for both stdio and SSE transport methods
- Comprehensive logging system
- Configuration via environment variables

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Running the Server

#### Using stdio (for integration with MCP clients)

```bash
npm start
```

#### Using SSE (for web-based usage)

```bash
npm start -- --transport=sse
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable or using the port argument:

```bash
npm start -- --transport=sse --port=8080
```

Or:

```bash
PORT=8080 npm start -- --transport=sse
```

## API

### Tools

- `cross_document_search`: Search across documents for relevant information
  - Parameters: 
    - `query` (string): The search query
    - `max_results` (number, default: 5): Maximum number of results to return

### Resources

- `documents://list`: Get a list of available documents
- `document://{id}`: Get metadata for a specific document

### Prompts

- `document_qa`: Q&A about document content
  - Parameters:
    - `document_id` (string): The ID of the document to query
    - `question` (string): The question to ask about the document

## Configuration

The server can be configured through environment variables:

- `SERVER_NAME`: Name of the server (default: "document-archive-mcp-server")
- `SERVER_VERSION`: Server version (default: "1.0.0")
- `ENABLE_RESOURCES`: Enable/disable resources (default: true)
- `ENABLE_TOOLS`: Enable/disable tools (default: true)
- `ENABLE_PROMPTS`: Enable/disable prompts (default: true)
- `PORT`: Default port for SSE transport (default: 3000)
- `TRANSPORT_TYPE`: Default transport type (default: "stdio")
- `LOG_LEVEL`: Log level (default: "info")
- `LOG_DIR`: Directory for log files (default: "logs")
- `LOG_FILE`: Main log file name (default: "combined.log")
- `ERROR_LOG_FILE`: Error log file name (default: "error.log")
- `ENABLE_FILE_LOGGING`: Enable file logging (default: true in production, false in development)

## Development

To run the server in development mode with auto-reloading:

```bash
npm run dev
```

For SSE transport in development mode:

```bash
npm run dev -- --transport=sse
```

## License

ISC 