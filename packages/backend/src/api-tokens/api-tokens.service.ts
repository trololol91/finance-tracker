import {
    Injectable, ForbiddenException, NotFoundException
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import type {CreateApiTokenDto} from '#api-tokens/dto/create-api-token.dto.js';
import type {
    CreateApiTokenResponseDto, ApiTokenResponseDto
} from '#api-tokens/dto/api-token-response.dto.js';
import * as crypto from 'crypto';

@Injectable()
export class ApiTokensService {
    constructor(private readonly prisma: PrismaService) {}

    public async create(
        userId: string,
        userRole: string,
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
                scopes: dto.scopes,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
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
        const tokens = await this.prisma.apiToken.findMany({
            where: {userId, deletedAt: null},
            orderBy: {createdAt: 'desc'}
        });
        return tokens.map(
            ({tokenHash: _th, deletedAt: _da, updatedAt: _ua, userId: _uid, ...rest}) => rest
        );
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
