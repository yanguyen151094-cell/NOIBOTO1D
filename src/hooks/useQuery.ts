import { useCallback, useEffect, useRef, useState } from "react";

export interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetcherRef
      .current()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { data, loading, error, reload: load };
}