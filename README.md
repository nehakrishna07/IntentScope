# IntentScope — Multilingual Intent Classification

Anveshan DataSprint 2.0 final demo application. React/TanStack Start and Tailwind provide the dashboard; a separate, genuine **FastAPI Web App** runs the original trained PyTorch/Hugging Face model. There are no LLM APIs, mock predictions, ensembles or retraining steps in this application.

## Final verified results — 25 November 2026

| Metric | Result |
|---|---:|
| Leaderboard Macro-F1 (team-reported) | **0.8196 (81.96%)** |
| Fold 0 validation Macro-F1 (recorded notebook) | **0.85716 (85.716%)** |
| Fold 0 validation accuracy | 0.87367 (87.367%) |
| Exact inference parameter count | **278,086,712** |
| Competition parameter limit | 300,000,000 |
| Parameter compliance | Passed |
| Average single-query inference latency | **47.78 ms** |
| Median inference latency | 47.28 ms |
| P95 inference latency | 55.14 ms |
| Inference device | CPU (AMD host) |
| Measured benchmark runs | 100 |
| Submission prediction agreement | **100% (4,912/4,912)** |
| ID/order mismatches | 0 |
| Target mismatches | 0 |

The latency benchmark used five sample queries cycled across 100 measured runs, five warm-up runs and batch size 1, excluding model loading. The recreated checkpoint reproduced every reference prediction through actual checkpoint inference. Prediction agreement is not classification accuracy or proof that the original and recreated weights are byte-identical.

Evidence: [original competition submission](hingroberta_fold0_submission.csv) and [checkpoint inference verification report](reproduction_report.json).

## Current availability

- Included: React frontend, FastAPI service, original `notebooks/hingrobert_1.ipynb`, all eight recorded epoch metrics, classification report, verification/benchmark/reproduction scripts, n8n workflow, Docker deployment and technical form draft.
- The original training dataset (16,936 rows) and test dataset (4,912 rows) are kept private; the repository includes aggregate statistics and artifact hashes, the original Fold 0 submission and the reproduction report.
- The original trained weights were unavailable after the Kaggle session expired. The owner recreated the Fold 0 checkpoint and tokenizer on Kaggle; the restored checkpoint is available locally and its predictions match the original reference CSV on all test rows.
- Local inference, parameter compliance, benchmarking and checkpoint reproduction have been verified. Both standard and low-confidence manual-review n8n branches were exercised successfully.
- The large checkpoint is not included in GitHub. Obtain it from the project owner through an authorized transfer; public checkpoint hosting has not yet been configured.
- The supplied notebook also trains `hingroberta_final` on full data. The submitted model is Fold 0; the application does not load the later model. The notebook is retained as provenance.
- Official intent names for classes 0–54 have not been verified; the UI displays numeric intent IDs. Class 55 is Out-of-Scope.
- Local screen-share demo is available; no public hosted demo URL is claimed.

## A. Pipeline and architecture

```mermaid
flowchart LR
  A[Hindi or Hinglish query] --> B[Original NFKC normalization]
  B --> C[Saved fast tokenizer: max length 64]
  C --> D[HingRoBERTa-Mixed XLM-R encoder]
  D --> E[Fine-tuned 56-class head]
  E --> F[Original logits argmax]
  E --> G[Softmax estimates and top 3]
  F --> H[Class 0–55]
```

Base checkpoint: `l3cube-pune/hing-roberta-mixed`. Architecture: XLM-RoBERTa sequence classifier. Load exactly one saved fine-tuned model with FP32 stored weights, `model.eval()` and `torch.inference_mode()`. CUDA FP16 autocast matches the notebook; CPU falls back to FP32. Use the original tokenizer saved alongside the Fold 0 model. Dynamic padding rounds to a multiple of eight; max token length is 64. Notebook submission inference batch size is 16.

The exact normalization copied from the notebook is:

