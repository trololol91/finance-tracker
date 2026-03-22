import React, {
    useRef, useEffect, useCallback, useId
} from 'react';
import {SyncScheduleForm} from '@features/scraper/components/SyncScheduleForm.js';
import {useAiStatus} from '@features/transactions/hooks/useAiStatus.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors, SyncScheduleModalMode
} from '@features/scraper/types/scraper.types.js';
import styles from '@features/scraper/components/SyncScheduleModal.module.css';

interface SyncScheduleModalProps {
    mode: SyncScheduleModalMode;
    values: SyncScheduleFormValues;
    errors: SyncScheduleFormErrors;
    isSubmitting: boolean;
    onClose: () => void;
    onChange: (field: keyof SyncScheduleFormValues, value: string | boolean) => void;
    onInputChange: (key: string, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const SyncScheduleModal = ({
    mode,
    values,
    errors,
    isSubmitting,
    onClose,
    onChange,
    onInputChange,
    onSubmit
}: SyncScheduleModalProps): React.JSX.Element | null => {
    const {available: aiAvailable} = useAiStatus();
    const headingId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const firstFieldRef = useRef<HTMLSelectElement | null>(null);
    const triggerRef = useRef<Element | null>(null);

    useEffect(() => {
        if (mode !== null) {
            triggerRef.current = document.activeElement;
        }
    }, [mode]);

    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        if (mode !== null) {
            if (!el.open) el.showModal();
        } else {
            if (el.open) el.close();
        }
    }, [mode]);

    useEffect(() => {
        if (mode === null) return;
        const raf = requestAnimationFrame(() => { firstFieldRef.current?.focus(); });
        return (): void => { cancelAnimationFrame(raf); };
    }, [mode]);

    useEffect(() => {
        if (mode !== null) return;
        if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
        }
    }, [mode]);

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

    const title = mode === 'edit' ? 'Edit Sync Schedule' : 'New Sync Schedule';

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            aria-modal="true"
            aria-labelledby={headingId}
            onClick={handleBackdropClick}
        >
            <div className={styles.content}>
                <div className={styles.header}>
                    <h2 id={headingId} className={styles.title}>{title}</h2>
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
                    <SyncScheduleForm
                        values={values}
                        errors={errors}
                        isSubmitting={isSubmitting}
                        firstFieldRef={firstFieldRef}
                        editMode={mode === 'edit'}
                        onChange={onChange}
                        onInputChange={onInputChange}
                        onSubmit={onSubmit}
                        aiAvailable={aiAvailable}
                    />
                </div>
            </div>
        </dialog>
    );
};
