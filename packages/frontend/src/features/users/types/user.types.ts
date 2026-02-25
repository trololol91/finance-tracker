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

/** UI mode for the profile page. */
export type ProfileMode = 'view' | 'edit';
