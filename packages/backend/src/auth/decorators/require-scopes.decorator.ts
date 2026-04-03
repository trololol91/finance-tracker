import {SetMetadata} from '@nestjs/common';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';

export const SCOPES_KEY = 'required_scopes';
export const RequireScopes = (...scopes: ApiTokenScope[]): ReturnType<typeof SetMetadata> =>
    SetMetadata(SCOPES_KEY, scopes);
