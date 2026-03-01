// Frontend-specific types for the Categories feature.
// Generated DTO/entity types live in @/api/model/ — do not redefine them here.

/** Form values (all strings for controlled inputs). */
export interface CategoryFormValues {
    name: string;
    description: string;
    color: string;
    icon: string;
    /** UUID string or empty string (top-level) */
    parentId: string;
}

/** Form validation errors. */
export type CategoryFormErrors = Partial<Record<keyof CategoryFormValues, string>>;

/** Whether the modal is open for create or edit. */
export type CategoryModalMode = 'create' | 'edit' | null;
