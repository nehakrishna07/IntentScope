import { ClientOnly } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Info, Sparkles, Clock } from "lucide-react";
import { intentLabel, type Explanation } from "@/lib/intentscope";

export function ExplainPanel({ explanation }: { explanation: Explanation }) {
  const maxAbs = Math.max(
    0.001,
    ...explanation.words.map((w) => Math.abs(w.importance)),
  );
  const chartData = explanation.words.map((w) => ({
    label: `${w.word} (#${w.index + 1})`,
    word: w.word,
    importancePct: Number((w.importance * 100).toFixed(3)),
    occludedPct: Number((w.occluded_probability * 100).toFixed(2)),
    direction: w.direction,
  }));

  return (
    <section className="panel section-gap" aria-label="Prediction explanation">
      <div className="panel-header">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan" />
            <h2>Explainable AI · Occlusion Sensitivity</h2>
          </div>
          <p className="subtitle mt-1">
            Measured probability shift when each normalized word is removed from the query.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag cyan">{intentLabel(explanation.class_id)}</span>
          <span className="tag">
            <Clock size={11} className="inline mr-1" />
            {explanation.computation_ms.toFixed(1)} ms
          </span>
        </div>
      </div>
      <div className="panel-body">
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <div className="detail-row">
            <span>Original probability</span>
            <strong>{(explanation.base_probability * 100).toFixed(2)}%</strong>
          </div>
          <div className="detail-row">
            <span>Words evaluated</span>
            <strong>
              {explanation.evaluated_words} / {explanation.total_words}
            </strong>
          </div>
          <div className="detail-row">
            <span>Tokens processed</span>
            <strong>{explanation.token_count} / 64</strong>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Color-coded word influence
            </h3>
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-success">
                <i className="legend-dot success" />
                Supports prediction
              </span>
              <span className="flex items-center gap-1.5 text-warning">
                <i className="legend-dot warning" />
                Opposes prediction
              </span>
            </div>
          </div>
          <div className="token-highlight-box">
            {explanation.words.map((w) => {
              const strength = Math.min(1, Math.abs(w.importance) / maxAbs);
              const cls = w.importance >= 0 ? "pos" : "neg";
              return (
                <span
                  key={`${w.index}-${w.word}`}
                  className={`token-chip ${cls}`}
                  style={{ ["--strength" as string]: (0.14 + strength * 0.42).toFixed(2) }}
                  title={`Removing "${w.word}": probability changes from ${(explanation.base_probability * 100).toFixed(2)}% to ${(w.occluded_probability * 100).toFixed(2)}% (importance ${w.importance >= 0 ? "+" : ""}${(w.importance * 100).toFixed(2)} pts)`}
                >
                  <span>{w.word}</span>
                  <small>
                    {w.importance >= 0 ? "+" : ""}
                    {(w.importance * 100).toFixed(1)}
                  </small>
                </span>
              );
            })}
          </div>
          {explanation.truncated && (
            <p className="text-[11px] text-warning mt-2">
              Occlusion was capped at the first {explanation.max_words} normalized words to keep
              inference responsive.
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Feature importance (percentage-point drop when removed)
            </h3>
            <ClientOnly fallback={<div className="chart-frame" />}>
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                    <CartesianGrid stroke="var(--grid)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}pt`}
                    />
                    <YAxis
                      type="category"
                      dataKey="word"
                      width={88}
                      tick={{ fill: "var(--foreground)", fontSize: 11 }}
                    />
                    <ReferenceLine x={0} stroke="var(--border)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        fontSize: 11,
                      }}
                      formatter={(val: number) => [`${val >= 0 ? "+" : ""}${val.toFixed(2)} pts`, "Importance"]}
                    />
                    <Bar dataKey="importancePct" radius={[3, 3, 3, 3]}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.importancePct >= 0 ? "var(--success)" : "var(--warning)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ClientOnly>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Most influential words
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Effect</th>
                    <th>Without word</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {explanation.most_influential.map((w) => (
                    <tr key={`${w.index}-${w.word}`}>
                      <td>
                        <strong>{w.word}</strong>
                      </td>
                      <td>
                        <span className={`tag ${w.direction === "positive" ? "cyan" : "warning"}`}>
                          {w.direction === "positive" ? "Supports" : "Opposes"}
                        </span>
                      </td>
                      <td>{(w.occluded_probability * 100).toFixed(2)}%</td>
                      <td>
                        {w.importance >= 0 ? "+" : ""}
                        {(w.importance * 100).toFixed(2)} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-5 pt-4 border-t border-border text-[11px] text-muted-foreground">
          <div className="flex gap-2">
            <Info size={13} className="shrink-0 mt-0.5 text-cyan" />
            <span>
              <strong>Method:</strong> {explanation.method}
            </span>
          </div>
          <p className="pl-5">{explanation.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}