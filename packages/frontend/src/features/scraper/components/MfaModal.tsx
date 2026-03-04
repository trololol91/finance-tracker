import React, {
    useRef, useEffect, useCallback, useState, useId
} from 'react';
import styles from '@features/scraper/components/MfaModal.module.css';

interface MfaModalProps {
    isOpen: boolean;
    challenge: string;
    isSubmitting: boolean;
    onSubmit: (code: string) => void;
    onCancel: () => void;
}

export const MfaModal = ({
    isOpen,
    challenge,
    isSubmitting,
    onSubmit,
    onCancel
}: MfaModalProps): React.JSX.Element | null => {
    const headingId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<Element | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement;
        }
    }, [isOpen]);

    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        if (isOpen) {
            if (!el.open) el.showModal();
        } else {
            if (el.open) el.close();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const raf = requestAnimationFrame(() => { inputRef.current?.focus(); });
        return (): void => { cancelAnimationFrame(raf); };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) return;
        if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        if (dialog === null) return;

        const getFocusable = (): HTMLElement[] =>
            Array.from(
                dialog.querySelectorAll<HTMLElement>(
                    'button, input, [tabindex]:not([tabindex="-1"])'
                )
            ).filter((el) => !el.hasAttribute('disabled'));

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') { onCancel(); return; }
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
    }, [isOpen, onCancel]);

    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        const handleClose = (): void => { onCancel(); };
        el.addEventListener('close', handleClose);
        return (): void => { el.removeEventListener('close', handleClose); };
    }, [onCancel]);

    const handleSubmit = useCallback(
        (e: React.FormEvent): void => {
            e.preventDefault();
            if (code.trim() === '') {
                setError('MFA code is required');
                return;
            }
            setError(null);
            onSubmit(code.trim());
        },
        [code, onSubmit]
    );

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDialogElement>): void => {
            if (e.target === dialogRef.current) onCancel();
        },
        [onCancel]
    );

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
                    <h2 id={headingId} className={styles.title}>MFA Required</h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        aria-label="Cancel MFA"
                        onClick={onCancel}
                    >
                        ✕
                    </button>
                </div>
                <div className={styles.body}>
                    {challenge !== '' && (
                        <p className={styles.challenge}>{challenge}</p>
                    )}
                    <form onSubmit={handleSubmit} noValidate>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="mfa-code">
                                Authentication Code <span aria-hidden="true" className={styles.required}>*</span>
                            </label>
                            <input
                                id="mfa-code"
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                className={`${styles.input}${error !== null ? ` ${styles.inputError}` : ''}`}
                                value={code}
                                aria-required="true"
                                aria-invalid={error !== null ? 'true' : 'false'}
                                placeholder="Enter code…"
                                onChange={(e) => {
                                    setCode(e.target.value);
                                    if (error !== null) setError(null);
                                }}
                            />
                            {error !== null && (
                                <span role="alert" className={styles.error}>{error}</span>
                            )}
                        </div>
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.cancelBtn}
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={styles.submitBtn}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting…' : 'Submit Code'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </dialog>
    );
};
