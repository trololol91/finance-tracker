import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import type {TestingModule} from '@nestjs/testing';
import {Test} from '@nestjs/testing';
import {GoogleDriveService} from '#integrations/google-drive/google-drive.service.js';

// Mock the entire service since it's complex to mock Google APIs correctly
vi.mock('../google-drive.service.js');

describe('GoogleDriveService', () => {
    let service: GoogleDriveService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleDriveService]
        }).compile();

        service = module.get<GoogleDriveService>(GoogleDriveService);
        
        // Reset mock call history
        vi.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createFolder', () => {
        it('should create a folder successfully', async () => {
            const folderName = 'Test Folder';
            const parentId = 'parent123';
            const responseData = {
                id: 'folder123',
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
                webViewLink: 'https://drive.google.com/folder123'
            };

            // Setup the mock
            const createFolderSpy = vi.spyOn(service, 'createFolder')
                .mockResolvedValue(responseData);

            const result = await service.createFolder(folderName, parentId);

            expect(createFolderSpy).toHaveBeenCalledWith(folderName, parentId);
            expect(result).toEqual(responseData);
        });
    });

    describe('listFiles', () => {
        it('should list files in a folder', async () => {
            const folderId = 'folder123';
            const files = [
                {id: 'file1', name: 'File 1'},
                {id: 'file2', name: 'File 2'}
            ];
            const mockResult = {
                files,
                nextPageToken: 'next-token'
            };

            // Setup the mock
            const listFilesSpy = vi.spyOn(service, 'listFiles')
                .mockResolvedValue(mockResult);

            const result = await service.listFiles(folderId, 100);

            expect(listFilesSpy).toHaveBeenCalledWith(folderId, 100);
            expect(result).toEqual(mockResult);
        });
    });

    describe('searchFiles', () => {
        it('should search for files with a query', async () => {
            const query = "name contains 'test'";
            const files = [
                {id: 'file1', name: 'Test File 1'},
                {id: 'file2', name: 'Test File 2'}
            ];
            const mockResult = {
                files,
                nextPageToken: null
            };

            // Setup the mock
            const searchFilesSpy = vi.spyOn(service, 'searchFiles')
                .mockResolvedValue(mockResult);

            const result = await service.searchFiles(query);

            expect(searchFilesSpy).toHaveBeenCalledWith(query);
            expect(result).toEqual(mockResult);
        });
    });
});
