import React, {
    useState, useCallback
} from 'react';
import {
    useCategoriesControllerFindAll,
    useCategoriesControllerUpdate,
    useCategoriesControllerRemove,
    getCategoriesControllerFindAllQueryKey
} from '@/api/categories/categories.js';
import {
    useCategoryRulesControllerFindAll,
    useCategoryRulesControllerRemove,
    getCategoryRulesControllerFindAllQueryKey
} from '@/api/category-rules/category-rules.js';
import {useQueryClient} from '@tanstack/react-query';
import {CategoryList} from '@features/categories/components/CategoryList.js';
import {CategoryModal} from '@features/categories/components/CategoryModal.js';
import {useCategoryForm} from '@features/categories/hooks/useCategoryForm.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {CategoryModalMode} from '@features/categories/types/category.types.js';
import type {CategoryRuleResponseDto} from '@/api/model/categoryRuleResponseDto.js';
import styles from '@pages/CategoriesPage.module.css';

const CategoriesPage = (): React.JSX.Element => {
    const queryClient = useQueryClient();
    const [modalMode, setModalMode] = useState<CategoryModalMode>(null);
    const [showInactive, setShowInactive] = useState(false);

    const {data, isLoading, isError} = useCategoriesControllerFindAll();
    const {data: rulesData} = useCategoryRulesControllerFindAll();
    const rules: CategoryRuleResponseDto[] = rulesData ?? [];
    const {mutate: deleteRule} = useCategoryRulesControllerRemove();

    const invalidateRules = useCallback((): void => {
        void queryClient.invalidateQueries({queryKey: getCategoryRulesControllerFindAllQueryKey()});
    }, [queryClient]);

    const handleDeleteRule = useCallback((id: string): void => {
        deleteRule({id}, {onSuccess: invalidateRules});
    }, [deleteRule, invalidateRules]);
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

                {/* Category Rules */}
                <section className={styles.rulesSection} aria-label="Category rules">
                    <h2 className={styles.rulesTitle}>Category Rules</h2>
                    <p className={styles.rulesHint}>
                        Rules match transaction descriptions by substring (case-insensitive)
                        and assign a category — checked before AI suggestions.
                    </p>
                    {rules.length === 0 ? (
                        <p className={styles.rulesEmpty}>
                            No rules yet. Open a transaction in edit mode and click
                            &ldquo;Save as rule&rdquo; to create one.
                        </p>
                    ) : (
                        <table className={styles.rulesTable}>
                            <thead>
                                <tr>
                                    <th className={styles.rulesTh}>Pattern</th>
                                    <th className={styles.rulesTh}>Category</th>
                                    <th className={styles.rulesTh}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map((rule) => (
                                    <tr key={rule.id} className={styles.rulesTr}>
                                        <td className={styles.rulesTd}>
                                            <code className={styles.rulesPattern}>
                                                {rule.pattern}
                                            </code>
                                        </td>
                                        <td className={styles.rulesTd}>{rule.categoryName}</td>
                                        <td className={styles.rulesTdActions}>
                                            <button
                                                type="button"
                                                className={styles.rulesDeleteBtn}
                                                onClick={(): void => { handleDeleteRule(rule.id); }}
                                                aria-label={`Delete rule for "${rule.pattern}"`}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
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
