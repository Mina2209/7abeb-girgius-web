import { useEffect, useRef } from "react";
import { trackEvent } from "../services/analytics";

type SearchTrackingOptions = {
  section: string;
  getResultCount?: () => number;
  delay?: number;
};

export function useSearchAnalytics(
  query: string,
  { section, getResultCount, delay = 600 }: SearchTrackingOptions
) {
  const initialized = useRef(false);
  const previousQuery = useRef(query);
  const resultCountRef = useRef(getResultCount);
  resultCountRef.current = getResultCount;

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      previousQuery.current = query;
      return;
    }
    if (query === previousQuery.current) return;
    previousQuery.current = query;

    const trimmed = query.trim();
    if (!trimmed) return;

    const timer = setTimeout(() => {
      trackEvent("search", {
        contentType: section,
        properties: {
          queryLength: trimmed.length,
          ...(resultCountRef.current
            ? { resultCount: resultCountRef.current() }
            : {}),
        },
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [query, section, delay]);
}
