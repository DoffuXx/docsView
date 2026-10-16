# docsView

Serve any folder of Markdown as a searchable, auto-reloading local website. docsView wraps
[MkDocs](https://www.mkdocs.org/) and Material for MkDocs with a Gruvbox theme, generated
navigation, full-text search, backlinks, wikilinks, Mermaid, MathJax, file browsing, and PDF
export.

## Requirements

- Bash
- Python 3
- [`uv`](https://docs.astral.sh/uv/) (`uvx` is used to fetch MkDocs and its plugins)
- Google Chrome only when exporting PDF

## Install

```bash
git clone git@github.com:DoffuXx/docsView.git
cd docsView
./install.sh
```

You can also run the checked-out script directly without installing it:

```bash
./bin/markdownlive -folder=./docs start --open
```

## Usage

```bash
# Serve ./docs if it exists, otherwise the current directory
markdownlive start --open

# Serve a specific directory in the background
markdownlive -folder=/path/to/docs start -d --open

# Use a specific port, or listen on the LAN
markdownlive -folder=/path/to/docs start -p 8080
markdownlive -folder=/path/to/docs start --lan

# Manage the server
markdownlive -folder=/path/to/docs status
markdownlive -folder=/path/to/docs logs
markdownlive -folder=/path/to/docs restart -d
markdownlive -folder=/path/to/docs stop

# Build a static site, validate links, or export one PDF
markdownlive -folder=/path/to/docs build --out ./site
markdownlive -folder=/path/to/docs check
markdownlive -folder=/path/to/docs check --orphans
markdownlive -folder=/path/to/docs pdf --out ./docs.pdf

# Create a starter Markdown folder
markdownlive new -folder=./docs
```

The first folder is assigned port `8010`; additional folders use the next available port through
`8099`. Port assignments and generated files live under `~/.cache/markdownlive`.

By default the server binds to `127.0.0.1`, so it is only reachable from your machine. `--lan`
binds to `0.0.0.0`; WSL still needs a Windows port-forward for access from other devices.

## Configuration

The installed configuration lives at `~/.config/markdownlive`. Set `MARKDOWNLIVE_CONF` to use a
different configuration directory. When running `bin/markdownlive` directly from this checkout,
it automatically uses this repository's `config` directory.

`config/groups.json` can customize a folder's site name, landing page, and navigation groups. Keys
are absolute paths to document folders:

```json
{
  "/absolute/path/to/docs": {
    "site_name": "Project documentation",
    "index_redirect": "getting-started.md",
    "groups": [
      ["Guides", ["getting-started.md", "guides/*"]],
      ["Reference", ["reference/*"]]
    ]
  }
}
```

If a folder has no entry, its directory name becomes the site name and Markdown pages are listed
under `Other`.
