"""Expose non-Markdown files in docs/: a 'Files' index page, plus a readable page per .txt/.tex."""
import datetime
import html
import shutil
import math
import os
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import quote, unquote

from mkdocs.structure.files import File

sys.path.insert(0, str(Path(__file__).parent))
from navgen import build_nav, load_cfg  # noqa: E402

SKIP = ("Zone.Identifier",)
TEXT_SUFFIXES = {".txt", ".tex"}


def _assets(docs: Path):
    return sorted(
        (p for p in docs.iterdir()
         if p.is_file() and p.suffix.lower() != ".md" and not p.name.startswith(".")
         and not any(s in p.name for s in SKIP)),
        key=lambda p: (p.suffix.lower(), p.name.lower()),
    )


def _size(p: Path) -> str:
    n = p.stat().st_size
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def on_config(config):
    """Rebuild the nav on every (re)build so added/renamed/deleted pages and new titles hot-reload."""
    docs = Path(config["docs_dir"])
    config["nav"] = build_nav(docs, load_cfg(Path(__file__).parent, docs))
    return config


def on_files(files, config):
    docs = Path(config["docs_dir"])
    out = Path(os.environ.get("MARKDOWNLIVE_GEN", Path.home() / ".cache/markdownlive/generated"))
    (out / "text").mkdir(parents=True, exist_ok=True)

    rows, videos = [], []
    for p in _assets(docs):
        link = quote(p.name)
        if p.suffix.lower() in TEXT_SUFFIXES:
            page = f"text/{p.name}.md"
            body = p.read_text(encoding="utf8", errors="replace")
            (out / page).write_text(f"# {p.name}\n\n[Download original]({'../../' + link})\n\n~~~~text\n{body}\n~~~~\n", encoding="utf8")
            files.append(File(page, str(out), config["site_dir"], config["use_directory_urls"]))
            cell = f"[{html.escape(p.name)}](text/{quote(p.name)}.md)"
        else:
            cell = f"[{html.escape(p.name)}]({link})"
        if p.suffix.lower() in {".mp4", ".webm"}:
            videos.append(p)
        rows.append(f"| {cell} | {p.suffix.lower().lstrip('.') or '-'} | {_size(p)} |")

    md = ["# All files", "",
          "Everything in this folder that is not a Markdown page. Spreadsheets and PDFs open in your",
          "browser or download; `.txt` and `.tex` files open as readable pages.", "",
          "| File | Type | Size |", "|---|---|---|", *rows, ""]
    for v in videos:
        md += [f"## {v.name}", "", f'<video controls preload="metadata" width="100%" src="../{quote(v.name)}"></video>', ""]
    (out / "files.md").write_text("\n".join(md), encoding="utf8")
    files.append(File("files.md", str(out), config["site_dir"], config["use_directory_urls"]))

    mds = sorted((p for p in docs.rglob("*.md") if not any(x.startswith(".") for x in p.relative_to(docs).parts)),
                 key=lambda p: p.stat().st_mtime, reverse=True)
    recent = ["# Recently changed", "", "Pages sorted by last modified time.", "", "| Page | Modified |", "|---|---|"]
    for p in mds[:50]:
        rel = p.relative_to(docs).as_posix()
        when = datetime.datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        recent.append(f"| [{html.escape(rel)}]({quote(rel)}) | {when} |")
        raw = out / "_raw" / (rel + ".txt")
        raw.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, raw)
        files.append(File(f"_raw/{rel}.txt", str(out), config["site_dir"], config["use_directory_urls"]))
    (out / "recent.md").write_text("\n".join(recent) + "\n", encoding="utf8")
    files.append(File("recent.md", str(out), config["site_dir"], config["use_directory_urls"]))

    global NAMES, BACKLINKS
    NAMES, BACKLINKS = {}, {}
    rels = [p.relative_to(docs).as_posix() for p in mds]
    for r in rels:
        NAMES.setdefault(Path(r).stem.lower(), r)
        NAMES.setdefault(r.lower(), r)
    for src in rels:
        text = (docs / src).read_text(encoding="utf8", errors="replace")
        for target in _targets(text, src):
            if target != src:
                BACKLINKS.setdefault(target, set()).add(src)

    (out / "javascripts").mkdir(exist_ok=True)
    (out / "javascripts" / "tablesort.js").write_text(TABLESORT, encoding="utf8")
    files.append(File("javascripts/tablesort.js", str(out), config["site_dir"], config["use_directory_urls"]))
    (out / "javascripts" / "mathjax.js").write_text(MATHJAX, encoding="utf8")
    files.append(File("javascripts/mathjax.js", str(out), config["site_dir"], config["use_directory_urls"]))
    return files


