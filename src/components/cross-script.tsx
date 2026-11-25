import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Languages,
  LoaderCircle,
  CheckCircle2,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionNotice, ErrorNotice, PredictionResult } from "./scope-widgets";
import { VoiceInput } from "./voice-input";
import { useScope } from "./intentscope-context";
import { intentLabel, summarizeCrossScriptPairs, type Prediction } from "@/lib/intentscope";

interface QueryPair {
  id: string;
  label: string;
  hindi: string;
  hinglish: string;
}
interface PairResult {
  pair: QueryPair;
  hindiPred: Prediction;
  hinglishPred: Prediction;
}

const PRESET_PAIRS: QueryPair[] = [
  {
    id: "refund",
    label: "Refund request",
    hindi: "मुझे मेरा पैसा वापस चाहिए",
    hinglish: "Mujhe mera paisa wapas chahiye",
  },
  {
    id: "order",
    label: "Order delivery",
    hindi: "मेरा ऑर्डर कब आएगा",
    hinglish: "Mera order kab aayega",
  },
  {
    id: "password",
    label: "Password reset",
    hindi: "मुझे अपना पासवर्ड बदलना है",
    hinglish: "Mujhe apna password badalna hai",
  },
  {
    id: "payment",
    label: "Payment failure",
    hindi: "मेरा पेमेंट फेल हो गया है",
    hinglish: "Mera payment fail ho gaya hai",
  },
];

