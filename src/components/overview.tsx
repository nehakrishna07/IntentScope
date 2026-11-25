import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowRight,
  Award,
  Target,
  Layers,
  Cpu,
  Timer,
  TrendingUp,
  FlaskConical,
  Languages,
  Files,
  ShieldCheck,
  Info,
  Download,
  RefreshCw,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
import { Metric, TrainingChart } from "./scope-widgets";
import stats from "@/data/dataset_stats.json";
export function Overview() {
  const { health, refresh, setSettingsOpen, benchmark } = useScope();
  const info = health.model_info;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1>Overview</h1>
            <span className="tag cyan">Fold 0 · Best checkpoint</span>
          </div>
          <p className="subtitle">Model evaluation and experiment results.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/documentation">
            <Download size={14} />
            Technical report
          </Link>
        </Button>
      </div>
      <section className="intro-banner">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-cyan">
            <Network size={13} />
            ABOUT THE PROJECT
          </div>
          <h2>Hindi & Hinglish Intent Classification</h2>
          <p>
            HingRoBERTa-Mixed is fine-tuned to classify
            <br className="hidden xl:block" /> Hindi and code-mixed queries across 56 intent
            categories.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="tag">हिन्दी · Devanagari</span>
            <span className="tag">Hinglish · Romanized</span>
            <span className="tag">56 intent classes</span>
          </div>
        </div>
        <div className="intro-art" aria-label="Hindi and Romanized scripts">
          <div className="script-tile">अ</div>
          <ArrowRight size={17} />
          <div className="script-tile">Aa</div>
        </div>
      </section>
      <div className="metrics-grid">
        <Metric
          label="Validation Macro-F1"
          value="85.72"
          unit="%"
          foot="↑ 2.35 pts vs. XLM-R baseline"
          icon={TrendingUp}
          highlight
        />
        <Metric
          label="Leaderboard Macro-F1"
          value="81.96"
          unit="%"
          foot="Original leaderboard submission"
          icon={Award}
        />
        <Metric
          label="Validation Accuracy"
          value="87.37"
          unit="%"
          foot="Original held-out validation split"
          icon={Target}
        />
        <Metric
          label="Intent Classes"
          value="56"
          foot="Classes 0–54 + Class 55 (OOS)"
          icon={Layers}
        />
        <Metric
          label="Model Parameters"
          value={info ? (info.total_parameters / 1e6).toFixed(2) : "≈278.09"}
          unit="M"
          foot={
            info
              ? "Exact count verified on loaded model"
              : "Notebook estimate · awaiting verification"
          }
          icon={Cpu}
        />
        <Metric
          label="Avg. Inference Latency"
          value={benchmark ? benchmark.average_ms.toFixed(2) : "—"}
          unit="ms"
          foot={
            benchmark
              ? `${benchmark.query_count} runs · ${benchmark.device}`
              : "Run a benchmark to measure on-device"
          }
          icon={Timer}
        />
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Training performance</h2>
              <p className="subtitle mt-1">Original Fold 0 validation results over eight epochs.</p>
            </div>
            <span className="tag">Fold 0</span>
          </div>
          <div className="flex justify-end px-6 pt-4">
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
          <div className="panel-footer">
            <Info size={12} />
            Recorded notebook metrics · Stratified 5-fold split, Fold 0 trained only
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Model at a glance</h2>
            <Cpu size={16} className="text-muted-foreground" />
          </div>
          <div className="panel-body">
            <div className="detail-row">
              <span>Base model</span>
              <strong>HingRoBERTa-Mixed</strong>
            </div>
            <div className="detail-row">
              <span>Architecture</span>
              <strong>XLM-RoBERTa</strong>
            </div>
            <div className="detail-row">
              <span>Max. sequence length</span>
              <strong>64 tokens</strong>
            </div>
            <div className="detail-row">
              <span>Best checkpoint</span>
              <strong>Epoch 8 · Fold 0</strong>
            </div>
            <div className="detail-row">
              <span>Inference pipeline</span>
              <strong>Single model · No ensemble</strong>
            </div>
            <div className="border-t border-border mt-3 pt-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Parameter utilization</span>
                <span>
                  {info
                    ? `${(info.total_parameters / 3000000).toFixed(1)}%`
                    : "Awaiting exact count"}
                </span>
              </div>
              <div className="progress-track">
                <progress value={info?.total_parameters ?? 0} max={300000000} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {info
                    ? `${(info.total_parameters / 1e6).toFixed(2)}M loaded`
                    : "≈278.09M notebook estimate"}
                </span>
                <span>300M limit</span>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] text-success">
                <ShieldCheck size={14} />
                {info
                  ? info.compliant
                    ? "Within competition parameter limit"
                    : "Exceeds parameter limit"
                  : "Exact compliance checked when model loads"}
              </div>
            </div>
          </div>
        </section>
      </div>
      <section className="section-gap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>Dataset evidence</h2>
          <Button variant="link" size="sm" asChild>
            <Link to="/performance">Class and script analysis <ArrowRight size={14} /></Link>
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-3">
          <div className="detail-row"><span>Training queries</span><strong>{stats.training.rows.toLocaleString()}</strong></div>
          <div className="detail-row"><span>Test queries</span><strong>{stats.test.rows.toLocaleString()}</strong></div>
          <div className="detail-row"><span>Reference ID alignment</span><strong>{stats.reference.ids_and_order_match_test ? "Verified" : "Mismatch"}</strong></div>
        </div>
        <p className="subtitle mt-2">Original competition results · Recreated checkpoint agreement must be verified separately</p>
      </section>
      <section className="section-gap">
        <div className="flex items-center justify-between">
          <h2>Explore your model</h2>
          <span className="text-[10px] text-muted-foreground">
            From a single query to a complete dataset
          </span>
        </div>
        <div className="quick-grid">
          {[
            {
              to: "/playground",
              icon: FlaskConical,
              title: "Intent Playground",
              text: "Classify Hindi & Hinglish queries",
            },
            {
              to: "/cross-script",
              icon: Languages,
              title: "Cross-Script Analysis",
              text: "Compare meaning across scripts",
            },
            {
              to: "/batch",
              icon: Files,
              title: "Batch Prediction",
              text: "Upload, classify & export a CSV",
            },
          ].map((q) => (
            <Link to={q.to} key={q.to} className="quick-link">
              <div className="quick-icon">
                <q.icon size={18} />
              </div>
              <div className="flex-1">
                <h3>{q.title}</h3>
                <p>{q.text}</p>
              </div>
              <ArrowUpRight size={16} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
      <div className="flex items-center justify-between border-t border-border mt-7 pt-5 gap-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <i className={`status-dot ${health.ready ? "ready" : ""}`} />
          {health.ready
            ? "Model ready for live inference"
            : "Live inference awaits your saved model checkpoint"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh model status"
            title="Refresh model status"
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            Connect model
            <ArrowRight size={13} />
          </Button>
        </div>
      </div>
    </>
  );
}
