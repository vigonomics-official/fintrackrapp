import { z } from "zod";

/** Minimum length required for new FinTrackr account passwords. */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_HINT =
  "At least 12 characters, with upper and lower case letters and a number.";

/** Shared strength rules for signup and password reset. */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

/** Returns the first policy violation message, or null when the password is valid. */
export function validatePassword(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid password");
}
