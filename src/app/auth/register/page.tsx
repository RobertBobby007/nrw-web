"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { upsertProfileFromAuth } from "@/lib/profiles";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

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

    if (!email) {
      setError("Zadej e-mail.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Heslo musí mít aspoň 6 znaků.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Hesla se neshodují.");
      return;
    }

    setStep(2);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (step === 1) {
      handleNext(e);
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("Vyplň jméno, příjmení i uživatelské jméno.");
      return;
    }

    if (!birthdate) {
      setError("Vyplň datum narození.");
      return;
    }

    const normalizedUsername = username.trim().replace(/^@+/, "");
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: normalizedUsername || null,
          birthdate,
        },
      },
    });

    if (!error && data?.user) {
      await upsertProfileFromAuth({
        userId: data.user.id,
        username: normalizedUsername,
        displayName,
      });
    }

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Účet byl vytvořen, zkontroluj e-mail.");
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
              Registrace
            </p>
            <h1 className="text-xl font-semibold">Vytvoř si účet NRW</h1>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-neutral-600">
            Krok {step}/2
          </span>
        </div>

        {step === 1 ? (
          <>
            <div className="space-y-2">
              <label className="block text-sm">E-mail</label>
              <input
                type="email"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm">Heslo</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm">Potvrzení hesla</label>
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
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              Pokračovat
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-sm">Datum narození</label>
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
                <label className="block text-sm">Jméno</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm">Příjmení</label>
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
              <label className="block text-sm">Uživatelské jméno</label>
              <div className="flex items-center gap-2 rounded border px-3 py-2">
                <span className="text-neutral-500">@</span>
                <input
                  type="text"
                  className="w-full bg-transparent text-sm outline-none"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/^@+/, ""))
                  }
                  placeholder="tvujnick"
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
                Zpět
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-md border px-3 py-2 text-sm font-medium"
              >
                {loading ? "Zakládám účet…" : "Registrovat se"}
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
          Už máš účet?{" "}
          <a href="/auth/login" className="underline">
            Přihlásit se
          </a>
        </p>
      </form>
    </div>
  );
}
