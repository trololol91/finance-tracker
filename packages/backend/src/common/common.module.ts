import {Module} from '@nestjs/common';
import {GoogleDriveService} from '#integrations/google-drive/google-drive.service.js';
import {GoogleDriveDirectoryService} from '#integrations/google-drive/google-drive-directory.service.js';
import {AdminGuard} from '#common/guards/admin.guard.js';

@Module({
    providers: [
        GoogleDriveService,
        GoogleDriveDirectoryService,
        AdminGuard
    ],
    exports: [
        GoogleDriveService,
        GoogleDriveDirectoryService,
        AdminGuard
    ]
})
export class CommonModule {}
