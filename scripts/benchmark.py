import sys
import json
import argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.inference import InferenceEngine
from backend.csv_utils import read_queries
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--queries', required=True, help='CSV with example_id and query_text')
    parser.add_argument('--count', type=int, default=100)
    parser.add_argument('--output', default='benchmark_report.json')
    args = parser.parse_args()
    if not 100 <= args.count <= 1000:
        parser.error('count must be between 100 and 1000')
    queries = [r['query_text'] for r in read_queries(Path(args.queries).read_text(encoding='utf-8-sig'))]
    engine = InferenceEngine()
    engine.load()
    report = engine.benchmark(queries, args.count)
    Path(args.output).write_text(json.dumps(report, indent=2))
    print(json.dumps({k:v for k,v in report.items() if k != 'timings_ms'}, indent=2))
