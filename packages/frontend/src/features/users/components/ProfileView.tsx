import React from 'react';
import {Button} from '@components/common/Button/Button.js';
import type {ProfileDisplayData} from '@features/users/types/user.types.js';
import {
    TIMEZONES,
    formatDate
} from '@features/users/utils/profile.utils.js';

interface ProfileViewProps {
    displayData: ProfileDisplayData | null;
    successMessage: string;
    isLoading: boolean;
    onEdit: () => void;
    onDeleteRequest: () => void;
}

export const ProfileView = ({
    displayData,
    successMessage,
    isLoading,
    onEdit,
    onDeleteRequest
}: ProfileViewProps): React.JSX.Element => {
    return (
        <>
            <div className="profile-page__header">
                <h1 className="profile-page__title">My Profile</h1>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={onEdit}
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
                <h2 className="profile-page__section-title">Personal Information</h2>
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
                <h2 className="profile-page__section-title">Account Information</h2>
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
                <Button variant="danger" size="small" onClick={onDeleteRequest}>
                    Delete My Account
                </Button>
            </section>
        </>
    );
};
