import {
    describe, it, expect
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import {ImportJobStatusBadge} from '@features/scraper/components/ImportJobStatusBadge.js';

describe('ImportJobStatusBadge', () => {
    it.each([
        ['pending', 'Pending'],
        ['processing', 'Processing'],
        ['completed', 'Completed'],
        ['failed', 'Failed']
    ] as const)('renders "%s" status with label "%s"', (status, label) => {
        render(<ImportJobStatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('renders a span element', () => {
        const {container} = render(<ImportJobStatusBadge status="completed" />);
        expect(container.querySelector('span')).toBeInTheDocument();
    });
});
