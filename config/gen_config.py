#!/usr/bin/env python3
"""Fill mkdocs.base.yml for a folder. The nav itself is built live by hooks.py (hot reload)."""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from navgen import load_cfg, md_files

conf, docs, out, site = (Path(a) for a in sys.argv[1:5])
cfg = load_cfg(conf.parent, docs)
SITE_NAME = cfg.get("site_name", sys.argv[5] if len(sys.argv) > 5 else docs.name)

files = md_files(docs)
redirect = cfg.get("index_redirect") or (None if "index.md" in files or not files else files[0])
redirects = ("  - redirects:\n      redirect_maps:\n        index.md: " + redirect + "\n") if redirect else ""
text = conf.read_text(encoding="utf8")
text = (text.replace("__REDIRECTS__", redirects).replace("__SITE_NAME__", json.dumps(SITE_NAME))
        .replace("__DOCS_DIR__", str(docs)).replace("__SITE_DIR__", str(site))
        .replace("__OVERRIDES__", str(conf.parent / "overrides"))
        .replace("__HOOKS__", str(conf.parent / "hooks.py"))
        .replace("__GROUPS__", str(conf.parent / "groups.json")))
out.write_text(text, encoding="utf8")
print(f"{len(files)} pages", file=sys.stderr)
