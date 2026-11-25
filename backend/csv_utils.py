"""CSV validation shared by HTTP batch prediction and submission reproduction."""
import csv
import io


def read_queries(text, max_rows=10000):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    fields = reader.fieldnames or []
    if len(fields) != len(set(fields)):
        raise ValueError('Duplicate CSV column names are not allowed.')
    if not {'example_id', 'query_text'}.issubset(fields):
        raise ValueError('CSV requires example_id and query_text columns.')
    rows = list(reader)
    if not rows:
        raise ValueError('CSV contains no query rows.')
    if max_rows is not None and len(rows) > max_rows:
        raise ValueError(f'Upload at most {max_rows:,} rows per file.')
    for index, row in enumerate(rows, start=2):
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f'Malformed CSV at row {index}.')
        if not row['example_id'].strip() or not row['query_text'].strip():
            raise ValueError(f'Empty example_id or query_text at row {index}.')
        if len(row['query_text']) > 10000:
            raise ValueError(f'Query at row {index} exceeds 10,000 characters.')
    return rows


def submission_csv(rows):
    out = io.StringIO(newline='')
    writer = csv.DictWriter(out, fieldnames=['example_id', 'target'], lineterminator='\n')
    writer.writeheader()
    for row in rows:
        writer.writerow({'example_id': row['example_id'], 'target': row['target']})
    return out.getvalue()
