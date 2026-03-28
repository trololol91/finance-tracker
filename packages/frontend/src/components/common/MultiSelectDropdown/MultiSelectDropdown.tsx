import React, {
    useRef, useState, useEffect, useCallback, useId
} from 'react';
import '@components/common/MultiSelectDropdown/MultiSelectDropdown.css';

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectDropdownProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    id?: string;
}

export const MultiSelectDropdown = ({
    options,
    value,
    onChange,
    placeholder,
    id
}: MultiSelectDropdownProps): React.JSX.Element => {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const generatedId = useId();
    const dropdownId = `${id ?? generatedId}-dropdown`;

    // Close on outside click
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return (): void => { document.removeEventListener('mousedown', handleOutsideClick); };
    }, [isOpen]);

    // Focus the correct list item when focusedIndex changes
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listboxRef.current) {
            const items = listboxRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
            items[focusedIndex].focus();
        }
    }, [isOpen, focusedIndex]);

    const close = useCallback((): void => {
        setIsOpen(false);
        setFocusedIndex(-1);
    }, []);

    const toggleOption = useCallback((optionValue: string): void => {
        if (value.includes(optionValue)) {
            onChange(value.filter((v) => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    }, [value, onChange]);

    const clearAll = useCallback((): void => {
        onChange([]);
    }, [onChange]);

    // Total option count: "All" item + each option
    const totalItems = options.length + 1;

    const handleContainerKeyDown = useCallback((e: React.KeyboardEvent): void => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex((prev) => Math.min(prev + 1, totalItems - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
        }
    }, [isOpen, close, totalItems]);

    const handleOptionKeyDown = useCallback((
        e: React.KeyboardEvent,
        index: number
    ): void => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (index === 0) {
                clearAll();
            } else {
                toggleOption(options[index - 1].value);
            }
        }
    }, [clearAll, toggleOption, options]);

    const buttonLabel = value.length === 0
        ? `All ${placeholder}`
        : `${value.length} selected`;

    return (
        <div
            className="msd"
            ref={containerRef}
            onKeyDown={handleContainerKeyDown}
        >
            <button
                type="button"
                className={`msd__trigger${isOpen ? ' msd__trigger--open' : ''}`}
                id={id}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={dropdownId}
                onClick={() => { setIsOpen((prev) => !prev); }}
            >
                <span className={value.length > 0 ? 'msd__trigger-label--active' : ''}>
                    {buttonLabel}
                </span>
                <span className="msd__chevron" aria-hidden="true">▾</span>
            </button>

            {isOpen && (
                <ul
                    id={dropdownId}
                    className="msd__dropdown"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={placeholder}
                    ref={listboxRef}
                >
                    <li
                        className={`msd__option${value.length === 0 ? ' msd__option--selected' : ''}`}
                        role="option"
                        aria-selected={value.length === 0}
                        tabIndex={0}
                        onClick={clearAll}
                        onFocus={() => { setFocusedIndex(0); }}
                        onKeyDown={(e) => { handleOptionKeyDown(e, 0); }}
                    >
                        <span className="msd__checkbox" aria-hidden="true">
                            {value.length === 0 ? '✓' : ''}
                        </span>
                        All {placeholder}
                    </li>
                    {options.map((opt, i) => {
                        const selected = value.includes(opt.value);
                        return (
                            <li
                                key={opt.value}
                                className={`msd__option${selected ? ' msd__option--selected' : ''}`}
                                role="option"
                                aria-selected={selected}
                                tabIndex={0}
                                onClick={() => { toggleOption(opt.value); }}
                                onFocus={() => { setFocusedIndex(i + 1); }}
                                onKeyDown={(e) => { handleOptionKeyDown(e, i + 1); }}
                            >
                                <span className="msd__checkbox" aria-hidden="true">
                                    {selected ? '✓' : ''}
                                </span>
                                {opt.label}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
