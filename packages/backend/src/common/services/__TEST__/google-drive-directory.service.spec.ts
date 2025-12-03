import { Test, TestingModule } from '@nestjs/testing';
import { GoogleDriveDirectoryService } from '../google-drive-directory.service';
import { GoogleDriveService } from '../google-drive.service';
import { drive_v3 } from 'googleapis';

describe('GoogleDriveDirectoryService', () => {
    let service: GoogleDriveDirectoryService;
    let googleDriveService: GoogleDriveService;

    const mockGoogleDriveService = {
        createFolder: jest.fn(),
        searchFiles: jest.fn(),
        listFiles: jest.fn(),
        moveFile: jest.fn(),
        deleteFile: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleDriveDirectoryService,
                {
                    provide: GoogleDriveService,
                    useValue: mockGoogleDriveService,
                },
            ],
        }).compile();

        service = module.get<GoogleDriveDirectoryService>(GoogleDriveDirectoryService);
        googleDriveService = module.get<GoogleDriveService>(GoogleDriveService);
        expect(googleDriveService).toBeDefined();

        // Clear all mocks before each test
        jest.clearAllMocks();
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
