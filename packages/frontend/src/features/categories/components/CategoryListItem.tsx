import React, {
    useState, useCallback
} from 'react';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import styles from '@features/categories/components/CategoryListItem.module.css';

interface CategoryListItemProps {
    category: CategoryResponseDto;
    parentName: string | null;
    onEdit: (category: CategoryResponseDto) => void;
    onDelete: (id: string, name: string) => void;
    onToggleActive: (category: CategoryResponseDto) => void;
}

export const CategoryListItem = ({
    category,
    parentName,
    onEdit,
    onDelete,
    onToggleActive
}: CategoryListItemProps): React.JSX.Element => {
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const handleDeleteClick = useCallback((): void => {
        setConfirmingDelete(true);
    }, []);

    const handleConfirmDelete = useCallback((): void => {
        setConfirmingDelete(false);
        onDelete(category.id, category.name);
    }, [onDelete, category.id, category.name]);

    const handleCancelDelete = useCallback((): void => {
        setConfirmingDelete(false);
    }, []);

    const colorSwatch = category.color !== null ? (
        <span
            className={styles.colorSwatch}
            style={{backgroundColor: category.color}}
            aria-hidden="true"
        />
    ) : (
        <span className={`${styles.colorSwatch} ${styles.colorSwatchEmpty}`} aria-hidden="true" />
    );

    return (
        <tr
            className={`${styles.row}${!category.isActive ? ` ${styles.rowInactive}` : ''}`}
            data-testid={`category-row-${category.id}`}
        >
            {/* Color + Icon */}
            <td className={styles.cellColor}>
                {colorSwatch}
                {category.icon !== null && (
                    <span className={styles.icon} aria-label={`Icon: ${category.icon}`}>{category.icon}</span>
                )}
            </td>

            {/* Name */}
            <td className={styles.cellName}>
                <span className={styles.name}>{category.name}</span>
                {!category.isActive && (
                    <span className={styles.inactiveBadge} aria-label="inactive">Inactive</span>
                )}
            </td>

            {/* Parent */}
            <td className={`${styles.cellParent} ${styles.hideOnMobile}`}>
                {parentName ?? <span className={styles.none}>—</span>}
            </td>

            {/* Transactions */}
            <td className={`${styles.cellCount} ${styles.hideOnMobile}`}>
                {category.transactionCount}
            </td>

            {/* Actions */}
            <td className={styles.cellActions}>
                {confirmingDelete ? (
                    <span className={styles.confirmRow} role="group" aria-label="Confirm deletion">
                        <span className={styles.confirmLabel}>Delete?</span>
                        <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={handleConfirmDelete}
                            aria-label={`Confirm delete ${category.name}`}
                        >
                            Yes
                        </button>
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={handleCancelDelete}
                            aria-label="Cancel delete"
                        >
                            No
                        </button>
                    </span>
                ) : (
                    <span className={styles.buttonGroup}>
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => { onToggleActive(category); }}
                            aria-label={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`}
                            title={category.isActive ? 'Deactivate' : 'Activate'}
                        >
                            {category.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => { onEdit(category); }}
                            aria-label={`Edit ${category.name}`}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={handleDeleteClick}
                            aria-label={`Delete ${category.name}`}
                        >
                            Delete
                        </button>
                    </span>
                )}
            </td>
        </tr>
    );
};
