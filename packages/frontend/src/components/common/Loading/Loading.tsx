import '@components/common/Loading/Loading.css';

interface LoadingProps {
    size?: 'small' | 'medium' | 'large';
    text?: string;
}

export const Loading = ({size = 'medium', text}: LoadingProps): React.JSX.Element => {
    return (
        <div className="loading-container">
            <div className={`loading-spinner loading-spinner--${size}`}></div>
            {text && <p className="loading-text">{text}</p>}
        </div>
    );
};
