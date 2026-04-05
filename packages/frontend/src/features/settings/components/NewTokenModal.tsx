import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useMemo
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {
    useApiTokensControllerCreate,
    getApiTokensControllerFindAllQueryKey
} from '@/api/api-tokens/api-tokens.js';
import type {CreateApiTokenResponseDto} from '@/api/api-tokens/api-tokens.js';
import {Button} from '@components/common/Button/Button.js';
import styles from '@features/settings/components/NewTokenModal.module.css';

const HEADING_ID = 'new-token-modal-title';

// Keep in sync with API_TOKEN_SCOPES in packages/backend/src/auth/api-token-scopes.ts
type ApiTokenScope =
    | 'transactions:read' | 'transactions:write'
    | 'accounts:read'     | 'accounts:write'
    | 'categories:read'   | 'categories:write'
    | 'dashboard:read'
    | 'admin';

interface ScopeGroup {
    label: string;
    scopes: ApiTokenScope[];
}

const SCOPE_GROUPS: ScopeGroup[] = [
    {label: 'Transactions', scopes: ['transactions:read', 'transactions:write']},
    {label: 'Accounts', scopes: ['accounts:read', 'accounts:write']},
    {label: 'Categories', scopes: ['categories:read', 'categories:write']},
    {label: 'Dashboard', scopes: ['dashboard:read']}
];

const ADMIN_SCOPE_GROUP: ScopeGroup = {label: 'Admin', scopes: ['admin']};

interface NewTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ModalStep = 'form' | 'reveal';

