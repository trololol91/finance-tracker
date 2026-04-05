import {
    Injectable, ForbiddenException, NotFoundException, BadRequestException
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateApiTokenDto} from '#api-tokens/dto/create-api-token.dto.js';
import type {
    CreateApiTokenResponseDto, ApiTokenResponseDto
} from '#api-tokens/dto/api-token-response.dto.js';
import * as crypto from 'crypto';

/**
 * Parse a date string as UTC midnight to avoid local-time offset on non-UTC servers.
 * Accepts YYYY-MM-DD or full ISO-8601 timestamps — only the date portion is used.
 * Throws if the date portion does not produce a valid Date (defense-in-depth; the
 * DTO's @IsDateString + @IsFutureDate validators should prevent invalid values first).
 */
const parseUtcDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
        throw new BadRequestException(`Invalid date string: ${dateStr}`);
    }
    return new Date(Date.UTC(y, m - 1, d));
};

@Injectable()
export class ApiTokensService {
    constructor(private readonly prisma: PrismaService) {}

    public async create(
        userId: string,
        userRole: User['role'],
        dto: CreateApiTokenDto
    ): Promise<CreateApiTokenResponseDto> {
        if (dto.scopes.includes('admin') && userRole !== 'ADMIN') {
            throw new ForbiddenException('Only admins can create tokens with admin scope');
        }

        const rawToken = 'ft_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const apiToken = await this.prisma.apiToken.create({
            data: {
                userId,
                name: dto.name,
                tokenHash,
                scopes: [...new Set(dto.scopes)],
                // Parse the date-only string (YYYY-MM-DD) explicitly as UTC midnight to avoid
                // local-time offset issues on non-UTC servers.
                expiresAt: dto.expiresAt ? parseUtcDate(dto.expiresAt) : null
            }
        });

        return {
            id: apiToken.id,
            name: apiToken.name,
            scopes: apiToken.scopes,
            lastUsedAt: apiToken.lastUsedAt,
            expiresAt: apiToken.expiresAt,
            createdAt: apiToken.createdAt,
            token: rawToken
        };
    }

    public async findAll(userId: string): Promise<ApiTokenResponseDto[]> {
        return this.prisma.apiToken.findMany({
            where: {userId, deletedAt: null},
            select: {
                id: true,
                name: true,
                scopes: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true
            },
            orderBy: {createdAt: 'desc'}
        });
    }

    public async remove(userId: string, tokenId: string): Promise<void> {
        const token = await this.prisma.apiToken.findFirst({
            where: {id: tokenId, userId, deletedAt: null}
        });
        if (!token) throw new NotFoundException('Token not found');
        await this.prisma.apiToken.update({
            where: {id: tokenId},
            data: {deletedAt: new Date()}
        });
    }
}
