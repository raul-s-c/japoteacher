import csv
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch


class IncrementalPublishingTest(unittest.TestCase):
    def test_transport_failure_does_not_retry_or_count_as_editorial_rejection(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location("generator", root / "scripts/editorial-generate.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        with patch.object(generator.urllib.request, "urlopen", side_effect=generator.http.client.RemoteDisconnected("closed")) as request:
            with self.assertRaises(generator.EditorialTransportError):
                generator.request_editorial({"operation": "generate"}, "test", retries=6)
        self.assertEqual(request.call_count, 1)

    def test_published_editorial_sentence_is_not_counted_twice_for_coverage(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location("generator", root / "scripts/editorial-generate.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        reference = {"vocabulary": [{"Word_ID": "book", "Word": "book"}], "kanji": [], "grammar": []}
        row = {"source_text": "sentence", "direction": "ja_es", "vocabulary_tags": "book"}
        approved = [{"japanese": "sentence", "coverage_slot": {"target_vocabulary": [{"id": "book"}]}}]
        with patch.object(generator, "active_pairs", return_value=[row]):
            self.assertEqual(generator.coverage_counts(reference, "N5", approved)["vocabulary"]["book"], 1)

    def test_exhausted_validation_does_not_publish_provisional_result(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location("generator", root / "scripts/editorial-generate.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        item = generator.read_jsonl(root / "data/editorial/n5-approved.jsonl")[-1]
        slot = item["coverage_slot"]
        with tempfile.TemporaryDirectory() as directory:
            temporary = pathlib.Path(directory)
            (temporary / "data/editorial").mkdir(parents=True)
            with patch.object(generator, "ROOT", temporary), patch.object(generator, "MAX_GENERATION_ATTEMPTS", 1), patch.object(generator, "existing_pairs", return_value=[]), patch.object(generator, "active_pairs", return_value=[]), patch.object(generator, "make_slots", return_value=[slot]), patch.object(generator, "request_editorial", side_effect=[{"items": [item]}, SystemExit("stop")]), patch.object(generator, "review_until_approved", return_value=([item], 1)), patch.object(generator, "validate_slot", side_effect=RuntimeError("invalid")), patch.dict("os.environ", {"JAPOTEACHER_EDITORIAL_KEY": "test"}):
                with self.assertRaises(SystemExit):
                    generator.run("N5", append=1)
            self.assertFalse((temporary / "data/editorial/n5-approved.jsonl").exists())

    def test_spanish_reference_cannot_be_japanese(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location("generator", root / "scripts/editorial-generate.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        item = generator.read_jsonl(root / "data/editorial/n5-approved.jsonl")[-1]
        with self.assertRaisesRegex(RuntimeError, "traduccion espanola"):
            generator.validate_slot({**item, "spanish": item["japanese"]}, item["coverage_slot"])

    def test_preserves_archived_rows_and_is_idempotent(self):
        script = pathlib.Path(__file__).resolve().parents[1] / "scripts/publish-editorial-bank.py"
        spec = importlib.util.spec_from_file_location("publisher", script)
        publisher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(publisher)
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            editorial = root / "data/editorial"
            editorial.mkdir(parents=True)
            csv_path = root / "data/exercises.full.csv"
            with publisher.CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
                fields = csv.DictReader(source).fieldnames
            original = dict.fromkeys(fields, "")
            original.update(exercise_id="JAES-N5-EDITORIAL-0001", active="false", difficulty="87", pedagogical_notes="manual")
            with csv_path.open("w", encoding="utf-8-sig", newline="") as output:
                writer = csv.DictWriter(output, fieldnames=fields)
                writer.writeheader()
                writer.writerow(original)
            item = dict(slot=1, topic_primary="vida_diaria", register="neutro", communicative_function="informar", tense_aspect="presente", polarity="positiva", sentence_type="declarativa", difficulty_rationale="test", ambiguity_notes="", japanese="テスト。", spanish="Prueba.", accepted_alternatives_es=[], accepted_alternatives_ja=[])
            (editorial / "n5-approved.jsonl").write_text(json.dumps(item), encoding="utf-8")
            with patch.object(publisher, "ROOT", root), patch.object(publisher, "CSV_PATH", csv_path), patch("sys.argv", [str(script), "--append-only"]), patch.dict("os.environ", {"JAPOTEACHER_USAGE_REFERENCE_ZIP": str(root / "missing.zip")}):
                publisher.main()
                publisher.main()
            with csv_path.open(encoding="utf-8-sig", newline="") as source:
                rows = list(csv.DictReader(source))
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0], original)
            self.assertEqual(rows[1]["exercise_id"], "ESJA-N5-EDITORIAL-0001")


if __name__ == "__main__":
    unittest.main()