export const NewTokenModal = ({isOpen, onClose}: NewTokenModalProps): React.JSX.Element => {
    const {user} = useAuth();
    const queryClient = useQueryClient();
    const {mutate: createToken, isPending} = useApiTokensControllerCreate();

    const dialogRef = useRef<HTMLDialogElement>(null);
    const firstFieldRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<Element | null>(null);

    const [step, setStep] = useState<ModalStep>('form');
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [selectedScopes, setSelectedScopes] = useState<Set<ApiTokenScope>>(new Set());
    const [scopesError, setScopesError] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [apiError, setApiError] = useState('');
    const [createdToken, setCreatedToken] = useState<CreateApiTokenResponseDto | null>(null);
    const [copied, setCopied] = useState(false);

    // Track the trigger element so we can restore focus on close
    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement;
        }
    }, [isOpen]);

    // Show / close the <dialog> element
    useEffect(() => {
        const el = dialogRef.current;
        if (el === null) return;
        if (isOpen) {
            if (!el.open) el.showModal();
        } else {
            if (el.open) el.close();
        }
    }, [isOpen]);

    // Move focus to first form field when modal opens
    useEffect(() => {
        if (!isOpen) return;
        const raf = requestAnimationFrame(() => {
            firstFieldRef.current?.focus();
        });
        return (): void => { cancelAnimationFrame(raf); };
    }, [isOpen]);

    // Restore focus to trigger element on close
    useEffect(() => {
        if (isOpen) return;
        if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
        }
    }, [isOpen]);

    // Reset form state when modal opens.
     
    useEffect(() => {  
        if (isOpen) {
            setStep('form');
            setName('');  
            setNameError('');  
            setSelectedScopes(new Set());  
            setScopesError('');  
            setExpiresAt('');  
            setApiError('');  
            setCreatedToken(null);  
            setCopied(false);  
        }
    }, [isOpen]);

    // Focus trap — keep Tab / Shift+Tab inside the dialog
    const handleKeyDown = useCallback((e: KeyboardEvent): void => {
        if (e.key === 'Escape') { onClose(); return; }
        if (e.key !== 'Tab') return;
        const dialog = dialogRef.current;
        if (dialog === null) return;
        const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        if (dialog === null) return;
        dialog.addEventListener('keydown', handleKeyDown);
        return (): void => { dialog.removeEventListener('keydown', handleKeyDown); };
    }, [isOpen, handleKeyDown]);

    // Sync native dialog `close` event with state
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

    const toggleScope = (scope: ApiTokenScope): void => {
        setSelectedScopes((prev) => {
            const next = new Set(prev);
            if (next.has(scope)) {
                next.delete(scope);
            } else {
                next.add(scope);
            }
            return next;
        });
        setScopesError('');
    };

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        setNameError('');
        setScopesError('');
        setApiError('');

        let valid = true;
        if (name.trim() === '') {
            setNameError('Token name is required.');
            valid = false;
        } else if (name.trim().length > 100) {
            setNameError('Token name must be 100 characters or fewer.');
            valid = false;
        }
        if (selectedScopes.size === 0) {
            setScopesError('Select at least one scope.');
            valid = false;
        }
        if (!valid) return;

        createToken(
            {
                data: {
                    name: name.trim(),
                    scopes: Array.from(selectedScopes),
                    expiresAt: expiresAt !== '' ? expiresAt : undefined
                }
            },
            {
                onSuccess: (result) => {
                    setCreatedToken(result);
                    setStep('reveal');
                    void queryClient.invalidateQueries({
                        queryKey: getApiTokensControllerFindAllQueryKey()
                    });
                },
                onError: () => {
                    setApiError('Failed to create token. Please try again.');
                    console.error('[NewTokenModal] Failed to create API token');
                }
            }
        );
    };

    const handleCopy = (): void => {
        if (!createdToken) return;
        void navigator.clipboard.writeText(createdToken.token).then(() => {
            setCopied(true);
            setTimeout(() => { setCopied(false); }, 2000);
        }).catch(() => {
            console.error('[NewTokenModal] Failed to copy token to clipboard');
        });
    };

    // Tomorrow UTC — the backend DTO rejects today (expiresAt: {gt: new Date()} at midnight).
    // Computed once per modal open; a session kept open past midnight UTC will show a stale
    // min date, but the backend validator will still reject any past date at submit time.
    const tomorrowUtc = useMemo((): string => {
        const now = new Date();
        return new Date(Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
        )).toISOString().split('T')[0];
    }, []);

    const scopeGroupsToRender = useMemo(
        () => user?.role === 'ADMIN' ? [...SCOPE_GROUPS, ADMIN_SCOPE_GROUP] : SCOPE_GROUPS,
        [user?.role]
    );

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
                    <h2 id={HEADING_ID} className={styles.title}>
                        {step === 'form' ? 'Generate new API token' : 'Token created'}
                    </h2>
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
                    {step === 'form' ? (
                        <form onSubmit={handleSubmit} noValidate aria-label="New API token form">
                            {apiError !== '' && (
                                <p role="alert" className={styles.apiError}>
                                    {apiError}
                                </p>
                            )}

                            <div className={styles.fieldGroup}>
                                <label htmlFor="token-name" className={styles.label}>
                                    Token name
                                </label>
                                <input
                                    ref={firstFieldRef}
                                    id="token-name"
                                    type="text"
                                    className={`${styles.input}${nameError !== '' ? ` ${styles.inputError}` : ''}`}
                                    value={name}
                                    onChange={(e): void => {
                                        setName(e.target.value);
                                        if (nameError !== '') setNameError('');
                                    }}
                                    placeholder="e.g. My integration"
                                    autoComplete="off"
                                    aria-describedby={nameError !== '' ? 'token-name-error' : undefined}
                                    aria-invalid={nameError !== '' ? true : undefined}
                                />
                                {nameError !== '' && (
                                    <p id="token-name-error" className={styles.errorText} role="alert">
                                        {nameError}
                                    </p>
                                )}
                            </div>

                            <div className={styles.fieldGroup}>
                                <p className={styles.label} id="scopes-label">
                                    Scopes
                                </p>
                                {scopesError !== '' && (
                                    <p className={styles.errorText} role="alert">
                                        {scopesError}
                                    </p>
                                )}
                                <div
                                    className={styles.scopeGroups}
                                    role="group"
                                    aria-labelledby="scopes-label"
                                >
                                    {scopeGroupsToRender.map((group) => (
                                        <div key={group.label} className={styles.scopeGroup}>
                                            <p className={styles.scopeGroupTitle}>{group.label}</p>
                                            {group.scopes.map((scope) => (
                                                <label
                                                    key={scope}
                                                    className={styles.scopeItem}
                                                    htmlFor={`scope-${scope}`}
                                                >
                                                    <input
                                                        id={`scope-${scope}`}
                                                        type="checkbox"
                                                        className={styles.scopeCheckbox}
                                                        checked={selectedScopes.has(scope)}
                                                        onChange={(): void => {
                                                            toggleScope(scope);
                                                        }}
                                                    />
                                                    <span className={styles.scopeLabel}>
                                                        {scope}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.fieldGroup}>
                                <label htmlFor="token-expires" className={styles.label}>
                                    Expiry date{' '}
                                    <span className={styles.expiryOptional}>(optional)</span>
                                </label>
                                <input
                                    id="token-expires"
                                    type="date"
                                    className={styles.input}
                                    value={expiresAt}
                                    onChange={(e): void => { setExpiresAt(e.target.value); }}
                                    min={tomorrowUtc}
                                />
                            </div>

                            <div className={styles.actions}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="small"
                                    onClick={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="small"
                                    isLoading={isPending}
                                >
                                    Generate token
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className={styles.tokenReveal}>
                            <div className={styles.tokenWarning} role="alert">
                                <span className={styles.warningIcon} aria-hidden="true">⚠</span>
                                <span>
                                    This token will not be shown again.
                                    {' '}Copy it now and store it somewhere safe.
                                </span>
                            </div>

                            <div className={styles.tokenBox}>
                                <textarea
                                    readOnly
                                    className={styles.tokenValue}
                                    value={createdToken?.token ?? ''}
                                    aria-label="Generated API token"
                                    rows={3}
                                />
                                <button
                                    type="button"
                                    className={styles.copyBtn}
                                    onClick={handleCopy}
                                    aria-label="Copy token to clipboard"
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            <div className={styles.actions}>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="small"
                                    onClick={onClose}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </dialog>
    );
};
