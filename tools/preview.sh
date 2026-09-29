#!/usr/bin/env bash
# Safe preview on a small box with no GPU (the LlamaPress mothership): memory-capped, low
# priority, CPU WebGL, max 960 wide. Usage:
#   tools/preview.sh sheet --film leo --w 640 --from 0 --to 30 --n 12 --name leo_look
#   tools/preview.sh still --film leo --w 640 --t 9.9 --t 10.0 --name seam10
set -euo pipefail
[[ "$(uname)" == Linux ]] || { echo "preview.sh is for the no-GPU Linux mothership; on a Mac run node tools/cli.mjs directly" >&2; exit 2; }
cd "$(dirname "$0")/.."
for a in "$@"; do [[ "$a" =~ ^[0-9]+$ ]] && (( a > 960 )) && { echo "preview.sh: width $a > 960 refused on this box" >&2; exit 2; }; done
export CHROME="${CHROME:-$(ls -d ~/.cache/puppeteer/chrome/linux-151*/chrome-linux64/chrome | head -1)}"
export JS_HEAP_MB=900
exec timeout "${PREVIEW_TIMEOUT:-600}" systemd-run --user --scope -q -p MemoryMax=1800M -p MemorySwapMax=0 nice -n 19 node tools/cli.mjs "$@"
