import React from 'react';
import {useScraperControllerListScrapers} from '@/api/scrapers/scrapers.js';
import {useAccountsControllerFindAll} from '@/api/accounts/accounts.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors
} from '@features/scraper/types/scraper.types.js';
import styles from '@features/scraper/components/SyncScheduleForm.module.css';

interface SyncScheduleFormProps {
    values: SyncScheduleFormValues;
    errors: SyncScheduleFormErrors;
    isSubmitting: boolean;
    editMode: boolean;
    firstFieldRef?: React.RefObject<HTMLSelectElement | null>;
    onChange: (field: keyof SyncScheduleFormValues, value: string | boolean) => void;
    onInputChange: (key: string, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const SyncScheduleForm = ({
    values,
    errors,
    isSubmitting,
    editMode,
    firstFieldRef,
    onChange,
    onInputChange,
    onSubmit
}: SyncScheduleFormProps): React.JSX.Element => {
    const {data: scrapers} = useScraperControllerListScrapers();
    const {data: accountsResponse} = useAccountsControllerFindAll();
    const accounts = accountsResponse ?? [];

    return (
        <form
            id="sync-schedule-form"
            className={styles.form}
            onSubmit={onSubmit}
            noValidate
            aria-label={editMode ? 'Edit sync schedule form' : 'New sync schedule form'}
        >
            {/* Account */}
            <div className={styles.field}>
                <label className={styles.label} htmlFor="ss-account">
                    Account <span aria-hidden="true" className={styles.required}>*</span>
                </label>
                <select
                    id="ss-account"
                    ref={firstFieldRef as React.RefObject<HTMLSelectElement>}
                    className={`${styles.select}${errors.accountId !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.accountId}
                    required
                    aria-required="true"
                    aria-invalid={errors.accountId !== undefined ? 'true' : 'false'}
                    disabled={editMode}
                    onChange={(e) => { onChange('accountId', e.target.value); }}
                >
                    <option value="">Select account…</option>
                    {accounts.filter((a) => a.isActive).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                {editMode && (
                    <span className={styles.hint}>Account cannot be changed after creation.</span>
                )}
                {errors.accountId !== undefined && (
                    <span role="alert" className={styles.error}>{errors.accountId}</span>
                )}
            </div>

            {/* Bank */}
            <div className={styles.field}>
                <label className={styles.label} htmlFor="ss-bank">
                    Bank <span aria-hidden="true" className={styles.required}>*</span>
                </label>
                <select
                    id="ss-bank"
                    className={`${styles.select}${errors.bankId !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.bankId}
                    required
                    aria-required="true"
                    aria-invalid={errors.bankId !== undefined ? 'true' : 'false'}
                    disabled={editMode}
                    onChange={(e) => { onChange('bankId', e.target.value); }}
                >
                    <option value="">Select bank…</option>
                    {scrapers?.map((s) => (
                        <option key={s.bankId} value={s.bankId}>{s.displayName}</option>
                    ))}
                </select>
                {editMode && (
                    <span className={styles.hint}>Bank cannot be changed after creation.</span>
                )}
                {errors.bankId !== undefined && (
                    <span role="alert" className={styles.error}>{errors.bankId}</span>
                )}
            </div>

            {/* Dynamic plugin input fields — driven by the selected scraper's inputSchema */}
            {((): React.JSX.Element[] | null => {
                const selectedScraper = scrapers?.find((s) => s.bankId === values.bankId);
                if (selectedScraper === undefined) return null;

                return selectedScraper.inputSchema.map((field) => {
                    const fieldError = errors[`inputs.${field.key}`];
                    const fieldValue = values.inputs[field.key] ?? '';

                    return (
                        <div key={field.key} className={styles.field}>
                            <label className={styles.label} htmlFor={`ss-input-${field.key}`}>
                                {editMode ? `New ${field.label}` : field.label}
                                {!editMode && field.required && (
                                    <span aria-hidden="true" className={styles.required}> *</span>
                                )}
                            </label>

                            {field.type === 'select' && field.options !== undefined ? (
                                <select
                                    id={`ss-input-${field.key}`}
                                    className={`${styles.select}${fieldError !== undefined ? ` ${styles.inputError}` : ''}`}
                                    value={fieldValue}
                                    required={!editMode && field.required}
                                    onChange={(e) => { onInputChange(field.key, e.target.value); }}
                                >
                                    <option value="">Select…</option>
                                    {field.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    id={`ss-input-${field.key}`}
                                    type={field.type}
                                    autoComplete={
                                        field.type === 'password'
                                            ? (editMode ? 'new-password' : 'current-password')
                                            : field.key
                                    }
                                    className={`${styles.input}${fieldError !== undefined ? ` ${styles.inputError}` : ''}`}
                                    value={fieldValue}
                                    required={!editMode && field.required}
                                    placeholder={editMode ? 'Leave blank to keep unchanged' : ''}
                                    onChange={(e) => { onInputChange(field.key, e.target.value); }}
                                />
                            )}

                            {field.hint !== undefined && (
                                <span className={styles.hint}>{field.hint}</span>
                            )}
                            {fieldError !== undefined && (
                                <span role="alert" className={styles.error}>{fieldError}</span>
                            )}
                        </div>
                    );
                });
            })()}

            {/* Cron + lookback row */}
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="ss-cron">
                        Schedule (cron) <span aria-hidden="true" className={styles.required}>*</span>
                    </label>
                    <input
                        id="ss-cron"
                        type="text"
                        className={`${styles.input}${errors.cron !== undefined ? ` ${styles.inputError}` : ''}`}
                        value={values.cron}
                        required
                        aria-required="true"
                        placeholder="0 8 * * *"
                        onChange={(e) => { onChange('cron', e.target.value); }}
                    />
                    <span className={styles.hint}>E.g. "0 8 * * *" = 8 AM daily</span>
                    {errors.cron !== undefined && (
                        <span role="alert" className={styles.error}>{errors.cron}</span>
                    )}
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="ss-lookback">
                        Lookback days <span aria-hidden="true" className={styles.required}>*</span>
                    </label>
                    <input
                        id="ss-lookback"
                        type="number"
                        min={1}
                        max={365}
                        required
                        aria-required="true"
                        className={`${styles.input}${errors.lookbackDays !== undefined ? ` ${styles.inputError}` : ''}`}
                        value={values.lookbackDays}
                        onChange={(e) => { onChange('lookbackDays', e.target.value); }}
                    />
                    {errors.lookbackDays !== undefined && (
                        <span role="alert" className={styles.error}>{errors.lookbackDays}</span>
                    )}
                </div>
            </div>

            {/* Enabled toggle (edit mode only) */}
            {editMode && (
                <div className={styles.field}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={values.enabled}
                            onChange={(e) => { onChange('enabled', e.target.checked); }}
                        />
                        Schedule enabled
                    </label>
                </div>
            )}

            <div className={styles.actions}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (editMode ? 'Saving…' : 'Creating…') : (editMode ? 'Save Changes' : 'Create Schedule')}
                </button>
            </div>
        </form>
    );
};
