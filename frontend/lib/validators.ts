import type { LoginFormValues, SignupFormValues } from "@/lib/auth-types";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
<<<<<<< HEAD
const LOGIN_ID_REGEX = /^[a-zA-Z0-9._-]+$/;
const MIN_LOGIN_ID_LENGTH = 6;
const MAX_LOGIN_ID_LENGTH = 12;
const MIN_PASSWORD_LENGTH = 9;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/;
=======
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
>>>>>>> frontend

export function validateLogin(values: LoginFormValues): FieldErrors<keyof LoginFormValues> {
  const errors: FieldErrors<keyof LoginFormValues> = {};

  if (!values.loginId.trim()) {
    errors.loginId = "Login ID is required.";
<<<<<<< HEAD
  } else if (values.loginId.trim().length < MIN_LOGIN_ID_LENGTH || values.loginId.trim().length > MAX_LOGIN_ID_LENGTH) {
    errors.loginId = "Login ID must be 6 to 12 characters.";
  } else if (!LOGIN_ID_REGEX.test(values.loginId.trim())) {
    errors.loginId = "Login ID can only include letters, numbers, dots, underscores, and hyphens.";
=======
  } else if (values.loginId.trim().length < 3) {
    errors.loginId = "Login ID must be at least 3 characters.";
  } else if (!LOGIN_ID_REGEX.test(values.loginId.trim())) {
    errors.loginId = "Use letters, numbers, spaces, dots, or hyphens only.";
>>>>>>> frontend
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
  } else if (values.loginId.trim().length < MIN_LOGIN_ID_LENGTH || values.loginId.trim().length > MAX_LOGIN_ID_LENGTH) {
    errors.loginId = "Login ID must be 6 to 12 characters.";
  } else if (!LOGIN_ID_REGEX.test(values.loginId.trim())) {
    errors.loginId = "Login ID can only include letters, numbers, dots, underscores, and hyphens.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

<<<<<<< HEAD
  if (!values.password.trim()) {
    errors.password = "Password is required.";
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (!PASSWORD_REGEX.test(values.password)) {
    errors.password = "Password must include lowercase, uppercase, and a special character.";
  } else if (values.password.trim().toLowerCase() === values.loginId.trim().toLowerCase() || values.password.trim().toLowerCase() === values.email.trim().toLowerCase()) {
    errors.password = "Password must be different from Login ID and Email ID.";
=======
  const passwordError = validatePassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
>>>>>>> frontend
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
