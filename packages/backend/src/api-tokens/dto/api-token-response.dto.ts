export class ApiTokenResponseDto {
    id!: string;
    name!: string;
    scopes!: string[];
    lastUsedAt!: Date | null;
    expiresAt!: Date | null;
    createdAt!: Date;
}

export class CreateApiTokenResponseDto extends ApiTokenResponseDto {
    /** Raw token — returned ONCE only at creation time */
    token!: string;
}
