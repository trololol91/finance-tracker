/**
 * useSyncSchedule — wraps Orval-generated sync schedule CRUD hooks.
 */
import {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useSyncScheduleControllerFindAll,
    useSyncScheduleControllerCreate,
    useSyncScheduleControllerUpdate,
    useSyncScheduleControllerRemove,
    getSyncScheduleControllerFindAllQueryKey
} from '@/api/sync-schedules/sync-schedules.js';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import type {
    SyncScheduleFormValues,
    SyncScheduleFormErrors,
    SyncScheduleModalMode
} from '@features/scraper/types/scraper.types.js';

const EMPTY_FORM: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    username: '',
    password: '',
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true
};

const validateForm = (values: SyncScheduleFormValues, isEdit: boolean): SyncScheduleFormErrors => {
    const errors: SyncScheduleFormErrors = {};
    if (values.accountId.trim() === '') errors.accountId = 'Account is required';
    if (values.bankId.trim() === '') errors.bankId = 'Bank is required';
    // In edit mode username/password are optional — leave blank keeps them unchanged
    if (!isEdit && values.username.trim() === '') errors.username = 'Username is required';
    if (!isEdit && values.password.trim() === '') errors.password = 'Password is required';
    if (values.cron.trim() === '') errors.cron = 'Cron expression is required';
    const days = parseInt(values.lookbackDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
        errors.lookbackDays = 'Lookback days must be between 1 and 365';
    }
    return errors;
};

export interface UseSyncScheduleReturn {
    schedules: SyncScheduleResponseDto[];
    isLoading: boolean;
    isError: boolean;
    modalMode: SyncScheduleModalMode;
    formValues: SyncScheduleFormValues;
    errors: SyncScheduleFormErrors;
    isSubmitting: boolean;
    editTarget: SyncScheduleResponseDto | null;
    openCreate: () => void;
    openEdit: (schedule: SyncScheduleResponseDto) => void;
    closeModal: () => void;
    handleFieldChange: (field: keyof SyncScheduleFormValues, value: string | boolean) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleDelete: (id: string) => void;
}

// eslint-disable-next-line max-lines-per-function
export const useSyncSchedule = (): UseSyncScheduleReturn => {
    const queryClient = useQueryClient();
    const [modalMode, setModalMode] = useState<SyncScheduleModalMode>(null);
    const [formValues, setFormValues] = useState<SyncScheduleFormValues>(EMPTY_FORM);
    const [errors, setErrors] = useState<SyncScheduleFormErrors>({});
    const [editTarget, setEditTarget] = useState<SyncScheduleResponseDto | null>(null);

    const {data, isLoading, isError} = useSyncScheduleControllerFindAll();
    const schedules: SyncScheduleResponseDto[] = data ?? [];

    const createMutation = useSyncScheduleControllerCreate();
    const updateMutation = useSyncScheduleControllerUpdate();
    const removeMutation = useSyncScheduleControllerRemove();

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const invalidate = useCallback((): void => {
        void queryClient.invalidateQueries({queryKey: getSyncScheduleControllerFindAllQueryKey()});
    }, [queryClient]);

    const openCreate = useCallback((): void => {
        setEditTarget(null);
        setFormValues(EMPTY_FORM);
        setErrors({});
        setModalMode('create');
    }, []);

    const openEdit = useCallback((schedule: SyncScheduleResponseDto): void => {
        setEditTarget(schedule);
        setFormValues({
            accountId: schedule.accountId,
            bankId: schedule.bankId,
            username: '',
            password: '',
            cron: schedule.cron,
            lookbackDays: String(schedule.lookbackDays),
            enabled: schedule.enabled
        });
        setErrors({});
        setModalMode('edit');
    }, []);

    const closeModal = useCallback((): void => {
        setModalMode(null);
        setEditTarget(null);
        setErrors({});
    }, []);

    const handleFieldChange = useCallback(
        (field: keyof SyncScheduleFormValues, value: string | boolean): void => {
            setFormValues((prev) => ({...prev, [field]: value}));
            setErrors((prev) => {
                const next = {...prev};
                delete next[field];
                return next;
            });
        },
        []
    );

    const handleSubmit = useCallback(
        (e: React.FormEvent): void => {
            e.preventDefault();
            const validationErrors = validateForm(formValues, editTarget !== null);
            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                return;
            }

            const onSuccess = (): void => {
                invalidate();
                setModalMode(null);
                setEditTarget(null);
            };
            const onError = (label: string) => (err: unknown): void => {
                console.error('[useSyncSchedule]', err);
                setErrors({cron: (err as {message?: string}).message ?? `Failed to ${label} schedule`});
            };

            if (editTarget !== null) {
                updateMutation.mutate(
                    {
                        id: editTarget.id,
                        data: {
                            username: formValues.username !== '' ? formValues.username : undefined,
                            password: formValues.password !== '' ? formValues.password : undefined,
                            cron: formValues.cron,
                            lookbackDays: parseInt(formValues.lookbackDays, 10),
                            enabled: formValues.enabled
                        }
                    },
                    {onSuccess, onError: onError('update')}
                );
            } else {
                createMutation.mutate(
                    {
                        data: {
                            accountId: formValues.accountId,
                            bankId: formValues.bankId,
                            username: formValues.username,
                            password: formValues.password,
                            cron: formValues.cron,
                            lookbackDays: parseInt(formValues.lookbackDays, 10)
                        }
                    },
                    {onSuccess, onError: onError('create')}
                );
            }
        },
        [formValues, editTarget, createMutation, updateMutation, invalidate]
    );

    const handleDelete = useCallback(
        (id: string): void => {
            removeMutation.mutate(
                {id},
                {
                    onSuccess: invalidate,
                    onError: (err) => { console.error('[useSyncSchedule] delete', err); }
                }
            );
        },
        [removeMutation, invalidate]
    );

    return {
        schedules,
        isLoading,
        isError,
        modalMode,
        formValues,
        errors,
        isSubmitting,
        editTarget,
        openCreate,
        openEdit,
        closeModal,
        handleFieldChange,
        handleSubmit,
        handleDelete
    };
};
