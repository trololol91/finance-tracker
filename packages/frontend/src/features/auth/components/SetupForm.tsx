import React, {useState} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {validators} from '@utils/validators.js';
import type {CreateUserDto} from '@/api/model/createUserDto.js';
import {
    Eye,
    EyeOff
} from 'lucide-react';
import '@features/auth/components/RegisterForm.css';

interface FormState {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
}

interface FormErrors {
    firstName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
}

const getApiErrorMessage = (error: Error): string => {
    const msg = error.message;
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

    if (!validators.required(form.firstName)) {
        errors.firstName = 'First name is required';
    }

    if (!validators.required(form.email)) {
        errors.email = 'Email is required';
    } else if (!validators.email(form.email)) {
        errors.email = 'Please enter a valid email address';
    }

    const pwCheck = validators.password(form.password);
    if (!validators.required(form.password)) {
        errors.password = 'Password is required';
    } else if (!pwCheck.valid) {
        errors.password = pwCheck.errors[0];
    }

    if (!validators.required(form.confirmPassword)) {
        errors.confirmPassword = 'Please confirm your password';
    } else if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
};

export const SetupForm = (): React.JSX.Element => {
    const {completeSetup} = useAuth();

    const [form, setForm] = useState<FormState>({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [apiError, setApiError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const {name, value} = e.target;
        setForm(prev => ({...prev, [name]: value}));
        setErrors(prev => ({...prev, [name]: undefined}));
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
            const dto: CreateUserDto = {
                email: form.email,
                password: form.password,
                firstName: form.firstName.trim(),
                ...(form.lastName.trim() && {lastName: form.lastName.trim()})
            };
            await completeSetup(dto);
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
            className="register-form"
            onSubmit={(e) => { void handleSubmit(e); }}
            noValidate
            aria-label="Create admin account form"
        >
            {apiError && (
                <div className="register-form__api-error" role="alert">
                    {apiError}
                </div>
            )}

            <div className="register-form__name-row">
                <Input
                    label="First Name"
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    error={errors.firstName}
                    autoComplete="given-name"
                    autoFocus
                    disabled={isSubmitting}
                    aria-required="true"
                />
                <Input
                    label="Last Name"
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                    disabled={isSubmitting}
                />
            </div>

            <Input
                label="Email"
                type="email"
                name="email"
                id="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                disabled={isSubmitting}
                aria-required="true"
            />

            <div className="register-form__password-wrapper">
                <div className="register-form__password-field">
                    <label htmlFor="password" className="register-form__password-label">
                        Password
                    </label>
                    <div className="register-form__password-row">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            name="password"
                            className={`register-form__password-input${errors.password ? ' register-form__password-input--error' : ''}`}
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            aria-required="true"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <button
                            type="button"
                            className="register-form__password-toggle"
                            onClick={() => { setShowPassword(prev => !prev); }}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            disabled={isSubmitting}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password && (
                        <span
                            id="password-error"
                            className="register-form__password-error"
                            role="alert"
                        >
                            {errors.password}
                        </span>
                    )}
                </div>
            </div>

            <div className="register-form__password-wrapper">
                <div className="register-form__password-field">
                    <label htmlFor="confirmPassword" className="register-form__password-label">
                        Confirm Password
                    </label>
                    <div className="register-form__password-row">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            name="confirmPassword"
                            className={`register-form__password-input${errors.confirmPassword ? ' register-form__password-input--error' : ''}`}
                            value={form.confirmPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            aria-required="true"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                        <button
                            type="button"
                            className="register-form__password-toggle"
                            onClick={() => { setShowConfirmPassword(prev => !prev); }}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            disabled={isSubmitting}
                        >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <span
                            id="confirmPassword-error"
                            className="register-form__password-error"
                            role="alert"
                        >
                            {errors.confirmPassword}
                        </span>
                    )}
                </div>
            </div>

            <Button
                type="submit"
                variant="primary"
                size="large"
                isLoading={isSubmitting}
                className="register-form__submit"
            >
                Create Admin Account
            </Button>
        </form>
    );
};
