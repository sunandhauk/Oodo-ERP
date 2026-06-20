"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, HTMLAttributes, ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useAuditLog } from "@/components/audit-log-provider";
import { EyeToggleIcon, LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import type { AuthMode, LoginFormValues, SignupFormValues } from "@/lib/auth-types";
import { validateLogin, validateSignup } from "@/lib/validators";

type AuthScreenProps = {
  mode: AuthMode;
};

type LoginState = LoginFormValues;
type SignupState = SignupFormValues;

function FieldShell({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[0.94rem] font-semibold tracking-[-0.01em] text-ink-800 sm:text-[0.98rem]">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-[0.78rem] font-medium text-red-500 sm:text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  error,
  leftIcon,
  rightSlot,
  variant,
  autoComplete,
  inputMode,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  type?: string;
  error?: string;
  leftIcon: ReactNode;
  rightSlot?: ReactNode;
  variant: "login" | "signup";
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  name: string;
}) {
  const borderClass = variant === "login" ? "border-[#d5d9de]" : "border-brand-200";
  const focusClass = variant === "login" ? "focus-within:ring-2 focus-within:ring-brand-200/20" : "focus-within:ring-2 focus-within:ring-brand-200/30";

  return (
    <div
      className={[
        "flex h-[3.55rem] items-center rounded-[14px] border bg-white px-3.5 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition sm:h-[3.7rem] sm:px-4",
        borderClass,
        focusClass,
        error ? "ring-2 ring-red-200/60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={variant === "login" ? "text-brand-600" : "text-brand-500"}>{leftIcon}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required
        className="h-full flex-1 bg-transparent px-3 text-[0.96rem] text-ink-800 outline-none placeholder:text-ink-400/80 sm:px-4 sm:text-[1rem]"
      />
      {rightSlot ? <div className="pl-2">{rightSlot}</div> : null}
    </div>
  );
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const isLogin = mode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loginTouched, setLoginTouched] = useState<Partial<Record<keyof LoginState, boolean>>>({});
  const [signupTouched, setSignupTouched] = useState<Partial<Record<keyof SignupState, boolean>>>({});
  const [loginValues, setLoginValues] = useState<LoginState>({
    loginId: "",
    password: "",
  });
  const [signupValues, setSignupValues] = useState<SignupState>({
    loginId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    appendAuditLog({
      user: "Guest",
      module: "Auth",
      recordType: "Page",
      recordId: mode,
      action: "Viewed",
      fieldChanged: "Screen",
      oldValue: "-",
      newValue: mode,
      details: `Opened ${mode} page`,
    });
  }, [appendAuditLog, mode]);

  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoginTouched({});
    setSignupTouched({});
    setSubmitAttempted(false);
    setSubmitError("");
  }, [mode]);

  const copy = useMemo(() => {
    if (mode === "login") {
      return {
        title: "Welcome Back",
        subtitle: "Sign in to continue to your account",
        actionLabel: "SIGN IN",
        helperLabel: "Forgot Password?",
        linkLabel: "Sign Up",
        linkHref: "/signup",
      };
    }

    return {
      title: "Sign Up",
      subtitle: "Create your account",
      description: "Fill in the details below to get started",
      actionLabel: "SIGN UP",
      helperLabel: "Already have an account?",
      linkLabel: "Log in",
      linkHref: "/login",
    };
  }, [mode]);

  const loginErrors = useMemo(() => validateLogin(loginValues), [loginValues]);
  const signupErrors = useMemo(() => validateSignup(signupValues), [signupValues]);

  function updateLogin(field: keyof LoginState, value: string) {
    setLoginValues((current) => ({ ...current, [field]: value }));
    setSubmitError("");
  }

  function updateSignup(field: keyof SignupState, value: string) {
    setSignupValues((current) => ({ ...current, [field]: value }));
    setSubmitError("");
  }

  function markLoginTouched(field: keyof LoginState) {
    setLoginTouched((current) => ({ ...current, [field]: true }));
  }

  function markSignupTouched(field: keyof SignupState) {
    setSignupTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setSubmitAttempted(true);

    if (mode === "login") {
      if (Object.keys(loginErrors).length > 0) {
        setLoginTouched({
          loginId: true,
          password: true,
        });
        return;
      }

      setLoading(true);

      try {
        const response = await authClient.login(loginValues);
        appendAuditLog({
          user: response.user.displayName,
          module: "Auth",
          recordType: "Session",
          recordId: response.user.sub,
          action: "Signed In",
          fieldChanged: "Session status",
          oldValue: "Signed out",
          newValue: "Signed in",
          details: `Login successful for ${response.user.loginId}`,
        });
        router.replace("/dashboard");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Unable to sign in right now.");
      } finally {
        setLoading(false);
      }

      return;
    }

    if (Object.keys(signupErrors).length > 0) {
      setSignupTouched({
        loginId: true,
        email: true,
        password: true,
        confirmPassword: true,
      });
      return;
    }

    setLoading(true);

    try {
      const response = await authClient.signup(signupValues);
      appendAuditLog({
        user: response.user.displayName,
        module: "Auth",
        recordType: "Session",
        recordId: response.user.sub,
        action: "Signed Up",
        fieldChanged: "Session status",
        oldValue: "Signed out",
        newValue: "Signed in",
        details: `Signup successful for ${response.user.loginId}`,
      });
      router.replace("/dashboard");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign up right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setSubmitError("");

    try {
      const response = await authClient.demoLogin();
      appendAuditLog({
        user: response.user.displayName,
        module: "Auth",
        recordType: "Session",
        recordId: response.user.sub,
        action: "Signed In",
        fieldChanged: "Session status",
        oldValue: "Signed out",
        newValue: "Signed in",
        details: "Demo login used from the auth page",
      });
      router.replace("/dashboard");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full max-w-[900px]">
        <div
          className={[
            "mx-auto flex w-full flex-col rounded-[28px] border border-white/70 bg-white/95 px-5 py-5 shadow-[0_24px_64px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-7 sm:py-6 animate-scale-in",
            isLogin ? "max-w-[620px]" : "max-w-[720px]",
          ].join(" ")}
        >
          <div className="flex w-full flex-col items-center justify-center">
            <div className={["animate-float-soft", isLogin ? "h-[76px] w-[76px] sm:h-[84px] sm:w-[84px]" : "h-[88px] w-[88px] sm:h-[96px] sm:w-[96px]"].join(" ")}>
              <BrandMark className="h-full w-full" />
            </div>

            <h1
              className={[
                "mt-4 text-center font-extrabold tracking-[-0.045em] animate-fade-up",
                isLogin ? "text-[clamp(2rem,4vw,3rem)] leading-[0.96] text-ink-800" : "text-[clamp(2.25rem,4.7vw,3.6rem)] leading-[0.95] text-brand-700",
              ].join(" ")}
            >
              {copy.title}
            </h1>

            <div className="mt-3 text-center animate-fade-up" style={{ animationDelay: "80ms" }}>
              <p
                className={[
                  "font-medium leading-tight text-brand-600",
                  isLogin ? "text-[clamp(0.98rem,1.9vw,1.25rem)]" : "text-[clamp(1.1rem,2.2vw,1.5rem)]",
                ].join(" ")}
              >
                {copy.subtitle}
              </p>
              {"description" in copy ? <p className="mt-2 text-[0.96rem] leading-tight text-ink-500 sm:text-[1rem]">{copy.description}</p> : null}
            </div>

            <form onSubmit={handleSubmit} className={(isLogin ? "mt-6 w-full max-w-[520px]" : "mt-7 w-full max-w-[620px]") + " animate-fade-up"} style={{ animationDelay: "120ms" }}>
              <div className={isLogin ? "space-y-4" : "space-y-5"}>
                {mode === "signup" ? (
                  <FieldShell label="Create account" error={(signupTouched.loginId || submitAttempted) ? signupErrors.loginId : undefined}>
                    <TextField
                      name="loginId"
                      value={signupValues.loginId}
                      onChange={(value) => updateSignup("loginId", value)}
                      onBlur={() => markSignupTouched("loginId")}
                      placeholder="Enter your name"
                      error={(signupTouched.loginId || submitAttempted) ? signupErrors.loginId : undefined}
                      variant="signup"
                      autoComplete="username"
                      leftIcon={<UserIcon className="h-5 w-5" />}
                    />
                  </FieldShell>
                ) : null}

                {mode === "signup" ? (
                  <FieldShell label="Enter Email Id" error={(signupTouched.email || submitAttempted) ? signupErrors.email : undefined}>
                    <TextField
                      name="email"
                      value={signupValues.email}
                      onChange={(value) => updateSignup("email", value)}
                      onBlur={() => markSignupTouched("email")}
                      placeholder="Enter your email id"
                      error={(signupTouched.email || submitAttempted) ? signupErrors.email : undefined}
                      variant="signup"
                      autoComplete="email"
                      inputMode="email"
                      leftIcon={<MailIcon className="h-5 w-5" />}
                    />
                  </FieldShell>
                ) : null}

                <FieldShell
                  label={mode === "login" ? "Login ID" : "Enter Password"}
                  error={mode === "login" ? ((loginTouched.loginId || submitAttempted) ? loginErrors.loginId : undefined) : ((signupTouched.password || submitAttempted) ? signupErrors.password : undefined)}
                >
                  {mode === "login" ? (
                    <TextField
                      name="loginId"
                      value={loginValues.loginId}
                      onChange={(value) => updateLogin("loginId", value)}
                      onBlur={() => markLoginTouched("loginId")}
                      placeholder="Enter your login ID"
                      error={(loginTouched.loginId || submitAttempted) ? loginErrors.loginId : undefined}
                      variant="login"
                      autoComplete="username"
                      leftIcon={<UserIcon className="h-5 w-5" />}
                    />
                  ) : (
                    <TextField
                      name="password"
                      value={signupValues.password}
                      onChange={(value) => updateSignup("password", value)}
                      onBlur={() => markSignupTouched("password")}
                      placeholder="Enter your password"
                      error={(signupTouched.password || submitAttempted) ? signupErrors.password : undefined}
                      variant="signup"
                      autoComplete="new-password"
                      type={showPassword ? "text" : "password"}
                      leftIcon={<LockIcon className="h-5 w-5" />}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="text-brand-700/90 transition hover:text-brand-800"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <EyeToggleIcon open={showPassword} />
                        </button>
                      }
                    />
                  )}
                </FieldShell>

                {mode === "login" ? (
                  <FieldShell label="Password" error={(loginTouched.password || submitAttempted) ? loginErrors.password : undefined}>
                    <TextField
                      name="password"
                      value={loginValues.password}
                      onChange={(value) => updateLogin("password", value)}
                      onBlur={() => markLoginTouched("password")}
                      placeholder="Enter your password"
                      error={(loginTouched.password || submitAttempted) ? loginErrors.password : undefined}
                      variant="login"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      leftIcon={<LockIcon className="h-5 w-5" />}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="text-ink-400 transition hover:text-ink-600"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <EyeToggleIcon open={showPassword} />
                        </button>
                      }
                    />
                  </FieldShell>
                ) : null}

                {mode === "signup" ? (
                  <FieldShell label="Confirm Password" error={(signupTouched.confirmPassword || submitAttempted) ? signupErrors.confirmPassword : undefined}>
                    <TextField
                      name="confirmPassword"
                      value={signupValues.confirmPassword}
                      onChange={(value) => updateSignup("confirmPassword", value)}
                      onBlur={() => markSignupTouched("confirmPassword")}
                      placeholder="Re-enter your password"
                      error={(signupTouched.confirmPassword || submitAttempted) ? signupErrors.confirmPassword : undefined}
                      variant="signup"
                      autoComplete="new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      leftIcon={<LockIcon className="h-5 w-5" />}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="text-brand-700/90 transition hover:text-brand-800"
                          aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                        >
                          <EyeToggleIcon open={showConfirmPassword} />
                        </button>
                      }
                    />
                  </FieldShell>
                ) : null}
              </div>

              {submitError ? (
                <p className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600 sm:text-sm" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={[
                  "flex h-[3.5rem] w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#43af91_0%,#239b79_52%,#178765_100%)] text-[0.98rem] font-extrabold tracking-[0.04em] text-white shadow-button transition duration-200 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[3.7rem]",
                  isLogin ? "mt-5" : "mt-6",
                ].join(" ")}
              >
                {loading ? "PLEASE WAIT..." : copy.actionLabel}
              </button>

              <div className={["flex flex-wrap items-center justify-center gap-2 text-center text-[0.95rem] sm:text-[1rem]", isLogin ? "mt-4" : "mt-5"].join(" ")}>
                {mode === "login" ? (
                  <>
                    <button type="button" className="text-ink-700 transition hover:text-ink-900 active:scale-[0.98]" onClick={() => void 0}>
                      {copy.helperLabel}
                    </button>
                    <span className="text-ink-400">|</span>
                    <Link href={copy.linkHref} className="font-semibold text-brand-600 transition hover:text-brand-700">
                      {copy.linkLabel}
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-ink-700">{copy.helperLabel}</span>
                    <Link href={copy.linkHref} className="font-semibold text-brand-600 transition hover:text-brand-700">
                      {copy.linkLabel}
                    </Link>
                  </>
                )}
              </div>

              <div className={["flex items-center gap-4 text-ink-300 sm:gap-5", isLogin ? "mt-4" : "mt-5"].join(" ")}>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
                <span className="text-[0.92rem] uppercase tracking-[0.18em] text-ink-400 sm:text-[1rem]">OR</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
              </div>

              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className={[
                  "mt-4 flex w-full items-center justify-center gap-3 rounded-[16px] px-4 py-2.5 text-[0.98rem] font-semibold text-brand-700 transition hover:bg-brand-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-5 sm:py-3",
                ].join(" ")}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserIcon className="h-6 w-6" />
                </span>
                <span>{mode === "login" ? "Login as User" : "Login as User"}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
