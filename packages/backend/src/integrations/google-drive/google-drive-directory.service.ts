import {
    Injectable, Logger
} from '@nestjs/common';
import {drive_v3} from 'googleapis';
import {GoogleDriveService} from '@integrations/google-drive/google-drive.service.js';

/**
 * Interface for directory structure template
 */
export interface DirectoryTemplate {
    name: string;
    children?: DirectoryTemplate[];
}

/**
 * Service for handling Google Drive directory operations
 */
@Injectable()
export class GoogleDriveDirectoryService {
    private readonly logger = new Logger(GoogleDriveDirectoryService.name);

    constructor(private readonly googleDriveService: GoogleDriveService) {}

    /**
     * Create a directory in Google Drive
     * @param name Directory name
     * @param parentId Optional parent directory ID
     * @returns Directory metadata including ID
     */
    public async createDirectory(name: string, parentId?: string): Promise<drive_v3.Schema$File> {
        try {
            const result = await this.googleDriveService.createFolder(name, parentId);
            return result;
        } catch (error) {
            this.logger.error(`Failed to create directory: ${name}`, error);
            throw error;
        }
    }

    /**
     * Create a nested directory structure
     * @param path Path segments (e.g., ['Finance', '2025', 'Expenses'])
     * @param rootParentId Optional root parent directory ID
     * @returns Metadata of the deepest created directory
     */
    public async createDirectoryPath(
        path: string[],
        rootParentId?: string
    ): Promise<drive_v3.Schema$File> {
        if (!path.length) {
            throw new Error('Path must contain at least one directory name');
        }

        try {
            let currentParentId = rootParentId;
            let lastCreatedDir: drive_v3.Schema$File | null = null;

            for (const dirName of path) {
                // First, check if directory already exists at this level
                const existingDir = await this.findDirectoryByName(dirName, currentParentId);
        
                if (existingDir) {
                    lastCreatedDir = existingDir;
                    currentParentId = existingDir.id ?? undefined;
                } else {
                    // Create directory if it doesn't exist
                    lastCreatedDir = await this.createDirectory(dirName, currentParentId);
                    currentParentId = lastCreatedDir.id ?? undefined;
                }
            }

            if (!lastCreatedDir) {
                throw new Error('Failed to create directory path');
            }

            return lastCreatedDir;
        } catch (error) {
            this.logger.error(`Failed to create directory path: ${path.join('/')}`, error);
            throw error;
        }
    }

    /**
     * Find a directory by name within a parent directory
     * @param name Directory name to find
     * @param parentId Optional parent directory ID (defaults to root)
     * @returns Directory metadata if found, undefined otherwise
     */
    public async findDirectoryByName(
        name: string,
        parentId = 'root'
    ): Promise<drive_v3.Schema$File | undefined> {
        try {
            const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder'`;
            const parentQuery = parentId !== 'root' ? ` and '${parentId}' in parents` : '';
      
            const results = await this.googleDriveService.searchFiles(
                query + parentQuery,
                10
            );

            return results.files.length > 0 ? results.files[0] : undefined;
        } catch (error) {
            this.logger.error(`Failed to find directory: ${name}`, error);
            throw error;
        }
    }

    /**
     * List subdirectories within a directory
     * @param parentId Parent directory ID (defaults to root)
     * @param pageSize Number of items to return (default: 100)
     * @param pageToken Token for getting the next page of results
     * @returns List of subdirectories
     */
    public async listSubdirectories(
        parentId = 'root',
        pageSize = 100,
        pageToken?: string
    ): Promise<{directories: drive_v3.Schema$File[], nextPageToken?: string | null}> {
        try {
            const queryParts = [
                `'${parentId}' in parents`,
                "mimeType = 'application/vnd.google-apps.folder'",
                'trashed = false'
            ];
            const query = queryParts.join(' and ');
      
            const response = await this.googleDriveService.searchFiles(
                query,
                pageSize,
                pageToken
            );

            return {
                directories: response.files,
                nextPageToken: response.nextPageToken
            };
        } catch (error) {
            this.logger.error(`Failed to list subdirectories in: ${parentId}`, error);
            throw error;
        }
    }

    /**
     * Create or get a directory, ensuring it exists
     * @param name Directory name
     * @param parentId Optional parent directory ID
     * @returns Directory metadata
     */
    public async ensureDirectoryExists(
        name: string,
        parentId?: string
    ): Promise<drive_v3.Schema$File> {
        try {
            // Try to find the directory first
            const existingDir = await this.findDirectoryByName(name, parentId);
      
            if (existingDir) {
                this.logger.log(`Directory already exists: ${name}, ID: ${existingDir.id}`);
                return existingDir;
            }
      
            // Create it if it doesn't exist
            return await this.createDirectory(name, parentId);
        } catch (error) {
            this.logger.error(`Failed to ensure directory exists: ${name}`, error);
            throw error;
        }
    }

    /**
     * Move a directory to another parent directory
     * @param directoryId ID of the directory to move
     * @param newParentId ID of the destination parent directory
     * @returns Updated directory metadata
     */
    public async moveDirectory(
        directoryId: string,
        newParentId: string
    ): Promise<drive_v3.Schema$File> {
        try {
            return await this.googleDriveService.moveFile(directoryId, newParentId);
        } catch (error) {
            const errorMessage = [
                'Failed to move directory ID:',
                directoryId,
                'to parent:',
                newParentId
            ].join(' ');
            this.logger.error(
                errorMessage,
                error
            );
            throw error;
        }
    }

    /**
     * Delete a directory and optionally all its contents
     * @param directoryId ID of the directory to delete
    * @param recursive Whether to recursively delete contents
    * (if false and directory is not empty, will throw an error)
     * @returns True if deletion was successful
     */
    public async deleteDirectory(
        directoryId: string,
        recursive = false
    ): Promise<boolean> {
        try {
            if (recursive) {
                // First, get all files and folders in this directory
                const contents = await this.googleDriveService.listFiles(directoryId, 1000);
        
                // Delete each item
                for (const item of contents.files) {
                    if (item.id) {
                        if (item.mimeType === 'application/vnd.google-apps.folder') {
                            // Recursively delete subdirectories
                            await this.deleteDirectory(item.id, true);
                        } else {
                            // Delete files
                            await this.googleDriveService.deleteFile(item.id);
                        }
                    }
                }
            }
      
            // Finally delete the directory itself
            return await this.googleDriveService.deleteFile(directoryId);
        } catch (error) {
            this.logger.error(`Failed to delete directory ID: ${directoryId}`, error);
            throw error;
        }
    }

    /**
     * Create a complete directory structure based on a template
     * @param template Object representing the directory structure to create
     * @param parentId Optional parent directory ID
     * @returns Metadata of the root created directory
     */
    public async createDirectoryStructure(
        template: DirectoryTemplate,
        parentId?: string
    ): Promise<drive_v3.Schema$File> {
        try {
            // Create the root directory
            const rootDir = await this.createDirectory(template.name, parentId);
      
            // Create children if any
            if (template.children && template.children.length > 0) {
                for (const child of template.children) {
                    await this.createDirectoryStructure(child, rootDir.id ?? undefined);
                }
            }
      
            return rootDir;
        } catch (error) {
            this.logger.error(
                `Failed to create directory structure: ${template.name}`,
                error
            );
            throw error;
        }
    }
}
