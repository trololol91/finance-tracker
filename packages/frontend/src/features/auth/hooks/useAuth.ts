import {useContext} from 'react';
import {AuthContext} from '@features/auth/context/AuthContext.js';
import type {AuthContextType} from '@features/auth/types/auth.types.js';

/**
 * Custom hook to access authentication context
 * @throws Error if used outside of AuthProvider
 * @returns Authentication context with user state and auth methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <LoginForm onSubmit={login} />;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Welcome, {user.firstName}!</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
