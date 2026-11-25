import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Play,
  LoaderCircle,
  X,
  Files,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
import { ConnectionNotice, ErrorNotice, Metric, DistributionChart } from "./scope-widgets";
import { downloadFile, submissionCsv } from "@/lib/intentscope";
interface QueryRow {
  example_id: string;
  query_text: string;
  target?: number;
}
interface BatchResult {
  rows: { example_id: string; query_text: string; target: number }[];
  total_queries: number;
  average_ms: number;
  oos_count: number;
}
export function Batch() {
  const { request } = useScope();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [csv, setCsv] = useState("");
  const [fileName, setName] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  async function readFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setRows([]);
    setResult(null);
    setProgress(0);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file with example_id and query_text columns.");
      return;
    }
    if (file.size > 10000000) {
      setError("CSV must be smaller than 10 MB.");
      return;
    }
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
    });
    if (
      parsed.errors.length ||
      !parsed.meta.fields?.includes("example_id") ||
      !parsed.meta.fields.includes("query_text")
    ) {
      setError("Invalid CSV: required columns are example_id and query_text.");
      return;
    }
    if (!parsed.data.length || parsed.data.length > 10000) {
      setError("CSV must contain 1–10,000 rows.");
      return;
    }
    const next = parsed.data.map((r) => ({
      example_id: r["example_id"] ?? "",
      query_text: r["query_text"] ?? "",
    }));
    if (next.some((r) => !r.example_id.trim() || !r.query_text.trim())) {
      setError("Every row needs a non-empty example_id and query_text.");
      return;
    }
    setRows(next);
    setCsv(text);
    setName(file.name);
  }
  async function run() {
    setError("");
    if (!rows.length) {
      setError("Upload a valid CSV first.");
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress(0);
    try {
      let output: BatchResult["rows"] = [];
      let totalMs = 0;
      for (let i = 0; i < rows.length; i += 64) {
        const chunk = rows.slice(i, i + 64);
        const text = Papa.unparse(chunk, { columns: ["example_id", "query_text"] });
        const r = await request<BatchResult>("/api/batch-predict", { csv_text: text });
        output = output.concat(r.rows);
        totalMs += r.average_ms * r.total_queries;
        setProgress(Math.min(i + 64, rows.length));
      }
      setResult({
        rows: output,
        total_queries: output.length,
        average_ms: totalMs / output.length,
        oos_count: output.filter((r) => r.target === 55).length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch prediction failed.");
    } finally {
      setBusy(false);
    }
  }
  const distribution = Array.from({ length: 56 }, (_, id) => ({
    id,
    count: result?.rows.filter((r) => r.target === id).length ?? 0,
  }));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Batch Prediction</h1>
          <p className="subtitle">Classify a dataset and export a competition-ready submission.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadFile(
              "sample_queries.csv",
              "example_id,query_text\n001,Mera order kab deliver hoga?\n002,मुझे अपना पासवर्ड बदलना है\n003,Payment fail ho gaya hai\n",
              "text/csv",
            )
          }
        >
          <Download />
          Sample CSV
        </Button>
      </div>
      <ConnectionNotice />
      <ErrorNotice message={error} />
      <section className="panel">
        <div className="panel-header">
          <h2>Query dataset</h2>
          <span className="tag">CSV · example_id, query_text</span>
        </div>
        <div className="panel-body">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Upload query CSV"
            onChange={(e) => void readFile(e.target.files?.[0])}
            onClick={(e) => {
              e.currentTarget.value = "";
            }}
          />
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void readFile(e.dataTransfer.files[0]);
            }}
          >
            {rows.length ? <FileSpreadsheet /> : <UploadCloud />}
            <h3>{fileName || "Drop your query CSV here"}</h3>
            <span className="text-xs text-muted-foreground">
              {rows.length
                ? `${rows.length.toLocaleString()} rows · Original IDs and order preserved`
                : "CSV files up to 10 MB · Up to 10,000 rows"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {rows.length ? "Replace CSV" : "Browse files"}
              </Button>
              {rows.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove CSV"
                  disabled={busy}
                  onClick={() => {
                    setRows([]);
                    setName("");
                    setCsv("");
                    setResult(null);
                  }}
                >
                  <X />
                </Button>
              )}
            </div>
          </div>
          {rows.length > 0 && (
            <div className="flex items-center justify-between mt-5 gap-3">
              <span className="text-xs text-muted-foreground">
                {busy
                  ? `${progress} / ${rows.length} queries processed`
                  : `${rows.length} queries ready`}
              </span>
              <Button disabled={busy || !csv} onClick={() => void run()}>
                {busy ? <LoaderCircle className="spinner" /> : <Play />}
                {busy ? "Classifying…" : "Run batch prediction"}
              </Button>
            </div>
          )}
          {busy && (
            <div className="progress-track">
              <progress max={rows.length} value={progress} />
            </div>
          )}
        </div>
      </section>
      {result && (
        <>
          <div className="metrics-grid section-gap">
            <Metric
              label="Queries processed"
              value={String(result.total_queries)}
              foot="All input rows classified"
              icon={Files}
            />
            <Metric
              label="Avg. processing latency"
              value={result.average_ms.toFixed(2)}
              unit="ms"
              foot="Batched processing time per query"
              icon={Timer}
            />
            <Metric
              label="Out-of-Scope queries"
              value={String(result.oos_count)}
              foot="Model argmax selected Class 55"
              icon={AlertTriangle}
            />
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Predicted intent distribution</h2>
            </div>
            <DistributionChart data={distribution} />
          </section>
        </>
      )}
      {rows.length > 0 && (
        <section className="panel section-gap">
          <div className="panel-header">
            <h2>{result ? "Prediction results" : "Dataset preview"}</h2>
            {result && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile("intentscope_submission.csv", submissionCsv(result.rows), "text/csv")
                }
              >
                <Download />
                Download predictions
              </Button>
            )}
          </div>
          <div className="table-wrap mt-5">
            <table>
              <thead>
                <tr>
                  <th>example_id</th>
                  <th>query_text</th>
                  {result && <th>target</th>}
                </tr>
              </thead>
              <tbody>
                {(result?.rows ?? rows).slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    <td>{r.example_id}</td>
                    <td>{r.query_text}</td>
                    {result && (
                      <td>
                        <span className={r.target === 55 ? "text-warning" : "text-cyan"}>
                          {r.target}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footer">
            Showing first {Math.min(rows.length, 200)} rows · Export includes every row, with
            exactly example_id and target.
          </div>
        </section>
      )}
    </>
  );
}