```python
import re, unicodedata

def norm(t):
    t = unicodedata.normalize("NFKC", str(t)).lower()
    t = t.replace("\u093c", "").replace("\u0901", "\u0902")
    t = re.sub(r"([a-z])\1{2,}", r"\1\1", t)
    t = re.sub(r"[^\w\s\u0900-\u097F]", " ", t)
    return re.sub(r"\s+", " ", t).strip()
```

The pipeline contains no translation, language-dependent prediction override, confidence cutoff or bias adjustment. APIs reject empty/invalid inputs rather than fabricating a result. Only generic `Intent N` names are used without an official mapping; Class 55 has its specified OOS label.

### Training provenance (no retraining in this app)

16,936 queries; `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)`, with only Fold 0 used for the confirmed submission. Train: 13,548; validation: 3,388. Eight epochs; best epoch 8. Batch size 8, gradient accumulation 2, effective batch 16. Encoder LR 3e-5, head LR 1e-3, label smoothing .05, weight decay .01, warm-up ratio .10. AdamW with linear schedule, FP32 weights/CUDA AMP, gradient clipping 1.0. The notebook computes class weights in a separate cell but its recorded training loss uses ordinary label-smoothed cross entropy; do not claim class weighting in the final loss.

## B. Cross-script and Class 55 handling

HingRoBERTa-Mixed’s Hindi–English code-mixed pretraining supports contextual representation of Devanagari Hindi, Romanized Hindi and Hinglish. The comparison page independently infers both inputs; identical meaning does **not** guarantee identical classes. Latin script detection describes observed characters, not inferred language.

Class 55 is one of the 56 learned classes. `logits.argmax(axis=1)` chooses it normally when its logit is largest. The amber OOS visualization only describes the actual result. Softmax is a probability estimate, not guaranteed correctness. No threshold optimization, manual rules, ensembling or bias tuning is applied to classification. Optional downstream automation can flag low-probability predictions without changing their labels.

Macro-F1 gives each class equal weight. It prevents frequent categories from dominating evaluation and is therefore useful for this imbalanced intent dataset.

## C. Parameter count proof

The notebook reports **278.09M rounded**. The restored model has been verified at **278,086,712 parameters**, below the competition limit by **21,913,288 parameters**. The count is calculated programmatically:

```python
total_parameters = sum(p.numel() for p in model.parameters())
trainable_parameters = sum(p.numel() for p in model.parameters() if p.requires_grad)
assert total_parameters <= 300_000_000
print(total_parameters, trainable_parameters)
```

```sh
python scripts/verify_model.py
```

**Measured integer output: 278,086,712 — PASS.** The script reports total/trainable counts, device, hardware, loaded checkpoint and compliance; failure stops execution. The HTTP service checks before readiness/inference. The actual checkpoint inference report records the loaded model metadata and parameter compliance. The loader rejects missing, unexpected, mismatched or newly initialized weights and never downloads an untrained fallback.

## D. Validation results and limitations

| Epoch | Training loss | Validation Macro-F1 | Validation accuracy |
|---|---:|---:|---:|
| 1 | 1.99407 | 0.72849 | 0.77686 |
| 2 | 1.04138 | 0.79211 | 0.83117 |
| 3 | 0.77977 | 0.82810 | 0.84976 |
| 4 | 0.63576 | 0.83869 | 0.85744 |
| 5 | 0.54323 | 0.84576 | 0.86275 |
| 6 | 0.48130 | 0.84960 | 0.86777 |
| 7 | 0.44588 | 0.85458 | 0.87072 |
| 8 | 0.42676 | **0.85716** | **0.87367** |

Leaderboard Macro-F1: **0.8196**, supplied in the project brief (not measured by this app). Previous XLM-R Fold 0 Macro-F1: 0.83370; recorded improvement: **+0.02346** (2.346 percentage points). Do not claim this is the biggest improvement across experiments that were not supplied. A classification report with all 56 class F1 scores and validation support is included in `backend/metrics.json` and displayed in the dashboard. No confusion matrix was recorded. Full-training class counts are now computed from the uploaded training dataset, separately from validation support; no missing evaluation values are fabricated.

