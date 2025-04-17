/**
 * Directory watcher service that monitors for document changes
 */
import chokidar, {FSWatcher} from 'chokidar';
import { logger } from '../utils/logger.js';
import { DocumentProcessor } from './document-processor.js';
import debounce from 'lodash/debounce.js';
import { FILE_EXTENSIONS, WATCH_EXISTING_FILES } from '../utils/config.js';
import path from 'path';
import fs from 'fs';

/**
 * Service for watching directories and processing document changes
 */
export class DirectoryWatcher {
  private static instance: DirectoryWatcher;
  private documentProcessor: DocumentProcessor;
  private watcher: FSWatcher | null = null;
  private isWatching: boolean = false;
  private watchedDirs: Set<string> = new Set();
  private debounceMs: number = 500;
  private processExisting: boolean = WATCH_EXISTING_FILES;
  private allowedExtensions: string[];

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.documentProcessor = DocumentProcessor.getInstance();

    // Extract and normalize file extensions
    this.allowedExtensions = FILE_EXTENSIONS.split(',')
      .map(ext => ext.trim())
      .map(ext => ext.startsWith('.') ? ext : `.${ext}`)
      .filter(ext => ext !== '.');

    logger.info(`Initialized DirectoryWatcher with allowed extensions: ${JSON.stringify(this.allowedExtensions)}`);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DirectoryWatcher {
    if (!DirectoryWatcher.instance) {
      DirectoryWatcher.instance = new DirectoryWatcher();
    }
    return DirectoryWatcher.instance;
  }

  /**
   * Initialize the document processor if needed
   */
  private async ensureDocumentProcessorInitialized(): Promise<void> {
    if (!this.documentProcessor.isInitialized()) {
      await this.documentProcessor.initialize();
    }
  }

