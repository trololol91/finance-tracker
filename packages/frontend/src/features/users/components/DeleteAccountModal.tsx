import React, {
    useState,
    useEffect,
    useRef,
    useCallback
} from 'react';
import {createPortal} from 'react-dom';
import {TriangleAlert} from 'lucide-react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {useUsersControllerRemove} from '@/api/users/users.js';
import '@features/users/components/DeleteAccountModal.css';

interface DeleteAccountModalProps {
    isOpen: boolean;
    userId: string;
    onSuccess: () => void;
    onClose: () => void;
}

export const DeleteAccountModal = ({
    isOpen,
    userId,
    onSuccess,
    onClose
}: DeleteAccountModalProps): React.JSX.Element | null => {
    const [password, setPassword] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');

    const {mutate: removeAccount, isPending} = useUsersControllerRemove();

    const modalRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback((): void => {
        setPassword('');
        setApiError('');
        onClose();
    }, [onClose]);

    const handleConfirm = (): void => {
        setApiError('');
        removeAccount(
            {id: userId},
            {
                onSuccess: (): void => { onSuccess(); },
                onError: (): void => {
                    setApiError('Failed to delete account. Please try again.');
                }
            }
        );
    };

    // Focus trap — keep Tab/Shift+Tab cycling within the modal
    useEffect((): (() => void) | void => {
        if (!isOpen) return;
        const modal = modalRef.current;
        if (modal === null) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];
        const handleTabKey = (e: KeyboardEvent): void => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };
        document.addEventListener('keydown', handleTabKey);
        return (): void => { document.removeEventListener('keydown', handleTabKey); };
    }, [isOpen]);

    // ESC key closes the modal
    useEffect((): (() => void) | void => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return (): void => { document.removeEventListener('keydown', handleKeyDown); };
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="delete-account-modal__overlay"
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                className="delete-account-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-modal-title"
                onClick={(e) => { e.stopPropagation(); }}
            >
                <div className="delete-account-modal__icon">
                    <TriangleAlert size={28} aria-hidden="true" />
                </div>

                <h2
                    id="delete-modal-title"
                    className="delete-account-modal__title"
                >
                    Delete Account
                </h2>

                <p className="delete-account-modal__description">
                    This will permanently delete your account and all associated
                    data including transactions, categories, and settings.
                </p>

                <p className="delete-account-modal__warning">
                    This action cannot be undone.
                </p>

                <Input
                    id="delete-confirm-password"
                    label="Enter your password to confirm"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); }}
                />

                {apiError !== '' && (
                    <p className="delete-account-modal__api-error" role="alert">
                        {apiError}
                    </p>
                )}

                <div className="delete-account-modal__actions">
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={handleClose}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        size="small"
                        onClick={handleConfirm}
                        disabled={password.trim() === ''}
                        isLoading={isPending}
                    >
                        Delete My Account
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    ) as React.JSX.Element;
};
