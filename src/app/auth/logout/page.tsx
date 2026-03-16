"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LogoutPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-4 border p-6 rounded-xl">
        <h1 className="text-xl font-semibold">{t("logout.title")}</h1>
        <p className="text-sm text-neutral-600">
          {t("logout.description")}
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
        >
          {loading ? t("logout.loading") : t("common.actions.signOut")}
        </button>
      </div>
    </div>
  );
}
