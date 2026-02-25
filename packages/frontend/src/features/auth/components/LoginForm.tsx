import React, {useState} from 'react';
import {
    useNavigate,
    Link
} from 'react-router-dom';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {validators} from '@utils/validators.js';
import {APP_ROUTES} from '@config/constants';
import '@features/auth/components/LoginForm.css';

interface FormState {
    email: string;
    password: string;
    rememberMe: boolean;
}

interface FormErrors {
    email?: string;
    password?: string;
}

/**
 * Map a caught error to a user-friendly message.
 * The API client wraps errors as `new Error(String(axiosError))` so we
 * inspect the message string for status codes.
 */
const getApiErrorMessage = (error: Error): string => {
    const msg = error.message;
    if (msg.includes('401') || msg.includes('Unauthorized')) {
        return 'Email or password is incorrect.';
    }
    if (
        msg.includes('Network Error') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ERR_NETWORK')
    ) {
        return 'Unable to connect. Please check your connection.';
    }
    return 'Something went wrong. Please try again.';
};

const validate = (form: FormState): FormErrors => {
    const errors: FormErrors = {};

    if (!validators.required(form.email)) {
        errors.email = 'Email is required';
    } else if (!validators.email(form.email)) {
        errors.email = 'Please enter a valid email address';
    }

    if (!validators.required(form.password)) {
        errors.password = 'Password is required';
    } else if (!validators.minLength(form.password, 8)) {
        errors.password = 'Password must be at least 8 characters';
    }

    return errors;
};

export const LoginForm = (): React.JSX.Element => {
    const navigate = useNavigate();
    const {login} = useAuth();

    const [form, setForm] = useState<FormState>({
        email: '',
        password: '',
        rememberMe: false
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [apiError, setApiError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const {name, value, type, checked} = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Clear field error as the user types
        if (name === 'email' || name === 'password') {
            setErrors(prev => ({...prev, [name]: undefined}));
        }
        setApiError('');
    };

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ): Promise<void> => {
        e.preventDefault();
        setApiError('');

        const fieldErrors = validate(form);
        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            await login(form.email, form.password);
            void navigate(APP_ROUTES.DASHBOARD, {replace: true});
        } catch (error) {
            setApiError(
                getApiErrorMessage(
                    error instanceof Error ? error : new Error(String(error))
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form
            className="login-form"
            onSubmit={(e) => { void handleSubmit(e); }}
            noValidate
            aria-label="Sign in form"
        >
            {apiError && (
                <div className="login-form__api-error" role="alert">
                    {apiError}
                </div>
            )}

            <Input
                label="Email"
                type="email"
                name="email"
                id="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                autoFocus
                disabled={isSubmitting}
                aria-required="true"
            />

            {/* Password field with visibility toggle */}
            <div className="login-form__password-wrapper">
                <div className="login-form__password-field">
                    <label
                        htmlFor="password"
                        className="login-form__password-label"
                    >
                        Password
                    </label>
                    <div className="login-form__password-row">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            name="password"
                            className={`login-form__password-input${errors.password ? ' login-form__password-input--error' : ''}`}
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                            disabled={isSubmitting}
                            aria-required="true"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={
                                errors.password
                                    ? 'password-error'
                                    : undefined
                            }
                        />
                        <button
                            type="button"
                            className="login-form__password-toggle"
                            onClick={() => { setShowPassword(prev => !prev); }}
                            aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                            tabIndex={0}
                            disabled={isSubmitting}
                        >
                            {showPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
                    {errors.password && (
                        <span
                            id="password-error"
                            className="login-form__password-error"
                            role="alert"
                        >
                            {errors.password}
                        </span>
                    )}
                </div>
            </div>

            <label className="login-form__remember">
                <input
                    type="checkbox"
                    name="rememberMe"
                    checked={form.rememberMe}
                    onChange={handleChange}
                    disabled={isSubmitting}
                />
                <span>Remember me</span>
            </label>

            <Button
                type="submit"
                variant="primary"
                size="large"
                isLoading={isSubmitting}
                className="login-form__submit"
            >
                Sign In
            </Button>

            <div className="login-form__links">
                {/* Placeholder — forgot password flow is future work */}
                <button type="button" className="login-form__link-btn">
                    Forgot password?
                </button>

                <p className="login-form__register-prompt">
                    Don&apos;t have an account?{' '}
                    <Link
                        to={APP_ROUTES.REGISTER}
                        className="login-form__link"
                    >
                        Sign up
                    </Link>
                </p>
            </div>
        </form>
    );
};
