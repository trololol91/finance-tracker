import { Link } from 'react-router-dom';
import { APP_ROUTES } from '@config/constants';
import './Header.css';

export function Header(): React.JSX.Element {
    return (
        <header className="header">
            <div className="header-container">
                <Link to={APP_ROUTES.HOME} className="header-logo">
                    Finance Tracker
                </Link>
                <nav className="header-nav">
                    <Link to={APP_ROUTES.DASHBOARD} className="header-link">
                        Dashboard
                    </Link>
                    <Link to={APP_ROUTES.TRANSACTIONS} className="header-link">
                        Transactions
                    </Link>
                    <Link to={APP_ROUTES.BUDGETS} className="header-link">
                        Budgets
                    </Link>
                    <Link to={APP_ROUTES.REPORTS} className="header-link">
                        Reports
                    </Link>
                </nav>
            </div>
        </header>
    );
}
