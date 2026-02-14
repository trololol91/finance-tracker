import type {
    ButtonHTMLAttributes, ReactNode
} from 'react';
import '@components/common/Button/Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    isLoading?: boolean;
}

export const Button = ({
    children,
    variant = 'primary',
    size = 'medium',
    isLoading = false,
    disabled,
    className = '',
    ...props
}: ButtonProps): React.JSX.Element => {
    const classes = [
        'button',
        `button--${variant}`,
        `button--${size}`,
        isLoading ? 'button--loading' : '',
        className
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            className={classes}
            disabled={disabled ?? isLoading}
            {...props}
        >
            {isLoading ? 'Loading...' : children}
        </button>
    );
};
