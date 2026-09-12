import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("usage_classification", ROOT / "scripts" / "usage-classification.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class UsageClassificationTests(unittest.TestCase):
    def test_morphology_rejects_clock_substring_and_unrelated_tags(self):
        classifier=MODULE.UsageClassifier(Path.home()/'Downloads/japanese_usage_progress_v2_csv.zip')
        profile,_=classifier.classify({'direction':'ja_es','source_text':'毎朝七時に起きます。','jlpt_level':'N5','difficulty':18,'vocabulary_tags':'買う|時に|起きる'})
        terms={c['t'] for c in profile['display_components']}
        self.assertNotIn('買う',terms)
        self.assertNotIn('時に',terms)
        self.assertIn('起きる',terms)
        self.assertEqual(profile['level'],'N5')
        self.assertEqual(profile['difficulty'],18)

    def test_percentile_bands(self):
        self.assertEqual(MODULE.level_for(0), "N5")
        self.assertEqual(MODULE.level_for(9.99), "N5")
        self.assertEqual(MODULE.level_for(10), "N4")
        self.assertEqual(MODULE.level_for(30), "N3")
        self.assertEqual(MODULE.level_for(60), "N2")
        self.assertEqual(MODULE.level_for(90), "N1")

    def test_difficulty_is_bounded(self):
        for percentile in (0, 9.9, 10, 29.9, 30, 59.9, 60, 89.9, 90, 99.99):
            self.assertGreaterEqual(MODULE.difficulty_for(percentile, 8, 2, 24), 0)
            self.assertLessEqual(MODULE.difficulty_for(percentile, 8, 2, 24), 100)

    def test_contextual_reference_groups_mother_forms(self):
        path = ROOT / "data" / "reference" / "vocabulary-context-v1.csv"
        with path.open(encoding="utf-8-sig") as source:
            rows = {row["Word"]: row for row in __import__("csv").DictReader(source)}
        self.assertEqual(rows["母"]["Concept_ID"], rows["お母さん"]["Concept_ID"])
        self.assertEqual(rows["母"]["Composite_Percentile"], rows["ママ"]["Composite_Percentile"])
        self.assertLess(float(rows["母"]["Composite_Percentile"]), float(rows["資料"]["Composite_Percentile"]))

if __name__ == "__main__":
    unittest.main()
