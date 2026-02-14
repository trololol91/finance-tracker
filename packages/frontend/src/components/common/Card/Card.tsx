import type {ReactNode} from 'react';
import '@components/common/Card/Card.css';

interface CardProps {
    children: ReactNode;
    title?: string;
    className?: string;
}

export const Card = ({children, title, className = ''}: CardProps): React.JSX.Element => {
    return (
        <div className={`card ${className}`}>
            {title && <h3 className="card-title">{title}</h3>}
            <div className="card-content">{children}</div>
        </div>
    );
};
