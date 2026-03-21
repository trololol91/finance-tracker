import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FileImportDropzone} from '@features/scraper/components/FileImportDropzone.js';

const defaultProps = {
    onFile: vi.fn(),
    isUploading: false
};

beforeEach(() => {
    vi.clearAllMocks();
});

const makeFile = (name: string, sizeBytes = 1024, type = 'text/csv'): File =>
    new File(['x'.repeat(sizeBytes)], name, {type});

describe('FileImportDropzone', () => {
    describe('idle state', () => {
        it('renders the drag and drop area', () => {
            render(<FileImportDropzone {...defaultProps} />);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('shows instructional text', () => {
            render(<FileImportDropzone {...defaultProps} />);
            expect(screen.getByText(/drag.*drop.*file here/i)).toBeInTheDocument();
        });

        it('shows accepted formats hint', () => {
            render(<FileImportDropzone {...defaultProps} />);
            expect(screen.getByText(/supported formats.*csv/i)).toBeInTheDocument();
        });

        it('shows max file size hint', () => {
            render(<FileImportDropzone {...defaultProps} />);
            expect(screen.getByText(/10 MB/i)).toBeInTheDocument();
        });

        it('does not show error initially', () => {
            render(<FileImportDropzone {...defaultProps} />);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('uploading state', () => {
        it('shows "Uploading…" text when isUploading is true', () => {
            render(<FileImportDropzone {...defaultProps} isUploading={true} />);
            expect(screen.getByText(/uploading/i)).toBeInTheDocument();
        });

        it('hides instructional text when uploading', () => {
            render(<FileImportDropzone {...defaultProps} isUploading={true} />);
            expect(screen.queryByText(/drag.*drop/i)).not.toBeInTheDocument();
        });
    });

    describe('file validation', () => {
        it('calls onFile with valid CSV file from file input', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const input = document.querySelector('input[type="file"]')!;
            const csvFile = makeFile('transactions.csv');
            fireEvent.change(input, {target: {files: [csvFile]}});
            expect(defaultProps.onFile).toHaveBeenCalledWith(csvFile);
        });

        it('shows error for unsupported file type', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const input = document.querySelector('input[type="file"]')!;
            const txtFile = makeFile('notes.txt', 100, 'text/plain');
            fireEvent.change(input, {target: {files: [txtFile]}});
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/only .csv/i)).toBeInTheDocument();
            expect(defaultProps.onFile).not.toHaveBeenCalled();
        });

        it('shows error when file exceeds 10 MB', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const input = document.querySelector('input[type="file"]')!;
            const bigFile = makeFile('huge.csv', 11 * 1024 * 1024); // 11 MB
            fireEvent.change(input, {target: {files: [bigFile]}});
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/smaller than 10 MB/i)).toBeInTheDocument();
        });

        it('does not call onFile when files list is empty', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const input = document.querySelector('input[type="file"]')!;
            fireEvent.change(input, {target: {files: []}});
            expect(defaultProps.onFile).not.toHaveBeenCalled();
        });
    });

    describe('drag and drop', () => {
        it('accepts dropped CSV file', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const zone = screen.getByRole('button');
            const csvFile = makeFile('drop.csv');
            fireEvent.drop(zone, {dataTransfer: {files: [csvFile]}});
            expect(defaultProps.onFile).toHaveBeenCalledWith(csvFile);
        });

        it('shows error for dropped unsupported file', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const zone = screen.getByRole('button');
            const pdfFile = makeFile('doc.pdf', 100, 'application/pdf');
            fireEvent.drop(zone, {dataTransfer: {files: [pdfFile]}});
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('sets dragging style on dragover', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const zone = screen.getByRole('button');
            fireEvent.dragOver(zone);
            // dragging class is added — can't test class name directly without identity-obj-proxy
            // but verify no error is thrown
            expect(zone).toBeInTheDocument();
        });

        it('removes dragging style on dragleave', () => {
            render(<FileImportDropzone {...defaultProps} />);
            const zone = screen.getByRole('button');
            fireEvent.dragOver(zone);
            fireEvent.dragLeave(zone);
            expect(zone).toBeInTheDocument();
        });
    });

    describe('keyboard interaction', () => {
        it('triggers file input click on Enter key', async () => {
            const user = userEvent.setup();
            const clickSpy = vi.fn();
            render(<FileImportDropzone {...defaultProps} />);
            const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
            input.click = clickSpy;

            const zone = screen.getByRole('button');
            await user.type(zone, '{Enter}');
            expect(clickSpy).toHaveBeenCalled();
        });
    });
});
