import {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useTransactionsControllerCreate,
    useTransactionsControllerUpdate,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey,
    transactionsControllerCategorizeSuggestion
} from '@/api/transactions/transactions.js';
import type {CreateTransactionDtoTransactionType} from '@/api/model/createTransactionDtoTransactionType.js';
import type {CategorizeSuggestionRequestDtoTransactionType as SuggestionTxType} from '@/api/model/categorizeSuggestionRequestDtoTransactionType.js';
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
    if (isNaN(amount) || amount === 0) newErrors.amount = 'Amount must not be zero';
    if (values.description.trim() === '') newErrors.description = 'Description is required';
    if (values.date === '') newErrors.date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

const buildUpdateDto = (values: TransactionFormValues): UpdateTransactionDto => ({
    amount: parseFloat(values.amount),
    description: values.description.trim(),
    notes: values.notes.trim() !== '' ? values.notes.trim() : null,
    date: values.date + 'T00:00:00.000Z',
    categoryId: values.categoryId !== '' ? values.categoryId : null,
    accountId: values.accountId !== '' ? values.accountId : null
});

const buildCreateDto = (values: TransactionFormValues): CreateTransactionDto => ({
    amount: parseFloat(values.amount),
    description: values.description.trim(),
    notes: values.notes.trim() !== '' ? values.notes.trim() : null,
    transactionType: values.transactionType as CreateTransactionDtoTransactionType,
    date: values.date + 'T00:00:00.000Z',
    categoryId: values.categoryId !== '' ? values.categoryId : null,
    accountId: values.accountId !== '' ? values.accountId : null
});

interface UseTransactionFormProps {
    /** Called after a successful create or update so the caller can close the modal. */
    onSuccess: () => void;
}

interface UseTransactionFormReturn {
    formValues: TransactionFormValues;
    errors: FormErrors;
    editTarget: TransactionResponseDto | null;
    isSubmitting: boolean;
    isSuggestingCategory: boolean;
    openCreate: () => void;
    openEdit: (transaction: TransactionResponseDto) => void;
    handleFieldChange: (field: keyof TransactionFormValues, value: string) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleSuggestCategory: () => Promise<void>;
}

/**
 * Manages form state for creating and editing transactions.
 * Uses Orval mutation hooks internally.
 */
export const useTransactionForm = ({
    onSuccess
}: UseTransactionFormProps): UseTransactionFormReturn => {
    const queryClient = useQueryClient();
    const [formValues, setFormValues] = useState<TransactionFormValues>(EMPTY_FORM);
    const [editTarget, setEditTarget] = useState<TransactionResponseDto | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});

    const {mutate: createTransaction, isPending: isCreating} = useTransactionsControllerCreate();
    const {mutate: updateTransaction, isPending: isUpdating} = useTransactionsControllerUpdate();
    const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);

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
                    queryKey: getTransactionsControllerFindAllQueryKey(),
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
            queryClient
        ]
    );

    const handleSuggestCategory = useCallback(async (): Promise<void> => {
        if (!formValues.description || !formValues.amount) return;
        setIsSuggestingCategory(true);
        try {
            const txType = formValues.transactionType as SuggestionTxType;
            const result = await transactionsControllerCategorizeSuggestion({
                description: formValues.description,
                amount: parseFloat(formValues.amount),
                transactionType: txType
            });
            if (result.categoryId) {
                handleFieldChange('categoryId', result.categoryId);
            }
        } catch {
            // silently fail — user can pick manually
        } finally {
            setIsSuggestingCategory(false);
        }
    }, [formValues.description, formValues.amount, formValues.transactionType, handleFieldChange]);

    return {
        formValues,
        errors,
        editTarget,
        isSubmitting: isCreating || isUpdating,
        isSuggestingCategory,
        openCreate,
        openEdit,
        handleFieldChange,
        handleSubmit,
        handleSuggestCategory
    };
};
