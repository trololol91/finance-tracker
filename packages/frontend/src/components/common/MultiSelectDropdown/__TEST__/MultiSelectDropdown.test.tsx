import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MultiSelectDropdown} from '@components/common/MultiSelectDropdown/MultiSelectDropdown.js';

const OPTIONS = [
    {value: 'cat', label: 'Category'},
    {value: 'sub', label: 'Subcategory'},
    {value: 'tag', label: 'Tag'}
];

type RenderResult = {onChange: ReturnType<typeof vi.fn>} & ReturnType<typeof render>;
const renderDropdown = (
    overrides: Partial<Parameters<typeof MultiSelectDropdown>[0]> = {}
): RenderResult => {
    const onChange = vi.fn();
    const utils = render(
        <MultiSelectDropdown
            options={OPTIONS}
            value={[]}
            onChange={onChange}
            placeholder="Filters"
            {...overrides}
        />
    );
    return {...utils, onChange};
};

describe('MultiSelectDropdown', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('button label', () => {
        it('shows "All {placeholder}" when nothing is selected', () => {
            renderDropdown({value: []});
            expect(screen.getByRole('button')).toHaveTextContent('All Filters');
        });

        it('shows "{N} selected" when one item is selected', () => {
            renderDropdown({value: ['cat']});
            expect(screen.getByRole('button')).toHaveTextContent('1 selected');
        });

        it('shows "{N} selected" when multiple items are selected', () => {
            renderDropdown({value: ['cat', 'sub']});
            expect(screen.getByRole('button')).toHaveTextContent('2 selected');
        });
    });

    describe('open/close behavior', () => {
        it('does not render the listbox initially', () => {
            renderDropdown();
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('renders the listbox after clicking the trigger', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('closes the listbox when the trigger is clicked again', async () => {
            const user = userEvent.setup();
            renderDropdown();
            const trigger = screen.getByRole('button');
            await user.click(trigger);
            await user.click(trigger);
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('sets aria-expanded to false when closed', () => {
            renderDropdown();
            expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
        });

        it('sets aria-expanded to true when open', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
        });

        // Line 35: clicking outside the component closes the dropdown
        it('closes when a mousedown event fires outside the component', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toBeInTheDocument();

            // Fire mousedown on the document body (outside the component)
            fireEvent.mouseDown(document.body);
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('does NOT close when a mousedown event fires inside the component', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            const listbox = screen.getByRole('listbox');

            // Fire mousedown on the listbox itself (inside the component)
            fireEvent.mouseDown(listbox);
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        // Line 46: pressing Escape closes the dropdown
        it('closes when Escape is pressed', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toBeInTheDocument();

            await user.keyboard('{Escape}');
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('does not close when ArrowDown is pressed', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toBeInTheDocument();
            await user.keyboard('{ArrowDown}');
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('closes when Tab is pressed', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toBeInTheDocument();

            // Fire on the container div (where handleContainerKeyDown lives), not the button
            fireEvent.keyDown(screen.getByRole('button').parentElement!, {key: 'Tab'});
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });
    });

    describe('listbox accessibility', () => {
        it('renders a listbox with aria-multiselectable', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
        });

        it('sets aria-labelledby on the button to chain external label and button text when labelId is provided', () => {
            renderDropdown({labelId: 'ext-label'});
            const btn = screen.getByRole('button');
            // Should reference both the external label span and the button's own text span
            const labelledBy = btn.getAttribute('aria-labelledby') ?? '';
            expect(labelledBy).toContain('ext-label');
            // The button text span id should also be present so selection state is announced
            expect(labelledBy.split(' ')).toHaveLength(2);
        });

        it('does not set aria-labelledby when labelId is not provided', () => {
            renderDropdown();
            expect(screen.getByRole('button')).not.toHaveAttribute('aria-labelledby');
        });

        it('renders the listbox with aria-label matching placeholder', async () => {
            const user = userEvent.setup();
            renderDropdown({placeholder: 'Types'});
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Types');
        });

        it('renders all options plus the "All" option', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            const options = screen.getAllByRole('option');
            // "All Filters" + 3 actual options
            expect(options).toHaveLength(4);
        });

        it('renders option labels for all provided options', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('option', {name: /^category$/i})).toBeInTheDocument();
            expect(screen.getByRole('option', {name: /^subcategory$/i})).toBeInTheDocument();
            expect(screen.getByRole('option', {name: /^tag$/i})).toBeInTheDocument();
        });

        it('marks the "All" option as selected when value is empty', async () => {
            const user = userEvent.setup();
            renderDropdown({value: []});
            await user.click(screen.getByRole('button'));
            const allOption = screen.getByRole('option', {name: /all filters/i});
            expect(allOption).toHaveAttribute('aria-selected', 'true');
        });

        it('marks the "All" option as NOT selected when items are selected', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const allOption = screen.getByRole('option', {name: /all filters/i});
            expect(allOption).toHaveAttribute('aria-selected', 'false');
        });

        it('marks a selected option with aria-selected=true', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const listbox = screen.getByRole('listbox');
            const catOption = within(listbox).getByText('Category').closest('[role="option"]')!;
            expect(catOption).toHaveAttribute('aria-selected', 'true');
        });

        it('marks an unselected option with aria-selected=false', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const listbox = screen.getByRole('listbox');
            const subOption = within(listbox).getByText('Subcategory').closest('[role="option"]')!;
            expect(subOption).toHaveAttribute('aria-selected', 'false');
        });
    });

    describe('selecting options', () => {
        it('calls onChange with the new value added when an unselected option is clicked', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: []});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /^category$/i}));
            expect(onChange).toHaveBeenCalledWith(['cat']);
        });

        it('adds to existing selections when another option is clicked', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /^subcategory$/i}));
            expect(onChange).toHaveBeenCalledWith(['cat', 'sub']);
        });

        // Line 51: clicking an already-selected option deselects it
        it('calls onChange with the option removed when a selected option is clicked', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['cat', 'sub']});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /^category$/i}));
            expect(onChange).toHaveBeenCalledWith(['sub']);
        });

        it('calls onChange with empty array when the only selected option is deselected', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['tag']});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /^tag$/i}));
            expect(onChange).toHaveBeenCalledWith([]);
        });

        // Line 58: clicking "All" clears all selections
        it('calls onChange with [] when "All" option is clicked', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['cat', 'sub', 'tag']});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /all filters/i}));
            expect(onChange).toHaveBeenCalledWith([]);
        });

        it('calls onChange with [] when "All" is clicked and nothing was selected', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: []});
            await user.click(screen.getByRole('button'));
            await user.click(screen.getByRole('option', {name: /all filters/i}));
            expect(onChange).toHaveBeenCalledWith([]);
        });
    });

    describe('button trigger ARIA attributes', () => {
        it('has aria-haspopup="listbox"', () => {
            renderDropdown();
            expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
        });

        it('has aria-controls pointing to the dropdown id', async () => {
            const user = userEvent.setup();
            renderDropdown({id: 'test-dropdown'});
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'test-dropdown-dropdown');
            expect(screen.getByRole('listbox')).toHaveAttribute('id', 'test-dropdown-dropdown');
        });
    });

    describe('with custom id prop', () => {
        it('sets the button id to the provided id', () => {
            renderDropdown({id: 'my-filter'});
            expect(screen.getByRole('button')).toHaveAttribute('id', 'my-filter');
        });

        it('uses the provided id as base for the dropdown id', async () => {
            const user = userEvent.setup();
            renderDropdown({id: 'my-filter'});
            await user.click(screen.getByRole('button'));
            expect(screen.getByRole('listbox')).toHaveAttribute('id', 'my-filter-dropdown');
        });
    });

    describe('keyboard navigation', () => {
        it('opens with focus on the "All" option when nothing is selected (WAI-ARIA listbox pattern)', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const allOption = screen.getByRole('option', {name: /all filters/i});
            expect(document.activeElement).toBe(allOption);
        });

        it('ArrowDown moves focus to the first option', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const container = screen.getByRole('button').parentElement!;
            fireEvent.keyDown(container, {key: 'ArrowDown'});

            const categoryOption = screen.getByRole('option', {name: /^category$/i});
            expect(document.activeElement).toBe(categoryOption);
        });

        it('ArrowDown twice moves focus to the second option', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const container = screen.getByRole('button').parentElement!;
            fireEvent.keyDown(container, {key: 'ArrowDown'});
            fireEvent.keyDown(container, {key: 'ArrowDown'});

            const subcategoryOption = screen.getByRole('option', {name: /^subcategory$/i});
            expect(document.activeElement).toBe(subcategoryOption);
        });

        it('ArrowDown at the last option stays at the last option (Math.min boundary)', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const container = screen.getByRole('button').parentElement!;
            // OPTIONS has 3 items + "All" = 4 total (indices 0-3);
            // press ArrowDown 10 times to exceed the max
            for (let i = 0; i < 10; i++) {
                fireEvent.keyDown(container, {key: 'ArrowDown'});
            }

            const tagOption = screen.getByRole('option', {name: /^tag$/i});
            expect(document.activeElement).toBe(tagOption);
        });

        it('ArrowUp at the first option stays at the first option (Math.max boundary)', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const container = screen.getByRole('button').parentElement!;
            // Move to the first option first
            fireEvent.keyDown(container, {key: 'ArrowDown'});
            // Now press ArrowUp multiple times — should not go below index 0
            fireEvent.keyDown(container, {key: 'ArrowUp'});
            fireEvent.keyDown(container, {key: 'ArrowUp'});

            const allOption = screen.getByRole('option', {name: /all filters/i});
            expect(document.activeElement).toBe(allOption);
        });

        it('Space key on the "All" option calls onChange([])', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['cat', 'sub']});
            await user.click(screen.getByRole('button'));

            const allOption = screen.getByRole('option', {name: /all filters/i});
            fireEvent.keyDown(allOption, {key: ' '});

            expect(onChange).toHaveBeenCalledWith([]);
        });

        it('Space key on a regular option calls onChange with that option toggled in', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: []});
            await user.click(screen.getByRole('button'));

            const categoryOption = screen.getByRole('option', {name: /^category$/i});
            fireEvent.keyDown(categoryOption, {key: ' '});

            expect(onChange).toHaveBeenCalledWith(['cat']);
        });

        it('Enter key on a regular option calls onChange with that option toggled in', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: []});
            await user.click(screen.getByRole('button'));

            const subcategoryOption = screen.getByRole('option', {name: /^subcategory$/i});
            fireEvent.keyDown(subcategoryOption, {key: 'Enter'});

            expect(onChange).toHaveBeenCalledWith(['sub']);
        });

        it('Enter key on a selected regular option removes it from the selection', async () => {
            const user = userEvent.setup();
            const {onChange} = renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));

            const categoryOption = screen.getByRole('option', {name: /^category$/i});
            fireEvent.keyDown(categoryOption, {key: 'Enter'});

            expect(onChange).toHaveBeenCalledWith([]);
        });

        it('onFocus on the "All" option sets focusedIndex to 0 (focus stays on that element)', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const allOption = screen.getByRole('option', {name: /all filters/i});
            fireEvent.focus(allOption);

            expect(document.activeElement).toBe(allOption);
        });

        it('onFocus on a regular option sets focusedIndex to its position', async () => {
            const user = userEvent.setup();
            renderDropdown();
            await user.click(screen.getByRole('button'));

            const tagOption = screen.getByRole('option', {name: /^tag$/i});
            fireEvent.focus(tagOption);

            expect(document.activeElement).toBe(tagOption);
        });

        it('does not move focus when ArrowDown/ArrowUp is pressed while the dropdown is closed', () => {
            renderDropdown();
            const container = screen.getByRole('button').parentElement!;

            // Dropdown is closed — keydown should be a no-op
            fireEvent.keyDown(container, {key: 'ArrowDown'});
            fireEvent.keyDown(container, {key: 'ArrowUp'});

            // No listbox rendered, no crash
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });
    });

    describe('empty options list', () => {
        it('renders only the "All" option when no options are provided', async () => {
            const user = userEvent.setup();
            renderDropdown({options: []});
            await user.click(screen.getByRole('button'));
            const options = screen.getAllByRole('option');
            expect(options).toHaveLength(1);
        });
    });

    describe('checkmark display', () => {
        it('shows checkmark in "All" option when nothing is selected', async () => {
            const user = userEvent.setup();
            renderDropdown({value: []});
            await user.click(screen.getByRole('button'));
            const allOption = screen.getByRole('option', {name: /all filters/i});
            expect(allOption).toHaveTextContent('✓');
        });

        it('does not show checkmark in "All" option when items are selected', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const allOption = screen.getByRole('option', {name: /all filters/i});
            // Should not start with a checkmark — the checkbox span should be empty
            const checkboxSpan = allOption.querySelector('.msd__checkbox');
            expect(checkboxSpan?.textContent).toBe('');
        });

        it('shows checkmark in selected options', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const listbox = screen.getByRole('listbox');
            const catOption = within(listbox).getByText('Category').closest('[role="option"]')!;
            const checkboxSpan = catOption.querySelector('.msd__checkbox');
            expect(checkboxSpan?.textContent).toBe('✓');
        });

        it('does not show checkmark in unselected options', async () => {
            const user = userEvent.setup();
            renderDropdown({value: ['cat']});
            await user.click(screen.getByRole('button'));
            const listbox = screen.getByRole('listbox');
            const subOption = within(listbox).getByText('Subcategory').closest('[role="option"]')!;
            const checkboxSpan = subOption.querySelector('.msd__checkbox');
            expect(checkboxSpan?.textContent).toBe('');
        });
    });
});
