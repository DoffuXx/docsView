"""Build the MkDocs nav from a folder of Markdown (grouped into tabs). Re-run on every rebuild for hot reload."""
import fnmatch, json, re
from pathlib import Path

SKIP = ("Zone.Identifier",)


def load_cfg(conf_dir: Path, docs: Path) -> dict:
    try:
        return json.loads((conf_dir / "groups.json").read_text(encoding="utf8")).get(str(docs.resolve()), {})
    except (OSError, ValueError):
        return {}


def title(path: Path) -> str:
    try:
        text = path.read_text(encoding="utf8", errors="replace")
        fm = re.match(r"---\s*\n(.*?)\n---", text, re.S)
        if fm:
            m = re.search(r"^title:\s*(.+)$", fm.group(1), re.M)
            if m:
                return m.group(1).strip().strip("\"'")
        for line in text.splitlines():
            m = re.match(r"#\s+(.+)", line)
            if m:
                return m.group(1).strip()
    except OSError:
        pass
    return path.stem.replace("-", " ")


def md_files(docs: Path) -> list:
    return sorted(str(p.relative_to(docs)) for p in docs.rglob("*.md")
                  if not any(part.startswith(".") for part in p.relative_to(docs).parts))


def build_nav(docs: Path, cfg: dict) -> list:
    files = md_files(docs)
    used, nav = set(), []
    for group, patterns in cfg.get("groups", []):
        items = []
        for pat in patterns:
            for f in files:
                if f not in used and fnmatch.fnmatch(f, pat):
                    used.add(f)
                    items.append({title(docs / f): f})
        if items:
            nav.append({group: items})
    rest = [{title(docs / f): f} for f in files if f not in used]
    if rest:
        nav.append({"Other": rest})
    texts = sorted(p.name for p in docs.iterdir()
                   if p.is_file() and p.suffix.lower() in {".txt", ".tex"} and not any(s in p.name for s in SKIP))
    nav.append({"Files": [{"All files": "files.md"}, {"Recently changed": "recent.md"}] + [{t: f"text/{t}.md"} for t in texts]})
    return nav
