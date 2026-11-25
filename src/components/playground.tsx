import { useState, useRef } from "react";
import { RotateCcw, LoaderCircle, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionNotice, ErrorNotice, PredictionResult } from "./scope-widgets";
import { useScope } from "./intentscope-context";
import { VoiceInput } from "./voice-input";
import { ExplainPanel } from "./explain-panel";
import type { Prediction, Explanation } from "@/lib/intentscope";

const examples = ["Mera order kab deliver hoga?", "मुझे अपना पासवर्ड बदलना है", "Payment fail ho gaya hai", "Mujhe refund chahiye", "Aaj ka weather kaisa hai?"];

export function Playground({ demo = false }: { demo?: boolean }) {
  const { request, health } = useScope();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [sendAutomation, setSendAutomation] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);
  const busy = loading || explaining;

  function changeQuery(text: string) {
    revision.current++;
    setQuery(text.slice(0, 10000)); setResult(null); setExplanation(null); setError("");
  }
  async function predict() {
    if (pending.current || !health.ready) return;
    if (!query.trim()) { setError("Enter a query first."); return; }
    const current = revision.current;
    pending.current = true; setLoading(true); setError(""); setResult(null); setExplanation(null);
    try {
      const data = await request<Prediction>("/api/predict", { query, trigger_automation: sendAutomation });
      if (revision.current === current) setResult(data);
    } catch (e) { if (revision.current === current) setError(e instanceof Error ? e.message : "Prediction failed."); }
    finally { pending.current = false; setLoading(false); }
  }
  async function explain() {
    if (!result || pending.current) return;
    const current = revision.current;
    pending.current = true; setExplaining(true); setError(""); setExplanation(null);
    try {
      const data = await request<Explanation>("/api/explain", { query: result.original_query, max_words: 24 });
      if (revision.current === current) setExplanation(data);
    } catch (e) { if (revision.current === current) setError(e instanceof Error ? e.message : "Explanation failed."); }
    finally { pending.current = false; setExplaining(false); }
  }
  return <>
    <div className="page-heading"><div><h1>{demo ? "Live intent classification" : "Intent Playground"}</h1><p className="subtitle">Enter a Hindi or Hinglish query to see how the trained model classifies it.</p></div></div>
    {!demo && <ConnectionNotice />}<ErrorNotice message={error} />
    <div className="two-column">
      <section className="panel"><div className="panel-header"><h2>Enter a query</h2></div><div className="panel-body">
        <textarea aria-label="Query text" className="input-area" placeholder="Mera order kab deliver hoga?" value={query} disabled={busy} maxLength={10000} onChange={e => changeQuery(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void predict(); } }} />
        {!busy && <VoiceInput onTranscript={changeQuery} defaultLang="hi-IN" />}
        <div className="flex justify-between items-center mt-3"><span className="text-xs text-muted-foreground">{query.length.toLocaleString()} characters</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => changeQuery("")}><RotateCcw size={13}/> Clear</Button></div>
        <label className="flex items-center gap-2 mt-4 text-xs"><input type="checkbox" checked={sendAutomation} disabled={busy} onChange={e => setSendAutomation(e.target.checked)} /> Send prediction metadata to configured n8n workflow</label>
        <div className="flex flex-wrap gap-2 mt-4"><Button disabled={busy || !health.ready || !query.trim()} onClick={() => void predict()}>{loading ? <LoaderCircle className="spinner"/> : <Search size={15}/>} {loading ? "Classifying…" : "Classify query"}</Button></div>
        <div className="border-t border-border mt-6 pt-4"><h3>Try an example</h3><div className="example-list">{examples.map(s => <Button variant="outline" size="sm" className="example-chip" disabled={busy} key={s} onClick={() => changeQuery(s)}>{s}<ArrowRight size={12}/></Button>)}</div></div>
      </div></section>
      <section className="panel"><div className="panel-header"><h2>Prediction result</h2></div>
        {loading ? <div className="empty-result" role="status"><LoaderCircle className="spinner"/><p>Running the trained model…</p></div> : <PredictionResult result={result}/>}
        {result && <div className="panel-body border-t border-border"><Button variant="outline" disabled={busy} onClick={() => void explain()}>{explaining ? "Measuring word influence…" : "Why this prediction?"}</Button>
          {result.automation && <div className="mt-3 text-xs"><strong>Workflow: {result.automation.status}</strong><p className="subtitle">{result.automation.detail}</p>{result.automation.status === "success" && <p className="subtitle">Webhook latency: {result.automation.latency_ms.toFixed(1)} ms (separate from inference).</p>}{result.automation.triggered_workflows.length > 0 && <p className="subtitle">Matched rules: {result.automation.triggered_workflows.join(", ")}</p>}</div>}
        </div>}
      </section>
    </div>
    {explanation && <ExplainPanel explanation={explanation}/>}
  </>;
}

export { CrossScript } from "./cross-script";
