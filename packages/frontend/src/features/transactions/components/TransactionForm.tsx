import React, {useState} from 'react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {CreateTransactionDtoTransactionType} from '@/api/model/createTransactionDtoTransactionType.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionForm.css';

type FormErrors = Partial<Record<keyof TransactionFormValues, string>>;

interface TransactionFormProps {
    formValues: TransactionFormValues;
    errors: FormErrors;
    editTarget: TransactionResponseDto | null;
    isSubmitting: boolean;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
    amountRef?: React.RefObject<HTMLInputElement | null>;
    onFieldChange: (field: keyof TransactionFormValues, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    onSuggestCategory?: () => void | Promise<void>;
    isSuggestingCategory?: boolean;
    /** When false, the AI "Suggest" button is hidden entirely. Defaults to true. */
    aiAvailable?: boolean;
    onSaveAsRule?: (pattern: string, applyToExisting: boolean) => Promise<void>;
    isSavingRule?: boolean;
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
    categories = [],
    accounts = [],
    amountRef,
    onFieldChange,
    onSubmit,
    onCancel,
    onSuggestCategory,
    isSuggestingCategory = false,
    aiAvailable = true,
    onSaveAsRule,
    isSavingRule = false
}: TransactionFormProps): React.JSX.Element => {
    const isEditing = editTarget !== null;
    const activeCategories = categories.filter((c) => c.isActive);
    const activeAccounts = accounts.filter((a) => a.isActive);
    const [showRulePanel, setShowRulePanel] = useState(false);
    const [rulePattern, setRulePattern] = useState('');
    const [applyToExisting, setApplyToExisting] = useState(false);

    const handleOpenRulePanel = (): void => {
        setRulePattern(formValues.description);
        setApplyToExisting(false);
        setShowRulePanel(true);
    };

    const handleCancelRule = (): void => {
        setShowRulePanel(false);
    };

    const handleConfirmRule = async (): Promise<void> => {
        if (!onSaveAsRule) return;
        await onSaveAsRule(rulePattern, applyToExisting);
        setShowRulePanel(false);
    };

    const selectedCategory = categories.find((c) => c.id === formValues.categoryId) ?? null;

    return (
        <form id="transaction-form" className="tx-form" onSubmit={onSubmit} noValidate>
            <div className="tx-form__grid">
                <Input
                    ref={amountRef}
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

            <div className="tx-form__field">
                <label htmlFor="tx-form-category" className="tx-form__label">Category</label>
                <div className="tx-form__category-row">
                    <select
                        id="tx-form-category"
                        className="tx-form__select"
                        value={formValues.categoryId}
                        onChange={(e) => { onFieldChange('categoryId', e.target.value); }}
                    >
                        <option value="">None</option>
                        {activeCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.icon ? `${c.icon} ` : ''}{c.name}
                            </option>
                        ))}
                    </select>
                    {onSuggestCategory && aiAvailable && (
                        <button
                            type="button"
                            className="tx-form__suggest-btn"
                            onClick={(): void => { void onSuggestCategory(); }}
                            disabled={
                                !formValues.description || isSuggestingCategory || isSubmitting
                            }
                            title={
                                !formValues.description
                                    ? 'Suggest category using AI (enter a description first)'
                                    : 'Suggest category using AI'
                            }
                            aria-label={
                                !formValues.description
                                    ? 'Suggest category using AI (enter a description first)'
                                    : 'Suggest category using AI'
                            }
                        >
                            {isSuggestingCategory ? 'Suggesting\u2026' : 'Suggest'}
                        </button>
                    )}
                </div>
            </div>

            <div className="tx-form__field">
                <label htmlFor="tx-form-account" className="tx-form__label">Account</label>
                <select
                    id="tx-form-account"
                    className="tx-form__select"
                    value={formValues.accountId}
                    onChange={(e) => { onFieldChange('accountId', e.target.value); }}
                >
                    <option value="">None</option>
                    {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>
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

            {showRulePanel && (
                <div className="tx-form__rule-panel" role="region" aria-label="Save as rule">
                    <p className="tx-form__rule-panel-title">
                        Save as rule
                        {selectedCategory !== null && (
                            <span className="tx-form__rule-panel-category">
                                {' \u2192 '}{selectedCategory.icon ? `${selectedCategory.icon} ` : ''}{selectedCategory.name}
                            </span>
                        )}
                    </p>
                    <div className="tx-form__field">
                        <label htmlFor="rule-pattern" className="tx-form__label">
                            Pattern (substring match, case-insensitive)
                        </label>
                        <input
                            id="rule-pattern"
                            className="tx-form__input"
                            type="text"
                            value={rulePattern}
                            onChange={(e): void => { setRulePattern(e.target.value); }}
                            placeholder="e.g. SOBEYS"
                            maxLength={200}
                        />
                    </div>
                    <label className="tx-form__rule-checkbox">
                        <input
                            type="checkbox"
                            checked={applyToExisting}
                            onChange={(e): void => { setApplyToExisting(e.target.checked); }}
                        />
                        Apply to existing uncategorized transactions matching this pattern
                    </label>
                    <div className="tx-form__rule-panel-actions">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCancelRule}
                            disabled={isSavingRule}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={(): void => { void handleConfirmRule(); }}
                            disabled={rulePattern.trim().length === 0}
                            isLoading={isSavingRule}
                        >
                            Save Rule
                        </Button>
                    </div>
                </div>
            )}

            <div className="tx-form__footer">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                {isEditing && onSaveAsRule && !showRulePanel && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleOpenRulePanel}
                        disabled={isSubmitting || !formValues.categoryId}
                        title={!formValues.categoryId ? 'Select a category first' : 'Save a rule for this description'}
                    >
                        Save as rule
                    </Button>
                )}
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                    {isEditing ? 'Save Changes' : 'Add Transaction'}
                </Button>
            </div>
        </form>
    );
};
