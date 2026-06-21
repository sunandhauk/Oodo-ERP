import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full max-w-[720px]">
        <div className="mx-auto flex w-full flex-col items-center rounded-[0.25rem] border border-white/70 bg-white/95 px-5 py-8 shadow-[0_24px_64px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-8">
          <div className="h-[88px] w-[88px] sm:h-[96px] sm:w-[96px]">
            <BrandMark className="h-full w-full" />
          </div>
          <h1 className="mt-5 text-center text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.045em] text-ink-800">
            Forgot Password
          </h1>
          <p className="mt-3 max-w-[560px] text-center text-[1rem] leading-7 text-ink-600">
            Password reset is not wired to the backend yet. We can add the reset request flow next, but this page is in place now so the login screens can route here cleanly.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/user-login" className="rounded-[0.25rem] bg-brand-600 px-5 py-3 font-semibold text-white transition hover:bg-brand-700">
              Back to User Login
            </Link>
            <Link href="/login" className="rounded-[0.25rem] border border-brand-200 px-5 py-3 font-semibold text-brand-700 transition hover:bg-brand-50">
              System Administrator Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

