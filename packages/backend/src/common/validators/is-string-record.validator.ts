import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    ValidationOptions,
    registerDecorator
} from 'class-validator';

@ValidatorConstraint({name: 'isStringRecord', async: false})
export class IsStringRecordConstraint implements ValidatorConstraintInterface {
    public validate(value: unknown, _args: ValidationArguments): boolean {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
        }
        return Object.values(value as Record<string, unknown>).every(
            v => typeof v === 'string'
        );
    }

    public defaultMessage(_args: ValidationArguments): string {
        return 'Each value in the object must be a string';
    }
}

export const IsStringRecord = (options?: ValidationOptions) =>
    (object: object, propertyName: string): void => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            constraints: [],
            validator: IsStringRecordConstraint
        });
    };
