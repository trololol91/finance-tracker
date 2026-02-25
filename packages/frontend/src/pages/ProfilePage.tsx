import React from 'react';
import {
    useState,
    useEffect
} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import type {ProfileMode} from '@features/users/types/user.types.js';
import {useQueryClient} from '@tanstack/react-query';
import {
    getUsersControllerFindOneQueryKey,
    useUsersControllerFindOne,
    useUsersControllerUpdate
} from '@/api/users/users.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';
import type {UpdateUserDto} from '@/api/model/updateUserDto.js';
import '@pages/ProfilePage.css';

interface ProfileFormState {
    firstName: string;
    lastName: string;
    timezone: string;
    currency: UpdateUserDtoCurrency;
}

interface TimezoneOption {
    value: string;
    label: string;
}

const TIMEZONES: TimezoneOption[] = [
    {value: 'America/New_York', label: 'Eastern Time (ET)'},
    {value: 'America/Chicago', label: 'Central Time (CT)'},
    {value: 'America/Denver', label: 'Mountain Time (MT)'},
    {value: 'America/Los_Angeles', label: 'Pacific Time (PT)'},
    {value: 'America/Anchorage', label: 'Alaska Time (AKT)'},
    {value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)'},
    {value: 'America/Toronto', label: 'Toronto (ET)'},
    {value: 'America/Vancouver', label: 'Vancouver (PT)'},
    {value: 'America/Halifax', label: 'Halifax (AT)'},
    {value: 'America/Winnipeg', label: 'Winnipeg (CT)'},
    {value: 'America/Regina', label: 'Saskatchewan (CT)'},
    {value: 'America/Edmonton', label: 'Edmonton (MT)'},
    {value: 'America/St_Johns', label: "St. John's (NT)"},
    {value: 'Europe/London', label: 'London (GMT/BST)'},
    {value: 'Europe/Paris', label: 'Paris (CET/CEST)'},
    {value: 'Europe/Berlin', label: 'Berlin (CET/CEST)'},
    {value: 'Asia/Tokyo', label: 'Tokyo (JST)'},
    {value: 'Asia/Shanghai', label: 'Shanghai (CST)'},
    {value: 'Asia/Singapore', label: 'Singapore (SGT)'},
    {value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)'},
    {value: 'UTC', label: 'UTC'}
];

const formatDate = (isoString: string): string =>
    new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

