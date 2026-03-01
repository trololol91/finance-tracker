import React, {
    useState, useId
} from 'react';
import type {DatePreset} from '@features/transactions/types/transaction.types.js';
import '@components/common/DateRangePicker/DateRangePicker.css';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (range: DateRange) => void;
}

const PRESETS: {label: string, value: DatePreset}[] = [
    {label: 'Today', value: 'today'},
    {label: 'This Week', value: 'this-week'},
    {label: 'This Month', value: 'this-month'},
    {label: 'This Year', value: 'this-year'},
    {label: 'Custom', value: 'custom'}
];

const getPresetRange = (preset: DatePreset): DateRange | null => {
    const now = new Date();
    switch (preset) {
        case 'today': {
            const d = now.toISOString().substring(0, 10);
            return {
                startDate: new Date(`${d}T00:00:00`).toISOString(),
                endDate: new Date(`${d}T23:59:59`).toISOString()
            };
        }
        case 'this-week': {
            const day = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - ((day + 6) % 7));
            monday.setHours(0, 0, 0, 0);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);
            return {startDate: monday.toISOString(), endDate: sunday.toISOString()};
        }
        case 'this-month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            return {startDate: start.toISOString(), endDate: end.toISOString()};
        }
        case 'this-year': {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            return {startDate: start.toISOString(), endDate: end.toISOString()};
        }
        default:
            return null;
    }
};

const isoToDateInput = (iso: string): string => iso.substring(0, 10);

const detectPreset = (startDate: string, endDate: string): DatePreset => {
    for (const p of PRESETS.filter((p) => p.value !== 'custom')) {
        const range = getPresetRange(p.value);
        if (range) {
            const sMatch = startDate.startsWith(range.startDate.substring(0, 10));
            const eMatch = endDate.startsWith(range.endDate.substring(0, 10));
            if (sMatch && eMatch) return p.value;
        }
    }
    return 'custom';
};

/**
 * A date-range selector with preset shortcuts and custom date inputs.
 */
export const DateRangePicker = (
    {startDate, endDate, onChange}: DateRangePickerProps
): React.JSX.Element => {
    const id = useId();
    const activePreset = detectPreset(startDate, endDate);
    const [showCustom, setShowCustom] = useState(activePreset === 'custom');

    const handlePreset = (preset: DatePreset): void => {
        if (preset === 'custom') {
            setShowCustom(true);
            return;
        }
        setShowCustom(false);
        const range = getPresetRange(preset);
        if (range) onChange(range);
    };

    const handleCustomStart = (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange({
            startDate: new Date(`${e.target.value}T00:00:00`).toISOString(),
            endDate
        });
    };

    const handleCustomEnd = (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange({
            startDate,
            endDate: new Date(`${e.target.value}T23:59:59`).toISOString()
        });
    };

    return (
        <div className="drp" role="group" aria-label="Date range">
            <div className="drp__presets">
                {PRESETS.map((p) => (
                    <button
                        key={p.value}
                        type="button"
                        className={`drp__preset ${(showCustom ? 'custom' : activePreset) === p.value ? 'drp__preset--active' : ''}`}
                        onClick={() => { handlePreset(p.value); }}
                        aria-pressed={(showCustom ? 'custom' : activePreset) === p.value}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {showCustom && (
                <div className="drp__custom">
                    <div className="drp__custom-field">
                        <label htmlFor={`${id}-start`} className="drp__label">From</label>
                        <input
                            id={`${id}-start`}
                            type="date"
                            className="drp__input"
                            value={isoToDateInput(startDate)}
                            onChange={handleCustomStart}
                        />
                    </div>
                    <span className="drp__separator" aria-hidden="true">—</span>
                    <div className="drp__custom-field">
                        <label htmlFor={`${id}-end`} className="drp__label">To</label>
                        <input
                            id={`${id}-end`}
                            type="date"
                            className="drp__input"
                            value={isoToDateInput(endDate)}
                            onChange={handleCustomEnd}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