### Actual dataset analysis and privacy

The performance page shows all 56 training class counts and the original reference prediction distribution. Training has 249 Class 55 labels; the reference submission has 335 Class 55 predictions (6.82%). Reference predictions are **not test ground truth** and cannot establish accuracy. Training contains 10,353 Devanagari-only, 5,645 Latin-only and 938 mixed-script queries; test contains 1,604, 3,154 and 154 respectively. Script categories describe characters, not inferred language. Original normalization yields 14 duplicate training queries, no duplicate test queries, and no empty normalized queries; no rows are removed or rewritten.

Keep the raw training and test datasets outside the repository and any web-served directory. The original prediction-only submission is included for verification; redistribute it only as permitted by the competition. Regenerate public aggregate snapshots from private files:

```sh
python scripts/analyze_datasets.py --train /private/train.csv --test /private/test.csv --reference /private/hingroberta_fold0_submission.csv --notebook notebooks/hingrobert_1.ipynb
cp backend/dataset_stats.json src/data/dataset_stats.json
```

On Windows use `Copy-Item backend/dataset_stats.json src/data/dataset_stats.json`. This script uses only the Python standard library and existing normalization, exports counts and SHA-256 provenance only, and does not require a checkpoint. The API and dashboard snapshots must remain identical. The private-analysis row count does not change the public API's 10,000-row upload limit. Do not publish raw datasets; comply with the competition and owner’s permissions when distributing prediction artifacts.

This is **single Fold 0 validation**, not completed five-fold OOF. Bias tuning was tested separately and excluded from the final submission because leaderboard performance decreased, according to the brief. The app never applies it. Any broader claims of generalization require more evidence.

## E. Submission reproduction

1. Install Python 3.13, create a virtual environment, and install `requirements.txt`.
2. Obtain the owner’s verified recreated `hingroberta_fold0.zip` through an authorized transfer (not currently hosted in this repository). Extract it and locate the saved `hingroberta_fold0_best` directory including tokenizer files. An `.ipynb` alone cannot restore trained weights. The recreated checkpoint has demonstrated prediction parity on the competition test set; this is not a claim of identical weights.
3. Place files under `model/hingroberta_fold0_best/`, or set `MODEL_PATH` to their directory. Do not rename the later full-data checkpoint to pretend it is Fold 0.
4. Obtain the original competition `test.csv` through authorized Kaggle access and keep it at a private local path. Use the repository’s `hingroberta_fold0_submission.csv` as the reference.
5. Run model verification, then reproduction using original normalization, max length 64, dynamic padding and batch size 16:

```sh
python scripts/verify_model.py
python scripts/reproduce_submission.py --test /private/test.csv --reference hingroberta_fold0_submission.csv --output /private/regenerated_submission.csv --report /private/reproduction_report.json
```

6. The output has **exactly `example_id,target`**, preserves IDs (including leading zeroes), and preserves dataset order. The script compares all IDs and targets row by row and exits nonzero on mismatches.
7. The JSON report records ID/order mismatches, target mismatches, row counts, input/output SHA-256 hashes, inference mode and loaded model metadata. **Verified result: PASS — all 4,912 IDs, their order and targets matched using checkpoint inference on CPU.** See `reproduction_report.json` for the recorded verification. Different byte hashes can reflect CSV formatting even when all IDs and targets match. Even with identical training configuration, future recreation may change predictions. A mismatch exits nonzero; investigate without bias tuning or changing the model. Floating-point behavior, hardware and Transformers/PyTorch versions can affect edge predictions; retain the notebook runtime versions.

To audit an existing regenerated CSV without loading weights, add `--compare-only /private/regenerated_submission.csv` and `--report /private/comparison_report.json`. Such a report is labeled `comparison_only`, has no loaded model proof and is **not evidence of executed inference**. Reference and candidate IDs must both match the test order, and every target must match the original reference. Missing/duplicate IDs, invalid targets and incorrect columns are rejected.

