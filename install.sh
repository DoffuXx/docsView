#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/markdownlive"

mkdir -p "$BIN_DIR" "$CONF_DIR"
install -m 755 "$ROOT/bin/markdownlive" "$BIN_DIR/markdownlive"
cp -R "$ROOT/config/." "$CONF_DIR/"

echo "Installed markdownlive to $BIN_DIR/markdownlive"
echo "Installed configuration to $CONF_DIR"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Add $BIN_DIR to PATH before running markdownlive." ;;
esac
