import importlib.util,json,pathlib,tempfile,unittest

spec=importlib.util.spec_from_file_location('collection_import',pathlib.Path(__file__).resolve().parents[1]/'scripts/import-study-collection.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class BudgetTests(unittest.TestCase):
    def setUp(self):module.budget_stopped.clear()
    def fixture(self,path,used):
        module.write(path/'budget.json',{'limit':2_000_000,'uncertain_prior':0,'reservations':{}})
        module.write(path/'screen-fixture.json',{'usage':{'total_tokens':used}})
    def test_does_not_send_when_maximum_would_exceed_total(self):
        with tempfile.TemporaryDirectory() as temp:
            path=pathlib.Path(temp);self.fixture(path,1_980_000)
            with self.assertRaises(RuntimeError):module.reserve(path,'x',{'stage':'screen','items':[]})
            self.assertEqual(json.loads((path/'budget.json').read_text())['reservations'],{})
    def test_inflight_and_uncertain_requests_remain_charged(self):
        with tempfile.TemporaryDirectory() as temp:
            path=pathlib.Path(temp);self.fixture(path,1_945_000)
            one=module.reserve(path,'one',{'stage':'screen','items':[]})
            two=module.reserve(path,'two',{'stage':'screen','items':[]})
            with self.assertRaises(RuntimeError):module.reserve(path,'three',{'stage':'screen','items':[]})
            module.release(path,one)
            self.assertIn(two,json.loads((path/'budget.json').read_text())['reservations'])
    def test_prior_uncertainty_is_reserved_in_addition_to_recorded_usage(self):
        with tempfile.TemporaryDirectory() as temp:
            path=pathlib.Path(temp)
            reservation=module.reserve(path,'one',{'stage':'annotate','items':[]})
            ledger=json.loads((path/'budget.json').read_text())
            self.assertEqual(ledger['uncertain_prior'],200_000)
            self.assertGreater(ledger['reservations'][reservation],30_000)
    def test_closed_ledger_blocks_calls_even_with_remaining_budget(self):
        with tempfile.TemporaryDirectory() as temp:
            path=pathlib.Path(temp);self.fixture(path,0)
            ledger=json.loads((path/'budget.json').read_text());ledger['closed']=True
            module.write(path/'budget.json',ledger)
            with self.assertRaises(RuntimeError):module.reserve(path,'x',{'stage':'screen','items':[]})
            self.assertEqual(json.loads((path/'budget.json').read_text())['reservations'],{})

if __name__=='__main__':unittest.main()
