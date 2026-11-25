import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Health, Benchmark } from "@/lib/intentscope";
interface ScopeContext {
  benchmark: Benchmark | null;
  setBenchmark: (v: Benchmark) => void;
  health: Health;
  apiUrl: string;
  setApiUrl: (v: string) => void;
  refresh: () => Promise<void>;
  request: <T>(path: string, body?: unknown) => Promise<T>;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
}
const Context = createContext<ScopeContext | null>(null);
export function ScopeProvider({ children }: { children: ReactNode }) {
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [apiUrl, setUrl] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState<Health>({
    ready: false,
    detail: "Connect the Python service with your saved Fold 0 checkpoint.",
  });
  useEffect(() => {
    setUrl(
      localStorage.getItem("intentscope-api") || import.meta.env["VITE_INFERENCE_API_URL"] || "",
    );
  }, []);
  const setApiUrl = (v: string) => {
    const clean = v.trim().replace(/\/$/, "");
    localStorage.setItem("intentscope-api", clean);
    setUrl(clean);
    setBenchmark(null);
    setHealth({ ready: false, detail: "Checking model connection…" });
  };
  const request = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      if (!apiUrl)
        throw new Error("Model disconnected. Connect your Python service in Connection settings.");
      const response = await fetch(`${apiUrl}${path}`, {
        ...(body !== undefined
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
        signal: AbortSignal.timeout(
          path.includes("benchmark") || path.includes("batch") ? 600000 : path.includes("explain") ? 120000 : 45000,
        ),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          typeof json.detail === "string"
            ? json.detail
            : "The service could not process this request.",
        );
      return json as T;
    },
    [apiUrl],
  );
  const refresh = useCallback(async () => {
    try {
      setHealth(await request<Health>("/api/health"));
    } catch (e) {
      setHealth({
        ready: false,
        detail: apiUrl
          ? `Service unavailable. ${e instanceof Error ? e.message : "Check the service URL."}`
          : "Connect the Python service with your saved Fold 0 checkpoint.",
      });
    }
  }, [request, apiUrl]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        benchmark,
        setBenchmark,
        health,
        apiUrl,
        setApiUrl,
        refresh,
        request,
        settingsOpen,
        setSettingsOpen,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useScope() {
  const c = useContext(Context);
  if (!c) throw new Error("ScopeProvider required");
  return c;
}
