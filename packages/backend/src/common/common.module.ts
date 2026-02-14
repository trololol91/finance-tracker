import {Module} from '@nestjs/common';
import {GoogleDriveService} from '@integrations/google-drive/google-drive.service.js';
import {GoogleDriveDirectoryService} from '@integrations/google-drive/google-drive-directory.service.js';

@Module({
    providers: [
        GoogleDriveService,
        GoogleDriveDirectoryService
    ],
    exports: [
        GoogleDriveService,
        GoogleDriveDirectoryService
    ]
})
export class CommonModule {}
