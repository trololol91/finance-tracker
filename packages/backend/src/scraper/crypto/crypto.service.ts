import {
    Injectable, InternalServerErrorException
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {
    createCipheriv, createDecipheriv, randomBytes
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128 bits — GCM authentication tag

/**
 * AES-256-GCM symmetric encryption / decryption service.
 *
 * The key is read from the CREDENTIALS_ENCRYPTION_KEY environment variable
 * as a 64-character hex string (32 bytes).  The IV is randomly generated
 * per encryption and prepended to the ciphertext in the stored blob:
 *
 *   <iv_hex>:<ciphertext_hex>:<tag_hex>
 *
 * This service is used exclusively to protect bank credentials at rest.
 * The raw plaintext never leaves the main NestJS process.
 */
@Injectable()
export class CryptoService {
    private readonly key: Buffer;

    constructor(configService: ConfigService) {
        const hexKey = configService.get<string>('CREDENTIALS_ENCRYPTION_KEY');
        if (!hexKey || hexKey.length !== 64) {
            throw new InternalServerErrorException(
                'CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
                    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
            );
        }
        this.key = Buffer.from(hexKey, 'hex');
    }

    /**
     * Encrypt a plaintext string using AES-256-GCM.
     * @returns Encoded string in the format `<iv_hex>:<ciphertext_hex>:<tag_hex>`
     */
    public encrypt(plaintext: string): string {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, this.key, iv, {authTagLength: TAG_LENGTH});
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
    }

    /**
     * Decrypt a ciphertext string produced by {@link encrypt}.
     * @throws InternalServerErrorException if the blob is malformed or authentication fails
     */
    public decrypt(ciphertext: string): string {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) {
            throw new InternalServerErrorException('Invalid encrypted credential blob format');
        }
        const [ivHex, encHex, tagHex] = parts;
        try {
            const iv = Buffer.from(ivHex, 'hex');
            const enc = Buffer.from(encHex, 'hex');
            const tag = Buffer.from(tagHex, 'hex');
            const decipher = createDecipheriv(ALGORITHM, this.key, iv, {authTagLength: TAG_LENGTH});
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
        } catch {
            throw new InternalServerErrorException('Failed to decrypt credentials — key mismatch or corrupted data');
        }
    }
}
