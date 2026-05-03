import { useEffect, useState } from "react";
import { searchSuggestions, AddressSuggestion } from "@/lib/distances";

/** Hook : retourne des suggestions d'adresses pour `query`, avec debounce. */
export function useAddressSuggestions(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchSuggestions(q, ctrl.signal);
        setSuggestions(res);
      } catch {
        // ignore (abort or network)
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
      setLoading(false);
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
