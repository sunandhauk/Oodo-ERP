export type AuthScreenVariant = "admin-login" | "user-login" | "signup";

export type SessionUser = {
  sub: string;
  tenantId: string;
  loginId: string;
  fullName: string;
  displayName: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
};

export type LoginFormValues = {
  loginId: string;
  password: string;
  portal?: "admin" | "user";
};

export type SignupFormValues = LoginFormValues & {
  email: string;
  confirmPassword: string;
};

