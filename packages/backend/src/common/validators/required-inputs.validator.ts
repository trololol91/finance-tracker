import {Injectable} from '@nestjs/common';
import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator';
import {ScraperRegistry} from '#scraper/scraper.registry.js';

@ValidatorConstraint({name: 'requiredInputs', async: false})
@Injectable()
export class RequiredInputsConstraint implements ValidatorConstraintInterface {
    private failedKey: string | undefined;

    constructor(private readonly scraperRegistry: ScraperRegistry) {}

    public validate(_value: unknown, args: ValidationArguments): boolean {
        const obj = args.object as Record<string, unknown>;
        const bankId = obj.bankId;
        const inputs = obj.inputs;

        // If either is missing, let other validators handle the error
        if (typeof bankId !== 'string' || typeof inputs !== 'object' || inputs === null) {
            return true;
        }

        const scraper = this.scraperRegistry.findByBankId(bankId);
        // If bankId not found in registry, let other validators handle that
        if (!scraper) {
            return true;
        }

        const inputsMap = inputs as Record<string, string>;
        for (const field of scraper.inputSchema) {
            if (field.required) {
                const val = inputsMap[field.key];
                if (typeof val !== 'string' || val.trim() === '') {
                    this.failedKey = field.key;
                    return false;
                }
            }
        }

        return true;
    }

    public defaultMessage(_args: ValidationArguments): string {
        return `inputs.${this.failedKey ?? 'unknown'} is required for this bank`;
    }
}
