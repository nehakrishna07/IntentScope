import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
import { ErrorNotice } from "./scope-widgets";
import { intentLabel, type AutomationStatus, type AutomationConfig, type AutomationHistoryEntry } from "@/lib/intentscope";

export function AutomationPanel() {
  const { request } = useScope();
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [routeClass, setRouteClass] = useState("0");
  const [routeName, setRouteName] = useState("");
  async function run(action: () => Promise<AutomationStatus>) {
    setBusy(true); setError(""); setNotice("");
    try { const next = await action(); setStatus(next); setConfig({ ...next.config }); }
    catch (e) { setError(e instanceof Error ? e.message : "Workflow request failed."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    request<AutomationStatus>("/api/automation/status").then(data => { if (active) { setStatus(data); setConfig({...data.config}); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load workflows."); });
    return () => { active = false; };
  }, [request]);
  function toggle(key: "enabled" | "log_predictions" | "oos_routing" | "low_confidence_review" | "intent_routing" | "summary_reports", value: boolean) {
    setConfig(old => old ? {...old, [key]: value} : old);
  }
  function send(path: string) {
    return run(async () => {
      const result = await request<{entry: AutomationHistoryEntry; status: AutomationStatus}>(path, {});
      setNotice(result.entry.status === "success" ? "Webhook acknowledged the request. Check the n8n execution for the actual route and any downstream actions." : result.entry.error || "Webhook failed.");
      return result.status;
    });
  }
  const metrics = status?.metrics;
  const latestSuccess = status?.history.find(h => h.status === "success");
  return <>
    <div className="page-heading"><div><h1>Workflows</h1><p className="subtitle">Route selected predictions through n8n without changing their class IDs.</p></div><Button variant="outline" disabled={busy} onClick={() => void run(() => request<AutomationStatus>("/api/automation/status"))}>Refresh</Button></div>
    <ErrorNotice message={error} />
    {notice && <p role="status" className="panel p-4 mb-4 text-sm">{notice}</p>}
    <section className="panel"><div className="panel-header"><h2>Webhook connection</h2><span className="tag">{!status ? "Unknown" : !status.configured ? "Not configured" : status.config.enabled ? "Enabled" : "Disabled"}</span></div><div className="panel-body">
      <div className="detail-row"><span>Webhook host</span><strong>{status?.webhook_host ?? "Set N8N_WEBHOOK_URL on the Python service"}</strong></div>
      <div className="detail-row"><span>Header secret</span><strong>{status?.auth_configured ? "Configured" : "Not configured"}</strong></div>
      <div className="detail-row"><span>Most recent successful request</span><strong>{latestSuccess ? new Date(latestSuccess.timestamp).toLocaleString() : "None recorded"}</strong></div>
      <p className="subtitle">Configure the webhook URL and secret in the backend terminal. Connection is verified by a successful test, not by the presence of a URL.</p>
      <div className="flex flex-wrap gap-2 mt-4"><Button disabled={busy || !status?.configured || !status?.auth_configured} onClick={() => void send("/api/automation/test")}>Test connection</Button><Button variant="outline" disabled={busy || !status?.configured || !status?.auth_configured || !status?.config.enabled || !status?.config.summary_reports} onClick={() => void send("/api/automation/summary")}>Send summary</Button></div>
    </div></section>
    {config && <section className="panel section-gap"><div className="panel-header"><h2>Routing settings</h2></div><div className="panel-body">
      {([ ["enabled", "Enable automation"], ["log_predictions", "Log prediction metadata"], ["oos_routing", "Route class 55 for manual review"], ["low_confidence_review", "Route low-probability predictions for manual review"], ["intent_routing", "Apply class-specific routes"], ["summary_reports", "Allow summary reports"] ] as const).map(([key,label]) => <label key={key} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={config[key]} disabled={busy} onChange={e => toggle(key,e.target.checked)}/>{label}</label>)}
      <label className="block text-sm mt-4">Review probability threshold: {(config.confidence_threshold*100).toFixed(0)}%<input className="block w-full mt-2" type="range" min="0" max="1" step="0.05" value={config.confidence_threshold} disabled={busy} onChange={e => setConfig({...config, confidence_threshold:Number(e.target.value)})}/></label>
      <p className="subtitle">This threshold only changes downstream review routing. The classifier always returns its original argmax.</p>
      <h3 className="mt-5 mb-2">Class-specific routes</h3>
      <div className="flex flex-wrap items-end gap-2"><label className="text-xs">Class ID<input type="number" min="0" max="55" step="1" className="text-input" value={routeClass} disabled={busy} onChange={e => setRouteClass(e.target.value)}/></label><label className="text-xs flex-1">Route name<input className="text-input" maxLength={80} placeholder="e.g. review-queue" value={routeName} disabled={busy} onChange={e => setRouteName(e.target.value)}/></label><Button variant="outline" disabled={busy || !routeName.trim() || routeClass.trim()==="" || !Number.isInteger(Number(routeClass)) || Number(routeClass)<0 || Number(routeClass)>55} onClick={() => {setConfig({...config,routing_rules:[...config.routing_rules,{class_id:Number(routeClass),route:routeName.trim(),channel:"webhook"}]});setRouteName("");}}>Add route</Button></div>
      {config.routing_rules.map((r,i) => <div className="detail-row" key={i}><span>{intentLabel(r.class_id)} → {r.route}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfig({...config,routing_rules:config.routing_rules.filter((_,j)=>j!==i)})}>Remove</Button></div>)}
      <p className="subtitle mt-3">Raw query text is excluded when saving these settings. Settings and execution history are held in memory and reset when the backend restarts.</p>
      <Button className="mt-4" disabled={busy} onClick={() => void run(async () => {const next = await request<AutomationStatus>("/api/automation/config", {...config,include_raw_query:false});setNotice("Routing settings saved for this backend session.");return next;})}>Save settings</Button>
      <p className="subtitle mt-2">After saving, go to Playground and select “Send prediction metadata” before classifying. Comparisons and explanations do not dispatch workflows.</p>
    </div></section>}
    <section className="panel section-gap"><div className="panel-header"><h2>Session activity</h2></div><div className="panel-body">
      <div className="grid sm:grid-cols-3 gap-4">{[["Predictions observed",metrics?.total_predictions_observed],["Successful webhooks",metrics?.successful_executions],["Failed webhooks",metrics?.failed_executions],["Review candidates",metrics?.manual_review_count],["Mean model latency (ms)",metrics?.average_model_latency_ms?.toFixed(1)],["Mean webhook latency (ms)",metrics?.average_automation_latency_ms?.toFixed(1)]].map(([label,value])=><div className="detail-row flex-col items-start" key={label}><span>{label}</span><strong className="text-xl">{value ?? "—"}</strong></div>)}</div>
      <div className="table-wrap mt-4"><table><thead><tr><th>Time</th><th>Event</th><th>Class</th><th>Webhook</th><th>Result</th></tr></thead><tbody>{status?.history.map(h=><tr key={h.event_id}><td>{new Date(h.timestamp).toLocaleTimeString()}</td><td>{h.event_type}</td><td>{h.class_id===null ? "—" : intentLabel(h.class_id)}</td><td>{h.automation_latency_ms.toFixed(1)} ms</td><td>{h.status}{h.error ? `: ${h.error}` : ""}</td></tr>)}{!status?.history.length && <tr><td colSpan={5}>No webhook executions recorded yet.</td></tr>}</tbody></table></div>
    </div></section>
  </>;
}