The API batch uploader accepts a CSV file in the browser, validates it, then sends the CSV content as JSON `{ "csv_text": "..." }`. Requests are processed with notebook batch size 16. The frontend submits chunks and reports actual completed-row progress. Batched average processing latency is not the single-query benchmark.

## Local setup — Windows / VS Code

Install Python 3.13 and Bun. Open the repository folder in VS Code, then its PowerShell terminal:

```powershell
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
bun install
python scripts/verify_model.py
python scripts/start_local.py
```

If PowerShell activation is blocked, use `.venv\Scripts\python.exe` directly. Linux/macOS: `python3 -m venv .venv && source .venv/bin/activate`. The pinned Transformers 4.57.6 matches the notebook’s installation cell; PyTorch 2.11.0 and NumPy 2.1.3 match the recorded notebook runtime. Its Python was 3.13.16 and its CUDA PyTorch build was 2.11.0+cu130; retain that CUDA build on compatible GPU hardware for strict reproduction. For a CUDA-specific PyTorch wheel, follow the official PyTorch installer for the host’s CUDA version without changing the inference algorithm.

The launcher starts one Uvicorn worker on port 8000 and the frontend on port 8080. Stop with Ctrl+C. Model loading is once at service startup, never once per query. To run separately:

```sh
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
bun run dev
```

Open **http://localhost:8080**. Click Connection settings and enter **http://localhost:8000**, or configure public `VITE_INFERENCE_API_URL` before launching. Swagger is at **http://localhost:8000/docs**. Never place secrets in `VITE_` settings. Theme and API address are local interface preferences; no predictions are fabricated or stored as a model fallback.

## Benchmarking

```sh
python scripts/benchmark.py --queries test.csv --count 100 --output benchmark_report.json
```

The dashboard offers the same measurement: one already-loaded model, five warm-ups, at least 100 measured runs, batch size 1, `time.perf_counter()`, CUDA synchronization before/after each run. Timing includes original normalization, tokenization, model forward, device transfers and prediction extraction. Loading time is excluded. Average, median and interpolated p95 are reported, together with raw timings, query count, device/hardware, warm-ups and checkpoint. The supplied query pool cycles if fewer than 100 queries are provided; repeated runs are not represented as unique queries. Report downloads use measured values only.

**Measured local benchmark:** mean 47.78 ms, median 47.28 ms, p95 55.14 ms over 100 measured runs using five repeated sample queries on CPU. These results are specific to the tested host and workload, not a guarantee on other devices. The batch, explanation and webhook timings are separate from this single-query benchmark.

## REST endpoints

| Method | Endpoint | Contract |
|---|---|---|
| GET | /api/health | readiness, detail, optional loaded model metadata |
| POST | /api/predict | JSON: `{"query":"...","trigger_automation":false}`; enable automation explicitly when desired |
| POST | /api/explain | JSON: `{"query":"..."}`; word occlusion sensitivity |
| POST | /api/batch-predict | JSON: `{"csv_text":"example_id,query_text\n..."}` |
| POST | /api/benchmark | JSON: `{"queries":["..."],"count":100}` (100–1000) |
| GET | /api/model-info | exact total/trainable parameters, device, checkpoint |
| GET | /api/metrics | notebook-recorded evaluation metrics |
| GET | /api/dataset-stats | aggregate-only training, test, reference counts and artifact hashes |
| GET | /api/automation/status | webhook configuration, statistics and history |
| POST | /api/automation/config | update automation settings and routing rules |
| POST | /api/automation/test | send connectivity test event |
| POST | /api/automation/summary | send summary metadata |
| GET | /docs | Swagger UI |

Single prediction returns class ID, probability, top three, latency, detected script, original/normalized text and unpadded token count. Input up to 10,000 characters is normalized and tokenized with truncation to 64 tokens. CSV limits: 10 MB input and 10,000 rows per file. Service handles missing files, malformed CSV, empty normalized text, API errors and insufficient memory. Readiness remains false on load failure; missing weights never silently initialize a classifier.

## Application features and verified examples

