#!/usr/bin/env python3
"""Report broken relative links/images in a folder of Markdown. Exit 1 if any."""
import re, sys
from pathlib import Path
from urllib.parse import unquote

docs = Path(sys.argv[1]).resolve()
LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
bad = 0
for md in sorted(docs.rglob("*.md")):
    if any(p.startswith(".") for p in md.relative_to(docs).parts):
        continue
    text = re.sub(r"```.*?```", "", md.read_text(encoding="utf8", errors="replace"), flags=re.S)
    for n, line in enumerate(text.splitlines(), 1):
        for target in LINK.findall(line):
            if re.match(r"^([a-z]+:|#|//|mailto:)", target, re.I):
                continue
            path = unquote(target.split("#")[0].split("?")[0])
            if path and not (md.parent / path).exists():
                print(f"{md.relative_to(docs)}:{n}: broken link -> {target}")
                bad += 1
WIKI = re.compile(r"\[\[([^\]|#]+)")
names = {p.stem.lower() for p in docs.rglob("*.md")}
linked = set()
for md in docs.rglob("*.md"):
    text = md.read_text(encoding="utf8", errors="replace")
    for n in WIKI.findall(text):
        if n.strip().lower().removesuffix(".md") not in names:
            print(f"{md.relative_to(docs)}: unresolved wikilink -> [[{n.strip()}]]"); bad += 1
        else:
            linked.add(n.strip().lower().removesuffix(".md"))
    for target in LINK.findall(text):
        if target.split("#")[0].endswith(".md"):
            linked.add(Path(unquote(target.split("#")[0])).stem.lower())
orphans = sorted(p.name for p in docs.glob("*.md") if p.stem.lower() not in linked and p.name != "index.md")
if "--orphans" in sys.argv:
    print(f"orphans (no inbound links): {len(orphans)}"); [print(f"  {o}") for o in orphans]
print(f"{bad} broken link(s)" if bad else "no broken links")
sys.exit(1 if bad else 0)
