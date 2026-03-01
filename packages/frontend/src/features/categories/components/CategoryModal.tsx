import React, {
    useRef, useEffect, useCallback
} from 'react';
import {CategoryForm} from '@features/categories/components/CategoryForm.js';
import type {
    CategoryFormValues, CategoryFormErrors, CategoryModalMode
} from '@features/categories/types/category.types.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import styles from '@features/categories/components/CategoryModal.module.css';

interface CategoryModalProps {
    mode: CategoryModalMode;
    values: CategoryFormValues;
    errors: CategoryFormErrors;
    isSubmitting: boolean;
    parentOptions: CategoryResponseDto[];
    onClose: () => void;
    onChange: (field: keyof CategoryFormValues, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const HEADING_ID = 'category-modal-title';

export const CategoryModal = ({
    mode,
    values,
    errors,
    isSubmitting,
    parentOptions,
    onClose,
    onChange,
    onSubmit
}: CategoryModalProps): React.JSX.Element | null => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const firstFieldRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<Element | null>(null);

    // Track the element that opened the dialog so we can restore focus on close.
    useEffect(() => {
        if (mode !== null) {
            triggerRef.current = document.activeElement;
        }
    }, [mode]);

    // Show / close the <dialog> element.
    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        if (mode !== null) {
            if (!el.open) el.showModal();
        } else {
            if (el.open) el.close();
        }
    }, [mode]);

    // Move focus to the first form field when the modal opens.
    useEffect(() => {
        if (mode === null) return;
        const raf = requestAnimationFrame(() => {
            firstFieldRef.current?.focus();
        });
        return (): void => { cancelAnimationFrame(raf); };
    }, [mode]);

    // Restore focus to the trigger element when the modal closes.
    useEffect(() => {
        if (mode !== null) return;
        if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
        }
    }, [mode]);

    // Focus trap — keep Tab / Shift+Tab inside the dialog.
    useEffect(() => {
        if (mode === null) return;
        const dialog = dialogRef.current;
        if (dialog === null) return;

        const getFocusable = (): HTMLElement[] =>
            Array.from(
                dialog.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            ).filter((el) => !el.hasAttribute('disabled'));

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const focusable = getFocusable();
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        dialog.addEventListener('keydown', handleKeyDown);
        return (): void => { dialog.removeEventListener('keydown', handleKeyDown); };
    }, [mode, onClose]);

    // Sync native dialog `close` event (e.g. browser built-in Escape) with our state.
    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        const handleClose = (): void => { onClose(); };
        el.addEventListener('close', handleClose);
        return (): void => { el.removeEventListener('close', handleClose); };
    }, [onClose]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDialogElement>): void => {
            if (e.target === dialogRef.current) onClose();
        },
        [onClose]
    );

    const title = mode === 'edit' ? 'Edit Category' : 'New Category';

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            aria-modal="true"
            aria-labelledby={HEADING_ID}
            onClick={handleBackdropClick}
        >
            <div className={styles.content}>
                <div className={styles.header}>
                    <h2 id={HEADING_ID} className={styles.title}>{title}</h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        aria-label="Close dialog"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>
                <div className={styles.body}>
                    <CategoryForm
                        values={values}
                        errors={errors}
                        isSubmitting={isSubmitting}
                        parentOptions={parentOptions}
                        firstFieldRef={firstFieldRef}
                        onChange={onChange}
                        onSubmit={onSubmit}
                        editMode={mode === 'edit'}
                    />
                </div>
            </div>
        </dialog>
    );
};
