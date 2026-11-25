"""Optional, bounded synchronous n8n webhook automation layer for IntentScope.

Never alters model predictions or competition inference. Credentials stay in
server environment variables and are never returned to the frontend.
"""
import os
import time
import uuid
import logging
from collections import Counter, deque
from datetime import datetime, timezone
from threading import Lock
from urllib.parse import urlparse
import httpx


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class AutomationManager:
    def __init__(self):
        self._lock = Lock()
        self._history = deque(maxlen=50)
        self._seen_events = deque(maxlen=500)
        self._class_counts: Counter[int] = Counter()
        self._stats = {
            "total_predictions_observed": 0,
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "oos_alerts": 0,
            "manual_review_count": 0,
            "low_confidence_count": 0,
            "model_latency_sum_ms": 0.0,
            "automation_latency_sum_ms": 0.0,
            "automation_latency_count": 0,
        }
        self.config = {
            "enabled": _env_bool("N8N_ENABLED", False),
            "log_predictions": True,
            "oos_routing": True,
            "low_confidence_review": True,
            "confidence_threshold": 0.60,
            "intent_routing": True,
            "routing_rules": [],
            "summary_reports": True,
            "include_raw_query": False,
        }

    def _webhook_url(self) -> str:
        return os.getenv("N8N_WEBHOOK_URL", "").strip()

    def _webhook_secret(self) -> str:
        return os.getenv("N8N_WEBHOOK_SECRET", "").strip()

    def _auth_header(self) -> str:
        return os.getenv("N8N_AUTH_HEADER", "X-IntentScope-Secret").strip() or "X-IntentScope-Secret"

    def _timeout(self) -> float:
        try:
            return max(1.0, min(30.0, float(os.getenv("N8N_TIMEOUT_SECONDS", "5.0"))))
        except ValueError:
            return 5.0

    def _webhook_host(self) -> str | None:
        url = self._webhook_url()
        if not url:
            return None
        parsed = urlparse(url)
        return parsed.netloc or None

    def update_config(self, updates: dict) -> dict:
        with self._lock:
            for key in (
                "enabled",
                "log_predictions",
                "oos_routing",
                "low_confidence_review",
                "intent_routing",
                "summary_reports",
                "include_raw_query",
            ):
                if key in updates and updates[key] is not None:
                    self.config[key] = bool(updates[key])
            if "confidence_threshold" in updates and updates["confidence_threshold"] is not None:
                value = float(updates["confidence_threshold"])
                if not 0.0 <= value <= 1.0:
                    raise ValueError("confidence_threshold must be between 0.0 and 1.0.")
                self.config["confidence_threshold"] = round(value, 4)
            if "routing_rules" in updates and updates["routing_rules"] is not None:
                clean_rules = []
                for rule in updates["routing_rules"]:
                    cid = int(rule["class_id"])
                    if not 0 <= cid <= 55:
                        raise ValueError("Routing rule class_id must be between 0 and 55.")
                    route = str(rule.get("route", "")).strip()
                    if not route:
                        raise ValueError("Routing rule route name cannot be empty.")
                    clean_rules.append({
                        "class_id": cid,
                        "route": route[:80],
                        "channel": str(rule.get("channel", "webhook")).strip()[:40] or "webhook",
                    })
                self.config["routing_rules"] = clean_rules
        return self.status()

    def _post_webhook(self, payload: dict) -> tuple[bool, float, int | None, str | None]:
        url = self._webhook_url()
        if not url:
            return False, 0.0, None, "N8N_WEBHOOK_URL is not configured on the Python service."
        headers = {"Content-Type": "application/json"}
        secret = self._webhook_secret()
        if not secret:
            return False, 0.0, None, "N8N_WEBHOOK_SECRET is not configured on the Python service."
        headers[self._auth_header()] = secret
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=self._timeout()) as client:
                response = client.post(url, json=payload, headers=headers)
            elapsed_ms = (time.perf_counter() - start) * 1000
            if 200 <= response.status_code < 300:
                return True, elapsed_ms, response.status_code, None
            return False, elapsed_ms, response.status_code, f"n8n webhook returned HTTP {response.status_code}."
        except httpx.TimeoutException:
            elapsed_ms = (time.perf_counter() - start) * 1000
            return False, elapsed_ms, None, "n8n webhook request timed out."
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logging.warning("n8n webhook dispatch failed: %s", exc)
            return False, elapsed_ms, None, f"Could not reach n8n webhook ({type(exc).__name__})."

    def dispatch_prediction(self, prediction: dict, event_id: str | None = None) -> dict:
        eid = (event_id or "").strip() or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            if eid in self._seen_events:
                return {
                    "status": "duplicate_skipped",
                    "event_id": eid,
                    "latency_ms": 0.0,
                    "triggered_workflows": [],
                    "detail": "Duplicate event_id skipped to prevent double execution.",
                }
            self._seen_events.append(eid)
            cfg = dict(self.config)
            cfg["routing_rules"] = list(self.config["routing_rules"])
            class_id = int(prediction["class_id"])
            prob = float(prediction["probability"])
            is_oos = class_id == 55
            is_low_conf = prob < cfg["confidence_threshold"]
            matched_routes = [r["route"] for r in cfg["routing_rules"] if r["class_id"] == class_id]
            self._stats["total_predictions_observed"] += 1
            self._stats["model_latency_sum_ms"] += float(prediction.get("latency_ms", 0.0))
            self._class_counts[class_id] += 1
            if is_oos:
                self._stats["oos_alerts"] += 1
            if is_low_conf:
                self._stats["low_confidence_count"] += 1
            if is_oos or is_low_conf:
                self._stats["manual_review_count"] += 1

        triggered = []
        if cfg["log_predictions"]:
            triggered.append("prediction_logging")
        if cfg["oos_routing"] and is_oos:
            triggered.append("oos_routing")
        if cfg["low_confidence_review"] and is_low_conf:
            triggered.append("low_confidence_review")
        if cfg["intent_routing"] and matched_routes:
            triggered.append("intent_routing")

        if not cfg["enabled"]:
            return {
                "status": "disabled",
                "event_id": eid,
                "latency_ms": 0.0,
                "triggered_workflows": triggered,
                "is_oos": is_oos,
                "is_low_confidence": is_low_conf,
                "matched_routes": matched_routes,
                "detail": "Automation is currently disabled.",
            }
        if not self._webhook_url():
            return {
                "status": "unconfigured",
                "event_id": eid,
                "latency_ms": 0.0,
                "triggered_workflows": triggered,
                "is_oos": is_oos,
                "is_low_confidence": is_low_conf,
                "matched_routes": matched_routes,
                "detail": "Set N8N_WEBHOOK_URL on the Python host to activate n8n workflows.",
            }
        if not triggered:
            return {
                "status": "skipped",
                "event_id": eid,
                "latency_ms": 0.0,
                "triggered_workflows": [],
                "is_oos": is_oos,
                "is_low_confidence": is_low_conf,
                "matched_routes": matched_routes,
                "detail": "No enabled automation workflow matched this prediction.",
            }

        payload = {
            "event_type": "prediction",
            "event_id": eid,
            "timestamp": now,
            "predicted_class_id": class_id,
            "model_probability": round(prob, 6),
            "input_script": prediction.get("script", "Other"),
            "inference_latency_ms": round(float(prediction.get("latency_ms", 0.0)), 3),
            "is_out_of_scope": is_oos,
            "is_low_confidence": is_low_conf,
            "confidence_threshold": cfg["confidence_threshold"],
            "manual_review_required": "oos_routing" in triggered or "low_confidence_review" in triggered,
            "matched_routes": matched_routes if "intent_routing" in triggered else [],
            "triggered_workflows": triggered,
            "raw_query_included": cfg["include_raw_query"],
        }
        if cfg["include_raw_query"]:
            payload["query_text"] = prediction.get("original_query", "")

        ok, auto_ms, http_status, error = self._post_webhook(payload)
        entry = {
            "event_id": eid,
            "event_type": "prediction",
            "timestamp": now,
            "class_id": class_id,
            "probability": prob,
            "script": prediction.get("script", "Other"),
            "is_oos": is_oos,
            "is_low_confidence": is_low_conf,
            "triggered_workflows": triggered,
            "matched_routes": matched_routes,
            "model_latency_ms": float(prediction.get("latency_ms", 0.0)),
            "automation_latency_ms": auto_ms,
            "status": "success" if ok else "failed",
            "http_status": http_status,
            "error": error,
        }
        with self._lock:
            self._stats["total_executions"] += 1
            self._stats["automation_latency_sum_ms"] += auto_ms
            self._stats["automation_latency_count"] += 1
            if ok:
                self._stats["successful_executions"] += 1
            else:
                self._stats["failed_executions"] += 1
            self._history.appendleft(entry)
        return {
            "status": entry["status"],
            "event_id": eid,
            "latency_ms": auto_ms,
            "triggered_workflows": triggered,
            "is_oos": is_oos,
            "is_low_confidence": is_low_conf,
            "matched_routes": matched_routes,
            "http_status": http_status,
            "detail": "Webhook acknowledged the request." if ok else (error or "Automation failed."),
        }

    def send_test(self) -> dict:
        eid = f"test-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "event_type": "connectivity_test",
            "event_id": eid,
            "timestamp": now,
            "note": "Connectivity verification from IntentScope Automation Hub. Not a model prediction.",
        }
        ok, auto_ms, http_status, error = self._post_webhook(payload)
        entry = {
            "event_id": eid,
            "event_type": "connectivity_test",
            "timestamp": now,
            "class_id": None,
            "probability": None,
            "script": None,
            "is_oos": False,
            "is_low_confidence": False,
            "triggered_workflows": ["connectivity_test"],
            "matched_routes": [],
            "model_latency_ms": None,
            "automation_latency_ms": auto_ms,
            "status": "success" if ok else "failed",
            "http_status": http_status,
            "error": error,
        }
        with self._lock:
            self._stats["total_executions"] += 1
            self._stats["automation_latency_sum_ms"] += auto_ms
            self._stats["automation_latency_count"] += 1
            if ok:
                self._stats["successful_executions"] += 1
            else:
                self._stats["failed_executions"] += 1
            self._history.appendleft(entry)
        return entry

    def summary_payload(self) -> dict:
        with self._lock:
            obs = self._stats["total_predictions_observed"]
            avg_model = self._stats["model_latency_sum_ms"] / obs if obs else None
            auto_cnt = self._stats["automation_latency_count"]
            avg_auto = self._stats["automation_latency_sum_ms"] / auto_cnt if auto_cnt else None
            return {
                "event_type": "summary_report",
                "event_id": f"summary-{uuid.uuid4().hex[:12]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "total_predictions": obs,
                "top_intent_classes": [
                    {"class_id": cid, "count": count}
                    for cid, count in self._class_counts.most_common(5)
                ],
                "oos_count": self._stats["oos_alerts"],
                "low_confidence_count": self._stats["low_confidence_count"],
                "manual_review_count": self._stats["manual_review_count"],
                "average_model_latency_ms": round(avg_model, 3) if avg_model is not None else None,
                "average_automation_latency_ms": round(avg_auto, 3) if avg_auto is not None else None,
                "successful_automations": self._stats["successful_executions"],
                "failed_automations": self._stats["failed_executions"],
            }

    def send_summary(self) -> dict:
        payload = self.summary_payload()
        ok, auto_ms, http_status, error = self._post_webhook(payload)
        entry = {
            "event_id": payload["event_id"],
            "event_type": "summary_report",
            "timestamp": payload["timestamp"],
            "class_id": None,
            "probability": None,
            "script": None,
            "is_oos": False,
            "is_low_confidence": False,
            "triggered_workflows": ["summary_reports"],
            "matched_routes": [],
            "model_latency_ms": None,
            "automation_latency_ms": auto_ms,
            "status": "success" if ok else "failed",
            "http_status": http_status,
            "error": error,
        }
        with self._lock:
            self._stats["total_executions"] += 1
            self._stats["automation_latency_sum_ms"] += auto_ms
            self._stats["automation_latency_count"] += 1
            if ok:
                self._stats["successful_executions"] += 1
            else:
                self._stats["failed_executions"] += 1
            self._history.appendleft(entry)
        return {"entry": entry, "summary": payload}

    def status(self) -> dict:
        configured = bool(self._webhook_url())
        with self._lock:
            obs = self._stats["total_predictions_observed"]
            auto_cnt = self._stats["automation_latency_count"]
            return {
                "configured": configured,
                "connected": configured and self.config["enabled"],
                "webhook_host": self._webhook_host(),
                "auth_configured": bool(self._webhook_secret()),
                "timeout_seconds": self._timeout(),
                "config": {
                    **self.config,
                    "routing_rules": list(self.config["routing_rules"]),
                },
                "metrics": {
                    "total_predictions_observed": obs,
                    "total_executions": self._stats["total_executions"],
                    "successful_executions": self._stats["successful_executions"],
                    "failed_executions": self._stats["failed_executions"],
                    "oos_alerts": self._stats["oos_alerts"],
                    "manual_review_count": self._stats["manual_review_count"],
                    "low_confidence_count": self._stats["low_confidence_count"],
                    "average_model_latency_ms": (
                        self._stats["model_latency_sum_ms"] / obs if obs else None
                    ),
                    "average_automation_latency_ms": (
                        self._stats["automation_latency_sum_ms"] / auto_cnt if auto_cnt else None
                    ),
                    "top_intent_classes": [
                        {"class_id": cid, "count": count}
                        for cid, count in self._class_counts.most_common(5)
                    ],
                },
                "history": list(self._history),
            }