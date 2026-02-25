import {
    StrictMode, Suspense
} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {router} from '@routes/index';
import {AuthProvider} from '@features/auth/context/AuthContext.js';
import {Loading} from '@components/common/Loading/Loading.js';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <Suspense fallback={<Loading size="large" text="Loading..." />}>
                <RouterProvider router={router} />
            </Suspense>
        </AuthProvider>
    </StrictMode>
);
