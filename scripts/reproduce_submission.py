import sys
import json
import argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.inference import InferenceEngine
from backend.csv_utils import read_queries, submission_csv
from backend.reproduction import read_submission, compare_rows, file_sha256
if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--test', required=True)
    p.add_argument('--reference', help='Original Fold 0 submission CSV')
    p.add_argument('--output', default='regenerated_submission.csv')
    p.add_argument('--report', default='reproduction_report.json')
    p.add_argument('--compare-only', help='Compare an existing prediction CSV without loading a model')
    args = p.parse_args()
    rows = read_queries(Path(args.test).read_text(encoding='utf-8-sig'))
    engine = None
    if args.compare_only:
        if not args.reference:
            p.error('--compare-only requires --reference')
        output = read_submission(Path(args.compare_only).read_text(encoding='utf-8-sig'))
        candidate_path = args.compare_only
    else:
        engine = InferenceEngine()
        engine.load()
        output = []
        for start in range(0, len(rows), 16):
            chunk = rows[start:start+16]
            predictions, _ = engine.predict_many([r['query_text'] for r in chunk])
            output.extend({'example_id':r['example_id'], 'target':v['class_id']} for r,v in zip(chunk, predictions))
        Path(args.output).write_text(submission_csv(output), encoding='utf-8')
        candidate_path = args.output
    if args.reference:
        reference = read_submission(Path(args.reference).read_text(encoding='utf-8-sig'))
        report = compare_rows(reference, output)
        test_ids = [r['example_id'] for r in rows]
        report.update({
            'candidate_ids_match_test': [r['example_id'] for r in output] == test_ids,
            'reference_ids_match_test': [r['example_id'] for r in reference] == test_ids,
            'mode': 'comparison_only' if args.compare_only else 'checkpoint_inference',
            'model_info': engine.info if engine else None,
            'sha256': {'test': file_sha256(args.test), 'reference': file_sha256(args.reference),
                       'candidate': file_sha256(candidate_path)},
        })
        report['passed'] = report['exact_match'] and report['candidate_ids_match_test'] and report['reference_ids_match_test']
        Path(args.report).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        if not report['passed']:
            sys.exit(f"FAIL: {report['id_order_mismatches']} ID/order mismatches; {report['target_mismatches']} target mismatches. See {args.report}.")
        print(f'PASS: all {len(output)} IDs, order and targets match. Mode: {report["mode"]}. Report: {args.report}')
    else:
        print(f'Wrote {len(output)} predictions. Supply --reference to verify reproduction.')
