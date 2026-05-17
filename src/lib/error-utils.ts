// Maps backend/database errors to safe, user-friendly messages.
// Never surface raw DB error messages (constraint names, column names, etc.) to users.

type AnyError = { code?: string; message?: string; status?: number } | null | undefined;

const CODE_MAP: Record<string, string> = {
  "23505": "This record already exists.",
  "23503": "Related record not found.",
  "23502": "A required field is missing.",
  "23514": "Some values are not allowed.",
  "22P02": "Invalid input format.",
  "42501": "You don't have permission to do that.",
  PGRST301: "You don't have permission to do that.",
  PGRST116: "Record not found.",
};

export function friendlyError(err: AnyError, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  if (err.code && CODE_MAP[err.code]) return CODE_MAP[err.code];
  // Auth errors typically have safe, user-facing messages
  if (err.status && err.status >= 400 && err.status < 500 && err.message && err.message.length < 120 && !/".*"|relation |column |constraint |violates |duplicate key|schema /i.test(err.message)) {
    return err.message;
  }
  if (typeof console !== "undefined") console.error("[error]", err);
  return fallback;
}
