import React, {
    useState,
    useEffect
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {
    getUsersControllerFindOneQueryKey,
    useUsersControllerUpdate
} from '@/api/users/users.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';
import type {UpdateUserDto} from '@/api/model/updateUserDto.js';
import type {ProfileFormState} from '@features/users/types/user.types.js';
import {ProfileEdit} from '@features/users/components/ProfileEdit.js';
import styles from '@features/settings/components/ProfileForm.module.css';

export const ProfileForm = (): React.JSX.Element => {
    const {user: authUser, updateUser} = useAuth();
    const queryClient = useQueryClient();

    const [form, setForm] = useState<ProfileFormState>({
        firstName: authUser?.firstName ?? '',
        lastName: authUser?.lastName ?? '',
        timezone: authUser?.timezone ?? 'UTC',
        currency: (authUser?.currency ?? UpdateUserDtoCurrency.USD) as UpdateUserDtoCurrency
    });
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');

    const {mutate: updateProfile, isPending: isSaving} = useUsersControllerUpdate();

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
        <div className={styles.wrapper}>
            {successMessage !== '' && (
                <p className={styles.success} role="status">
                    {successMessage}
                </p>
            )}
            <ProfileEdit
                form={form}
                email={authUser?.email ?? ''}
                apiError={apiError}
                isSaving={isSaving}
                onFieldChange={handleFieldChange}
                onSave={handleSave}
                onCancel={(): void => {
                    if (!authUser) return;
                    setApiError('');
                    setForm({
                        firstName: authUser.firstName,
                        lastName: authUser.lastName,
                        timezone: authUser.timezone,
                        currency: authUser.currency as UpdateUserDtoCurrency
                    });
                }}
            />
        </div>
    );
};
