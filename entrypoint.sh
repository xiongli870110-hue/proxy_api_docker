#!/bin/sh
set -euo pipefail

# 要下载的 raw 文件 URL（默认指向你的仓库 main 分支）
RAW_URL="${DENOTS_RAW_URL:-https://raw.githubusercontent.com/xiongli870110-hue/proxy_api_docker/main/deno.ts}"
# 可选：传入期望的 sha256 值以防止被意外改动
EXPECTED_SHA256="${DENOTS_SHA256:-}"

TMP="$(mktemp /tmp/deno.ts.XXXX)"
cleanup() { [ -f "$TMP" ] && rm -f "$TMP"; }
trap cleanup EXIT

echo "Downloading deno.ts from: $RAW_URL"
if ! curl -fsSL "$RAW_URL" -o "$TMP"; then
  echo "Failed to download $RAW_URL" >&2
  exit 1
fi

if [ -n "$EXPECTED_SHA256" ]; then
  echo "${EXPECTED_SHA256}  ${TMP}" | sha256sum -c - || {
    echo "sha256 mismatch for downloaded deno.ts" >&2
    exit 1
  }
fi

# 原子替换目标文件
mv "$TMP" /app/deno.ts
chmod 644 /app/deno.ts
echo "Updated /app/deno.ts"

# 最后 exec 启动 deno（使用环境变量限制 allow-net，按需调整）
exec deno run --allow-net="${DENO_TARGET_HOST}:80" --allow-env deno.ts
