import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
    children: ReactNode;
    title?: string;
    className?: string;
}

export function Card({ children, title, className = '' }: CardProps): React.JSX.Element {
    return (
        <div className={`card ${className}`}>
            {title && <h3 className="card-title">{title}</h3>}
            <div className="card-content">{children}</div>
        </div>
    );
}
