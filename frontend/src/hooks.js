import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Fetch a GET endpoint; refetches when `path` changes. Pass null to skip. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => {
      live = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// SLA settings rarely change; fetch once per page load and share.
let slaSettings = null;
export function useSlaSettings() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    slaSettings ??= api("/sla/settings").catch((e) => {
      slaSettings = null;
      throw e;
    });
    slaSettings.then((d) => live && setData(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return data;
}
