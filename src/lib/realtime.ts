import { supabase } from "@/lib/supabase-browser";

export function subscribeToTable(
  table: string,
  onChange: (payload: any) => void,
) {
  const channel = supabase
    .channel(`realtime:${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        onChange(payload);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
