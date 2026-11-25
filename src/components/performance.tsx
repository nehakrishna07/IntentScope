import { useState } from "react";
import {
  Award,
  TrendingUp,
  Target,
  Download,
  Timer,
  LoaderCircle,
  Play,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
import {
  Metric,
  TrainingChart,
  DistributionChart,
  ConnectionNotice,
  ErrorNotice,
} from "./scope-widgets";
import { downloadFile, type Benchmark } from "@/lib/intentscope";
import metrics from "@/data/metrics.json";
import { DatasetAnalysis } from "./dataset-analysis";
export function Performance() {
  const { request, health, benchmark, setBenchmark } = useScope();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queries, setQueries] = useState(
    "Mera order kab deliver hoga?\nमुझे अपना पासवर्ड बदलना है\nPayment fail ho gaya hai\nMujhe refund chahiye\nAaj ka weather kaisa hai?",
  );
  const [view, setView] = useState<"f1" | "support" | "report">("f1");
  async function run() {
    setError("");
    const q = queries.split("\n").filter((q) => q.trim());
    if (!q.length) {
      setError("Enter at least one benchmark query.");
      return;
    }
    setBusy(true);
    try {
      setBenchmark(await request<Benchmark>("/api/benchmark", { queries: q, count: 100 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmark failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Model Performance</h1>
          <p className="subtitle">
            Recorded evaluation, exact model verification, and on-device latency.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadFile(
              "recorded_metrics.json",
              JSON.stringify(metrics, null, 2),
              "application/json",
            )
          }
        >
          <Download />
          Export metrics
        </Button>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Validation Macro-F1"
          value="85.72"
          unit="%"
          foot="Fold 0 · Best epoch 8"
          icon={TrendingUp}
        />
        <Metric
          label="Validation Accuracy"
          value="87.37"
          unit="%"
          foot="3,388 held-out queries"
          icon={Target}
        />
        <Metric
          label="Leaderboard Macro-F1"
          value="81.96"
          unit="%"
          foot="Competition leaderboard, as supplied"
          icon={Award}
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="panel">
          <div className="panel-header">
            <h2>Validation by epoch</h2>
            <div className="chart-legend">
              <span>
                <i className="legend-dot" />
                Macro-F1
              </span>
              <span>
                <i className="legend-dot cyan" />
                Accuracy
              </span>
            </div>
          </div>
          <TrainingChart />
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Training loss</h2>
            <span className="tag">1.99407 → 0.42676</span>
          </div>
          <TrainingChart loss />
        </section>
      </div>
      <section className="panel section-gap">
        <div className="panel-header">
          <h2>Per-class evaluation</h2>
          <div className="flex gap-1 flex-wrap">
            {(["f1", "support", "report"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "secondary" : "ghost"}
                onClick={() => setView(v)}
              >
                {v === "f1" ? "F1 scores" : v === "support" ? "Validation support" : "Full report"}
              </Button>
            ))}
          </div>
        </div>
        {view === "report" ? (
          <div className="panel-body">
            <pre>{metrics.report}</pre>
          </div>
        ) : (
          <DistributionChart data={metrics.classes} dataKey={view} />
        )}
        <div className="panel-footer">
          Best-epoch validation report from the notebook · No confusion matrix was recorded.
        </div>
      </section>
      <DatasetAnalysis />
      <div className="grid md:grid-cols-2 gap-5 section-gap">
        <section className="panel">
          <div className="panel-header">
            <h2>Validation strategy</h2>
          </div>
          <div className="panel-body">
            <div className="detail-row">
              <span>Split strategy</span>
              <strong>StratifiedKFold · 5 splits</strong>
            </div>
            <div className="detail-row">
              <span>Submitted trained fold</span>
              <strong>Fold 0 only</strong>
            </div>
            <div className="detail-row">
              <span>Training / validation</span>
              <strong>13,548 / 3,388 queries</strong>
            </div>
            <div className="detail-row">
              <span>Seed</span>
              <strong>42</strong>
            </div>
            <div className="detail-row">
              <span>Baseline XLM-R Macro-F1</span>
              <strong>0.83370</strong>
            </div>
            <div className="detail-row">
              <span>Recorded improvement</span>
              <strong className="text-success">+0.02346 absolute</strong>
            </div>
            <p className="subtitle mt-3">
              This is a single-fold validation score, not completed five-fold OOF evaluation. Bias
              tuning was excluded from the final Fold 0 submission.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Parameter verification</h2>
            <ShieldCheck size={17} className="text-success" />
          </div>
          <div className="panel-body">
            {health.model_info ? (
              <>
                {[
                  ["Total parameters", health.model_info.total_parameters.toLocaleString()],
                  ["Trainable parameters", health.model_info.trainable_parameters.toLocaleString()],
                  [
                    "Remaining allowance",
                    (300000000 - health.model_info.total_parameters).toLocaleString(),
                  ],
                  [
                    "Compliance",
                    health.model_info.compliant ? "Within 300M limit" : "Over limit — blocked",
                  ],
                  ["Checkpoint", health.model_info.checkpoint],
                  ["Device", health.model_info.device],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="detail-row">
                  <span>Notebook rounded count</span>
                  <strong>≈278.09M</strong>
                </div>
                <div className="detail-row">
                  <span>Competition limit</span>
                  <strong>300,000,000</strong>
                </div>
                <p className="subtitle mt-4">
                  The exact integer count and trainable count require the saved checkpoint.
                  Inference is blocked if the loaded model exceeds the limit.
                </p>
                <pre>sum(p.numel() for p in model.parameters())</pre>
              </>
            )}
          </div>
        </section>
      </div>
      <section className="section-gap" id="benchmark">
        <div className="page-heading">
          <div>
            <h2 className="text-lg">Inference latency benchmark</h2>
            <p className="subtitle mt-1">
              100 individual runs · Batch size 1 · 5 warm-ups · Model loading excluded
            </p>
          </div>
          <Button disabled={busy} onClick={() => void run()}>
            {busy ? <LoaderCircle className="spinner" /> : <Play />}
            {busy ? "Benchmarking…" : "Run Benchmark"}
          </Button>
        </div>
        <ConnectionNotice />
        <ErrorNotice message={error} />
        <section className="panel">
          <div className="panel-body">
            <label htmlFor="benchmark-queries" className="block text-xs mb-3">
              Benchmark queries
            </label>
            <textarea
              id="benchmark-queries"
              className="input-area min-h-32"
              value={queries}
              onChange={(e) => setQueries(e.target.value)}
            />
            <p className="subtitle mt-3">
              The supplied query pool is cycled across 100 measured runs; this is not necessarily
              100 unique queries. Includes normalization, tokenization, forward pass, and prediction
              extraction, with CUDA synchronization.
            </p>
          </div>
        </section>
        {benchmark && (
          <>
            <div className="metrics-grid section-gap">
              <Metric
                label="Average latency"
                value={benchmark.average_ms.toFixed(2)}
                unit="ms"
                foot={`${benchmark.query_count} measured queries`}
                icon={Timer}
              />
              <Metric
                label="Median latency"
                value={benchmark.median_ms.toFixed(2)}
                unit="ms"
                foot="50th percentile"
                icon={Timer}
              />
              <Metric
                label="95th percentile"
                value={benchmark.p95_ms.toFixed(2)}
                unit="ms"
                foot="Measured end-to-end inference"
                icon={Timer}
              />
            </div>
            <div className="flex justify-between gap-3 items-center">
              <span className="tag">
                <Cpu size={13} />
                {benchmark.device} · {benchmark.hardware}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile(
                    "benchmark_report.json",
                    JSON.stringify(benchmark, null, 2),
                    "application/json",
                  )
                }
              >
                <Download />
                Download benchmark report
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
