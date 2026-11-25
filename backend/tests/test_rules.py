import ast
import json
import os
import re
import unittest
import unicodedata
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.inference import norm, validate_parameters, InferenceEngine, NUM_CLASSES, MAX_LENGTH
from backend.csv_utils import read_queries, submission_csv
from backend.main import app

class Rules(unittest.TestCase):
    def test_parameter_limit(self):
        validate_parameters(300_000_000)
        with self.assertRaises(ValueError):
            validate_parameters(300_000_001)

    def test_56_classes(self):
        self.assertEqual(NUM_CLASSES, 56)

    def test_max_length_64(self):
        self.assertEqual(MAX_LENGTH, 64)

    def test_exact_notebook_normalization(self):
        notebook = json.loads(Path('notebooks/hingrobert_1.ipynb').read_text())
        source = next(''.join(c['source']) for c in notebook['cells'] if ''.join(c['source']).startswith('def norm(t):'))
        definition = ast.parse(source).body[0]
        namespace = {'re': re, 'unicodedata': unicodedata}
        exec(compile(ast.Module(body=[definition], type_ignores=[]), '<original-notebook-norm>', 'exec'), namespace)
        for text in ['Meraa!!! order???', '  मुझे पाँव की क़ीमत चाहिए।  ', 'ＡＡＡ hello___ 123', 'Payment fail ho gaya hai', 'aaaaa bbbb cc']:
            self.assertEqual(norm(text), namespace['norm'](text))
        self.assertEqual(norm('ＭＥＲＡＡＡ!!!  ORDER?'), 'meraa order')

    def test_submission_exact_columns_ids_and_order(self):
        rows = read_queries('example_id,query_text\n001,hello\n"a,b",world\n')
        result = submission_csv([{'example_id':r['example_id'], 'target':v} for r,v in zip(rows,[55,0])])
        self.assertEqual(result, 'example_id,target\n001,55\n"a,b",0\n')

    def test_csv_columns(self):
        with self.assertRaises(ValueError):
            read_queries('id,text\n1,hello\n')

    def test_malformed_csv(self):
        with self.assertRaises(ValueError):
            read_queries('example_id,query_text\n1,hello,extra\n')

    def test_missing_model_no_fallback(self):
        with patch.dict(os.environ, {'MODEL_PATH':'/tmp/intentscope-nonexistent-model'}):
            engine = InferenceEngine()
            with self.assertRaises(FileNotFoundError):
                engine.load()
            self.assertIsNone(engine.model)

    def test_disconnected_api(self):
        with patch.dict(os.environ, {'MODEL_PATH':'/tmp/intentscope-nonexistent-model'}):
            with TestClient(app) as client:
                health = client.get('/api/health').json()
                self.assertFalse(health['ready'])
                self.assertIsNone(health['model_info'])
                self.assertEqual(client.post('/api/predict', json={'query':'Mera order kab deliver hoga?'}).status_code, 503)
                self.assertEqual(client.post('/api/benchmark', json={'queries':['hello'], 'count':100}).status_code, 503)
                self.assertEqual(client.post('/api/benchmark', json={'queries':['hello'], 'count':99}).status_code, 422)
                self.assertEqual(client.post('/api/predict', json={'query':'   '}).status_code, 422)
                self.assertEqual(client.post('/api/batch-predict', json={'csv_text':'example_id,query_text\n001,hello\n'}).status_code, 503)
                self.assertEqual(client.post('/api/batch-predict', json={'csv_text':'bad\n1\n'}).status_code, 422)
                self.assertAlmostEqual(client.get('/api/metrics').json()['epochs'][7]['f1'], 85.716, places=8)
                stats = client.get('/api/dataset-stats').json()
                self.assertEqual(stats['training']['rows'], 16936)
                self.assertEqual(stats['test']['rows'], 4912)
                response = client.options('/api/predict', headers={'Origin':'http://localhost:8080','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
                self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:8080')
                response = client.post('/api/predict', json={'query':'hello'}, headers={'Origin':'http://localhost:8080'})
                self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:8080')

if __name__ == '__main__':
    unittest.main()
