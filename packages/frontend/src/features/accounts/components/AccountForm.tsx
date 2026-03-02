import React from 'react';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';
import type {
    AccountFormValues, AccountFormErrors
} from '@features/accounts/types/account.types.js';
import styles from '@features/accounts/components/AccountForm.module.css';

const ACCOUNT_TYPES: {value: CreateAccountDtoType, label: string}[] = [
    {value: CreateAccountDtoType.checking, label: 'Checking'},
    {value: CreateAccountDtoType.savings, label: 'Savings'},
    {value: CreateAccountDtoType.credit, label: 'Credit'},
    {value: CreateAccountDtoType.investment, label: 'Investment'},
    {value: CreateAccountDtoType.loan, label: 'Loan'},
    {value: CreateAccountDtoType.other, label: 'Other'}
];

const COMMON_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF'];

interface AccountFormProps {
    values: AccountFormValues;
    errors: AccountFormErrors;
    isSubmitting: boolean;
    firstFieldRef?: React.RefObject<HTMLInputElement | null>;
    editMode: boolean;
    onChange: (field: keyof AccountFormValues, value: string | boolean) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const AccountForm = ({
    values,
    errors,
    isSubmitting,
    firstFieldRef,
    editMode,
    onChange,
    onSubmit
}: AccountFormProps): React.JSX.Element => (
    <form
        id="account-form"
        className={styles.form}
        onSubmit={onSubmit}
        noValidate
        aria-label={editMode ? 'Edit account form' : 'New account form'}
    >
        {/* Name */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-name">
                Account Name <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
                id="acc-name"
                ref={firstFieldRef}
                type="text"
                className={`${styles.input}${errors.name !== undefined ? ` ${styles.inputError}` : ''}`}
                value={values.name}
                maxLength={100}
                required
                aria-required="true"
                aria-invalid={errors.name !== undefined ? 'true' : 'false'}
                aria-describedby={errors.name !== undefined ? 'acc-name-error' : undefined}
                onChange={(e) => { onChange('name', e.target.value); }}
                placeholder="e.g. Main Chequing"
            />
            {errors.name !== undefined && (
                <span id="acc-name-error" role="alert" className={styles.error}>
                    {errors.name}
                </span>
            )}
        </div>

        {/* Type + Institution row */}
        <div className={styles.row}>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-type">
                    Type <span aria-hidden="true" className={styles.required}>*</span>
                </label>
                <select
                    id="acc-type"
                    className={`${styles.select}${errors.type !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.type}
                    required
                    aria-required="true"
                    aria-invalid={errors.type !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.type !== undefined ? 'acc-type-error' : undefined}
                    disabled={editMode}
                    onChange={(e) => { onChange('type', e.target.value); }}
                >
                    {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {editMode && (
                    <span className={styles.hint}>
                        Account type cannot be changed after creation.
                    </span>
                )}
                {errors.type !== undefined && (
                    <span id="acc-type-error" role="alert" className={styles.error}>
                        {errors.type}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-institution">Institution</label>
                <input
                    id="acc-institution"
                    type="text"
                    className={`${styles.input}${errors.institution !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.institution}
                    maxLength={100}
                    aria-invalid={errors.institution !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.institution !== undefined ? 'acc-institution-error' : undefined}
                    onChange={(e) => { onChange('institution', e.target.value); }}
                    placeholder="e.g. TD Bank"
                />
                {errors.institution !== undefined && (
                    <span id="acc-institution-error" role="alert" className={styles.error}>{errors.institution}</span>
                )}
            </div>
        </div>

        {/* Currency + Opening Balance row */}
        <div className={styles.row}>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-currency">Currency</label>
                <select
                    id="acc-currency"
                    className={`${styles.select}${errors.currency !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.currency}
                    aria-invalid={errors.currency !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.currency !== undefined ? 'acc-currency-error' : undefined}
                    onChange={(e) => { onChange('currency', e.target.value); }}
                >
                    {COMMON_CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                {errors.currency !== undefined && (
                    <span id="acc-currency-error" role="alert" className={styles.error}>{errors.currency}</span>
                )}
            </div>

            <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-balance">Opening Balance</label>
                <input
                    id="acc-balance"
                    type="number"
                    step="0.01"
                    className={`${styles.input}${errors.openingBalance !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.openingBalance}
                    aria-invalid={errors.openingBalance !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.openingBalance !== undefined ? 'acc-balance-error' : 'acc-balance-hint'}
                    onChange={(e) => { onChange('openingBalance', e.target.value); }}
                    placeholder="0.00"
                />
                <span id="acc-balance-hint" className={styles.hint}>
                    Balance at the time you added this account
                </span>
                {errors.openingBalance !== undefined && (
                    <span id="acc-balance-error" role="alert" className={styles.error}>
                        {errors.openingBalance}
                    </span>
                )}
            </div>
        </div>

        {/* Color */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-color">Color</label>
            <div className={styles.colorRow}>
                <input
                    id="acc-color-picker"
                    type="color"
                    className={styles.colorPicker}
                    value={values.color !== '' ? values.color : '#60a5fa'}
                    aria-label="Pick account color"
                    onChange={(e) => { onChange('color', e.target.value); }}
                />
                <input
                    id="acc-color"
                    type="text"
                    className={`${styles.input}${errors.color !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.color}
                    aria-invalid={errors.color !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.color !== undefined ? 'acc-color-error' : 'acc-color-hint'}
                    onChange={(e) => { onChange('color', e.target.value); }}
                    placeholder="#RRGGBB or empty"
                    maxLength={7}
                />
            </div>
            <span id="acc-color-hint" className={styles.hint}>
                Hex value, e.g. #60a5fa. Leave empty for default.
            </span>
            {errors.color !== undefined && (
                <span id="acc-color-error" role="alert" className={styles.error}>
                    {errors.color}
                </span>
            )}
        </div>

        {/* Notes */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-notes">Notes</label>
            <textarea
                id="acc-notes"
                className={`${styles.textarea}${errors.notes !== undefined ? ` ${styles.inputError}` : ''}`}
                value={values.notes}
                maxLength={500}
                rows={2}
                aria-invalid={errors.notes !== undefined ? 'true' : 'false'}
                aria-describedby={errors.notes !== undefined ? 'acc-notes-error' : undefined}
                onChange={(e) => { onChange('notes', e.target.value); }}
                placeholder="Optional notes…"
            />
            {errors.notes !== undefined && (
                <span id="acc-notes-error" role="alert" className={styles.error}>{errors.notes}</span>
            )}
        </div>

        {/* isActive toggle (edit mode only) */}
        {editMode && (
            <div className={styles.field}>
                <label className={styles.checkboxLabel} htmlFor="acc-active">
                    <input
                        id="acc-active"
                        type="checkbox"
                        className={styles.checkbox}
                        checked={values.isActive}
                        onChange={(e) => { onChange('isActive', e.target.checked); }}
                    />
                    Active account
                </label>
            </div>
        )}

        {/* Submit */}
        <div className={styles.footer}>
            <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
            >
                {isSubmitting ? 'Saving…' : (editMode ? 'Save Changes' : 'Create Account')}
            </button>
        </div>
    </form>
);
