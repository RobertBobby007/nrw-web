"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("banned")) {
      setAuthError(t("auth.login.bannedError"));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message || t("auth.login.fallbackError"));
        return;
      }

      router.push("/");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-xl"
      >
        <h1 className="text-xl font-semibold">{t("auth.login.title")}</h1>

        <div className="space-y-2">
          <label className="block text-sm">{t("auth.login.emailLabel")}</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm">{t("auth.login.passwordLabel")}</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {authError && <p className="text-sm text-red-500">{authError}</p>}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
        >
          {authLoading ? t("auth.login.submitLoading") : t("auth.login.submitButton")}
        </button>

        <p className="text-xs text-center text-neutral-500">
          {t("auth.login.noAccount")}{" "}
          <a href="/auth/register" className="underline">
            {t("auth.login.registerLink")}
          </a>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
