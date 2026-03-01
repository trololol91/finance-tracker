import React, {
    useState, useRef, useEffect
} from 'react';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionActions.css';

interface TransactionActionsProps {
    transaction: TransactionResponseDto;
    onEdit: (transaction: TransactionResponseDto) => void;
    onToggleActive: (id: string) => void;
    onDelete: (id: string) => void;
    isLoading?: boolean;
}

export const TransactionActions = ({
    transaction,
    onEdit,
    onToggleActive,
    onDelete,
    isLoading = false
}: TransactionActionsProps): React.JSX.Element => {
    const [isOpen, setIsOpen] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = useState<{top: number, right: number} | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent): void => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowConfirm(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return (): void => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [isOpen]);

    // Keep the fixed-position menu in sync with the trigger while open
    useEffect(() => {
        if (!isOpen) return;
        const update = (): void => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            setMenuPos({top: rect.bottom + 4, right: window.innerWidth - rect.right});
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return (): void => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setShowConfirm(false);
        }
    };

    const handleToggle = (): void => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setMenuPos({top: rect.bottom + 4, right: window.innerWidth - rect.right});
        }
        setIsOpen((prev) => !prev);
    };

    return (
        <div className="tx-actions" ref={menuRef} onKeyDown={handleKeyDown}>
            <button
                ref={triggerRef}
                type="button"
                className="tx-actions__trigger"
                onClick={handleToggle}
                aria-label={`Actions for ${transaction.description}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                disabled={isLoading}
            >
                &#8942;
            </button>

            {isOpen && menuPos !== null && (
                <div
                    className="tx-actions__menu"
                    role="menu"
                    style={{position: 'fixed', top: menuPos.top, right: menuPos.right}}
                >
                    {!showConfirm ? (
                        <>
                            <button
                                type="button"
                                role="menuitem"
                                className="tx-actions__item"
                                onClick={() => {
                                    onEdit(transaction);
                                    setIsOpen(false);
                                }}
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                className="tx-actions__item"
                                onClick={() => {
                                    onToggleActive(transaction.id);
                                    setIsOpen(false);
                                }}
                            >
                                {transaction.isActive ? 'Mark Inactive' : 'Mark Active'}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                className="tx-actions__item tx-actions__item--danger"
                                onClick={() => { setShowConfirm(true); }}
                            >
                                Delete
                            </button>
                        </>
                    ) : (
                        <div className="tx-actions__confirm">
                            <p className="tx-actions__confirm-text">Delete this transaction?</p>
                            <div className="tx-actions__confirm-buttons">
                                <button
                                    type="button"
                                    className="tx-actions__item tx-actions__item--danger"
                                    onClick={() => {
                                        onDelete(transaction.id);
                                        setIsOpen(false);
                                        setShowConfirm(false);
                                    }}
                                >
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    className="tx-actions__item"
                                    onClick={() => { setShowConfirm(false); }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
