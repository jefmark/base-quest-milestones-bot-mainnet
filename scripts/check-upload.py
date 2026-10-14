import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
manifest = root / "UPLOAD-FILES.json"
if not manifest.is_file():
    raise SystemExit("Incomplete upload: UPLOAD-FILES.json missing. Upload all extracted project contents.")
# Setup guides are documentation, not runtime/build dependencies.
optional_guides = {"START-HERE.md", "START-HERE-FA.md"}
required = [name for name in json.loads(manifest.read_text(encoding="utf-8")) if name not in optional_guides]
missing = [name for name in required if not (root / name).is_file() or (root / name).stat().st_size == 0]
if missing:
    raise SystemExit("Incomplete upload. Upload these files before publishing:\n" + "\n".join(missing))
print("All required release files are present. No deployment private key is required.")
