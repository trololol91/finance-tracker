import {useId} from 'react';
import type {InputHTMLAttributes} from 'react';
import '@components/common/Input/Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = ({
    label,
    error,
    className = '',
    id,
    ...props
}: InputProps): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id ?? `input-${generatedId}`;

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
};
