"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, HTMLAttributes, ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useAuditLog } from "@/components/audit-log-provider";
import { EyeToggleIcon, LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import type { AuthScreenVariant, LoginFormValues, SignupFormValues } from "@/lib/auth-types";
import { validateLogin, validateSignup } from "@/lib/validators";

type AuthScreenProps = {
  variant: AuthScreenVariant;
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
      <label className="block text-[0.84rem] font-semibold tracking-[-0.01em] text-ink-800 sm:text-[0.98rem]">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-[0.72rem] font-medium text-red-500 sm:text-xs" role="alert">
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
        "flex h-[3.2rem] items-center rounded-[10px] border bg-white px-3 transition sm:h-[3.7rem] sm:px-4",
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
        className="h-full flex-1 bg-transparent px-3 text-[0.96rem] text-ink-800 outline-none placeholder:text-ink-400/80 sm:px-4 sm:text-[1rem]"
      />
      {rightSlot ? <div className="pl-2">{rightSlot}</div> : null}
    </div>
  );
}

export function AuthScreen({ variant }: AuthScreenProps) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const isSignup = variant === "signup";
  const isLogin = !isSignup;
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
      recordId: variant,
      action: "Viewed",
      fieldChanged: "Screen",
      oldValue: "-",
      newValue: variant,
      details: `Opened ${variant} page`,
    });
  }, [appendAuditLog, mode]);

  const copy = useMemo(() => {
    if (variant === "admin-login") {
      return {
        title: "Login",
        actionLabel: "SIGN IN",
        helperLabel: "Forgot Password?",
        linkLabel: "Sign Up",
        linkHref: "/signup",
        switchLabel: "Login as User",
        switchHref: "/user-login",
      };
    }

    if (variant === "user-login") {
      return {
        title: "Login",
        actionLabel: "SIGN IN",
        helperLabel: "Forgot Password?",
        linkLabel: "Sign Up",
        linkHref: "/signup",
        switchLabel: "Login as System Administrator",
        switchHref: "/login",
      };
    }

    return {
      title: "Sign Up",
      actionLabel: "SIGN UP",
      helperLabel: "Already have an account?",
      linkLabel: "Login as User",
      linkHref: "/user-login",
      switchLabel: "Login as System Administrator",
      switchHref: "/login",
    };
  }, [mode]);

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
      const errors = validateLogin(loginValues);
      setLoginErrors(errors);

      if (Object.keys(errors).length > 0) {
        return;
      }

      setLoading(true);

      try {
        const response = await authClient.login({
          ...loginValues,
          portal: variant === "admin-login" ? "admin" : "user",
        });
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full max-w-[900px]">
        <div
          className={[
            "mx-auto flex w-full flex-col rounded-[12px] border border-slate-200 bg-white px-4 py-4 sm:px-7 sm:py-6",
            isSignup ? "max-w-[720px]" : "max-w-[620px]",
          ].join(" ")}
        >
          <div className="flex w-full flex-col items-center justify-center">
            <div className={isSignup ? "h-[72px] w-[72px] sm:h-[96px] sm:w-[96px]" : "h-[64px] w-[64px] sm:h-[84px] sm:w-[84px]"}>
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
                  <FieldShell label="Enter Login Id" error={signupErrors.loginId}>
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
                  <FieldShell label="Enter Email Id" error={signupErrors.email}>
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

                <FieldShell label={mode === "login" ? "Login ID" : "Enter Password"} error={mode === "login" ? loginErrors.loginId : signupErrors.password}>
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
                  <FieldShell label="Password" error={loginErrors.password}>
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
                  <FieldShell label="Re-Enter Password" error={signupErrors.confirmPassword}>
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
                <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600 sm:text-sm" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={[
                  "flex h-[3.15rem] w-full items-center justify-center rounded-[10px] border border-brand-600 bg-brand-600 text-[0.9rem] font-semibold tracking-[0.02em] text-white transition duration-150 hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[3.7rem] sm:text-[0.98rem]",
                  isLogin ? "mt-4" : "mt-5",
                ].join(" ")}
              >
                {loading ? "PLEASE WAIT..." : copy.actionLabel}
              </button>

              <div className={["flex flex-wrap items-center justify-center gap-2 text-center text-[0.84rem] sm:text-[1rem]", isLogin ? "mt-3" : "mt-4"].join(" ")}>
                {isLogin ? (
                  <>
                    <Link href="/forgot-password" className="text-ink-700 transition hover:text-ink-900 active:scale-[0.98]">
                      {copy.helperLabel}
                    </Link>
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

              <Link
                href={copy.switchHref}
                className={[
                  "mt-4 flex w-full items-center justify-center gap-3 rounded-[10px] border border-slate-200 px-4 py-2.5 text-[0.86rem] font-semibold text-brand-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-5 sm:py-3 sm:text-[0.98rem]",
                ].join(" ")}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 sm:h-11 sm:w-11">
                  <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span>{copy.switchLabel}</span>
              </Link>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
