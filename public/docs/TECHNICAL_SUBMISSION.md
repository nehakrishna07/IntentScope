# Anveshan DataSprint 2.0 — Technical Submission Draft

## Base model used in final pipeline
`l3cube-pune/hing-roberta-mixed` (HingRoBERTa-Mixed), XLM-RoBERTa-based encoder with the original fine-tuned 56-class head. Single best Fold 0 checkpoint, confirmed by the model owner.

## Exact total inference parameter count
**PENDING — run `python scripts/verify_model.py` with the recreated saved Fold 0 checkpoint and paste `total_parameters` here.** Notebook reports only rounded 278.09M. Limit: 300,000,000. Do not submit the rounded value as an exact integer.

## Pipeline overview, Hinglish handling and Class 55 strategy (under 200 words)
IntentScope uses one fine-tuned HingRoBERTa-Mixed Fold 0 model. Queries are normalized using the original notebook’s NFKC, lowercase, Devanagari character substitutions, Latin repeat reduction, punctuation replacement and whitespace collapse. The saved fast tokenizer truncates to 64 tokens and applies dynamic padding to a multiple of eight. The XLM-RoBERTa encoder and saved classification head produce 56 logits. Ordinary argmax selects the predicted class; softmax estimates and top-three classes are displayed for interpretation. Hindi–English code-mixed pretraining supports Devanagari Hindi, Romanized Hindi and Hinglish without a separate translation stage. Script comparison runs independent predictions and does not force agreement. Class 55 is the learned Out-of-Scope category, selected by the same multiclass argmax as all other classes. No additional confidence threshold, bias tuning or ensemble is applied. Deployment loads the original model once, uses eval and inference mode, and checks the exact total parameter count against the 300M competition limit before allowing inference.

## Local validation Macro-F1 and biggest score improvement (under 150 words)
The best Fold 0 validation Macro-F1 is 0.85716 at epoch 8; validation accuracy is 0.87367. StratifiedKFold used five splits with seed 42, but only Fold 0 was trained for the confirmed submission, so this is not complete five-fold OOF. The recorded prior XLM-R Fold 0 Macro-F1 was 0.83370, giving a documented improvement of 0.02346 (2.346 percentage points). This is the improvement verified by the supplied notebook; the biggest improvement across all experiments needs the owner’s additional records. The supplied competition leaderboard Macro-F1 is 0.8196. Separately tested bias tuning was excluded because leaderboard performance decreased. No missing evaluation statistics are invented.

## Interactive demo framework
**FastAPI Web App**, with React/TanStack Start frontend, Tailwind CSS, Recharts, PyTorch and Hugging Face Transformers. The independent Python service includes Swagger `/docs`.

## Average inference latency per query
**PENDING actual execution.** Run `python scripts/benchmark.py --queries test.csv --count 100`. Paste measured average, median, p95, hardware, CPU/GPU, count, and checkpoint. Batch size 1, five warm-ups, synchronized CUDA, normalization/tokenization/forward/extraction included, model loading excluded.

## Live hosted demo URL
**PENDING public deployment.** Do not submit the frontend preview as a verified connected model demo until `/api/health` reports ready and trained predictions have been exercised.

## Remaining evidence
- Recreated saved Fold 0 weights/tokenizer from the owner; original weights are unavailable.
- Executed prediction comparison against the supplied original Fold 0 submission. All 4,912 reference IDs already match the original test dataset order, but this does not prove prediction reproduction.
- Executed exact parameter count and hardware-specific latency report.
- Published, connected demo URL.

## Uploaded artifact audit
The re-uploaded notebook is identical to the preserved original. Training contains 16,936 labeled queries across 56 classes (249 Class 55); test and original submission each contain 4,912 rows. The reference includes 335 Class 55 predictions, not ground-truth test labels. Public views contain aggregate class/script statistics only, never competition queries, IDs or per-row predictions. The recreation comparison script emits a machine-readable report and fails on any ID/order or target mismatch. A comparison-only report is explicitly not loaded-checkpoint evidence.
