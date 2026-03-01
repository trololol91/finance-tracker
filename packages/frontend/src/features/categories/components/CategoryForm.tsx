import React from 'react';
import type {
    CategoryFormValues, CategoryFormErrors
} from '@features/categories/types/category.types.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import styles from '@features/categories/components/CategoryForm.module.css';

interface CategoryFormProps {
    values: CategoryFormValues;
    errors: CategoryFormErrors;
    isSubmitting: boolean;
    /** Top-level active categories available as parents (excludes the category being edited). */
    parentOptions: CategoryResponseDto[];
    /** Ref forwarded to the first focusable field (name input). */
    firstFieldRef?: React.RefObject<HTMLInputElement | null>;
    onChange: (field: keyof CategoryFormValues, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    editMode: boolean;
}

export const CategoryForm = ({
    values,
    errors,
    isSubmitting,
    parentOptions,
    firstFieldRef,
    onChange,
    onSubmit,
    editMode
}: CategoryFormProps): React.JSX.Element => (
    <form
        id="category-form"
        className={styles.form}
        onSubmit={onSubmit}
        noValidate
        aria-label={editMode ? 'Edit category form' : 'New category form'}
    >
        {/* Name */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="cat-name">
                Name <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
                id="cat-name"
                ref={firstFieldRef}
                type="text"
                className={`${styles.input}${errors.name !== undefined ? ` ${styles.inputError}` : ''}`}
                value={values.name}
                maxLength={100}
                required
                aria-required="true"
                aria-invalid={errors.name !== undefined ? 'true' : 'false'}
                aria-describedby={errors.name !== undefined ? 'cat-name-error' : undefined}
                onChange={(e) => { onChange('name', e.target.value); }}
                placeholder="e.g. Groceries"
            />
            {errors.name !== undefined && (
                <span id="cat-name-error" role="alert" className={styles.error}>
                    {errors.name}
                </span>
            )}
        </div>

        {/* Description */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="cat-description">Description</label>
            <input
                id="cat-description"
                type="text"
                className={`${styles.input}${errors.description !== undefined ? ` ${styles.inputError}` : ''}`}
                value={values.description}
                maxLength={255}
                aria-invalid={errors.description !== undefined ? 'true' : 'false'}
                aria-describedby={errors.description !== undefined ? 'cat-description-error' : undefined}
                onChange={(e) => { onChange('description', e.target.value); }}
                placeholder="Optional description"
            />
            {errors.description !== undefined && (
                <span id="cat-description-error" role="alert" className={styles.error}>
                    {errors.description}
                </span>
            )}
        </div>

        {/* Color */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="cat-color">Color</label>
            <div className={styles.colorRow}>
                <input
                    id="cat-color-picker"
                    type="color"
                    className={styles.colorPicker}
                    value={values.color !== '' ? values.color : '#6366f1'}
                    aria-label="Pick color"
                    onChange={(e) => { onChange('color', e.target.value); }}
                />
                <input
                    id="cat-color"
                    type="text"
                    className={`${styles.input}${errors.color !== undefined ? ` ${styles.inputError}` : ''}`}
                    value={values.color}
                    aria-invalid={errors.color !== undefined ? 'true' : 'false'}
                    aria-describedby={errors.color !== undefined ? 'cat-color-error' : 'cat-color-hint'}
                    onChange={(e) => { onChange('color', e.target.value); }}
                    placeholder="#RRGGBB or empty"
                    maxLength={7}
                />
            </div>
            <span id="cat-color-hint" className={styles.hint}>
                Hex value, e.g. #6366f1. Leave empty for default.
            </span>
            {errors.color !== undefined && (
                <span id="cat-color-error" role="alert" className={styles.error}>
                    {errors.color}
                </span>
            )}
        </div>

        {/* Icon */}
        <div className={styles.field}>
            <label className={styles.label} htmlFor="cat-icon">Icon (emoji)</label>
            <input
                id="cat-icon"
                type="text"
                className={`${styles.input}${errors.icon !== undefined ? ` ${styles.inputError}` : ''}`}
                value={values.icon}
                maxLength={10}
                aria-label="Icon (emoji)"
                aria-invalid={errors.icon !== undefined ? 'true' : 'false'}
                aria-describedby={errors.icon !== undefined ? 'cat-icon-error' : 'cat-icon-hint'}
                onChange={(e) => { onChange('icon', e.target.value); }}
                placeholder="e.g. 🛒"
            />
            <span id="cat-icon-hint" className={styles.hint}>
                Emoji or short text (max 10 chars).
            </span>
            {errors.icon !== undefined && (
                <span id="cat-icon-error" role="alert" className={styles.error}>
                    {errors.icon}
                </span>
            )}
        </div>

        {/* Parent Category */}
        {parentOptions.length > 0 && (
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cat-parent">Parent Category</label>
                <select
                    id="cat-parent"
                    className={styles.select}
                    value={values.parentId}
                    onChange={(e) => { onChange('parentId', e.target.value); }}
                >
                    <option value="">— None (top-level) —</option>
                    {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.icon !== null ? `${p.icon} ` : ''}{p.name}</option>
                    ))}
                </select>
            </div>
        )}

        <div className={styles.actions}>
            <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
            >
                {isSubmitting ? 'Saving…' : editMode ? 'Save Changes' : 'Create Category'}
            </button>
        </div>
    </form>
);
