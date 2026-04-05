import React, {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useApiTokensControllerFindAll,
    useApiTokensControllerRemove,
    getApiTokensControllerFindAllQueryKey
} from '@/api/api-tokens/api-tokens.js';
import type {ApiTokenResponseDto} from '@/api/api-tokens/api-tokens.js';
import {NewTokenModal} from '@features/settings/components/NewTokenModal.js';
import {Button} from '@components/common/Button/Button.js';
import styles from '@features/settings/components/ApiTokens.module.css';

const formatDate = (value: string | null): string => {
    if (value === null) return 'Never';
    return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const isExpired = (expiresAt: string | null): boolean => {
    if (expiresAt === null) return false;
    return new Date(expiresAt) < new Date();
};

interface TokenCardProps {
    token: ApiTokenResponseDto;
    onRevoke: (id: string) => void;
    isRevoking: boolean;
}

const TokenCard = ({token, onRevoke, isRevoking}: TokenCardProps): React.JSX.Element => {
    const expired = isExpired(token.expiresAt);

    return (
        <li className={styles.tokenCard}>
            <div className={styles.tokenInfo}>
                <p className={styles.tokenName}>{token.name}</p>
                <div className={styles.tokenMeta}>
                    <span>
                        Created {formatDate(token.createdAt)}
                    </span>
                    <span>
                        Last used: {formatDate(token.lastUsedAt)}
                    </span>
                    {token.expiresAt !== null && (
                        <span>
                            Expires: {formatDate(token.expiresAt)}
                            {expired && ' (expired)'}
                        </span>
                    )}
                </div>
                <div className={styles.tokenScopes} aria-label="Token scopes">
                    {token.scopes.map((scope) => (
                        <span
                            key={scope}
                            className={`${styles.scopeBadge}${expired ? ` ${styles.expiredBadge}` : ''}`}
                        >
                            {scope}
                        </span>
                    ))}
                </div>
            </div>
            <div className={styles.tokenActions}>
                <Button
                    type="button"
                    variant="danger"
                    size="small"
                    isLoading={isRevoking}
                    onClick={(): void => { onRevoke(token.id); }}
                    aria-label={`Revoke token ${token.name}`}
                >
                    Revoke
                </Button>
            </div>
        </li>
    );
};

export const ApiTokens = (): React.JSX.Element => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [revokeError, setRevokeError] = useState<string | null>(null);

    const {data: tokens, isLoading, isError} = useApiTokensControllerFindAll();
    const {mutate: revokeToken} = useApiTokensControllerRemove();

    const handleRevoke = useCallback((id: string): void => {
        setRevokingId(id);
        setRevokeError(null);
        revokeToken(
            {id},
            {
                onSuccess: (): void => {
                    void queryClient.invalidateQueries({
                        queryKey: getApiTokensControllerFindAllQueryKey()
                    });
                },
                onError: (): void => {
                    console.error('[ApiTokens] Failed to revoke token', id);
                    setRevokeError('Failed to revoke token. Please try again.');
                },
                onSettled: (): void => {
                    setRevokingId(null);
                }
            }
        );
    }, [queryClient, revokeToken]);

    return (
        <section className={styles.section} aria-label="API tokens">
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>API Tokens</h2>
                <p className={styles.sectionDescription}>
                    Use API tokens to authenticate programmatic access to your account.
                </p>
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    onClick={(): void => { setIsModalOpen(true); }}
                >
                    Generate new token
                </Button>
            </div>

            {isLoading && (
                <div className={styles.stateBox} role="status" aria-live="polite">
                    Loading tokens…
                </div>
            )}

            {isError && (
                <div className={styles.errorBox} role="alert">
                    Failed to load API tokens. Please refresh the page.
                </div>
            )}

            {revokeError !== null && (
                <div className={styles.errorBox} role="alert">
                    {revokeError}
                </div>
            )}

            {!isLoading && !isError && tokens !== undefined && (
                tokens.length === 0 ? (
                    <div className={styles.stateBox}>
                        No tokens yet. Generate one to get started.
                    </div>
                ) : (
                    <ul className={styles.tokenList} aria-label="API token list">
                        {tokens.map((token) => (
                            <TokenCard
                                key={token.id}
                                token={token}
                                onRevoke={handleRevoke}
                                isRevoking={revokingId === token.id}
                            />
                        ))}
                    </ul>
                )
            )}

            <NewTokenModal
                isOpen={isModalOpen}
                onClose={(): void => { setIsModalOpen(false); }}
            />
        </section>
    );
};
