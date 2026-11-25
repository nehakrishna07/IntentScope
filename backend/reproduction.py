"""Strict reference comparison without loading weights or changing predictions."""
import csv
import hashlib
import io
from pathlib import Path


def file_sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_submission(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')), strict=True)
    if reader.fieldnames != ['example_id', 'target']:
        raise ValueError('Submission must have exactly example_id,target columns in that order.')
    rows, seen = [], set()
    for index, row in enumerate(reader, start=2):
        if None in row or any(v is None for v in row.values()):
            raise ValueError(f'Malformed submission at row {index}.')
        identifier, target = row['example_id'], row['target']
        if not identifier.strip() or identifier in seen:
            raise ValueError(f'Empty or duplicate submission ID at row {index}.')
        if not target.isascii() or not target.isdigit() or not 0 <= int(target) <= 55:
            raise ValueError(f'Submission target must be an integer 0–55 at row {index}.')
        seen.add(identifier)
        rows.append({'example_id': identifier, 'target': int(target)})
    if not rows:
        raise ValueError('Submission contains no rows.')
    return rows


def compare_rows(reference, candidate):
    count = max(len(reference), len(candidate))
    id_mismatches, target_mismatches = [], []
    for i in range(count):
        if i >= len(reference) or i >= len(candidate):
            id_mismatches.append(i)
            target_mismatches.append(i)
            continue
        if reference[i]['example_id'] != candidate[i]['example_id']:
            id_mismatches.append(i)
        if int(reference[i]['target']) != int(candidate[i]['target']):
            target_mismatches.append(i)
    return {
        'exact_match': not id_mismatches and not target_mismatches,
        'reference_rows': len(reference), 'candidate_rows': len(candidate),
        'id_order_mismatches': len(id_mismatches),
        'target_mismatches': len(target_mismatches),
        'first_mismatch_index': min(id_mismatches + target_mismatches, default=None),
    }