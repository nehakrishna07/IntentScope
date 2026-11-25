"""One saved Fold 0 model; notebook preprocessing and inference, without retraining."""
import os
import re
import time
import unicodedata
import platform
from pathlib import Path
from threading import Lock

PARAM_LIMIT = 300_000_000
NUM_CLASSES = 56
MAX_LENGTH = 64


def norm(t):
    t = unicodedata.normalize("NFKC", str(t)).lower()
    t = t.replace("\u093c", "").replace("\u0901", "\u0902")
    t = re.sub(r"([a-z])\1{2,}", r"\1\1", t)
    t = re.sub(r"[^\w\s\u0900-\u097F]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def validate_parameters(total):
    if total > PARAM_LIMIT:
        raise ValueError(f"Model has {total:,} parameters; exceeds {PARAM_LIMIT:,} limit.")


def script_of(text):
    devanagari = bool(re.search(r"[\u0900-\u097F]", text))
    latin = bool(re.search(r"[a-zA-Z]", text))
    return "Devanagari + Latin" if devanagari and latin else "Devanagari" if devanagari else "Latin / Romanized" if latin else "Other"


class InferenceEngine:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.info = None
        self.lock = Lock()
        self.detail = "Model checkpoint not loaded."

    def load(self):
        # Lazy imports let health stay available even when packages/weights are missing.
        checkpoint = Path(os.getenv("MODEL_PATH", "model/hingroberta_fold0_best"))
        if not checkpoint.is_dir() or not (checkpoint / "config.json").is_file():
            raise FileNotFoundError(f"Missing saved Fold 0 checkpoint: {checkpoint}. Place model and tokenizer files here; the notebook alone is not weights.")
        if not any(checkpoint.glob("*.safetensors")) and not any(checkpoint.glob("pytorch_model*.bin")):
            raise FileNotFoundError("Fine-tuned model weights are missing. No pretrained fallback is allowed.")
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, DataCollatorWithPadding
        self.torch = torch
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        tokenizer = AutoTokenizer.from_pretrained(str(checkpoint), use_fast=True, local_files_only=True)
        model, loading = AutoModelForSequenceClassification.from_pretrained(
            str(checkpoint), local_files_only=True, output_loading_info=True
        )
        if loading.get("missing_keys") or loading.get("unexpected_keys") or loading.get("mismatched_keys") or loading.get("error_msgs"):
            raise ValueError("Checkpoint is incomplete or incompatible; refusing newly initialized model weights.")
        if model.config.num_labels != NUM_CLASSES or model.config.model_type != "xlm-roberta":
            raise ValueError("Expected the saved XLM-RoBERTa Fold 0 classifier with exactly 56 outputs.")
        model = model.float()
        total = sum(p.numel() for p in model.parameters())
        validate_parameters(total)
        model = model.to(device)
        model.eval()
        self.device = device
        self.tokenizer = tokenizer
        self.model = model
        self.collator = DataCollatorWithPadding(tokenizer, pad_to_multiple_of=8)
        self.info = {
            "total_parameters": total,
            "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
            "device": str(device),
            "hardware": torch.cuda.get_device_name(device) if device.type == "cuda" else (platform.processor() or platform.machine()),
            "checkpoint": checkpoint.name,
            "compliant": total <= PARAM_LIMIT,
            "max_tokens": MAX_LENGTH,
            "class_count": NUM_CLASSES,
            "base_model": "l3cube-pune/hing-roberta-mixed",
            "precision": "FP32 weights; FP16 CUDA autocast, as in notebook",
        }
        self.detail = "Saved model and tokenizer loaded; ready for inference."

    def synchronize(self):
        if self.device.type == "cuda":
            self.torch.cuda.synchronize(self.device)

    def _predict_many(self, queries):
        # Timing includes preprocessing, tokenization, transfers, forward and extraction.
        torch = self.torch
        self.synchronize()
        start = time.perf_counter()
        texts = [norm(q) for q in queries]
        encodings = self.tokenizer(texts, truncation=True, max_length=MAX_LENGTH, padding=False)
        items = [{key: values[i] for key, values in encodings.items()} for i in range(len(texts))]
        batch = self.collator(items)
        batch = {k: v.to(self.device, non_blocking=True) for k, v in batch.items()}
        with torch.inference_mode():
            with torch.autocast(device_type=self.device.type, dtype=torch.float16, enabled=self.device.type == "cuda"):
                logits = self.model(**batch).logits
            logits = logits.float()
            # Argmax, not a threshold or bias-adjusted classifier.
            targets = logits.argmax(dim=1).cpu().tolist()
            probabilities = torch.softmax(logits, dim=1)
            top_scores, top_classes = torch.topk(probabilities, 3, dim=1)
            top_scores, top_classes = top_scores.cpu().tolist(), top_classes.cpu().tolist()
        results = [{
            "class_id": targets[i],
            "probability": top_scores[i][0],
            "top_three": [{"class_id": c, "probability": p} for c, p in zip(top_classes[i], top_scores[i])],
            "original_query": q,
            "normalized_query": texts[i],
            "script": script_of(q),
            "token_count": len(encodings["input_ids"][i]),
        } for i, q in enumerate(queries)]
        self.synchronize()
        latency = (time.perf_counter() - start) * 1000
        for result in results:
            result["latency_ms"] = latency / len(queries)
        return results, latency

    def predict_many(self, queries):
        with self.lock:
            if self.model is None:
                raise RuntimeError(self.detail)
            return self._predict_many(queries)

    def _class_probabilities(self, texts, class_id):
        torch = self.torch
        probs = []
        for start in range(0, len(texts), 16):
            chunk = texts[start:start + 16]
            encodings = self.tokenizer(chunk, truncation=True, max_length=MAX_LENGTH, padding=False)
            items = [{key: values[i] for key, values in encodings.items()} for i in range(len(chunk))]
            batch = self.collator(items)
            batch = {k: v.to(self.device, non_blocking=True) for k, v in batch.items()}
            with torch.inference_mode():
                with torch.autocast(device_type=self.device.type, dtype=torch.float16, enabled=self.device.type == "cuda"):
                    logits = self.model(**batch).logits
                probabilities = torch.softmax(logits.float(), dim=1)[:, class_id]
                probs.extend(probabilities.cpu().tolist())
        return probs

    def explain(self, query, max_words=24):
        with self.lock:
            if self.model is None:
                raise RuntimeError(self.detail)
            self.synchronize()
            start = time.perf_counter()
            base_results, _ = self._predict_many([query])
            base = base_results[0]
            words = base["normalized_query"].split()
            evaluated = words[:max_words]
            occluded_texts = [
                " ".join(w for idx, w in enumerate(words) if idx != i)
                for i in range(len(evaluated))
            ]
            occluded_probs = self._class_probabilities(occluded_texts, base["class_id"]) if occluded_texts else []
            attributions = []
            for i, (word, occ_prob) in enumerate(zip(evaluated, occluded_probs)):
                importance = base["probability"] - occ_prob
                attributions.append({
                    "index": i,
                    "word": word,
                    "importance": importance,
                    "occluded_probability": occ_prob,
                    "probability_delta": occ_prob - base["probability"],
                    "direction": "positive" if importance >= 0 else "negative",
                })
            most_influential = sorted(attributions, key=lambda item: abs(item["importance"]), reverse=True)[:5]
            self.synchronize()
            computation_ms = (time.perf_counter() - start) * 1000
            return {
                "class_id": base["class_id"],
                "base_probability": base["probability"],
                "top_three": base["top_three"],
                "original_query": base["original_query"],
                "normalized_query": base["normalized_query"],
                "script": base["script"],
                "token_count": base["token_count"],
                "words": attributions,
                "most_influential": most_influential,
                "evaluated_words": len(evaluated),
                "total_words": len(words),
                "truncated": len(words) > max_words,
                "max_words": max_words,
                "computation_ms": computation_ms,
                "method": "Word-level leave-one-out occlusion sensitivity on the loaded HingRoBERTa-Mixed Fold 0 checkpoint using original preprocessing and tokenizer.",
                "disclaimer": "Scores measure model output probability sensitivity when a word is removed, not definitive causal reasoning.",
            }

    def benchmark(self, queries, count=100, warmups=5):
        import statistics
        with self.lock:
            if self.model is None:
                raise RuntimeError(self.detail)
            for i in range(warmups):
                self._predict_many([queries[i % len(queries)]])
            timings = [self._predict_many([queries[i % len(queries)]])[1] for i in range(count)]
        ordered = sorted(timings)
        # Linear interpolation, matching numpy percentile's default definition.
        pos = (count - 1) * .95
        low = int(pos)
        p95 = ordered[low] + (ordered[min(low + 1, count - 1)] - ordered[low]) * (pos - low)
        return {"average_ms": statistics.mean(timings), "median_ms": statistics.median(timings),
                "p95_ms": p95, "query_count": count, "warmup_runs": warmups,
                "batch_size": 1, "device": self.info["device"], "hardware": self.info["hardware"],
                "checkpoint": self.info["checkpoint"], "loading_excluded": True,
                "timing_scope": "normalization + tokenization + forward pass + prediction extraction",
                "timings_ms": timings}
