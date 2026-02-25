import React from 'react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import type {ProfileFormState} from '@features/users/types/user.types.js';
import {TIMEZONES} from '@features/users/utils/profile.utils.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';

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
        <>
            <div className="profile-page__header">
                <h1 className="profile-page__title">Edit Profile</h1>
                <div className="profile-page__header-actions">
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="small"
                        type="submit"
                        form="profile-form"
                        isLoading={isSaving}
                    >
                        Save
                    </Button>
                </div>
            </div>

            {apiError !== '' && (
                <p className="profile-page__api-error" role="alert">
                    {apiError}
                </p>
            )}

            <form
                id="profile-form"
                className="profile-page__form"
                onSubmit={onSave}
                noValidate
            >
                <section className="profile-page__section">
                    <h2 className="profile-page__section-title">
                        Personal Information
                    </h2>

                    <Input
                        label="First Name"
                        id="profile-first-name"
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        autoFocus
                        value={form.firstName}
                        onChange={(e) => {
                            onFieldChange('firstName', e.target.value);
                        }}
                    />

                    <Input
                        label="Last Name"
                        id="profile-last-name"
                        name="lastName"
                        type="text"
                        autoComplete="family-name"
                        value={form.lastName}
                        onChange={(e) => {
                            onFieldChange('lastName', e.target.value);
                        }}
                    />

                    <div className="profile-page__readonly-field">
                        <span className="profile-page__readonly-label">Email</span>
                        <span className="profile-page__readonly-value">{email}</span>
                    </div>
                </section>

                <section className="profile-page__section">
                    <h2 className="profile-page__section-title">Preferences</h2>

                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="profile-timezone">
                            Timezone
                        </label>
                        <select
                            id="profile-timezone"
                            className="input profile-page__select"
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

                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="profile-currency">
                            Currency
                        </label>
                        <select
                            id="profile-currency"
                            className="input profile-page__select"
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
                </section>
            </form>
        </>
    );
};
