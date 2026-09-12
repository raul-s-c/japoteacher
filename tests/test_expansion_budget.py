import concurrent.futures
import importlib.util
import json
import pathlib
import tempfile
import time
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('budgeted', ROOT/'scripts/run-budgeted-expansion.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BudgetTests(unittest.TestCase):
    def test_concurrent_reservations_settle_without_lost_usage(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(module, 'OUT', pathlib.Path(directory)/'ledger.json'):
                module.save({'limit':module.LIMIT,'used':0,'reservations':{},'calls':0,'closed':False})
                def response(*args, **kwargs):
                    time.sleep(.02)
                    return types.SimpleNamespace(returncode=0, stdout=json.dumps({'usage':{'total_tokens':123},'result':{'items':[]}}))
                with patch.object(module.subprocess,'run',response), patch.object(module.editorial,'record_usage'), patch.object(module.time,'time_ns',return_value=123):
                    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                        list(pool.map(lambda _:module.request({'operation':'generate'},'fake'),range(2)))
                ledger=json.loads(module.OUT.read_text())
                self.assertEqual(ledger['used'],246)
                self.assertEqual(ledger['reservations'],{})
                self.assertEqual(ledger['calls'],2)

    def test_budget_rejection_never_sends_and_disconnect_keeps_reservation(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(module,'OUT',pathlib.Path(directory)/'ledger.json'):
                module.save({'limit':module.LIMIT,'used':module.LIMIT-1,'reservations':{},'calls':0,'closed':False})
                with patch.object(module.subprocess,'run') as send:
                    with self.assertRaises(module.BudgetStop): module.request({},'fake')
                    send.assert_not_called()
                module.save({'limit':module.LIMIT,'used':0,'reservations':{},'calls':0,'closed':False})
                with patch.object(module.subprocess,'run',return_value=types.SimpleNamespace(returncode=1,stderr='timeout')):
                    with self.assertRaises(module.editorial.EditorialTransportError): module.request({},'fake')
                self.assertEqual(len(json.loads(module.OUT.read_text())['reservations']),1)

if __name__=='__main__': unittest.main()