export const ProfilePage = (): React.JSX.Element => {
    const {user: authUser, updateUser, logout} = useAuth();
    const queryClient = useQueryClient();

    const [mode, setMode] = useState<ProfileMode>('view');
    const [form, setForm] = useState<ProfileFormState>({
        firstName: '',
        lastName: '',
        timezone: 'UTC',
        currency: UpdateUserDtoCurrency.USD
    });
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

    const {data: profile, isLoading} = useUsersControllerFindOne(
        authUser?.id ?? '',
        {query: {enabled: !!authUser?.id}}
    );

    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();

    const displayData = profile ?? authUser;

    const handleEnterEdit = (): void => {
        setApiError('');
        setSuccessMessage('');
        setForm({
            firstName: displayData?.firstName ?? '',
            lastName: displayData?.lastName ?? '',
            timezone: displayData?.timezone ?? 'UTC',
            currency: (displayData?.currency ?? UpdateUserDtoCurrency.USD) as UpdateUserDtoCurrency
        });
        setMode('edit');
    };

    const handleCancelEdit = (): void => {
        setApiError('');
        setMode('view');
    };

    const handleFieldChange = (field: keyof ProfileFormState, value: string): void => {
        setForm((prev): ProfileFormState => ({...prev, [field]: value} as ProfileFormState));
    };

    const handleSave = (e: React.FormEvent): void => {
        e.preventDefault();
        if (!authUser) return;

        setApiError('');

        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();

        const data: UpdateUserDto = {
            firstName: firstName !== '' ? firstName : undefined,
            lastName: lastName !== '' ? lastName : undefined,
            timezone: form.timezone,
            currency: form.currency
        };

        updateProfile(
            {id: authUser.id, data},
            {
                onSuccess: (updated): void => {
                    queryClient.setQueryData(
                        getUsersControllerFindOneQueryKey(authUser.id),
                        updated
                    );
                    updateUser({
                        ...authUser,
                        firstName: updated.firstName ?? authUser.firstName,
                        lastName: updated.lastName ?? authUser.lastName,
                        timezone: updated.timezone,
                        currency: updated.currency
                    });
                    setMode('view');
                    setSuccessMessage('Profile updated successfully.');
                },
                onError: (): void => {
                    setApiError('Failed to save profile. Please try again.');
                }
            }
        );
    };

    const handleDeleteAccount = (): void => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = (): void => {
        logout();
    };

    useEffect((): (() => void) | void => {
        if (!successMessage) return;
        const timer = setTimeout((): void => { setSuccessMessage(''); }, 4000);
        return (): void => { clearTimeout(timer); };
    }, [successMessage]);

    return (
        <div className="profile-page">
            <div className="profile-page__card">

                {mode === 'view' && (
                    <>
                        <div className="profile-page__header">
                            <h1 className="profile-page__title">My Profile</h1>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={handleEnterEdit}
                                disabled={isLoading}
                            >
                                Edit Profile
                            </Button>
                        </div>

                        {successMessage !== '' && (
                            <p className="profile-page__success" role="status">
                                {successMessage}
                            </p>
                        )}

                        <section className="profile-page__section">
                            <h2 className="profile-page__section-title">
                                Personal Information
                            </h2>
                            <dl className="profile-page__fields">
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">First Name</dt>
                                    <dd className="profile-page__field-value">
                                        {displayData?.firstName ??
                                            <span className="profile-page__empty">Not set</span>
                                        }
                                    </dd>
                                </div>
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Last Name</dt>
                                    <dd className="profile-page__field-value">
                                        {displayData?.lastName ??
                                            <span className="profile-page__empty">Not set</span>
                                        }
                                    </dd>
                                </div>
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Email</dt>
                                    <dd className="profile-page__field-value">
                                        {displayData?.email ?? '\u2014'}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <section className="profile-page__section">
                            <h2 className="profile-page__section-title">Preferences</h2>
                            <dl className="profile-page__fields">
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Timezone</dt>
                                    <dd className="profile-page__field-value">
                                        {TIMEZONES.find(
                                            (tz) => tz.value === displayData?.timezone
                                        )?.label ?? displayData?.timezone ?? '\u2014'}
                                    </dd>
                                </div>
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Currency</dt>
                                    <dd className="profile-page__field-value">
                                        {displayData?.currency ?? '\u2014'}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <section className="profile-page__section">
                            <h2 className="profile-page__section-title">
                                Account Information
                            </h2>
                            <dl className="profile-page__fields">
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Status</dt>
                                    <dd className="profile-page__field-value">
                                        <span
                                            className={
                                                displayData?.isActive
                                                    ? 'profile-page__status--active'
                                                    : 'profile-page__status--inactive'
                                            }
                                        >
                                            {displayData?.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </dd>
                                </div>
                                <div className="profile-page__field">
                                    <dt className="profile-page__field-label">Member Since</dt>
                                    <dd className="profile-page__field-value">
                                        {displayData?.createdAt
                                            ? formatDate(displayData.createdAt)
                                            : '\u2014'
                                        }
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <div className="profile-page__divider" role="separator" />

                        <section className="profile-page__danger-zone">
                            <h2 className="profile-page__danger-title">Danger Zone</h2>
                            <p className="profile-page__danger-description">
                                Permanently delete your account and all associated data.
                                This action cannot be undone.
                            </p>

                            {showDeleteConfirm
                                ? (
                                    <div className="profile-page__delete-confirm">
                                        <p className="profile-page__delete-confirm-text">
                                            Are you sure? This will permanently delete your
                                            account.
                                        </p>
                                        <div className="profile-page__delete-confirm-actions">
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="small"
                                                onClick={handleConfirmDelete}
                                            >
                                                Yes, Delete My Account
                                            </Button>
                                        </div>
                                    </div>
                                )
                                : (
                                    <Button
                                        variant="danger"
                                        size="small"
                                        onClick={handleDeleteAccount}
                                    >
                                        Delete My Account
                                    </Button>
                                )
                            }
                        </section>
                    </>
                )}

                {mode === 'edit' && (
                    <>
                        <div className="profile-page__header">
                            <h1 className="profile-page__title">Edit Profile</h1>
                            <div className="profile-page__header-actions">
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={handleCancelEdit}
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
                            onSubmit={handleSave}
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
                                    value={form.firstName}
                                    onChange={(e) => {
                                        handleFieldChange('firstName', e.target.value);
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
                                        handleFieldChange('lastName', e.target.value);
                                    }}
                                />

                                <div className="profile-page__readonly-field">
                                    <span className="profile-page__readonly-label">Email</span>
                                    <span className="profile-page__readonly-value">
                                        {authUser?.email}
                                    </span>
                                </div>
                            </section>

                            <section className="profile-page__section">
                                <h2 className="profile-page__section-title">Preferences</h2>

                                <div className="input-wrapper">
                                    <label
                                        className="input-label"
                                        htmlFor="profile-timezone"
                                    >
                                        Timezone
                                    </label>
                                    <select
                                        id="profile-timezone"
                                        className="input profile-page__select"
                                        value={form.timezone}
                                        onChange={(e) => {
                                            handleFieldChange('timezone', e.target.value);
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
                                    <label
                                        className="input-label"
                                        htmlFor="profile-currency"
                                    >
                                        Currency
                                    </label>
                                    <select
                                        id="profile-currency"
                                        className="input profile-page__select"
                                        value={form.currency}
                                        onChange={(e) => {
                                            handleFieldChange(
                                                'currency',
                                                e.target.value
                                            );
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
                )}
            </div>
        </div>
    );
};

export default ProfilePage;
