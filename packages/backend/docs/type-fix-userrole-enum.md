# Type Fix: UserRoleEnum -> Prisma UserRole

## Problem

A custom TypeScript enum `UserRoleEnum` was defined locally in `update-user-role.dto.ts`:

```typescript
// WRONG — was defined locally
export enum UserRoleEnum {
    USER = 'USER',
    ADMIN = 'ADMIN',
}
```

This custom enum was structurally identical to Prisma's generated `UserRole` type but was a
different TypeScript type. When the service method accepted `UserRole` (from Prisma) and the
controller passed `UserRoleEnum` (from the DTO), TypeScript raised a type assignability error:

```
Type 'UserRoleEnum' is not assignable to type 'UserRole'
```

Prisma generates `UserRole` as a `const` object with a derived union type:

```typescript
export const UserRole = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
```

A hand-written `enum` produces a distinct nominal-like type that TypeScript will not automatically
widen to the Prisma-generated union, even when the string values are identical.

## Files Changed

| File | Change |
|------|--------|
| `src/users/dto/update-user-role.dto.ts` | Removed `UserRoleEnum`; imported `UserRole` from `#generated/prisma/enums.js` |
| `src/users/dto/admin-user-list-item.dto.ts` | Replaced local enum reference with `UserRole` from `#generated/prisma/enums.js` |
| `src/users/users.service.ts` | Changed import of `UserRole` from local DTO to `#generated/prisma/enums.js`; switched to `type` import |
| `src/users/__TEST__/users.service.spec.ts` | Replaced `UserRoleEnum` references with `UserRole` from `#generated/prisma/enums.js` |
| `src/users/__TEST__/admin-users.controller.spec.ts` | Replaced `UserRoleEnum` references with `UserRole` from `#generated/prisma/enums.js` |

## Correct Pattern for Prisma Enum Types in DTOs

Always import enum types directly from the Prisma-generated output. Never redeclare them locally.

### Import location

```typescript
// Enums only
import { UserRole } from '#generated/prisma/enums.js';

// Full Prisma client types (models, enums, and more)
import { UserRole } from '#generated/prisma/client.js';
```

Either import path works; `enums.js` is preferred when you only need the enum to keep the import
surface minimal.

### DTO example

```typescript
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '#generated/prisma/enums.js';

export class UpdateUserRoleDto {
    @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
    @IsEnum(UserRole)
    role!: UserRole;
}
```

### Response DTO example

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '#generated/prisma/enums.js';

export class AdminUserListItemDto {
    @ApiProperty({ enum: UserRole, example: UserRole.USER })
    role!: UserRole;
}
```

### Service example

```typescript
import type { UserRole } from '#generated/prisma/enums.js';

public async updateRole(userId: string, role: UserRole): Promise<AdminUserListItemDto> {
    // role is now compatible with prisma.user.update({ data: { role } })
}
```

### Key rules

1. **Never define a local enum that mirrors a Prisma enum.** The two types will be structurally
   similar but nominally distinct, causing assignability errors at service boundaries.
2. **Use `type` imports** for enum types that are only referenced in type positions (function
   signatures, interface fields). This avoids emitting unnecessary runtime imports.
3. **Use value imports** (no `type` keyword) when the enum object itself is needed at runtime —
   for example, in `@IsEnum(UserRole)` or `@ApiProperty({ enum: UserRole })` decorators.
4. **Follow the same pattern for all other Prisma enums** (e.g. `AccountType`, `TransactionType`)
   — always source them from `#generated/prisma/enums.js` or `#generated/prisma/client.js`.

## Reference: AccountType (canonical example)

The `accounts` feature uses the same pattern correctly and can serve as a reference:

```typescript
// packages/backend/src/accounts/dto/create-account.dto.ts
import { AccountType } from '#generated/prisma/client.js';
```
