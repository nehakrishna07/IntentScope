import { Download, ExternalLink, BookOpen, Terminal, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScope } from "./intentscope-context";
export function Documentation() {
  const { apiUrl, setSettingsOpen } = useScope();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Technical Documentation</h1>
          <p className="subtitle">
            Deployment, model verification, and a reproducible judging demo.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/docs/README.md" download>
            <Download />
            Download README
          </a>
        </Button>
      </div>
      <div className="notice">
        <FileCheck2 />
        <span>
          Your notebook, training data, test data, and original submission have been reviewed.
          All 4,912 reference IDs match the test order. Raw competition files remain private;
          live inference and prediction reproduction await your recreated Fold 0 weights and tokenizer.
        </span>
      </div>
      <div className="quick-grid">
        <a href="/docs/TECHNICAL_SUBMISSION.md" download className="quick-link">
          <div className="quick-icon">
            <FileCheck2 size={18} />
          </div>
          <div>
            <h3>Technical submission</h3>
            <p>Competition form draft</p>
          </div>
          <Download size={16} />
        </a>
        <a href="/docs/MODEL_SETUP.md" download className="quick-link">
          <div className="quick-icon">
            <Terminal size={18} />
          </div>
          <div>
            <h3>Model setup</h3>
            <p>Original checkpoint requirements</p>
          </div>
          <Download size={16} />
        </a>
        <Button
          variant="ghost"
          className="quick-link h-auto text-left justify-between whitespace-normal"
          onClick={() => {
            if (apiUrl) window.open(`${apiUrl}/docs`, "_blank", "noopener,noreferrer");
            else setSettingsOpen(true);
          }}
        >
          <div className="quick-icon">
            <BookOpen size={18} />
          </div>
          <div>
            <h3>API documentation</h3>
            <p>FastAPI interactive Swagger</p>
          </div>
          <ExternalLink size={16} />
        </Button>
      </div>
      <section className="doc-section">
        <h2>01 / Configure the recreated Fold 0 checkpoint</h2>
        <p>
          Extract your forthcoming <strong>hingroberta_fold0.zip</strong> and locate the saved
          <strong> hingroberta_fold0_best</strong> directory from the Kaggle notebook output.
          Copy its complete model and tokenizer files to the location below. The
          notebook itself contains code and recorded results, not the trained weights.
        </p>
        <pre>{`model/hingroberta_fold0_best/
  config.json
  model.safetensors
  tokenizer.json
  tokenizer_config.json
  special_tokens_map.json
  sentencepiece.bpe.model (if saved)`}</pre>
        <p>
          Do not substitute the later full-data <strong>hingroberta_final</strong> model or the
          untrained base checkpoint. Large weights should use a mounted volume, Git LFS, or external
          model storage.
        </p>
        <p>
          MODEL_PATH must point directly to the directory containing config.json, not the ZIP or
          a parent directory. Restart the Python service after adding the checkpoint. Compare its
          predictions against your original submission before claiming reproducibility; the original
          unavailable checkpoint and a recreated checkpoint are not automatically equivalent.
        </p>
      </section>
      <section className="doc-section">
        <h2>02 / Run locally on Windows & VS Code</h2>
        <p>
          Install Python 3.13 and Bun, open the repository folder in VS Code, and use its PowerShell
          terminal.
        </p>
        <pre>{`py -3.13 -m venv .venv
.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
bun install
python scripts/verify_model.py
python scripts/start_local.py`}</pre>
        <p>
          Open http://localhost:8080 for the app and http://localhost:8000/docs for the API. Set the
          Python service URL in Connection settings. Keep a local screen-share ready for judging if
          public hosting is unavailable.
        </p>
      </section>
      <section className="doc-section">
        <h2>03 / Verify and reproduce</h2>
        <pre>{`python scripts/verify_model.py
python scripts/benchmark.py --queries test.csv --count 100 --output benchmark_report.json
python scripts/reproduce_submission.py --test /private/test.csv --reference /private/hingroberta_fold0_submission.csv --report /private/reproduction_report.json`}</pre>
        <p>
          The output contains exactly example_id,target and preserves IDs and row order. The
          reference comparison checks all IDs and predictions. Batch size is 16, matching the
          original notebook. Exact reproduction can be sensitive to hardware and library
          differences; retain the original environment and investigate mismatches rather than
          silently modifying the pipeline.
        </p>
      </section>
      <section className="doc-section">
        <h2>04 / Deploy the Python service</h2>
        <p>
          The app connects directly to a separately hosted FastAPI service. Use a Hugging Face
          Docker Space or another Python-compatible host with enough memory for approximately 278M
          FP32 weights plus runtime overhead. Start one worker only.
        </p>
        <pre>{`docker build -t intentscope-api .
docker run --rm -p 7860:7860 \
  -e CORS_ORIGINS=https://your-published-frontend \
  -v /path/to/model:/app/model:ro intentscope-api`}</pre>
        <p>
          Configure MODEL_PATH if your model is mounted elsewhere. Set CORS_ORIGINS to your actual
          preview and published frontend addresses, separated by commas. Use HTTPS for the publicly
          hosted service, then connect its URL in this app.
        </p>
      </section>
      <section className="doc-section">
        <h2>05 / API contract</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["GET", "/api/health", "Readiness and connection status"],
                ["POST", "/api/predict", "JSON: {query: string}"],
                ["POST", "/api/batch-predict", "JSON: {csv_text: string}"],
                ["POST", "/api/benchmark", "JSON: {queries: string[], count: 100}"],
                ["GET", "/api/model-info", "Exact parameter count and device"],
                ["GET", "/api/metrics", "Recorded notebook evaluation metrics"],
                ["GET", "/api/dataset-stats", "Aggregate training, test and reference statistics"],
              ].map((r) => (
                <tr key={r[1]}>
                  {r.map((c) => (
                    <td key={c}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="doc-section">
        <h2>07 / Competition artifact privacy</h2>
        <p>
          Keep train.csv, test.csv and the original submission outside the public repository and
          web-served folders. Only aggregate class counts, script composition and file hashes are
          included. The reference distribution is recorded model output, not test ground truth.
        </p>
        <pre>{`python scripts/analyze_datasets.py --train /private/train.csv --test /private/test.csv --reference /private/hingroberta_fold0_submission.csv --notebook notebooks/hingrobert_1.ipynb
# Keep the API and dashboard aggregate snapshots identical:
cp backend/dataset_stats.json src/data/dataset_stats.json`}</pre>
      </section>
      <section className="doc-section">
        <h2>06 / Evaluation integrity</h2>
        <p>
          Validation Macro-F1: 0.85716. Validation accuracy: 0.87367. Leaderboard Macro-F1: 0.8196,
          as supplied in your brief. The 5-way stratified split trains only Fold 0 for the confirmed
          submission; it is not complete OOF evaluation. The notebook records all eight epochs and a
          best-epoch classification report. No confusion matrix is available. Bias tuning was tested
          separately and excluded from the final submission.
        </p>
      </section>
    </>
  );
}