| Feature | Description / verification |
|---|---|
| Intent Playground | Real-time prediction, numeric class ID, top three softmax scores, script, token count and latency. |
| Cross-Script Analysis | Independent inference on equivalent Hindi and Romanized inputs; compares predicted classes and confidence. |
| Explainable AI | On-demand leave-one-word-out occlusion; reports signed changes in the original class probability. |
| Batch Prediction | Validates and classifies CSV queries and supports prediction export. |
| Model Performance | Recorded training metrics, dataset distributions and measured inference benchmark. |
| Voice input | Browser speech recognition for Hindi and Indian English/Hinglish; transcript can be reviewed before classification. Chrome was used in local testing. |
| Live Demo | Presentation-oriented interface with a fullscreen option. |
| Workflows | Optional authenticated n8n integration, execution history, routing configuration and summary reports. |
| Themes | Light and dark interface options. |

Cross-script example: `मेरा ऑर्डर कब डिलीवर होगा?` and `Mera order kab deliver hoga?` both predicted Intent 3, with 95.98% and 96.55% model probability respectively. This demonstrates agreement for one pair, not overall cross-script accuracy.

Explainability removes one word at a time and measures the change in the original predicted class probability. Positive scores indicate that removal lowered the probability; negative scores indicate that removal raised it. These are local sensitivity estimates, not causal explanations or proof of model reasoning. No additional learned model is used. Voice recognition depends on browser support, microphone permissions and possibly network access; typed input remains available. Audio may be processed by the browser's speech provider.

## Optional n8n workflow automation

The downstream automation receives prediction metadata through an authenticated webhook, validates the payload, and flags uncertain predictions for review or routes standard events. Class 55 or confidence below the configured threshold (default 60%) triggers a manual-review flag when the relevant routing options are enabled. Custom class-specific route metadata, execution history and summary reports are supported. Raw query text is omitted by default. Automation does not alter the predicted class or its probability, and adds no learned model parameters.

```mermaid
flowchart TD
  A[User query] --> B[HingRoBERTa inference]
  B --> C[Prediction shown in UI]
  B --> D[Optional authenticated n8n webhook]
  D --> E[Validate and route metadata]
  E --> F{Manual review required?}
  F -->|Yes| G[Flag for manual review]
  F -->|No| H[Standard or control event]
  G --> I[Return routing result]
  H --> I
```

### Local setup

1. Install n8n separately and start it (`n8n.cmd start` on Windows if installed globally).
2. Open `http://localhost:5678` and import `n8n/intentscope-workflow.json`. Avoid duplicate published workflows using the same webhook path.
3. In the webhook node, configure Header Auth with the exact header name `X-IntentScope-Secret` and a strong secret of your choice. Save and publish the workflow. Copy its **Production URL**.
4. In the PowerShell terminal used to launch IntentScope, set the following server-side variables and start the app. Use the actual URL from your n8n instance:

```powershell
$env:N8N_WEBHOOK_URL = "http://localhost:5678/webhook/intentscope-intent"
$env:N8N_WEBHOOK_SECRET = [System.Net.NetworkCredential]::new("", (Read-Host "Enter n8n secret" -AsSecureString)).Password
$env:N8N_AUTH_HEADER = "X-IntentScope-Secret"
$env:N8N_ENABLED = "true"
python scripts/start_local.py
```

5. Open Workflows and click **Test connection**. On the Playground, select **Send prediction metadata** and classify a query. Verify routing in n8n's Executions page.

The connection test and both standard and low-confidence manual-review branches were successfully exercised locally. The current workflow returns routing results and records executions; it does not send email, create support tickets, or update external spreadsheets/databases. Class 55 routing is implemented but was not separately demonstrated in the live tests. Webhook calls are synchronous and bounded by a timeout; model latency excludes webhook time. Automation failure does not change the model's prediction. Configuration and in-memory history reset when the Python service restarts. Keep the webhook secret out of GitHub and frontend variables, and keep the unauthenticated configuration endpoints on a trusted/local network.

## Deployment and live demo

