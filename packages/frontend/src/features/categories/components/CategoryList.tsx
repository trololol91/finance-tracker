import React from 'react';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import {CategoryListItem} from '@features/categories/components/CategoryListItem.js';
import styles from '@features/categories/components/CategoryList.module.css';

interface CategoryListProps {
    categories: CategoryResponseDto[];
    isLoading: boolean;
    isError: boolean;
    showInactive: boolean;
    onEdit: (category: CategoryResponseDto) => void;
    onDelete: (id: string, name: string) => void;
    onToggleActive: (category: CategoryResponseDto) => void;
}

export const CategoryList = ({
    categories,
    isLoading,
    isError,
    showInactive,
    onEdit,
    onDelete,
    onToggleActive
}: CategoryListProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <div className={`${styles.centered}`} aria-live="polite" aria-busy="true">
                <p className={styles.message}>Loading categories…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.centered} role="alert">
                <p className={`${styles.message} ${styles.messageError}`}>
                    Failed to load categories. Please try again.
                </p>
            </div>
        );
    }

    const visible = showInactive
        ? categories
        : categories.filter((c) => c.isActive);

    if (visible.length === 0) {
        return (
            <div className={styles.centered}>
                <p className={styles.message}>
                    {showInactive
                        ? 'No categories found.'
                        : 'No active categories. Create one or show inactive.'}
                </p>
            </div>
        );
    }

    // Build a quick lookup map for parent names.
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Categories">
                <thead>
                    <tr>
                        <th scope="col" className={styles.th}>Color / Icon</th>
                        <th scope="col" className={styles.th}>Name</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Parent</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Transactions</th>
                        <th scope="col" className={`${styles.th} ${styles.thActions}`}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {visible.map((cat) => (
                        <CategoryListItem
                            key={cat.id}
                            category={cat}
                            parentName={cat.parentId !== null
                                ? (nameById.get(cat.parentId) ?? null)
                                : null}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleActive={onToggleActive}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
