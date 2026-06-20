import type { LoginFormValues, SignupFormValues } from "@/lib/auth-types";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const LOGIN_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._\-\s]{1,38}[a-zA-Z0-9]$/;
const PASSWORD_HAS_LOWERCASE = /[a-z]/;
const PASSWORD_HAS_UPPERCASE = /[A-Z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;

export function validatePassword(password: string): string {
  if (!password.trim()) {
    return "Password is required.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!PASSWORD_HAS_LOWERCASE.test(password) || !PASSWORD_HAS_UPPERCASE.test(password) || !PASSWORD_HAS_NUMBER.test(password)) {
    return "Use upper, lower, and number characters.";
  }

  return "";
}

export function validateLogin(values: LoginFormValues): FieldErrors<keyof LoginFormValues> {
  const errors: FieldErrors<keyof LoginFormValues> = {};

  if (!values.loginId.trim()) {
    errors.loginId = "Login ID is required.";
  } else if (values.loginId.trim().length < 3) {
    errors.loginId = "Login ID must be at least 3 characters.";
  } else if (!LOGIN_ID_REGEX.test(values.loginId.trim())) {
    errors.loginId = "Use letters, numbers, spaces, dots, or hyphens only.";
  }

  if (!values.password.trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function validateSignup(values: SignupFormValues): FieldErrors<keyof SignupFormValues> {
  const errors: FieldErrors<keyof SignupFormValues> = {};

  if (!values.loginId.trim()) {
    errors.loginId = "Login ID is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  const passwordError = validatePassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