This Lovable frontend runs on TanStack Start. PyTorch is deployed **separately** on a Python/Docker host, not inside Lovable’s web runtime. No Lovable Cloud database is needed for this public inference-only application.

### Hugging Face Docker Spaces

1. Create a Docker Space and copy Dockerfile, requirements, backend, scripts and model directory.
2. Upload exact weights using Git LFS or attach persistent storage/private model storage. Keep model downloads or mounts as a **startup/deployment** step, never a per-query download. This app has no automatic downloads.
3. Select CPU with sufficient RAM (recommend at least 4–8 GB; weights alone use about 1.1 GB at FP32) or suitable GPU hardware. Hosting costs depend on the provider.
4. Set `MODEL_PATH` and `CORS_ORIGINS` to actual frontend origins (comma-separated). Use HTTPS; local HTTP cannot be called from a publicly hosted HTTPS page.
5. Deploy one Uvicorn worker on port 7860. Verify `/api/health` reports ready, then connect `https://your-space.hf.space` in the frontend. Set `VITE_INFERENCE_API_URL` for the deployed frontend when configuring its environment.
6. Publish the frontend separately and add its published URL to the CORS list. This repository is not itself proof of a live hosted deployment.

```sh
docker build -t intentscope-api .
docker run --rm -p 7860:7860 -e CORS_ORIGINS=https://your-frontend-host -v /absolute/model/path:/app/model:ro intentscope-api
```

Use `.env.example` as a configuration reference; set environment variables on the Python host or shell explicitly (the backend does not implicitly load a dotenv file). The mounted model folder must contain `hingroberta_fold0_best/`, or override `MODEL_PATH`.

For a public judge demo, use an origin allowlist and host-level rate limits/concurrency controls to prevent compute abuse. CORS is not authentication. Do not expose confidential data in a public service. A single model lock serializes inference and prevents benchmark interference but is not a deployment rate limiter.

### Local screen-share fallback

Restore weights and dependencies before judging. Start the application with `python scripts/start_local.py`; open the playground, verify connected state, run one Hindi and one Hinglish query, compare scripts, upload CSV, and run/download the benchmark. Keep the model loaded before timing. Internet is not needed for inference with complete local checkpoint/tokenizer files.

**Hosted demo URL: Not deployed.** The demonstrated application runs locally and is suitable for screen sharing.

## Repository structure

```text
src/             React frontend, TanStack content routes, shared dashboard views
backend/         FastAPI service, inference engine, CSV validation, real metrics
model/           local checkpoint directory; large weights excluded from GitHub
notebooks/       unchanged original training notebook
scripts/         verification, benchmark, reproduction and local launcher
n8n/             optional workflow JSON
hingroberta_fold0_submission.csv   original prediction-only reference CSV
reproduction_report.json          measured checkpoint inference verification
docs/            competition setup guidance
public/docs/     downloadable documentation rendered by the app
requirements.txt pinned Python deployment dependencies
Dockerfile       independent Python service deployment
TECHNICAL_SUBMISSION.md form answer draft
```

The frontend remains in the template’s standard `src/` layout, rather than introducing a conflicting nested frontend framework. Raw competition datasets remain private; `backend/dataset_stats.json` and `src/data/dataset_stats.json` are aggregate-only derived artifacts. The prediction-only reference CSV and reproduction report are included for verification. Do not upload raw private datasets, credentials or large checkpoint files to normal GitHub storage.

## Tests

```sh
bunx vitest run src/test/intentscope.test.ts src/test/app-routing.test.tsx
python -m unittest discover -s backend/tests -v
```

Tests check parameter-limit boundaries, class labels, submission column/order/ID preservation, exact normalization equivalence to the uploaded notebook, malformed CSV handling, unavailable model behavior, CORS, actual aggregate totals, private-analysis export safety, and strict reference comparison. These automated tests do not substitute for real checkpoint inference. Local manual verification with the restored checkpoint has additionally confirmed inference, exact parameter count, latency and full submission prediction agreement. Repeat the checks after changing the model or runtime.
