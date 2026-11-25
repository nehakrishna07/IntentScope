import { ClientOnly } from "@tanstack/react-router";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Info, Unplug, AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
import { intentLabel, type Prediction } from "@/lib/intentscope";
import metrics from "@/data/metrics.json";
export function Metric({
  label,
  value,
  unit,
  foot,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  foot: string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon />
        </span>
      </div>
      <div className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className={`metric-foot ${highlight ? "highlight" : ""}`}>{foot}</div>
    </div>
  );
}
export function ConnectionNotice() {
  const { health, setSettingsOpen } = useScope();
  if (health.ready) return null;
  return (
    <div className="notice">
      <Unplug />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Model not connected.</strong> {health.detail}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-warning"
          onClick={() => setSettingsOpen(true)}
        >
          Connection settings →
        </Button>
      </div>
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="notice error">
      <AlertTriangle />
      <span>{message}</span>
    </div>
  ) : null;
}
export function TrainingChart({ loss = false }: { loss?: boolean }) {
  return (
    <ClientOnly fallback={<div className="chart-frame" />}>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics.epochs} margin={{ top: 10, right: 20, bottom: 10, left: -12 }}>
            <defs>
              <linearGradient id={loss ? "lossFill" : "f1Fill"} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid)" vertical={false} strokeDasharray="3 5" />
            <XAxis
              dataKey="epoch"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `Ep ${v}`}
            />
            <YAxis
              domain={loss ? [0, 2.2] : [65, 95]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (loss ? String(v) : `${v}%`)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 11,
                color: "var(--foreground)",
              }}
              formatter={(v: number) => (loss ? v.toFixed(5) : `${v.toFixed(2)}%`)}
              labelFormatter={(v) => `Epoch ${v}`}
            />
            <Area
              type="monotone"
              dataKey={loss ? "loss" : "f1"}
              name={loss ? "Training loss" : "Macro-F1"}
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill={`url(#${loss ? "lossFill" : "f1Fill"})`}
              dot={{ r: 3, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
            />
            {!loss && (
              <Area
                type="monotone"
                dataKey="accuracy"
                name="Accuracy"
                stroke="var(--cyan)"
                strokeWidth={2}
                fill="transparent"
                dot={{ r: 3, fill: "var(--cyan)", stroke: "var(--card)", strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}
export function DistributionChart({
  data,
  dataKey = "count",
}: {
  data: { id: number; count?: number; support?: number; f1?: number }[];
  dataKey?: string;
}) {
  return (
    <ClientOnly fallback={<div className="chart-frame" />}>
      <div className="chart-frame">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="id"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                fontSize: 11,
              }}
              labelFormatter={(v) => intentLabel(Number(v))}
            />
            <Bar dataKey={dataKey} fill="var(--cyan)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}
export function PredictionResult({ result }: { result: Prediction | null }) {
  const { health } = useScope();
  if (!result)
    return (
      <div className="empty-result">
        <Unplug />
        <h3>{health.ready ? "Ready to classify" : "Model not connected"}</h3>
        <p>
          {health.ready ? "Enter a query and run a prediction to see the results." : "Connect the saved Fold 0 checkpoint to see real predictions here."}
        </p>
        
      </div>
    );
  return (
    <div className={`panel-body ${result.class_id === 55 ? "oos-result" : ""}`}>
      <div className="flex justify-between items-center">
        <span className={`tag ${result.class_id === 55 ? "warning" : "cyan"}`}>
          Class ID: {result.class_id}
        </span>
        <span className="tag">{result.latency_ms.toFixed(1)} ms</span>
      </div>
      <div className="result-class">{intentLabel(result.class_id)}</div>
      {result.class_id === 55 && (
        <p className="text-warning text-xs">
          This query was classified outside the supported intent categories.
        </p>
      )}
      <div className="text-sm text-cyan">
        {(result.probability * 100).toFixed(2)}% model probability
      </div>
      <div className="mt-6 text-[10px] text-muted-foreground uppercase">Top three predictions</div>
      {result.top_three.map((p) => (
        <div className="probability-row" key={p.class_id}>
          <div>
            <span>{intentLabel(p.class_id)}</span>
            <span>{(p.probability * 100).toFixed(2)}%</span>
          </div>
          <progress max={1} value={p.probability} />
        </div>
      ))}
      <div className="mt-6">
        <div className="detail-row">
          <span>Input script</span>
          <strong>{result.script}</strong>
        </div>
        <div className="detail-row">
          <span>Tokens processed</span>
          <strong>{result.token_count} / 64</strong>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Original query</p>
        <p className="text-xs break-words">{result.original_query}</p>
        <p className="text-[10px] text-muted-foreground mt-4 mb-2">Normalized query</p>
        <p className="text-xs break-words">{result.normalized_query}</p>
      </div>
      <div className="flex gap-2 mt-6 text-[10px] text-muted-foreground leading-5">
        <Info size={13} className="shrink-0 mt-1" />
        Softmax scores are model probability estimates, not a guarantee of correctness.
      </div>
    </div>
  );
}
