"""Deploy this service on a Python host, independently of the React frontend."""
import json
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.inference import InferenceEngine, norm
from backend.csv_utils import read_queries
from backend.automation import AutomationManager

engine = InferenceEngine()
automation = AutomationManager()

@asynccontextmanager
async def lifespan(app):
    try:
        engine.load()
    except Exception as exc:
        engine.detail = f'Model disconnected: {type(exc).__name__}: {exc}'
        engine.model = None
        engine.tokenizer = None
        engine.info = None
        logging.exception('Could not load Fold 0 checkpoint')
    yield

app = FastAPI(title='IntentScope Inference API', version='1.0.0', lifespan=lifespan)
origins = [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:8080').split(',') if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])

class PredictBody(BaseModel):
    query: str = Field(min_length=1, max_length=10000)
    event_id: str | None = Field(default=None, max_length=128)
    trigger_automation: bool = False

class ExplainBody(BaseModel):
    query: str = Field(min_length=1, max_length=10000)
    max_words: int = Field(default=24, ge=1, le=40)

class RoutingRuleBody(BaseModel):
    class_id: int = Field(ge=0, le=55)
    route: str = Field(min_length=1, max_length=80)
    channel: str = Field(default="webhook", max_length=40)

class AutomationConfigBody(BaseModel):
    enabled: bool | None = None
    log_predictions: bool | None = None
    oos_routing: bool | None = None
    low_confidence_review: bool | None = None
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    intent_routing: bool | None = None
    routing_rules: list[RoutingRuleBody] | None = None
    summary_reports: bool | None = None
    include_raw_query: bool | None = None

class BatchBody(BaseModel):
    csv_text: str = Field(min_length=1, max_length=10_000_000)

class BenchmarkBody(BaseModel):
    queries: list[str] = Field(min_length=1, max_length=1000)
    count: int = Field(default=100, ge=100, le=1000)


def require_model():
    if engine.model is None:
        raise HTTPException(status_code=503, detail=engine.detail)


def validate_query(query):
    if not query.strip() or not norm(query):
        raise HTTPException(status_code=422, detail='Query is empty after normalization; enter meaningful text.')
    if len(query) > 10000:
        raise HTTPException(status_code=422, detail='Query exceeds 10,000 characters.')


def safely(call):
    try:
        return call()
    except MemoryError:
        raise HTTPException(status_code=503, detail='Insufficient memory for inference. Use a larger host or reduce workload.')
    except Exception as exc:
        if 'out of memory' in str(exc).lower():
            raise HTTPException(status_code=503, detail='Insufficient GPU/CPU memory. Reduce workload or use a larger host.')
        logging.exception('Inference failed')
        raise HTTPException(status_code=500, detail='Inference failed. Check the service logs and saved checkpoint.')

@app.get('/api/health')
def health():
    return {'ready': engine.model is not None, 'detail': engine.detail, 'model_info': engine.info}

@app.get('/api/model-info')
def model_info():
    require_model()
    return engine.info

@app.get('/api/metrics')
def metrics():
    return json.loads(Path(__file__).with_name('metrics.json').read_text())

@app.get('/api/dataset-stats')
def dataset_stats():
    return json.loads(Path(__file__).with_name('dataset_stats.json').read_text())

@app.post('/api/predict')
def predict(body: PredictBody):
    validate_query(body.query)
    require_model()
    prediction = safely(lambda: engine.predict_many([body.query])[0][0])
    if body.trigger_automation:
        try:
            prediction['automation'] = automation.dispatch_prediction(prediction, event_id=body.event_id)
        except Exception:
            logging.exception('Downstream automation failed; prediction retained')
            prediction['automation'] = {'status': 'failed', 'event_id': body.event_id or '', 'latency_ms': 0.0, 'triggered_workflows': [], 'detail': 'Downstream automation failed; the model prediction is unchanged.'}
    return prediction

@app.post('/api/explain')
def explain(body: ExplainBody):
    validate_query(body.query)
    require_model()
    return safely(lambda: engine.explain(body.query, max_words=body.max_words))

@app.get('/api/automation/status')
def automation_status():
    return automation.status()

@app.post('/api/automation/config')
def automation_config(body: AutomationConfigBody):
    try:
        return automation.update_config(body.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

@app.post('/api/automation/test')
def automation_test():
    entry = automation.send_test()
    return {'entry': entry, 'status': automation.status()}

@app.post('/api/automation/summary')
def automation_summary():
    config = automation.status()["config"]
    if not config["enabled"] or not config["summary_reports"]:
        raise HTTPException(status_code=409, detail="Enable automation and summary reports before sending a summary.")
    result = automation.send_summary()
    return {**result, 'status': automation.status()}

@app.post('/api/batch-predict')
def batch_predict(body: BatchBody):
    try:
        rows = read_queries(body.csv_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    for row in rows:
        validate_query(row['query_text'])
    require_model()
    def run():
        result, total_ms = [], 0
        # Notebook test DataLoader batch size is BATCH_SIZE * 2 = 16.
        for start in range(0, len(rows), 16):
            chunk = rows[start:start+16]
            predictions, elapsed = engine.predict_many([r['query_text'] for r in chunk])
            total_ms += elapsed
            result.extend({'example_id': row['example_id'], 'query_text': row['query_text'],
                           'target': prediction['class_id']} for row, prediction in zip(chunk, predictions))
        return {'rows': result, 'total_queries': len(result), 'average_ms': total_ms / len(result),
                'oos_count': sum(r['target'] == 55 for r in result)}
    return safely(run)

@app.post('/api/benchmark')
def benchmark(body: BenchmarkBody):
    for query in body.queries:
        validate_query(query)
    require_model()
    return safely(lambda: engine.benchmark(body.queries, body.count))
