import { Module } from '@nestjs/common';
import { GoogleDriveService } from './services/google-drive.service';
import { GoogleDriveDirectoryService } from './services/google-drive-directory.service';

@Module({
    providers: [
        GoogleDriveService,
        GoogleDriveDirectoryService,
    ],
    exports: [
        GoogleDriveService,
        GoogleDriveDirectoryService,
    ],
})
export class CommonModule {}
