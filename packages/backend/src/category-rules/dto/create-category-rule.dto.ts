import {
    ApiProperty, ApiPropertyOptional
} from '@nestjs/swagger';
import {
    IsString, IsUUID, IsNotEmpty, MaxLength, IsOptional, IsBoolean
} from 'class-validator';

export class CreateCategoryRuleDto {
    @ApiProperty({description: 'Case-insensitive substring to match against transaction descriptions'})
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    declare pattern: string;

    @ApiProperty({description: 'Category UUID to assign when the pattern matches'})
    @IsUUID()
    declare categoryId: string;

    @ApiPropertyOptional({
        description: 'If true, immediately apply this rule to existing uncategorized transactions',
        default: false
    })
    @IsOptional()
    @IsBoolean()
    declare applyToExisting?: boolean;
}
