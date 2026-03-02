// Frontend-specific types for the Accounts feature.
// Generated DTO/entity types live in @/api/model/ — do not redefine them here.

import type {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';

/** Form values (all strings for controlled inputs; isActive is bool for the toggle). */
export interface AccountFormValues {
    name: string;
    /** One of the CreateAccountDtoType enum values. */
    type: CreateAccountDtoType | '';
    institution: string;
    currency: string;
    /** String representation of a decimal number, e.g. "1500.00". */
    openingBalance: string;
    color: string;
    notes: string;
    /** Available in edit mode only — toggled via checkbox. */
    isActive: boolean;
}

/** Form validation errors. */
export type AccountFormErrors = Partial<Record<keyof AccountFormValues, string>>;

/** Whether the modal is open for create or edit. */
export type AccountModalMode = 'create' | 'edit' | null;
