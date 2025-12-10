import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({
    label,
    error,
    className = '',
    id,
    ...props
}: InputProps): React.JSX.Element {
    const inputId = id || `input-${Math.random().toString(36).substring(7)}`;

    return (
        <div className={`input-wrapper ${className}`}>
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`input ${error ? 'input--error' : ''}`}
                {...props}
            />
            {error && <span className="input-error">{error}</span>}
        </div>
    );
}
