import React from 'react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {CreateTransactionDtoTransactionType} from '@/api/model/createTransactionDtoTransactionType.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionForm.css';

type FormErrors = Partial<Record<keyof TransactionFormValues, string>>;

interface TransactionFormProps {
    formValues: TransactionFormValues;
    errors: FormErrors;
    editTarget: TransactionResponseDto | null;
    isSubmitting: boolean;
    onFieldChange: (field: keyof TransactionFormValues, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
}

const TRANSACTION_TYPES = [
    {value: CreateTransactionDtoTransactionType.income, label: 'Income'},
    {value: CreateTransactionDtoTransactionType.expense, label: 'Expense'},
    {value: CreateTransactionDtoTransactionType.transfer, label: 'Transfer'}
];

export const TransactionForm = ({
    formValues,
    errors,
    editTarget,
    isSubmitting,
    onFieldChange,
    onSubmit,
    onCancel
}: TransactionFormProps): React.JSX.Element => {
    const isEditing = editTarget !== null;

    return (
        <form id="transaction-form" className="tx-form" onSubmit={onSubmit} noValidate>
            <div className="tx-form__grid">
                <Input
                    label="Amount *"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formValues.amount}
                    onChange={(e) => { onFieldChange('amount', e.target.value); }}
                    error={errors.amount}
                    required
                />

                <div className="tx-form__field">
                    <label htmlFor="tx-form-type" className="tx-form__label">Type *</label>
                    <select
                        id="tx-form-type"
                        className={'tx-form__select'}
                        value={formValues.transactionType}
                        onChange={(e) => { onFieldChange('transactionType', e.target.value); }}
                        disabled={isEditing}
                        required
                    >
                        {TRANSACTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                    {isEditing && (
                        <span className="tx-form__hint">Transaction type cannot be changed after creation.</span>
                    )}
                </div>

                <Input
                    label="Date *"
                    type="date"
                    value={formValues.date}
                    onChange={(e) => { onFieldChange('date', e.target.value); }}
                    error={errors.date}
                    required
                />
            </div>

            <Input
                label="Description *"
                type="text"
                placeholder="e.g. Starbucks Coffee"
                value={formValues.description}
                onChange={(e) => { onFieldChange('description', e.target.value); }}
                error={errors.description}
                required
            />

            <div className="tx-form__field">
                <label htmlFor="tx-form-notes" className="tx-form__label">Notes</label>
                <textarea
                    id="tx-form-notes"
                    className="tx-form__textarea"
                    placeholder="Optional notes..."
                    rows={3}
                    value={formValues.notes}
                    onChange={(e) => { onFieldChange('notes', e.target.value); }}
                />
            </div>

            <div className="tx-form__footer">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                    {isEditing ? 'Save Changes' : 'Add Transaction'}
                </Button>
            </div>
        </form>
    );
};
