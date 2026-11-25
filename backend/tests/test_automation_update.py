import unittest
from unittest.mock import patch
from backend.automation import AutomationManager
from backend.main import predict, PredictBody, engine, automation

PRED = {'class_id': 55, 'probability': .8, 'latency_ms': 12.0, 'original_query': 'private sample', 'script': 'Latin / Romanized'}

class AutomationUpdateTests(unittest.TestCase):
    def test_opt_in_default(self):
        self.assertFalse(PredictBody(query='hello').trigger_automation)

    def test_failure_retains_prediction(self):
        with patch.object(engine, 'model', object()), patch.object(engine, 'predict_many', return_value=([dict(PRED)], 12.0)), patch.object(automation, 'dispatch_prediction', side_effect=RuntimeError('test failure')):
            result = predict(PredictBody(query='hello', trigger_automation=True))
        self.assertEqual(result['class_id'], 55)
        self.assertEqual(result['probability'], .8)
        self.assertEqual(result['automation']['status'], 'failed')

    def test_private_metadata_and_oos_routing(self):
        manager = AutomationManager()
        manager.update_config({'enabled': True, 'include_raw_query': False})
        with patch.object(manager, '_webhook_url', return_value='http://localhost/webhook'), patch.object(manager, '_post_webhook', return_value=(True, 3.0, 200, None)) as post:
            result = manager.dispatch_prediction(PRED)
        payload = post.call_args.args[0]
        self.assertNotIn('query_text', payload)
        self.assertTrue(payload['manual_review_required'])
        self.assertEqual(result['status'], 'success')

    def test_review_rules_off(self):
        manager = AutomationManager()
        manager.update_config({'enabled': True, 'oos_routing': False, 'low_confidence_review': False})
        with patch.object(manager, '_webhook_url', return_value='http://localhost/webhook'), patch.object(manager, '_post_webhook', return_value=(True, 3.0, 200, None)) as post:
            manager.dispatch_prediction(PRED)
        self.assertFalse(post.call_args.args[0]['manual_review_required'])

    def test_missing_secret_blocks_webhook(self):
        manager = AutomationManager()
        with patch.object(manager, '_webhook_url', return_value='http://localhost/webhook'), patch.object(manager, '_webhook_secret', return_value=''), patch('backend.automation.httpx.Client') as client:
            self.assertFalse(manager._post_webhook({})[0])
            client.assert_not_called()
