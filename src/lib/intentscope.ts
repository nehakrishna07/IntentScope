export const PARAMETER_LIMIT = 300_000_000;
export const CLASS_COUNT = 56;
export const MAX_TOKENS = 64;
export function intentLabel(id: number) {
  return id === 55 ? "Out-of-Scope Query" : `Intent ${id}`;
}
export function isCompliant(count: number) {
  return count <= PARAMETER_LIMIT;
}
export function submissionCsv(rows: { example_id: string; target: number }[]) {
  const escape = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
  return "example_id,target\n" + rows.map((r) => `${escape(r.example_id)},${r.target}`).join("\n");
}
export function downloadFile(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export interface Prediction {
  class_id: number;
  probability: number;
  top_three: { class_id: number; probability: number }[];
  latency_ms: number;
  script: string;
  original_query: string;
  normalized_query: string;
  token_count: number;
  automation?: {
    status: string;
    event_id: string;
    latency_ms: number;
    triggered_workflows: string[];
    is_oos?: boolean;
    is_low_confidence?: boolean;
    matched_routes?: string[];
    detail?: string;
  };
}
export interface WordAttribution {
  index: number;
  word: string;
  importance: number;
  occluded_probability: number;
  probability_delta: number;
  direction: "positive" | "negative";
}
export interface Explanation {
  class_id: number;
  base_probability: number;
  top_three: { class_id: number; probability: number }[];
  original_query: string;
  normalized_query: string;
  script: string;
  token_count: number;
  words: WordAttribution[];
  most_influential: WordAttribution[];
  evaluated_words: number;
  total_words: number;
  truncated: boolean;
  max_words: number;
  computation_ms: number;
  method: string;
  disclaimer: string;
}
export interface RoutingRule {
  class_id: number;
  route: string;
  channel: string;
}
export interface AutomationConfig {
  enabled: boolean;
  log_predictions: boolean;
  oos_routing: boolean;
  low_confidence_review: boolean;
  confidence_threshold: number;
  intent_routing: boolean;
  routing_rules: RoutingRule[];
  summary_reports: boolean;
  include_raw_query: boolean;
}
export interface AutomationHistoryEntry {
  event_id: string;
  event_type: string;
  timestamp: string;
  class_id: number | null;
  probability: number | null;
  script: string | null;
  is_oos: boolean;
  is_low_confidence: boolean;
  triggered_workflows: string[];
  matched_routes: string[];
  model_latency_ms: number | null;
  automation_latency_ms: number;
  status: "success" | "failed";
  http_status: number | null;
  error: string | null;
}
export interface AutomationStatus {
  configured: boolean;
  connected: boolean;
  webhook_host: string | null;
  auth_configured: boolean;
  timeout_seconds: number;
  config: AutomationConfig;
  metrics: {
    total_predictions_observed: number;
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    oos_alerts: number;
    manual_review_count: number;
    low_confidence_count: number;
    average_model_latency_ms: number | null;
    average_automation_latency_ms: number | null;
    top_intent_classes: { class_id: number; count: number }[];
  };
  history: AutomationHistoryEntry[];
}
export function summarizeCrossScriptPairs(
  pairs: { hindiClassId: number; hinglishClassId: number; hindiProb: number; hinglishProb: number }[],
) {
  const total = pairs.length;
  const matching = pairs.filter((p) => p.hindiClassId === p.hinglishClassId).length;
  const mismatched = total - matching;
  const consistencyPct = total > 0 ? (matching / total) * 100 : 0;
  const avgProbDiff =
    total > 0 ? pairs.reduce((s, p) => s + Math.abs(p.hindiProb - p.hinglishProb), 0) / total : 0;
  return { total, matching, mismatched, consistencyPct, avgProbDiff };
}
export interface Health {
  ready: boolean;
  detail: string;
  model_info?: ModelInfo | null;
}
export interface ModelInfo {
  total_parameters: number;
  trainable_parameters: number;
  device: string;
  hardware: string;
  checkpoint: string;
  compliant: boolean;
}
export interface Benchmark {
  average_ms: number;
  median_ms: number;
  p95_ms: number;
  query_count: number;
  device: string;
  hardware: string;
  warmup_runs: number;
}
