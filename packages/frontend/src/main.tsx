import {
    StrictMode, Suspense
} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query';
import {router} from '@routes/index';
import {AuthProvider} from '@features/auth/context/AuthContext.js';
import {PushBootstrap} from '@services/push/PushBootstrap.js';
import {Loading} from '@components/common/Loading/Loading.js';
import '@/index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <PushBootstrap>
                    <Suspense fallback={<Loading size="large" text="Loading..." />}>
                        <RouterProvider router={router} />
                    </Suspense>
                </PushBootstrap>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>
);
