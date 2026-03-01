import React, {
    useEffect, useRef
} from 'react';
import {TransactionForm} from '@features/transactions/components/TransactionForm.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionModal.css';

type FormErrors = Partial<Record<keyof TransactionFormValues, string>>;

/** CSS selector matching all interactive elements that participate in Tab order. */
const FOCUSABLE_SELECTOR =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface TransactionModalProps {
    isOpen: boolean;
    editTarget: TransactionResponseDto | null;
    formValues: TransactionFormValues;
    errors: FormErrors;
    isSubmitting: boolean;
    categories?: CategoryResponseDto[];
    onFieldChange: (field: keyof TransactionFormValues, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

export const TransactionModal = ({
    isOpen,
    editTarget,
    formValues,
    errors,
    isSubmitting,
    categories,
    onFieldChange,
    onSubmit,
    onClose
}: TransactionModalProps): React.JSX.Element | null => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);

    // BUG-07: safe showModal() — try/catch prevents InvalidStateError under StrictMode
    // double-invoke when the dialog is already in the top layer.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (isOpen) {
            if (!dialog.open) {
                try { dialog.showModal(); } catch { /* already in top layer */ }
            }
        } else {
            if (dialog.open) dialog.close();
        }
    }, [isOpen]);

    // BUG-05: move initial focus to the Amount field, not the Close button.
    useEffect(() => {
        if (!isOpen) return;
        const id = requestAnimationFrame(() => {
            amountInputRef.current?.focus();
        });
        return (): void => { cancelAnimationFrame(id); };
    }, [isOpen]);

    // BUG-06: focus trap — Tab/Shift+Tab must cycle within the dialog only.
    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const handleTab = (e: KeyboardEvent): void => {
            if (e.key !== 'Tab') return;
            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        dialog.addEventListener('keydown', handleTab);
        return (): void => { dialog.removeEventListener('keydown', handleTab); };
    }, [isOpen]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const handleClose = (): void => { onClose(); };
        dialog.addEventListener('close', handleClose);
        return (): void => { dialog.removeEventListener('close', handleClose); };
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
        if (e.target === dialogRef.current) onClose();
    };

    const title = editTarget !== null ? 'Edit Transaction' : 'Add Transaction';

    return (
        // BUG-06: aria-modal + aria-labelledby replace the earlier aria-label.
        <dialog
            ref={dialogRef}
            className="tx-modal"
            aria-modal="true"
            aria-labelledby="tx-modal-title"
            onClick={handleBackdropClick}
        >
            <div className="tx-modal__content">
                <div className="tx-modal__header">
                    <h2 id="tx-modal-title" className="tx-modal__title">{title}</h2>
                    <button
                        type="button"
                        className="tx-modal__close"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        &#x2715;
                    </button>
                </div>
                <TransactionForm
                    formValues={formValues}
                    errors={errors}
                    editTarget={editTarget}
                    isSubmitting={isSubmitting}
                    categories={categories}
                    amountRef={amountInputRef}
                    onFieldChange={onFieldChange}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                />
            </div>
        </dialog>
    );
};
