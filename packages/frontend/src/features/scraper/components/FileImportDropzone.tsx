import React, {
    useState, useRef, useCallback, useId
} from 'react';
import styles from '@features/scraper/components/FileImportDropzone.module.css';

const ACCEPTED_TYPES = ['.csv', 'text/csv'];
const MAX_FILE_SIZE_MB = 10;

interface FileImportDropzoneProps {
    onFile: (file: File) => void;
    isUploading: boolean;
}

const isFileSizeValid = (file: File): boolean =>
    file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;

const isFileTypeValid = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ext === 'csv';
};

export const FileImportDropzone = ({
    onFile,
    isUploading
}: FileImportDropzoneProps): React.JSX.Element => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const descId = useId();

    const handleFiles = useCallback(
        (files: FileList | null): void => {
            if (files === null || files.length === 0) return;
            const file = files[0];
            if (!isFileTypeValid(file)) {
                setFileError('Only .csv files are supported');
                return;
            }
            if (!isFileSizeValid(file)) {
                setFileError(`File must be smaller than ${MAX_FILE_SIZE_MB} MB`);
                return;
            }
            setFileError(null);
            onFile(file);
        },
        [onFile]
    );

    const handleDragOver = useCallback((e: React.DragEvent): void => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((): void => {
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent): void => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>): void => {
            handleFiles(e.target.files);
            // Reset so the same file can be uploaded again
            e.target.value = '';
        },
        [handleFiles]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>): void => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
            }
        },
        []
    );

    return (
        <div className={styles.wrapper} aria-label="File import area">
            <div
                role="button"
                tabIndex={0}
                aria-describedby={descId}
                aria-disabled={isUploading}
                className={`${styles.zone} ${isDragging ? styles.dragging : ''} ${isUploading ? styles.uploading : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => { inputRef.current?.click(); }}
                onKeyDown={handleKeyDown}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    className={styles.hiddenInput}
                    aria-hidden="true"
                    tabIndex={-1}
                    disabled={isUploading}
                    onChange={handleChange}
                />
                <span className={styles.icon} aria-hidden="true">📁</span>
                {isUploading ? (
                    <p className={styles.text}>Uploading…</p>
                ) : (
                    <>
                        <p className={styles.text}>
                            Drag &amp; drop a file here, or{' '}
                            <span className={styles.link}>browse</span>
                        </p>
                        <p id={descId} className={styles.hint}>
                            Supported formats: CSV — max {MAX_FILE_SIZE_MB} MB
                        </p>
                    </>
                )}
            </div>
            {fileError !== null && (
                <p role="alert" className={styles.error}>{fileError}</p>
            )}
        </div>
    );
};
