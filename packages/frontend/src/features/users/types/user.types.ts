/**
 * User feature types — frontend-specific only.
 *
 * Do NOT redefine types that Orval already generates:
 *   - UserResponseDto  → src/api/model/userResponseDto.ts
 *   - UpdateUserDto    → src/api/model/updateUserDto.ts
 *
 * API hooks (src/api/users/users.ts):
 *   - useUsersControllerFindOne(id)           — GET  /users/:id
 *   - useUsersControllerUpdate()              — PATCH /users/:id
 *   - useUsersControllerRemove()              — DELETE /users/:id
 */

import type {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';

/** UI mode for the profile page. */
export type ProfileMode = 'view' | 'edit';

/** Form state for the profile edit form. */
export interface ProfileFormState {
    firstName: string;
    lastName: string;
    timezone: string;
    currency: UpdateUserDtoCurrency;
}

/**
 * Minimal user data shape needed to render the profile view.
 * Compatible with both UserResponseDto (from API) and User (from auth context).
 */
export interface ProfileDisplayData {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    timezone: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
}
