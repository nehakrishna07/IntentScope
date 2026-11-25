# Saved checkpoint required
Place the **contents** of the original saved `hingroberta_fold0_best` directory inside `model/hingroberta_fold0_best/`:
- config.json
- model.safetensors (or complete model shards and index)
- tokenizer.json, tokenizer_config.json, special_tokens_map.json
- sentencepiece.bpe.model if saved by the tokenizer

Extract the forthcoming `hingroberta_fold0.zip` from the owner's Kaggle recreation. Locate the complete saved directory; the `.ipynb` is NOT model weights.
Do not use `hingroberta_final`: that is the later full-data checkpoint, not the confirmed Fold 0 submission model.
No weights are supplied in this repository. No external pretrained fallback is used.
Use Git LFS or an external private model repository for large weights, or mount a persistent model volume.
Use a single worker; each worker would load a separate model. No per-query downloads occur.

## Configure and enable

`MODEL_PATH` must point directly to the extracted folder containing `config.json`, weights and tokenizer files, not the archive or its parent. The default is `model/hingroberta_fold0_best`. For another private location:

```sh
export MODEL_PATH=/absolute/private/hingroberta_fold0_best
python scripts/verify_model.py
python scripts/reproduce_submission.py --test /private/test.csv --reference /private/hingroberta_fold0_submission.csv --output /private/regenerated_submission.csv --report /private/reproduction_report.json
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
```

PowerShell: `$env:MODEL_PATH = 'C:\private\hingroberta_fold0_best'`. Restart the Python service after adding/changing weights; it loads only at startup. Check `/api/health` and connect the Python service URL in the frontend. Public deployment needs HTTPS and `CORS_ORIGINS` set to the actual frontend origin(s).

The original checkpoint is unavailable. Matching training configuration is not proof that recreated weights reproduce the original submission. Only a passing `checkpoint_inference` report after regenerating every test prediction can establish the comparison. A comparison-only CSV audit or matching test IDs is insufficient. Preserve the model and investigate mismatches without thresholds, bias adjustment or retraining in this application.

Keep competition CSVs and prediction reports outside public/GitHub folders. Only aggregate statistics are shipped. Until complete trained files arrive, health remains disconnected and inference returns 503, never simulated output.