export function CrossScript() {
  const { request, health } = useScope();
  const [hindi, setHindi] = useState(PRESET_PAIRS[0]!.hindi);
  const [hinglish, setHinglish] = useState(PRESET_PAIRS[0]!.hinglish);
  const [results, setResults] = useState<[Prediction, Prediction] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [pairs, setPairs] = useState<QueryPair[]>(PRESET_PAIRS);
  const [newHindi, setNewHindi] = useState("");
  const [newHinglish, setNewHinglish] = useState("");
  const [batchResults, setBatchResults] = useState<PairResult[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState("");

  async function compare() {
    setError("");
    setResults(null);
    if (!hindi.trim() || !hinglish.trim()) {
      setError("Enter a query in both script fields.");
      return;
    }
    setBusy(true);
    try {
      const [h, r] = await Promise.all([
        request<Prediction>("/api/predict", { query: hindi, trigger_automation: false }),
        request<Prediction>("/api/predict", { query: hinglish, trigger_automation: false }),
      ]);
      setResults([h, r]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runMultiPairTest() {
    setBatchError("");
    setBatchResults(null);
    if (pairs.length === 0) {
      setBatchError("Add at least one query pair before running the consistency test.");
      return;
    }
    setBatchBusy(true);
    try {
      const out: PairResult[] = [];
      for (const pair of pairs) {
        const [hindiPred, hinglishPred] = await Promise.all([
          request<Prediction>("/api/predict", { query: pair.hindi, trigger_automation: false }),
          request<Prediction>("/api/predict", { query: pair.hinglish, trigger_automation: false }),
        ]);
        out.push({ pair, hindiPred, hinglishPred });
      }
      setBatchResults(out);
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : "Multi-pair consistency test failed.");
    } finally {
      setBatchBusy(false);
    }
  }

  function addCustomPair() {
    if (!newHindi.trim() || !newHinglish.trim()) return;
    setPairs((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        label: `Custom pair ${prev.length + 1}`,
        hindi: newHindi.trim(),
        hinglish: newHinglish.trim(),
      },
    ]);
    setNewHindi("");
    setNewHinglish("");
    setBatchResults(null);
  }

  const comparisonChart = results
    ? Array.from(
        new Set([
          ...results[0].top_three.map((p) => p.class_id),
          ...results[1].top_three.map((p) => p.class_id),
        ]),
      ).map((cid) => ({
        intent: intentLabel(cid),
        Hindi: results[0].top_three.some((p) => p.class_id === cid) ? Number((results[0].top_three.find((p) => p.class_id === cid)!.probability * 100).toFixed(2)) : null,
        Hinglish: results[1].top_three.some((p) => p.class_id === cid) ? Number((results[1].top_three.find((p) => p.class_id === cid)!.probability * 100).toFixed(2)) : null,
      }))
    : [];

  const summary = batchResults
    ? summarizeCrossScriptPairs(
        batchResults.map((r) => ({
          hindiClassId: r.hindiPred.class_id,
          hinglishClassId: r.hinglishPred.class_id,
          hindiProb: r.hindiPred.probability,
          hinglishProb: r.hinglishPred.probability,
        })),
      )
    : null;

  const isConsistent = results ? results[0].class_id === results[1].class_id : false;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Cross-Script Analysis</h1>
          <p className="subtitle">
            Two equivalent queries. Two independent predictions from the same HingRoBERTa-Mixed model.
          </p>
        </div>
        <Button disabled={busy || !health.ready} onClick={() => void compare()}>
          {busy ? <LoaderCircle className="spinner" /> : <Languages />}
          {busy ? "Comparing…" : "Compare predictions"}
        </Button>
      </div>
      <ConnectionNotice />
      <ErrorNotice message={error} />

      <div className="panel mb-5">
        <div className="panel-header">
          <h2>Preset equivalent query pairs</h2>
          <span className="tag">Click to load both panels</span>
        </div>
        <div className="panel-body flex flex-wrap gap-2">
          {PRESET_PAIRS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              className="h-auto py-1.5 text-left"
              disabled={busy}
              onClick={() => {
                setHindi(p.hindi);
                setHinglish(p.hinglish);
                setResults(null);
                setError("");
              }}
            >
              <span>
                {p.hindi} <span className="text-muted-foreground">/</span> {p.hinglish}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {results && (
        <>
          <div className={`notice ${isConsistent ? "" : "error"}`}>
            {isConsistent ? <CheckCircle2 className="text-success" /> : <AlertTriangle />}
            <span>
              <strong>{isConsistent ? "Consistent Prediction" : "Different Predictions"}</strong> ·{" "}
              {isConsistent
                ? `Both scripts predicted ${intentLabel(results[0].class_id)} (probability gap ${(Math.abs(results[0].probability - results[1].probability) * 100).toFixed(2)} pts).`
                : `Hindi predicted ${intentLabel(results[0].class_id)} while Hinglish predicted ${intentLabel(results[1].class_id)}.`}
            </span>
          </div>
          <section className="panel mb-5">
            <div className="panel-header">
              <h2>Side-by-side probability comparison</h2>
              <span className="tag cyan">Top three per script</span>
            </div>
            <div className="panel-body">
              <ClientOnly fallback={<div className="chart-frame" />}>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChart}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="intent" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          fontSize: 11,
                        }}
                        formatter={(v: number) => `${v.toFixed(2)}%`}
                      />
                      <Legend />
                      <Bar dataKey="Hindi" name="Hindi (Devanagari)" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Hinglish" name="Hinglish (Romanized)" fill="var(--cyan)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ClientOnly>
              <p className="subtitle">Missing bars mean the class was not in that script’s top three; its probability is not known here.</p>
            </div>
          </section>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {[
          {
            title: "Hindi — Devanagari script",
            badge: "अ",
            lang: "hi-IN" as const,
            v: hindi,
            set: setHindi,
            examples: PRESET_PAIRS.map((p) => p.hindi),
          },
          {
            title: "Hinglish — Romanized Hindi",
            badge: "Aa",
            lang: "en-IN" as const,
            v: hinglish,
            set: setHinglish,
            examples: PRESET_PAIRS.map((p) => p.hinglish),
          },
        ].map((s, i) => (
          <section key={s.title} className="panel">
            <div className="panel-header">
              <h2>{s.title}</h2>
              <span className="tag">{s.badge}</span>
            </div>
            <div className="panel-body">
              <textarea
                aria-label={s.title}
                className="input-area"
                value={s.v}
                maxLength={10000}
                disabled={busy}
                onChange={(e) => { s.set(e.target.value); setResults(null); }}
              />
              {!busy && <VoiceInput defaultLang={s.lang} compact onTranscript={(text) => { s.set(text); setResults(null); }} />}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {s.examples.slice(0, 3).map((ex) => (
                  <Button key={ex} size="sm" variant="ghost" className="text-[11px] h-7" disabled={busy} onClick={() => { s.set(ex); setResults(null); }}>
                    {ex}
                  </Button>
                ))}
              </div>
            </div>
            <div className="border-t border-border">
              <PredictionResult result={results?.[i] ?? null} />
            </div>
          </section>
        ))}
      </div>

      <section className="panel section-gap">
        <div className="panel-header">
          <div>
            <h2>Multi-query consistency testing</h2>
            <p className="subtitle mt-1">
              Test multiple equivalent Hindi / Hinglish pairs independently to measure cross-script agreement.
            </p>
          </div>
          <Button disabled={batchBusy || !health.ready} onClick={() => void runMultiPairTest()}>
            {batchBusy ? <LoaderCircle className="spinner" /> : <Play size={14} />}
            {batchBusy ? "Testing pairs…" : `Run ${pairs.length} pairs`}
          </Button>
        </div>
        <div className="panel-body">
          <ErrorNotice message={batchError} />
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 mb-4">
            <input
              aria-label="New Hindi query"
              className="text-input"
              placeholder="Add Hindi query (Devanagari)"
              value={newHindi}
              onChange={(e) => setNewHindi(e.target.value)}
            />
            <input
              aria-label="New Hinglish query"
              className="text-input"
              placeholder="Add equivalent Hinglish query"
              value={newHinglish}
              onChange={(e) => setNewHinglish(e.target.value)}
            />
            <Button type="button" variant="outline" disabled={batchBusy || !newHindi.trim() || !newHinglish.trim()} onClick={addCustomPair}>
              <Plus size={14} />
              Add pair
            </Button>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <div className="detail-row flex-col items-start">
                <span>Total pairs tested</span>
                <strong>{summary.total}</strong>
              </div>
              <div className="detail-row flex-col items-start">
                <span>Matching predictions</span>
                <strong className="text-success">{summary.matching}</strong>
              </div>
              <div className="detail-row flex-col items-start">
                <span>Mismatched predictions</span>
                <strong className="text-warning">{summary.mismatched}</strong>
              </div>
              <div className="detail-row flex-col items-start">
                <span>Consistency</span>
                <strong className="text-cyan">{summary.consistencyPct.toFixed(1)}%</strong>
              </div>
              <div className="detail-row flex-col items-start">
                <span>Avg. top-score gap</span>
                <strong>{(summary.avgProbDiff * 100).toFixed(2)} pts</strong>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hindi (Devanagari)</th>
                  <th>Hinglish (Romanized)</th>
                  <th>Result</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => {
                  const r = batchResults?.find((item) => item.pair.id === p.id);
                  const match = r && r.hindiPred.class_id === r.hinglishPred.class_id;
                  return (
                    <tr key={p.id}>
                      <td>{p.hindi}</td>
                      <td>{p.hinglish}</td>
                      <td>
                        {r ? (
                          <span className={`tag ${match ? "cyan" : "warning"}`}>
                            {match
                              ? `Match · ${intentLabel(r.hindiPred.class_id)}`
                              : `${intentLabel(r.hindiPred.class_id)} vs ${intentLabel(r.hinglishPred.class_id)}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not run</span>
                        )}
                      </td>
                      <td>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`Remove ${p.label}`}
                          disabled={batchBusy} onClick={() => { setPairs((prev) => prev.filter((item) => item.id !== p.id)); setBatchResults(null); }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="flex items-start gap-2 text-[11px] text-muted-foreground mt-4">
            <Info size={13} className="shrink-0 mt-0.5 text-cyan" />
            Cross-script consistency measures agreement between scripts on paired inputs, not
            classification accuracy, unless ground-truth intent labels are available. Predictions
            are never forced to match.
          </p>
        </div>
      </section>
    </>
  );
}