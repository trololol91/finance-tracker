import {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useTransactionsControllerCreate,
    useTransactionsControllerUpdate,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey
} from '@/api/transactions/transactions.js';
import type {CreateTransactionDtoTransactionType} from '@/api/model/createTransactionDtoTransactionType.js';
import type {CreateTransactionDto} from '@/api/model/createTransactionDto.js';
import type {UpdateTransactionDto} from '@/api/model/updateTransactionDto.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';

const todayIso = (): string => new Date().toISOString().substring(0, 10);

const EMPTY_FORM: TransactionFormValues = {
    amount: '',
    description: '',
    notes: '',
    transactionType: 'expense',
    date: todayIso(),
    categoryId: '',
    accountId: ''
};

type FormErrors = Partial<Record<keyof TransactionFormValues, string>>;

const validateForm = (
    values: TransactionFormValues, setErrors: (e: FormErrors) => void
): boolean => {
    const newErrors: FormErrors = {};
    const amount = parseFloat(values.amount);
    if (isNaN(amount) || amount <= 0) newErrors.amount = 'Amount must be a positive number';
    if (values.description.trim() === '') newErrors.description = 'Description is required';
    if (values.date === '') newErrors.date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

// categoryId and accountId are intentionally omitted from updates —
// transaction type and account associations cannot be changed after creation.
const buildUpdateDto = (values: TransactionFormValues): UpdateTransactionDto => ({
    amount: parseFloat(values.amount),
    description: values.description.trim(),
    notes: values.notes.trim() !== '' ? values.notes.trim() : null,
    date: new Date(values.date + 'T12:00:00').toISOString()
});

const buildCreateDto = (values: TransactionFormValues): CreateTransactionDto => ({
    amount: parseFloat(values.amount),
    description: values.description.trim(),
    notes: values.notes.trim() !== '' ? values.notes.trim() : null,
    transactionType: values.transactionType as CreateTransactionDtoTransactionType,
    date: new Date(values.date + 'T12:00:00').toISOString(),
    categoryId: values.categoryId !== '' ? values.categoryId : null,
    accountId: values.accountId !== '' ? values.accountId : null
});

interface UseTransactionFormProps {
    /** Called after a successful create or update so the caller can close the modal. */
    onSuccess: () => void;
    /** Query key to invalidate on mutation success. */
    queryKey?: readonly unknown[];
}

interface UseTransactionFormReturn {
    formValues: TransactionFormValues;
    errors: FormErrors;
    editTarget: TransactionResponseDto | null;
    isSubmitting: boolean;
    openCreate: () => void;
    openEdit: (transaction: TransactionResponseDto) => void;
    handleFieldChange: (field: keyof TransactionFormValues, value: string) => void;
    handleSubmit: (e: React.FormEvent) => void;
}

/**
 * Manages form state for creating and editing transactions.
 * Uses Orval mutation hooks internally.
 */
export const useTransactionForm = ({
    onSuccess,
    queryKey
}: UseTransactionFormProps): UseTransactionFormReturn => {
    const queryClient = useQueryClient();
    const [formValues, setFormValues] = useState<TransactionFormValues>(EMPTY_FORM);
    const [editTarget, setEditTarget] = useState<TransactionResponseDto | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});

    const {mutate: createTransaction, isPending: isCreating} = useTransactionsControllerCreate();
    const {mutate: updateTransaction, isPending: isUpdating} = useTransactionsControllerUpdate();

    const openCreate = useCallback((): void => {
        setEditTarget(null);
        setFormValues({...EMPTY_FORM, date: todayIso()});
        setErrors({});
    }, []);

    const openEdit = useCallback((transaction: TransactionResponseDto): void => {
        setEditTarget(transaction);
        setFormValues({
            amount: String(transaction.amount),
            description: transaction.description,
            notes: transaction.notes ?? '',
            transactionType: transaction.transactionType as TransactionFormValues['transactionType'],
            date: transaction.date.substring(0, 10),
            categoryId: transaction.categoryId ?? '',
            accountId: transaction.accountId ?? ''
        });
        setErrors({});
    }, []);

    const handleFieldChange = useCallback(
        (field: keyof TransactionFormValues, value: string): void => {
            setFormValues((prev) => ({...prev, [field]: value}));
            setErrors((prev) => ({...prev, [field]: undefined}));
        },
        []
    );

    const handleSubmit = useCallback(
        (e: React.FormEvent): void => {
            e.preventDefault();
            if (!validateForm(formValues, setErrors)) return;
            const afterSave = (): void => {
                void queryClient.invalidateQueries({
                    queryKey: queryKey ?? getTransactionsControllerFindAllQueryKey(),
                    exact: false
                });
                void queryClient.invalidateQueries({
                    queryKey: getTransactionsControllerGetTotalsQueryKey(),
                    exact: false
                });
                onSuccess();
            };
            if (editTarget !== null) {
                updateTransaction(
                    {id: editTarget.id, data: buildUpdateDto(formValues)},
                    {onSuccess: afterSave}
                );
            } else {
                createTransaction(
                    {data: buildCreateDto(formValues)},
                    {onSuccess: afterSave}
                );
            }
        },
        [
            formValues,
            editTarget,
            createTransaction,
            updateTransaction,
            onSuccess,
            queryKey,
            queryClient
        ]
    );

    return {
        formValues,
        errors,
        editTarget,
        isSubmitting: isCreating || isUpdating,
        openCreate,
        openEdit,
        handleFieldChange,
        handleSubmit
    };
};
