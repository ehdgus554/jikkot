"""Validate every original before installing. Usage: python3 scripts/import-jikkot74.py part1.zip part2.zip ..."""
from pathlib import Path, PurePosixPath
import argparse
import csv
import hashlib
import io
import json
import re
import shutil
import tempfile
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="+")
    args = parser.parse_args()
    source = json.loads((ROOT / "lib/personalization/source-catalog.json").read_text())
    by_id = {item["catalogId"]: item for item in source}
    found = {}
    csv_ids = set()
    csv_names = {}
    with tempfile.TemporaryDirectory(prefix="jikkot74-") as staging:
        stage = Path(staging)
        for archive in args.archives:
            with zipfile.ZipFile(archive) as z:
                for member in z.infolist():
                    name = PurePosixPath(member.filename)
                    if name.is_absolute() or ".." in name.parts:
                        raise ValueError("Unsafe archive path")
                    if member.is_dir() or "__MACOSX" in name.parts or name.name.startswith("."):
                        continue
                    if member.file_size > 32 * 1024 * 1024:
                        raise ValueError("Unexpectedly large individual asset")
                    if name.suffix.lower() == ".csv":
                        raw = z.read(member)
                        try:
                            text = raw.decode("utf-8-sig")
                        except UnicodeDecodeError:
                            text = raw.decode("cp949")
                        for row in csv.DictReader(io.StringIO(text)):
                            values = [str(v).strip() for v in row.values() if v is not None]
                            ids = [v for v in values if re.fullmatch(r"[ODYW]\d{2}", v)]
                            if len(ids) != 1 or ids[0] not in by_id:
                                raise ValueError("CSV needs exactly one known movement ID per row")
                            code = ids[0]
                            csv_ids.add(code)
                            files = [PurePosixPath(v).name for v in values if v.lower().endswith(".png")]
                            if files and files != [by_id[code]["imageFileName"]]:
                                raise ValueError(f"CSV image mismatch: {code}")
                            if code in csv_names and csv_names[code] != values:
                                raise ValueError(f"Conflicting CSV row: {code}")
                            csv_names[code] = values
                    elif name.suffix.lower() == ".png":
                        match = re.fullmatch(r"\d{3}_([ODYW]\d{2})_(male|female)\.png", name.name)
                        if not match or match[1] not in by_id:
                            raise ValueError(f"Unexpected PNG: {name.name}")
                        code = match[1]
                        if code in found:
                            raise ValueError(f"Duplicate original: {code}")
                        expected = by_id[code]
                        raw = z.read(member)
                        if name.name != expected["imageFileName"] or hashlib.sha256(raw).hexdigest() != expected["imageSha256"]:
                            raise ValueError(f"Filename or SHA-256 mismatch: {code}")
                        image = Image.open(io.BytesIO(raw))
                        if image.format != "PNG" or image.size != (expected["imageWidth"], expected["imageHeight"]) or "A" not in image.getbands():
                            raise ValueError(f"PNG dimensions/transparency mismatch: {code}")
                        if list(image.getchannel("A").getextrema()) != expected["alphaExtrema"]:
                            raise ValueError(f"Alpha range mismatch: {code}")
                        target = stage / name.name
                        target.write_bytes(raw)
                        found[code] = target
                    else:
                        raise ValueError(f"Unexpected archive entry: {name.name}")
        if set(found) != set(by_id) or csv_ids != set(by_id):
            raise ValueError(f"Need all 74 originals and CSV IDs; missing PNGs: {sorted(set(by_id)-set(found))}; missing CSV IDs: {sorted(set(by_id)-csv_ids)}")
        target = ROOT / "public/assets/jikkot74"
        target.mkdir(parents=True, exist_ok=True)
        # All validation completes before any repository asset is changed.
        for path in found.values():
            shutil.copyfile(path, target / path.name)
        manifest_path = ROOT / "lib/personalization/media-manifest.json"
        manifest = json.loads(manifest_path.read_text())
        for item in manifest:
            item["installed"] = True
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        (ROOT / "docs/jikkot74-csv-mapping.json").write_text(json.dumps(csv_names, ensure_ascii=False, indent=2) + "\n")
    print("Validated and installed 74 original PNGs and their CSV ID mappings; approvals unchanged.")


if __name__ == "__main__":
    main()
