import {
    StrictMode, Suspense
} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {router} from '@routes/index';
import {Loading} from '@components/common';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Suspense fallback={<Loading size="large" text="Loading..." />}>
            <RouterProvider router={router} />
        </Suspense>
    </StrictMode>
);
