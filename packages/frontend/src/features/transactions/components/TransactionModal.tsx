import React, {
    useEffect, useRef
} from 'react';
import {TransactionForm} from '@features/transactions/components/TransactionForm.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionModal.css';

type FormErrors = Partial<Record<keyof TransactionFormValues, string>>;

interface TransactionModalProps {
    isOpen: boolean;
    editTarget: TransactionResponseDto | null;
    formValues: TransactionFormValues;
    errors: FormErrors;
    isSubmitting: boolean;
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
    onFieldChange,
    onSubmit,
    onClose
}: TransactionModalProps): React.JSX.Element | null => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (isOpen) {
            if (!dialog.open) dialog.showModal();
        } else {
            if (dialog.open) dialog.close();
        }
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
        <dialog
            ref={dialogRef}
            className="tx-modal"
            aria-label={title}
            onClick={handleBackdropClick}
        >
            <div className="tx-modal__content">
                <div className="tx-modal__header">
                    <h2 className="tx-modal__title">{title}</h2>
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
                    onFieldChange={onFieldChange}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                />
            </div>
        </dialog>
    );
};
