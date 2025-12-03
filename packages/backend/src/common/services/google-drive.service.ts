import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

/**
 * Service for handling Google Drive operations
 */
@Injectable()
export class GoogleDriveService {
    private drive!: drive_v3.Drive;
    private readonly logger = new Logger(GoogleDriveService.name);

    constructor() {
    // Initialize the Google Drive API
    // Note: This requires proper authentication setup
    // You should set up authentication based on your environment (service account, OAuth, etc.)
        this.initializeDrive();
    }

    /**
     * Initialize Google Drive API client
     * You need to implement this based on your authentication approach
     * Options include:
     * - Service account credentials
     * - OAuth2 tokens
     * - API keys (limited functionality)
     */
    private initializeDrive(): void {
        try {
            // Example using service account authentication
            // Replace with your actual authentication method
            // For production, use environment variables for credentials
            const auth = new google.auth.GoogleAuth({
                // This is an example - you should use environment variables
                // scopes: ['https://www.googleapis.com/auth/drive'],
                // keyFile: 'path-to-service-account-key.json', 
            });

            this.drive = google.drive({
                version: 'v3',
                auth,
            });
      
            this.logger.log('Google Drive service initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Google Drive service', error);
            throw error;
        }
    }

    /**
     * Create a new folder in Google Drive
     * @param name Folder name
     * @param parentId Optional parent folder ID
     * @returns Folder metadata including ID
     */
    async createFolder(name: string, parentId?: string): Promise<drive_v3.Schema$File> {
        try {
            const fileMetadata: drive_v3.Schema$File = {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : undefined,
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                fields: 'id, name, mimeType, parents, webViewLink',
            });

            this.logger.log(`Folder created: ${name}, ID: ${response.data.id}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to create folder: ${name}`, error);
            throw error;
        }
    }

    /**
     * Upload a file to Google Drive
     * @param name File name
     * @param content File content (Buffer, string or readable stream)
     * @param mimeType MIME type of the file
     * @param parentId Optional parent folder ID
     * @returns File metadata including ID
     */
    async uploadFile(
        name: string, 
        content: Buffer | string | Readable, 
        mimeType: string, 
        parentId?: string
    ): Promise<drive_v3.Schema$File> {
        try {
            const fileMetadata: drive_v3.Schema$File = {
                name,
                parents: parentId ? [parentId] : undefined,
            };

            // Convert string to buffer if needed
            let fileContent = content;
            if (typeof content === 'string') {
                fileContent = Buffer.from(content);
            }

            const media = {
                mimeType,
                body: fileContent,
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media,
                fields: 'id, name, mimeType, parents, webViewLink, size',
            });

            this.logger.log(`File uploaded: ${name}, ID: ${response.data.id}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to upload file: ${name}`, error);
            throw error;
        }
    }

    /**
     * Download a file from Google Drive
     * @param fileId ID of the file to download
     * @returns File content as a Buffer
     */
    async downloadFile(fileId: string): Promise<{ buffer: Buffer, metadata: drive_v3.Schema$File }> {
        try {
            // Get file metadata
            const metadata = await this.drive.files.get({
                fileId,
                fields: 'id, name, mimeType, size',
            });

            // Get file content
            const response = await this.drive.files.get({
                fileId,
                alt: 'media',
            }, { responseType: 'arraybuffer' });

            const buffer = Buffer.from(response.data as ArrayBuffer);
      
            this.logger.log(`File downloaded: ${metadata.data.name}, ID: ${fileId}`);
            return { buffer, metadata: metadata.data };
        } catch (error) {
            this.logger.error(`Failed to download file ID: ${fileId}`, error);
            throw error;
        }
    }

    /**
     * Update an existing file in Google Drive
     * @param fileId ID of the file to update
     * @param content New file content
     * @param mimeType MIME type of the file
     * @param newName Optional new name for the file
     * @returns Updated file metadata
     */
    async updateFile(
        fileId: string, 
        content: Buffer | string | Readable, 
        mimeType: string, 
        newName?: string
    ): Promise<drive_v3.Schema$File> {
        try {
            const fileMetadata: drive_v3.Schema$File = {};
      
            if (newName) {
                fileMetadata.name = newName;
            }

            // Convert string to buffer if needed
            let fileContent = content;
            if (typeof content === 'string') {
                fileContent = Buffer.from(content);
            }

            const media = {
                mimeType,
                body: fileContent,
            };

            const response = await this.drive.files.update({
                fileId,
                requestBody: fileMetadata,
                media,
                fields: 'id, name, mimeType, parents, webViewLink, size, modifiedTime',
            });

            this.logger.log(`File updated: ${response.data.name}, ID: ${fileId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to update file ID: ${fileId}`, error);
            throw error;
        }
    }

    /**
     * Delete a file or folder from Google Drive
     * @param fileId ID of the file or folder to delete
     * @returns True if deletion was successful
     */
    async deleteFile(fileId: string): Promise<boolean> {
        try {
            await this.drive.files.delete({
                fileId,
            });
      
            this.logger.log(`File/folder deleted: ${fileId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to delete file/folder ID: ${fileId}`, error);
            throw error;
        }
    }

    /**
     * List files and folders in a specific folder
     * @param folderId ID of the folder to list contents of (use 'root' for root folder)
     * @param pageSize Number of items to return (default: 100)
     * @param pageToken Token for getting the next page of results
     * @returns List of files and folders
     */
    async listFiles(
        folderId = 'root', 
        pageSize = 100, 
        pageToken?: string
    ): Promise<{ files: drive_v3.Schema$File[], nextPageToken?: string | null }> {
        try {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                pageSize,
                pageToken,
                fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
            });

            this.logger.log(`Listed ${response.data.files?.length ?? 0} files in folder: ${folderId}`);
            return {
                files: response.data.files ?? [],
                nextPageToken: response.data.nextPageToken ?? null,
            };
        } catch (error) {
            this.logger.error(`Failed to list files in folder: ${folderId}`, error);
            throw error;
        }
    }

    /**
     * Search for files and folders by name or other criteria
     * @param query Search query in Google Drive query format
     * @param pageSize Number of items to return (default: 100)
     * @param pageToken Token for getting the next page of results
     * @returns List of matching files and folders
     */
    async searchFiles(
        query: string,
        pageSize = 100,
        pageToken?: string
    ): Promise<{ files: drive_v3.Schema$File[], nextPageToken?: string | null }> {
        try {
            const response = await this.drive.files.list({
                q: `${query} and trashed = false`,
                pageSize,
                pageToken,
                fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
            });

            this.logger.log(`Found ${response.data.files?.length ?? 0} files matching query: ${query}`);
            return {
                files: response.data.files ?? [],
                nextPageToken: response.data.nextPageToken ?? null,
            };
        } catch (error) {
            this.logger.error(`Failed to search files with query: ${query}`, error);
            throw error;
        }
    }

    /**
     * Move a file or folder to a different folder
     * @param fileId ID of the file or folder to move
     * @param newParentId ID of the destination folder
     * @param removeFromOldParents Whether to remove from current parents (default: true)
     * @returns Updated file metadata
     */
    async moveFile(
        fileId: string, 
        newParentId: string, 
        removeFromOldParents = true
    ): Promise<drive_v3.Schema$File> {
        try {
            // Get current parents to remove them
            let previousParents = '';
      
            if (removeFromOldParents) {
                const file = await this.drive.files.get({
                    fileId,
                    fields: 'parents',
                });

                previousParents = (file.data.parents ?? []).join(',');
            }

            const response = await this.drive.files.update({
                fileId,
                addParents: newParentId,
                removeParents: removeFromOldParents ? previousParents : undefined,
                fields: 'id, name, mimeType, parents, webViewLink',
            });

            this.logger.log(`File moved: ${response.data.name}, ID: ${fileId}, to folder: ${newParentId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to move file ID: ${fileId} to folder: ${newParentId}`, error);
            throw error;
        }
    }

    /**
     * Copy a file in Google Drive
     * @param fileId ID of the file to copy
     * @param newName Optional new name for the copy
     * @param parentId Optional parent folder ID for the copy
     * @returns Metadata of the new copy
     */
    async copyFile(
        fileId: string, 
        newName?: string, 
        parentId?: string
    ): Promise<drive_v3.Schema$File> {
        try {
            const fileMetadata: drive_v3.Schema$File = {};
      
            if (newName) {
                fileMetadata.name = newName;
            }
      
            if (parentId) {
                fileMetadata.parents = [parentId];
            }

            const response = await this.drive.files.copy({
                fileId,
                requestBody: fileMetadata,
                fields: 'id, name, mimeType, parents, webViewLink, size',
            });

            this.logger.log(`File copied: ${response.data.name}, ID: ${response.data.id}, from file: ${fileId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to copy file ID: ${fileId}`, error);
            throw error;
        }
    }

    /**
     * Get metadata for a file or folder
     * @param fileId ID of the file or folder
     * @returns File metadata
     */
    async getFileMetadata(fileId: string): Promise<drive_v3.Schema$File> {
        try {
            const response = await this.drive.files.get({
                fileId,
                fields: 'id, name, mimeType, parents, size, createdTime, modifiedTime, webViewLink, description',
            });

            this.logger.log(`Retrieved metadata for file: ${response.data.name}, ID: ${fileId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get metadata for file ID: ${fileId}`, error);
            throw error;
        }
    }
}
