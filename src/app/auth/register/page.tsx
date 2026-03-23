"use client";

import { useState } from "react";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { containsBlockedIdentityContent } from "@/lib/content-filter";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function RegisterPage() {
  const supabase = getSupabaseBrowserClient();
  const t = useTranslations();

  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleNext = (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const emailTrimmed = email.trim();

    if (!emailTrimmed) {
      setError(t("auth.register.emailRequired"));
      return;
    }

    if (containsBlockedIdentityContent(emailTrimmed).hit) {
      setError(t("auth.register.emailBlocked"));
      return;
    }

    if (!password || password.length < 6) {
      setError(t("auth.register.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.register.passwordsMismatch"));
      return;
    }

    setStep(2);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (step === 1) {
      handleNext(e);
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError(t("auth.register.nameUsernameRequired"));
      return;
    }

    if (!birthdate) {
      setError(t("auth.register.birthdateRequired"));
      return;
    }

    const firstNameTrimmed = firstName.trim();
    const lastNameTrimmed = lastName.trim();
    const normalizedUsername = username.trim().replace(/^@+/, "");
    const displayName = `${firstNameTrimmed} ${lastNameTrimmed}`.trim();
    const emailTrimmed = email.trim();

    if (containsBlockedIdentityContent(firstNameTrimmed).hit) {
      setError(t("auth.register.firstNameBlocked"));
      return;
    }
    if (containsBlockedIdentityContent(lastNameTrimmed).hit) {
      setError(t("auth.register.lastNameBlocked"));
      return;
    }
    if (displayName && containsBlockedIdentityContent(displayName).hit) {
      setError(t("auth.register.displayNameBlocked"));
      return;
    }
    if (containsBlockedIdentityContent(normalizedUsername).hit) {
      setError(t("auth.register.usernameBlocked"));
      return;
    }
    if (containsBlockedIdentityContent(emailTrimmed).hit) {
      setError(t("auth.register.emailBlocked"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: emailTrimmed,
      password,
      options: {
        data: {
          display_name: displayName || null,
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
          username: normalizedUsername || null,
          birthdate,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo(t("auth.register.successInfo"));
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {t("auth.register.eyebrow")}
            </p>
            <h1 className="text-xl font-semibold">{t("auth.register.title")}</h1>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-neutral-600">
            {t("auth.register.step", { step })}
          </span>
        </div>

        {step === 1 ? (
          <>
            <div className="space-y-2">
              <label className="block text-sm">{t("auth.register.emailLabel")}</label>
              <input
                type="email"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm">{t("auth.register.passwordLabel")}</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm">{t("auth.register.passwordConfirmLabel")}</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              {t("auth.register.continueButton")}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-sm">{t("auth.register.birthdateLabel")}</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm">{t("auth.register.firstNameLabel")}</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm">{t("auth.register.lastNameLabel")}</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm">{t("auth.register.usernameLabel")}</label>
              <div className="flex items-center gap-2 rounded border px-3 py-2">
                <span className="text-neutral-500">@</span>
                <input
                  type="text"
                  className="w-full bg-transparent text-sm outline-none"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/^@+/, ""))
                  }
                  placeholder={t("auth.register.usernamePlaceholder")}
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {info && <p className="text-sm text-emerald-500">{info}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-md border px-3 py-2 text-sm font-medium"
              >
                {t("auth.register.backButton")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-md border px-3 py-2 text-sm font-medium"
              >
                {loading ? t("auth.register.submitLoading") : t("auth.register.submitButton")}
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {info && <p className="text-sm text-emerald-500">{info}</p>}
          </>
        )}

        <p className="text-xs text-center text-neutral-500">
          {t("auth.register.hasAccount")}{" "}
          <a href="/auth/login" className="underline">
            {t("auth.register.loginLink")}
          </a>
        </p>
      </form>
    </div>
  );
}
