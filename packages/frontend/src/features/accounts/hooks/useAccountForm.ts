import {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useAccountsControllerCreate,
    useAccountsControllerUpdate,
    useAccountsControllerRemove,
    getAccountsControllerFindAllQueryKey
} from '@/api/accounts/accounts.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {CreateAccountDto} from '@/api/model/createAccountDto.js';
import type {UpdateAccountDto} from '@/api/model/updateAccountDto.js';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';
import type {
    AccountFormValues, AccountFormErrors, AccountModalMode
} from '@features/accounts/types/account.types.js';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

const EMPTY_FORM: AccountFormValues = {
    name: '',
    type: CreateAccountDtoType.checking,
    institution: '',
    currency: 'CAD',
    openingBalance: '0',
    color: '',
    notes: '',
    isActive: true
};

const validateForm = (
    values: AccountFormValues,
    setErrors: (e: AccountFormErrors) => void
): boolean => {
    const newErrors: AccountFormErrors = {};
    if (values.name.trim() === '') newErrors.name = 'Name is required';
    else if (values.name.trim().length > 100) newErrors.name = 'Name must be 100 characters or fewer';
    if (values.type === '') newErrors.type = 'Account type is required';
    if (values.institution.length > 100) newErrors.institution = 'Institution must be 100 characters or fewer';
    if (values.currency !== '' && !CURRENCY_RE.test(values.currency)) {
        newErrors.currency = 'Currency must be a 3-letter uppercase code (e.g. CAD, USD)';
    }
    const balance = parseFloat(values.openingBalance);
    if (values.openingBalance !== '' && (isNaN(balance) || !/^-?\d+(\.\d{1,2})?$/.test(values.openingBalance.trim()))) {
        newErrors.openingBalance = 'Opening balance must be a number with at most 2 decimal places';
    }
    if (values.color !== '' && !HEX_RE.test(values.color)) {
        newErrors.color = 'Color must be a valid hex code (e.g. #4CAF50)';
    }
    if (values.notes.length > 500) newErrors.notes = 'Notes must be 500 characters or fewer';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

const buildCreateDto = (values: AccountFormValues): CreateAccountDto => ({
    name: values.name.trim(),
    type: values.type as CreateAccountDtoType,
    institution: values.institution.trim() !== '' ? values.institution.trim() : null,
    currency: values.currency.trim() !== '' ? values.currency.trim() : undefined,
    openingBalance: values.openingBalance !== '' ? parseFloat(values.openingBalance) : undefined,
    color: values.color !== '' ? values.color : null,
    notes: values.notes.trim() !== '' ? values.notes.trim() : null
});

const buildUpdateDto = (values: AccountFormValues): UpdateAccountDto => ({
    name: values.name.trim(),
    type: values.type as CreateAccountDtoType,
    institution: values.institution.trim() !== '' ? values.institution.trim() : null,
    currency: values.currency.trim() !== '' ? values.currency.trim() : undefined,
    openingBalance: values.openingBalance !== '' ? parseFloat(values.openingBalance) : undefined,
    color: values.color !== '' ? values.color : null,
    notes: values.notes.trim() !== '' ? values.notes.trim() : null,
    isActive: values.isActive
});

interface UseAccountFormProps {
    onSuccess?: () => void;
}

type CreateMutate = ReturnType<typeof useAccountsControllerCreate>['mutate'];
type UpdateMutate = ReturnType<typeof useAccountsControllerUpdate>['mutate'];

interface SubmitArgs {
    formValues: AccountFormValues;
    editTarget: AccountResponseDto | null;
    create: CreateMutate;
    update: UpdateMutate;
    invalidate: () => void;
    setErrors: (e: AccountFormErrors) => void;
    setModalMode: (m: AccountModalMode) => void;
    onSuccess?: () => void;
}

const runSubmit = (args: SubmitArgs): void => {
    const {
        formValues, editTarget, create, update, invalidate, setErrors, setModalMode, onSuccess
    } = args;
    const success = (): void => { invalidate(); setModalMode(null); onSuccess?.(); };
    const errHandler = (label: string) => (err: unknown): void => {
        console.error('[AccountForm]', err);
        const msg = (err as {message?: string}).message ?? `Failed to ${label} account`;
        setErrors({name: msg});
    };
    if (editTarget !== null) {
        update(
            {id: editTarget.id, data: buildUpdateDto(formValues)},
            {onSuccess: success, onError: errHandler('update')}
        );
    } else {
        create(
            {data: buildCreateDto(formValues)},
            {onSuccess: success, onError: errHandler('create')}
        );
    }
};

export interface UseAccountFormReturn {
    formValues: AccountFormValues;
    errors: AccountFormErrors;
    editTarget: AccountResponseDto | null;
    modalMode: AccountModalMode;
    isSubmitting: boolean;
    isDeleting: boolean;
    openCreate: () => void;
    openEdit: (account: AccountResponseDto) => void;
    closeModal: () => void;
    handleFieldChange: (field: keyof AccountFormValues, value: string | boolean) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleDelete: (id: string) => void;
}

export const useAccountForm = ({onSuccess}: UseAccountFormProps = {}): UseAccountFormReturn => {
    const queryClient = useQueryClient();
    const [formValues, setFormValues] = useState<AccountFormValues>(EMPTY_FORM);
    const [errors, setErrors] = useState<AccountFormErrors>({});
    const [editTarget, setEditTarget] = useState<AccountResponseDto | null>(null);
    const [modalMode, setModalMode] = useState<AccountModalMode>(null);

    const {mutate: create, isPending: isCreating} = useAccountsControllerCreate();
    const {mutate: update, isPending: isUpdating} = useAccountsControllerUpdate();
    const {mutate: remove, isPending: isDeleting} = useAccountsControllerRemove();
    const isSubmitting = isCreating || isUpdating;

    const invalidate = useCallback((): void => {
        void queryClient.invalidateQueries({queryKey: getAccountsControllerFindAllQueryKey()});
    }, [queryClient]);

    const openCreate = useCallback((): void => {
        setEditTarget(null);
        setFormValues(EMPTY_FORM);
        setErrors({});
        setModalMode('create');
    }, []);

    const openEdit = useCallback((account: AccountResponseDto): void => {
        setEditTarget(account);
        setFormValues({
            name: account.name,
            type: account.type as CreateAccountDtoType,
            institution: account.institution ?? '',
            currency: account.currency,
            openingBalance: String(account.openingBalance),
            color: account.color ?? '',
            notes: account.notes ?? '',
            isActive: account.isActive
        });
        setErrors({});
        setModalMode('edit');
    }, []);

    const closeModal = useCallback((): void => {
        setModalMode(null);
    }, []);

    const handleFieldChange = useCallback(
        (field: keyof AccountFormValues, value: string | boolean): void => {
            setFormValues((prev) => ({...prev, [field]: value}));
            if (errors[field] !== undefined) {
                setErrors((prev) => ({...prev, [field]: undefined}));
            }
        },
        [errors]
    );

    const handleSubmit = useCallback(
        (e: React.FormEvent): void => {
            e.preventDefault();
            if (!validateForm(formValues, setErrors)) return;
            runSubmit({
                formValues, editTarget,
                create, update,
                invalidate, setErrors, setModalMode,
                onSuccess
            });
        },
        [formValues, editTarget, create, update, invalidate, onSuccess]
    );

    const handleDelete = useCallback(
        (id: string): void => {
            remove(
                {id},
                {
                    onSuccess: (): void => { invalidate(); },
                    onError: (err): void => {
                        console.error('[AccountForm] delete failed', err);
                    }
                }
            );
        },
        [remove, invalidate]
    );

    return {
        formValues,
        errors,
        editTarget,
        modalMode,
        isSubmitting,
        isDeleting,
        openCreate,
        openEdit,
        closeModal,
        handleFieldChange,
        handleSubmit,
        handleDelete
    };
};
