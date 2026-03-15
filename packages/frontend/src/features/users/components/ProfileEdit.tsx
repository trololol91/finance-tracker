import React from 'react';
import type {ProfileFormState} from '@features/users/types/user.types.js';
import {TIMEZONES} from '@features/users/utils/profile.utils.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';
import styles from '@features/users/components/ProfileEdit.module.css';

interface ProfileEditProps {
    form: ProfileFormState;
    email: string;
    apiError: string;
    isSaving: boolean;
    onFieldChange: (field: keyof ProfileFormState, value: string) => void;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
}

export const ProfileEdit = ({
    form,
    email,
    apiError,
    isSaving,
    onFieldChange,
    onSave,
    onCancel
}: ProfileEditProps): React.JSX.Element => {
    return (
        <div className={styles.card}>
            {/* ── Header Row ── */}
            <div className={styles.header}>
                <h1 className={styles.title}>Edit Profile</h1>
                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.btnCancel}
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="profile-form"
                        className={styles.btnSave}
                        disabled={isSaving}
                        aria-busy={isSaving}
                    >
                        {isSaving ? 'Saving…' : (
                            <>
                                <span className={styles.btnSaveLong}>Save Changes</span>
                                <span className={styles.btnSaveShort}>Save</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {apiError !== '' && (
                <p className={styles.apiError} role="alert">
                    {apiError}
                </p>
            )}

            <form
                id="profile-form"
                className={styles.form}
                onSubmit={onSave}
                noValidate
            >
                {/* ── Personal Information Section ── */}
                <section className={styles.section} aria-labelledby="section-personal">
                    <h2 id="section-personal" className={styles.sectionTitle}>
                        Personal Information
                    </h2>
                    <hr className={styles.sectionDivider} />

                    {/* First Name / Last Name two-column row */}
                    <div className={styles.fieldGrid}>
                        <div className={styles.fieldWrapper}>
                            <label
                                className={styles.fieldLabel}
                                htmlFor="profile-first-name"
                            >
                                First Name
                            </label>
                            <input
                                id="profile-first-name"
                                name="firstName"
                                type="text"
                                autoComplete="given-name"
                                autoFocus
                                className={styles.fieldInput}
                                value={form.firstName}
                                onChange={(e) => {
                                    onFieldChange('firstName', e.target.value);
                                }}
                            />
                        </div>

                        <div className={styles.fieldWrapper}>
                            <label
                                className={styles.fieldLabel}
                                htmlFor="profile-last-name"
                            >
                                Last Name
                            </label>
                            <input
                                id="profile-last-name"
                                name="lastName"
                                type="text"
                                autoComplete="family-name"
                                className={styles.fieldInput}
                                value={form.lastName}
                                onChange={(e) => {
                                    onFieldChange('lastName', e.target.value);
                                }}
                            />
                        </div>
                    </div>

                    {/* Email — read-only, full width */}
                    <div className={styles.readonlyField}>
                        <span className={styles.readonlyLabel}>Email</span>
                        <div
                            className={styles.readonlyValue}
                            role="textbox"
                            aria-readonly="true"
                            aria-label={`Email: ${email}`}
                        >
                            <span>{email}</span>
                            <span className={styles.readonlyBadge}>read only</span>
                        </div>
                    </div>
                </section>

                {/* ── Preferences Section ── */}
                <section className={styles.section} aria-labelledby="section-preferences">
                    <h2 id="section-preferences" className={styles.sectionTitle}>
                        Preferences
                    </h2>
                    <hr className={styles.sectionDivider} />

                    {/* Timezone / Currency two-column row */}
                    <div className={styles.fieldGrid}>
                        <div className={styles.selectWrapper}>
                            <label
                                className={styles.selectLabel}
                                htmlFor="profile-timezone"
                            >
                                Timezone
                            </label>
                            <select
                                id="profile-timezone"
                                className={styles.select}
                                value={form.timezone}
                                onChange={(e) => {
                                    onFieldChange('timezone', e.target.value);
                                }}
                            >
                                {TIMEZONES.map((tz) => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.selectWrapper}>
                            <label
                                className={styles.selectLabel}
                                htmlFor="profile-currency"
                            >
                                Currency
                            </label>
                            <select
                                id="profile-currency"
                                className={styles.select}
                                value={form.currency}
                                onChange={(e) => {
                                    onFieldChange('currency', e.target.value);
                                }}
                            >
                                {Object.values(UpdateUserDtoCurrency).map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
};
