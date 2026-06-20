export type AuthMode = "login" | "signup";

export type SessionKind = "login" | "signup" | "demo";

export type SessionPayload = {
  sub: string;
  loginId: string;
  email?: string;
  kind: SessionKind;
  iat: number;
  exp: number;
};

export type SessionUser = {
  sub: string;
  loginId: string;
  email?: string;
  kind: SessionKind;
  displayName: string;
  iat: number;
  exp: number;
};

export type LoginFormValues = {
  loginId: string;
  password: string;
};

export type SignupFormValues = LoginFormValues & {
  email: string;
  confirmPassword: string;
};

