import React from 'react';
import {
    useState,
    useEffect
} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useQueryClient} from '@tanstack/react-query';
import {
    getUsersControllerFindOneQueryKey,
    useUsersControllerFindOne,
    useUsersControllerUpdate
} from '@/api/users/users.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';
import type {UpdateUserDto} from '@/api/model/updateUserDto.js';
import type {
    ProfileMode,
    ProfileFormState,
    ProfileDisplayData
} from '@features/users/types/user.types.js';
import {ProfileView} from '@features/users/components/ProfileView.js';
import {ProfileEdit} from '@features/users/components/ProfileEdit.js';
import {DeleteAccountModal} from '@features/users/components/DeleteAccountModal.js';
import '@pages/ProfilePage.css';

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
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

    const {data: profile, isLoading} = useUsersControllerFindOne(
        authUser?.id ?? '',
        {query: {enabled: !!authUser?.id}}
    );

    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();

    const displayData: ProfileDisplayData | null = (profile ?? authUser) ?? null;

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

    useEffect((): (() => void) | void => {
        if (!successMessage) return;
        const timer = setTimeout((): void => { setSuccessMessage(''); }, 4000);
        return (): void => { clearTimeout(timer); };
    }, [successMessage]);

    return (
        <div className="profile-page">
            <div className="profile-page__card">
                {mode === 'view' && (
                    <ProfileView
                        displayData={displayData}
                        successMessage={successMessage}
                        isLoading={isLoading}
                        onEdit={handleEnterEdit}
                        onDeleteRequest={() => { setShowDeleteModal(true); }}
                    />
                )}
                {mode === 'edit' && (
                    <ProfileEdit
                        form={form}
                        email={authUser?.email ?? ''}
                        apiError={apiError}
                        isSaving={isSaving}
                        onFieldChange={handleFieldChange}
                        onSave={handleSave}
                        onCancel={handleCancelEdit}
                    />
                )}
            </div>

            {authUser !== null && (
                <DeleteAccountModal
                    isOpen={showDeleteModal}
                    userId={authUser.id}
                    onSuccess={() => { logout(); }}
                    onClose={() => { setShowDeleteModal(false); }}
                />
            )}
        </div>
    );
};

export default ProfilePage;
