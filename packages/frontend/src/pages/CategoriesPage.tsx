import React, {
    useState, useCallback
} from 'react';
import {
    useCategoriesControllerFindAll,
    useCategoriesControllerUpdate,
    useCategoriesControllerRemove,
    getCategoriesControllerFindAllQueryKey
} from '@/api/categories/categories.js';
import {useQueryClient} from '@tanstack/react-query';
import {CategoryList} from '@features/categories/components/CategoryList.js';
import {CategoryModal} from '@features/categories/components/CategoryModal.js';
import {useCategoryForm} from '@features/categories/hooks/useCategoryForm.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {CategoryModalMode} from '@features/categories/types/category.types.js';
import styles from '@pages/CategoriesPage.module.css';

const CategoriesPage = (): React.JSX.Element => {
    const queryClient = useQueryClient();
    const [modalMode, setModalMode] = useState<CategoryModalMode>(null);
    const [showInactive, setShowInactive] = useState(false);

    const {data, isLoading, isError} = useCategoriesControllerFindAll();
    const categories: CategoryResponseDto[] = data ?? [];

    const {mutate: updateCategory} = useCategoriesControllerUpdate();
    const {mutate: deleteCategory} = useCategoriesControllerRemove();

    const invalidate = useCallback((): void => {
        void queryClient.invalidateQueries({queryKey: getCategoriesControllerFindAllQueryKey()});
    }, [queryClient]);

    const handleModalClose = useCallback((): void => {
        setModalMode(null);
    }, []);

    const {
        formValues,
        errors,
        editTarget,
        isSubmitting,
        openCreate,
        openEdit,
        handleFieldChange,
        handleSubmit
    } = useCategoryForm({
        onSuccess: handleModalClose
    });

    const handleNewCategory = useCallback((): void => {
        openCreate();
        setModalMode('create');
    }, [openCreate]);

    const handleEdit = useCallback((category: CategoryResponseDto): void => {
        openEdit(category);
        setModalMode('edit');
    }, [openEdit]);

    const handleDelete = useCallback((id: string, name: string): void => {
        deleteCategory(
            {id},
            {
                onSuccess: (): void => { invalidate(); },
                onError: (err): void => {
                    console.error(`[CategoriesPage] Failed to delete category "${name}"`, err);
                }
            }
        );
    }, [deleteCategory, invalidate]);

    const handleToggleActive = useCallback((category: CategoryResponseDto): void => {
        updateCategory(
            {id: category.id, data: {isActive: !category.isActive}},
            {
                onSuccess: (): void => { invalidate(); },
                onError: (err): void => {
                    console.error(`[CategoriesPage] Failed to toggle active state for "${category.name}"`, err);
                }
            }
        );
    }, [updateCategory, invalidate]);

    // Parent options for the form: top-level active categories, excluding the one being edited.
    const parentOptions = categories.filter(
        (c) => c.parentId === null && c.isActive && c.id !== (editTarget?.id ?? '')
    );

    return (
        <main className={styles.page} aria-label="Categories">
            <div className={styles.inner}>
                {/* Header */}
                <header className={styles.header}>
                    <h1 className={styles.title}>Categories</h1>
                    <button
                        type="button"
                        className={styles.newBtn}
                        onClick={handleNewCategory}
                        aria-label="Create new category"
                    >
                        + New Category
                    </button>
                </header>

                {/* Toolbar */}
                <div className={styles.toolbar} role="toolbar" aria-label="Category filters">
                    <label className={styles.toggleLabel}>
                        <input
                            type="checkbox"
                            className={styles.toggleCheckbox}
                            checked={showInactive}
                            onChange={(e) => { setShowInactive(e.target.checked); }}
                            aria-label="Show inactive categories"
                        />
                        Show inactive
                    </label>
                </div>

                {/* List */}
                <CategoryList
                    categories={categories}
                    isLoading={isLoading}
                    isError={isError}
                    showInactive={showInactive}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                />
            </div>

            {/* Create / Edit Modal */}
            <CategoryModal
                mode={modalMode}
                values={formValues}
                errors={errors}
                isSubmitting={isSubmitting}
                parentOptions={parentOptions}
                onClose={handleModalClose}
                onChange={handleFieldChange}
                onSubmit={handleSubmit}
            />
        </main>
    );
};

export default CategoriesPage;