NAMES: dict = {}
BACKLINKS: dict = {}
WIKI = re.compile(r"\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]")
MDLINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s#]+\.md)(?:#[^)]*)?\)")
TABLESORT = """document$.subscribe(() => {
  document.querySelectorAll("article table:not([class])").forEach((table) => new Tablesort(table));
});
"""


def _resolve_wiki(name: str):
    key = name.strip().lower()
    return NAMES.get(key) or NAMES.get(key.removesuffix(".md"))


def _targets(text: str, src: str) -> set:
    """Page paths that `text` (living at `src`) links to via [[wikilinks]] or relative .md links."""
    found = set()
    for m in WIKI.finditer(text):
        t = _resolve_wiki(m.group(1))
        if t:
            found.add(t)
    for m in MDLINK.finditer(text):
        t = posixpath.normpath(posixpath.join(posixpath.dirname(src), unquote(m.group(1))))
        if t in NAMES.values():
            found.add(t)
    return found


CALLOUT = re.compile(r"^(?P<ind>\s*)>\s*\[!(?P<type>\w+)\](?P<fold>[+-]?)\s*(?P<title>.*)$")
CALLOUT_MAP = {"todo": "note", "summary": "abstract", "tldr": "abstract", "hint": "tip", "important": "tip", "check": "success",
               "done": "success", "help": "question", "faq": "question", "caution": "warning", "attention": "warning",
               "fail": "failure", "missing": "failure", "error": "danger", "cite": "quote"}


def _callouts(markdown: str) -> str:
    """Turn Obsidian `> [!type] Title` blockquotes into Material admonitions."""
    out, lines, i = [], markdown.split("\n"), 0
    while i < len(lines):
        m = CALLOUT.match(lines[i])
        if not m:
            out.append(lines[i]); i += 1; continue
        kind = CALLOUT_MAP.get(m["type"].lower(), m["type"].lower())
        mark = "???" if m["fold"] else "!!!"
        plus = "+" if m["fold"] == "+" else ""
        title = f' "{m["title"].strip()}"' if m["title"].strip() else ""
        out.append(f'{m["ind"]}{mark}{plus} {kind}{title}')
        i += 1
        while i < len(lines) and re.match(r"^\s*>", lines[i]):
            out.append(m["ind"] + "    " + re.sub(r"^\s*>\s?", "", lines[i])); i += 1
    return "\n".join(out)


def _wikilinks(markdown: str, src: str) -> str:
    def sub(m):
        target = _resolve_wiki(m.group(1))
        label = m.group(3) or m.group(1).strip()
        if not target:
            return f"{label}"
        rel = posixpath.relpath(target, posixpath.dirname(src) or ".")
        return f"[{label}]({quote(rel)}{m.group(2) or ''})"
    return WIKI.sub(sub, markdown)


MATHJAX = """window.MathJax = {
  tex: { inlineMath: [["\\\\(", "\\\\)"]], displayMath: [["\\\\[", "\\\\]"]], processEscapes: true, processEnvironments: true },
  options: { ignoreHtmlClass: ".*|", processHtmlClass: "arithmatex" }
};
document$.subscribe(() => { MathJax.startup.output.clearCache(); MathJax.typesetClear(); MathJax.texReset(); MathJax.typesetPromise(); });
"""


def on_page_markdown(markdown, page, config, files):
    """Under the first heading of real pages: reading time and a link to the raw markdown."""
    src = page.file.src_uri
    if src in ("files.md", "recent.md") or src.startswith(("text/", "_raw/")):
        return markdown
    markdown = _wikilinks(_callouts(markdown), src)
    linked = sorted(BACKLINKS.get(src, ()))
    if linked:
        items = "\n".join(f"- [{posixpath.splitext(s)[0]}]({quote(posixpath.relpath(s, posixpath.dirname(src) or '.'))})" for s in linked)
        markdown = markdown.rstrip() + f"\n\n---\n\n<small>**Linked from**</small>\n\n{items}\n"
    body = re.sub(r"```.*?```", "", markdown, flags=re.S)
    words = len(re.findall(r"\w+", body))
    raw = "../" * src.count("/") + f"_raw/{quote(src)}.txt"
    parts = []
    if words >= 150:
        parts.append(f":material-clock-outline: {math.ceil(words / 220)} min read · {words:,} words")
    parts.append(f"[:material-file-code-outline: raw]({raw})")
    note = "\n<small>" + " · ".join(parts) + "</small>\n"
    return re.sub(r"^(# .+)$", lambda m: m.group(1) + "\n" + note, markdown, count=1, flags=re.M)
