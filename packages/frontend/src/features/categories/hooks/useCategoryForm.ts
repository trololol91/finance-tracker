import {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useCategoriesControllerCreate,
    useCategoriesControllerUpdate,
    getCategoriesControllerFindAllQueryKey
} from '@/api/categories/categories.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {CreateCategoryDto} from '@/api/model/createCategoryDto.js';
import type {UpdateCategoryDto} from '@/api/model/updateCategoryDto.js';
import type {
    CategoryFormValues, CategoryFormErrors
} from '@features/categories/types/category.types.js';

const EMPTY_FORM: CategoryFormValues = {
    name: '',
    description: '',
    color: '',
    icon: '',
    parentId: ''
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const validateForm = (
    values: CategoryFormValues,
    setErrors: (e: CategoryFormErrors) => void
): boolean => {
    const newErrors: CategoryFormErrors = {};
    if (values.name.trim() === '') newErrors.name = 'Name is required';
    else if (values.name.trim().length > 100) newErrors.name = 'Name must be 100 characters or fewer';
    if (values.description.length > 255) newErrors.description = 'Description must be 255 characters or fewer';
    if (values.color !== '' && !HEX_RE.test(values.color)) {
        newErrors.color = 'Color must be a valid hex code (e.g. #FF5733)';
    }
    if (values.icon.length > 10) newErrors.icon = 'Icon must be 10 characters or fewer';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

const buildCreateDto = (values: CategoryFormValues): CreateCategoryDto => ({
    name: values.name.trim(),
    description: values.description.trim() !== '' ? values.description.trim() : null,
    color: values.color !== '' ? values.color : null,
    icon: values.icon.trim() !== '' ? values.icon.trim() : null,
    parentId: values.parentId !== '' ? values.parentId : null
});

const buildUpdateDto = (values: CategoryFormValues): UpdateCategoryDto => ({
    name: values.name.trim(),
    description: values.description.trim() !== '' ? values.description.trim() : null,
    color: values.color !== '' ? values.color : null,
    icon: values.icon.trim() !== '' ? values.icon.trim() : null,
    parentId: values.parentId !== '' ? values.parentId : null
});

interface UseCategoryFormProps {
    /** Called after a successful create or update so the caller can close the modal. */
    onSuccess: () => void;
}

interface UseCategoryFormReturn {
    formValues: CategoryFormValues;
    errors: CategoryFormErrors;
    editTarget: CategoryResponseDto | null;
    isSubmitting: boolean;
    openCreate: () => void;
    openEdit: (category: CategoryResponseDto) => void;
    handleFieldChange: (field: keyof CategoryFormValues, value: string) => void;
    handleSubmit: (e: React.FormEvent) => void;
}

export const useCategoryForm = ({onSuccess}: UseCategoryFormProps): UseCategoryFormReturn => {
    const queryClient = useQueryClient();
    const [formValues, setFormValues] = useState<CategoryFormValues>(EMPTY_FORM);
    const [errors, setErrors] = useState<CategoryFormErrors>({});
    const [editTarget, setEditTarget] = useState<CategoryResponseDto | null>(null);

    const {mutate: create, isPending: isCreating} = useCategoriesControllerCreate();
    const {mutate: update, isPending: isUpdating} = useCategoriesControllerUpdate();
    const isSubmitting = isCreating || isUpdating;

    const invalidate = useCallback((): void => {
        void queryClient.invalidateQueries({queryKey: getCategoriesControllerFindAllQueryKey()});
    }, [queryClient]);

    const openCreate = useCallback((): void => {
        setEditTarget(null);
        setFormValues(EMPTY_FORM);
        setErrors({});
    }, []);

    const openEdit = useCallback((category: CategoryResponseDto): void => {
        setEditTarget(category);
        setFormValues({
            name: category.name,
            description: category.description ?? '',
            color: category.color ?? '',
            icon: category.icon ?? '',
            parentId: category.parentId ?? ''
        });
        setErrors({});
    }, []);

    const handleFieldChange = useCallback(
        (field: keyof CategoryFormValues, value: string): void => {
            setFormValues((prev) => ({...prev, [field]: value}));
            if (errors[field]) {
                setErrors((prev) => ({...prev, [field]: undefined}));
            }
        },
        [errors]
    );

    const handleSubmit = useCallback(
        (e: React.FormEvent): void => {
            e.preventDefault();
            if (!validateForm(formValues, setErrors)) return;

            if (editTarget !== null) {
                update(
                    {id: editTarget.id, data: buildUpdateDto(formValues)},
                    {
                        onSuccess: (): void => { invalidate(); onSuccess(); },
                        onError: (err): void => {
                            console.error('[CategoryForm]', err);
                            // Extract server message if available
                            const msg = (err as unknown as {message?: string}).message ?? 'Failed to update category';
                            setErrors({name: msg});
                        }
                    }
                );
            } else {
                create(
                    {data: buildCreateDto(formValues)},
                    {
                        onSuccess: (): void => { invalidate(); onSuccess(); },
                        onError: (err): void => {
                            console.error('[CategoryForm]', err);
                            const msg = (err as unknown as {message?: string}).message ?? 'Failed to create category';
                            setErrors({name: msg});
                        }
                    }
                );
            }
        },
        [formValues, editTarget, create, update, invalidate, onSuccess]
    );

    return {
        formValues,
        errors,
        editTarget,
        isSubmitting,
        openCreate,
        openEdit,
        handleFieldChange,
        handleSubmit
    };
};
