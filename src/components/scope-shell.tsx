import { Link } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  Activity,
  LayoutDashboard,
  FlaskConical,
  Languages,
  Files,
  ChartNoAxesCombined,
  Workflow,
  BookOpen,
  ChevronRight,
  Settings2,
  Sun,
  Moon,
  Menu,
  X,
  ExternalLink,
  CircleHelp,
  Presentation,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
export const navigation = [
  { to: "/", name: "Overview", icon: LayoutDashboard },
  { to: "/playground", name: "Intent Playground", icon: FlaskConical },
  { to: "/cross-script", name: "Cross-Script Analysis", icon: Languages },
  { to: "/batch", name: "Batch Prediction", icon: Files },
  { to: "/automation", name: "Workflows", icon: Network },
  { to: "/demo", name: "Live Demo", icon: Presentation },
  { to: "/performance", name: "Model Performance", icon: ChartNoAxesCombined },
  { to: "/architecture", name: "Model Architecture", icon: Workflow },
  { to: "/documentation", name: "Technical Documentation", icon: BookOpen },
] as const;
export function ScopeShell({ page, children }: { page: string; children: ReactNode }) {
  return <Shell page={page}>{children}</Shell>;
}
function Shell({ page, children }: { page: string; children: ReactNode }) {
  const { health, setSettingsOpen, settingsOpen, apiUrl, setApiUrl, refresh } = useScope();
  const [mobile, setMobile] = useState(false);
  const [light, setLight] = useState(true);
  useEffect(() => {
    const next = localStorage.getItem("intentscope-theme") !== "dark";
    setLight(next); document.documentElement.dataset["theme"] = next ? "light" : "dark";
  }, []);
  const [url, setUrl] = useState(apiUrl);
  const [connectionError, setConnectionError] = useState("");
  function toggleTheme() {
    const next = !light;
    setLight(next);
    localStorage.setItem("intentscope-theme", next ? "light" : "dark");
    document.documentElement.dataset["theme"] = next ? "light" : "dark";
  }
  function openSettings() {
    setUrl(apiUrl);
    setConnectionError("");
    setSettingsOpen(true);
  }
  function connect() {
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      setApiUrl(url);
      setSettingsOpen(false);
    } catch {
      setConnectionError("Enter a valid HTTP or HTTPS service URL.");
    }
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} />
          </div>
          <div>
            <div className="brand-name">
              IntentScope<span className="text-primary">.</span>
            </div>
            <div className="brand-caption">Multilingual Intent Classification</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          {navigation.slice(0, 6).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMobile(false)}
              className={`nav-item ${page === n.name ? "active" : ""}`}
            >
              <n.icon />
              {n.name}
              {page === n.name && <ChevronRight className="ml-auto" size={13} />}
            </Link>
          ))}
        </nav>
        <div className="nav-label mt-6">Model & insights</div>
        <nav>
          {navigation.slice(6).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMobile(false)}
              className={`nav-item ${page === n.name ? "active" : ""}`}
            >
              <n.icon />
              {n.name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="connection-box">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] font-medium">
                <i className={`status-dot ${health.ready ? "ready" : ""}`} />
                {health.ready ? "Model connected" : "Model disconnected"}
              </span>
              <Button
                title="Connection settings"
                aria-label="Connection settings"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={openSettings}
              >
                <Settings2 size={13} />
              </Button>
            </div>
            <p>
              {health.ready ? health.model_info?.checkpoint : "Awaiting trained Fold 0 checkpoint"}
            </p>
            <p>HingRoBERTa-Mixed · 56 classes</p>
          </div>
          <div className="flex items-center justify-between px-3 pt-5 text-[10px] text-muted-foreground">
            <span>Anveshan DataSprint 2.0</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={12} />
              <strong>{page}</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="tag competition-tag">
              <span className="status-dot ready" />
              Final Demo Round
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
              title={light ? "Dark mode" : "Light mode"}
              onClick={toggleTheme}
            >
              {light ? <Moon /> : <Sun />}
            </Button>
            <Link to="/documentation" aria-label="Documentation" title="Documentation">
              <CircleHelp size={17} className="text-muted-foreground" />
            </Link>

          </div>
        </header>
        <main className="page">
          {children}
          <footer className="page-footer">
            <span>IntentScope · Powered by HingRoBERTa-Mixed</span>
            <span>Anveshan DataSprint 2.0 · Final Demo Round</span>
          </footer>
        </main>
      </div>
      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-title"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="connection-title">Model connection</h2>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close connection settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X />
              </Button>
            </div>
            <p>
              Connect the deployed FastAPI service containing your exact{" "}
              <strong>hingroberta_fold0_best</strong> model and tokenizer. The notebook does not
              contain the saved weights.
            </p>
            <label htmlFor="api-url" className="block mb-2 text-xs">
              Inference service URL
            </label>
            <input
              id="api-url"
              className="text-input"
              placeholder="https://your-space.hf.space"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") connect();
              }}
            />
            {connectionError && <p className="text-destructive">{connectionError}</p>}
            <div className="flex justify-between gap-3 mt-5">
              <Button variant="outline" onClick={() => void refresh()}>
                Check connection
              </Button>
              <Button onClick={connect}>
                Connect service
                <ExternalLink size={14} />
              </Button>
            </div>
            <p className="mb-0">
              Allow this app’s origin in the service’s CORS configuration. See Technical
              Documentation for setup.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
