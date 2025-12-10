import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveDirectoryService } from '@integrations/google-drive/google-drive-directory.service.js';
import { GoogleDriveService } from '@integrations/google-drive/google-drive.service.js';
import { drive_v3 } from 'googleapis';

describe('GoogleDriveDirectoryService', () => {
    let service: GoogleDriveDirectoryService;
    let mockGoogleDriveService: {
        createFolder: ReturnType<typeof vi.fn>;
        searchFiles: ReturnType<typeof vi.fn>;
        listFiles: ReturnType<typeof vi.fn>;
        moveFile: ReturnType<typeof vi.fn>;
        deleteFile: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockGoogleDriveService = {
            createFolder: vi.fn(),
            searchFiles: vi.fn(),
            listFiles: vi.fn(),
            moveFile: vi.fn(),
            deleteFile: vi.fn(),
        };

        service = new GoogleDriveDirectoryService(mockGoogleDriveService as unknown as GoogleDriveService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createDirectory', () => {
        it('should create a directory successfully', async () => {
            const folderName = 'Test Folder';
            const parentId = 'parent123';
            const expectedResponse: drive_v3.Schema$File = {
                id: 'folder123',
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            };

            mockGoogleDriveService.createFolder.mockResolvedValue(expectedResponse);

            const result = await service.createDirectory(folderName, parentId);

            expect(mockGoogleDriveService.createFolder).toHaveBeenCalledWith(folderName, parentId);
            expect(result).toEqual(expectedResponse);
        });

        it('should handle errors when creating a directory', async () => {
            const folderName = 'Test Folder';
            const error = new Error('Failed to create folder');

            mockGoogleDriveService.createFolder.mockRejectedValue(error);

            await expect(service.createDirectory(folderName)).rejects.toThrow(error);
        });
    });

    describe('findDirectoryByName', () => {
        it('should find a directory by name', async () => {
            const dirName = 'Test Directory';
            const parentId = 'parent123';
            const expectedResponse = {
                files: [
                    {
                        id: 'dir123',
                        name: dirName,
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                ],
                nextPageToken: null,
            };

            mockGoogleDriveService.searchFiles.mockResolvedValue(expectedResponse);

            const result = await service.findDirectoryByName(dirName, parentId);

            expect(mockGoogleDriveService.searchFiles).toHaveBeenCalledWith(
                `name = '${dirName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents`,
                10,
            );
            expect(result).toEqual(expectedResponse.files[0]);
        });

        it('should return undefined when directory not found', async () => {
            const dirName = 'Nonexistent Directory';
            
            mockGoogleDriveService.searchFiles.mockResolvedValue({
                files: [],
                nextPageToken: null,
            });

            const result = await service.findDirectoryByName(dirName);

            expect(result).toBeUndefined();
        });
    });

    describe('createDirectoryPath', () => {
        it('should create a nested directory path', async () => {
            const path = ['Finance', '2025', 'Expenses'];
            const rootParentId = 'root123';

            // Mock the behavior for findDirectoryByName and createDirectory
            mockGoogleDriveService.searchFiles
                // First directory doesn't exist
                .mockResolvedValueOnce({ files: [], nextPageToken: null })
                // Second directory doesn't exist
                .mockResolvedValueOnce({ files: [], nextPageToken: null })
                // Third directory doesn't exist
                .mockResolvedValueOnce({ files: [], nextPageToken: null });

            // Mock the createFolder responses
            mockGoogleDriveService.createFolder
                .mockResolvedValueOnce({ id: 'finance123', name: 'Finance' })
                .mockResolvedValueOnce({ id: '2025123', name: '2025' })
                .mockResolvedValueOnce({ id: 'expenses123', name: 'Expenses' });

            const result = await service.createDirectoryPath(path, rootParentId);

            // Should have called createFolder for each directory in the path
            expect(mockGoogleDriveService.createFolder).toHaveBeenCalledTimes(3);
            expect(mockGoogleDriveService.createFolder).toHaveBeenNthCalledWith(1, 'Finance', rootParentId);
            expect(mockGoogleDriveService.createFolder).toHaveBeenNthCalledWith(2, '2025', 'finance123');
            expect(mockGoogleDriveService.createFolder).toHaveBeenNthCalledWith(3, 'Expenses', '2025123');
            
            expect(result).toEqual({ id: 'expenses123', name: 'Expenses' });
        });
    });
});
