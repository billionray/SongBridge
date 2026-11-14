"""Build identical, source-only desktop helper archives on every supported OS."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
source = root / "browser-helper"
files = """LICENSE README.md loanwords.tsv loanwords-NOTICE.txt loanwords.mjs batch.mjs batch.test.mjs core.mjs matching.mjs matching.test.mjs membership.mjs origins.mjs
package.json package-lock.json platform.mjs platform-player.mjs policy.mjs proxy.mjs proxy.test.mjs
reading.mjs server.mjs spotify-player.mjs start.command start.mjs start.ps1 start.sh
tests.mjs web.mjs target-playlist.mjs""".split()
origin = os.environ.get("SONGBRIDGE_SITE_ORIGIN", "").strip()
if origin:
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
            parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("SONGBRIDGE_SITE_ORIGIN must be an exact HTTPS origin")
    origin = origin.rstrip("/")

out = root / "public" / "songbridge-helper.zip"
with ZipFile(out, "w") as archive:
    for name in sorted(files):
        path = root / name if name == "LICENSE" else source / name
        data = path.read_bytes()
        if name == "origins.mjs" and origin:
            data = ("export const siteOrigins = " + json.dumps([origin]) + ";\n").encode()
        entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = (0o100755 if name.endswith((".command", ".sh")) else 0o100644) << 16
        archive.writestr(entry, data, compress_type=ZIP_DEFLATED)
with ZipFile(out) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
out.with_name("songbridge-helper-mac.zip").write_bytes(out.read_bytes())