  /**
   * Check if a file path has an allowed extension
   */
  private hasAllowedExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedExtensions.includes(ext);
  }

  /**
   * Start watching a directory
   */
  public async watchDirectory(dirPath: string): Promise<void> {
    try {
      logger.info(`Setting up directory watcher for: ${dirPath}`);

      // Ensure processor is initialized
      await this.ensureDocumentProcessorInitialized();

      // Ensure directory exists
      try {
        await fs.promises.access(dirPath, fs.constants.F_OK);
        logger.debug(`Confirmed directory exists: ${dirPath}`);
      } catch (error) {
        logger.error(`Directory does not exist: ${dirPath}`);
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      // Keep track of watched directory
      this.watchedDirs.add(dirPath);

      // Close existing watcher if any
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
        logger.info('Closed existing watcher');
      }

      // IMPORTANT: Use a simpler approach - watch the directory and filter files
      logger.debug(`Creating new chokidar watcher for directory: ${dirPath}`);

      this.watcher = chokidar.watch(dirPath, {
        persistent: true,
        ignoreInitial: !this.processExisting,
        ignored: (path) => {
          // Ignore directories that start with . and files with disallowed extensions
          if (/(^|\/)\.[^\/\.]/g.test(path)) return true;
          if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) return false;
          return !this.hasAllowedExtension(path);
        },
        depth: 10, // Set a reasonable depth limit
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      // Set up event handlers
      this.setupEventHandlers();

      logger.info(`Directory watcher set up successfully for: ${dirPath}`);

      // Register a one-time 'ready' event to log initial stats
      this.watcher.once('ready', () => {
        logger.info('Directory watcher is ready and will now report real-time changes');

        // List files in the directory to check if there are matching files
        this.listFilesInDirectory(dirPath);

        // Log what's being watched
        if (this.watcher) {
          const watched = this.watcher.getWatched();
          logger.info(`Initially watched paths: ${JSON.stringify(watched, null, 2)}`);
        }
      });
    } catch (error) {
      logger.error('Error setting up directory watcher', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to set up directory watcher: ${error}`);
    }
  }

  /**
   * List files in directory to check what should be watched
   */
  private async listFilesInDirectory(dirPath: string): Promise<void> {
    try {
      const readDirectory = async (dir: string, prefix = ''): Promise<string[]> => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(prefix, entry.name);

          if (entry.isDirectory()) {
            const subDirFiles = await readDirectory(fullPath, relativePath);
            files.push(...subDirFiles);
          } else if (this.hasAllowedExtension(entry.name)) {
            files.push(relativePath);
          }
        }

        return files;
      };

      const files = await readDirectory(dirPath);
      logger.info(`Found ${files.length} matching files in ${dirPath}`);
      if (files.length > 0) {
        logger.info(`Existing files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      } else {
        logger.warn(`No matching files found in ${dirPath} with extensions: ${this.allowedExtensions.join(', ')}`);
      }
    } catch (error) {
      logger.error(`Error listing files in directory: ${dirPath}`, { error });
    }
  }

  /**
   * Set up event handlers for the watcher
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return;

    logger.info('Setting up file watcher event handlers');

    // Create a single debounced function for processing files
    const debouncedProcessFile = debounce(async (filePath: string, isNew: boolean = true) => {
      try {
        logger.info(`Processing ${isNew ? 'new' : 'changed'} file: ${filePath}`);

        if (!this.hasAllowedExtension(filePath)) {
          logger.info(`Skipping file with disallowed extension: ${filePath}`);
          return;
        }

        if (!isNew) {
          // For changed files, delete first to avoid duplicates
          await this.documentProcessor.deleteDocument(filePath);
        }
        await this.documentProcessor.processDocument(filePath);
        logger.info(`Successfully processed ${isNew ? 'new' : 'changed'} file: ${filePath}`);
      } catch (error) {
        logger.error(`Error processing ${isNew ? 'new' : 'changed'} file`, {
          error: error instanceof Error ? error.message : String(error),
          filePath
        });
      }
    }, this.debounceMs);

    // Create a debounced function for deleting files
    const debouncedDeleteFile = debounce(async (filePath: string) => {
      try {
        if (!this.hasAllowedExtension(filePath)) {
          logger.info(`Skipping deletion of file with disallowed extension: ${filePath}`);
          return;
        }

        await this.documentProcessor.deleteDocument(filePath);
        logger.info(`Successfully processed deleted file: ${filePath}`);
      } catch (error) {
        logger.error('Error processing deleted file', {
          error: error instanceof Error ? error.message : String(error),
          filePath
        });
      }
    }, this.debounceMs);

    // Set up the main event handlers
    this.watcher
      .on('add', (filePath: string) => {
        logger.info(`File added: ${filePath}`);
        debouncedProcessFile(filePath, true);
      })
      .on('change', (filePath: string) => {
        logger.info(`File changed: ${filePath}`);
        debouncedProcessFile(filePath, false);
      })
      .on('unlink', (filePath: string) => {
        logger.info(`File deleted: ${filePath}`);
        debouncedDeleteFile(filePath);
      })
      .on('error', (error: unknown) => {
        logger.error('Directory watcher error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      });

    this.isWatching = true;
  }

  /**
   * Stop watching directories
   */
  public async stopWatching(): Promise<void> {
    if (this.watcher) {
      logger.info('Stopping directory watcher');
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      this.watchedDirs.clear();
      logger.info('Directory watcher stopped');
    }
  }

  /**
   * Check if watcher is active
   */
  public isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get the list of watched directories
   */
  public getWatchedDirectories(): string[] {
    return Array.from(this.watchedDirs);
  }

  /**
   * Process a single file manually
   */
  public async processFile(filePath: string): Promise<void> {
    logger.info(`Manually processing file: ${filePath}`);

    if (!this.hasAllowedExtension(filePath)) {
      logger.warn(`Cannot process file with disallowed extension: ${filePath}`);
      return;
    }

    await this.ensureDocumentProcessorInitialized();
    await this.documentProcessor.processDocument(filePath);
  }
}