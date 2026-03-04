/**
 * useImportJob — wraps Orval-generated import hooks with convenient defaults.
 */
import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    useImportControllerUpload,
    useImportControllerFindAll,
    getImportControllerFindAllQueryKey
} from '@/api/import/import.js';
import type {ImportJobResponseDto} from '@/api/model/importJobResponseDto.js';

export interface UseImportJobReturn {
    jobs: ImportJobResponseDto[];
    isLoading: boolean;
    isError: boolean;
    upload: (file: File, accountId?: string) => Promise<ImportJobResponseDto>;
    isUploading: boolean;
}

export const useImportJob = (): UseImportJobReturn => {
    const queryClient = useQueryClient();

    const {data, isLoading, isError} = useImportControllerFindAll();
    const jobs: ImportJobResponseDto[] = data ?? [];

    const uploadMutation = useImportControllerUpload();

    const upload = useCallback(
        (file: File, accountId?: string): Promise<ImportJobResponseDto> => {
            return new Promise((resolve, reject) => {
                uploadMutation.mutate(
                    {
                        data: {
                            file,
                            accountId: accountId !== undefined && accountId !== '' ? accountId : undefined
                        }
                    },
                    {
                        onSuccess: (result) => {
                            void queryClient.invalidateQueries({
                                queryKey: getImportControllerFindAllQueryKey()
                            });
                            resolve(result);
                        },
                        onError: (err) => {
                            console.error('[useImportJob] upload', err);
                            reject(new Error(String(err)));
                        }
                    }
                );
            });
        },
        [uploadMutation, queryClient]
    );

    return {
        jobs,
        isLoading,
        isError,
        upload,
        isUploading: uploadMutation.isPending
    };
};
