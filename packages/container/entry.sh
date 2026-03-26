#!/bin/bash
set -e

WORKSPACE="/workspace/repo"

echo "[layrr-container] Starting..."
echo "[layrr-container] Repo: $GITHUB_REPO"
echo "[layrr-container] Branch: $GITHUB_BRANCH"

# ---- Clone or pull ----
if [ -d "$WORKSPACE/.git" ]; then
  echo "[layrr-container] Repo exists, pulling latest..."
  cd "$WORKSPACE"
  git fetch origin
  git checkout "$GITHUB_BRANCH"
  git reset --hard "origin/$GITHUB_BRANCH"
else
  echo "[layrr-container] Cloning repo..."
  git clone --depth 1 --branch "$GITHUB_BRANCH" \
    "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
    "$WORKSPACE"
  cd "$WORKSPACE"
fi

# ---- Detect package manager ----
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  PM="bun"
else
  PM="npm"
fi
echo "[layrr-container] Package manager: $PM"

# ---- Install dependencies ----
echo "[layrr-container] Installing dependencies..."
$PM install

# ---- Detect framework and dev command ----
detect_dev_command() {
  local pkg="$WORKSPACE/package.json"
  if [ ! -f "$pkg" ]; then
    echo "npm start"
    return
  fi

  # Check for specific frameworks in dependencies
  if grep -q '"next"' "$pkg"; then
    echo "$PM run dev"
    return
  fi
  if grep -q '"astro"' "$pkg"; then
    echo "$PM run dev"
    return
  fi
  if grep -q '"vite"' "$pkg" || grep -q '"@vitejs/plugin-react"' "$pkg"; then
    echo "$PM run dev"
    return
  fi
  if grep -q '"@sveltejs/kit"' "$pkg"; then
    echo "$PM run dev"
    return
  fi
  if grep -q '"nuxt"' "$pkg"; then
    echo "$PM run dev"
    return
  fi

  # Check if "dev" script exists
  if grep -q '"dev"' "$pkg"; then
    echo "$PM run dev"
    return
  fi

  # Fallback
  echo "$PM start"
}

detect_framework() {
  local pkg="$WORKSPACE/package.json"
  if grep -q '"next"' "$pkg" 2>/dev/null; then echo "nextjs"; return; fi
  if grep -q '"astro"' "$pkg" 2>/dev/null; then echo "astro"; return; fi
  if grep -q '"vite"' "$pkg" 2>/dev/null; then echo "vite"; return; fi
  if grep -q '"@sveltejs/kit"' "$pkg" 2>/dev/null; then echo "sveltekit"; return; fi
  if grep -q '"nuxt"' "$pkg" 2>/dev/null; then echo "nuxt"; return; fi
  if grep -q '"vue"' "$pkg" 2>/dev/null; then echo "vue"; return; fi
  if grep -q '"react"' "$pkg" 2>/dev/null; then echo "react"; return; fi
  echo "unknown"
}

DEV_CMD=$(detect_dev_command)
FRAMEWORK=$(detect_framework)
echo "[layrr-container] Framework: $FRAMEWORK"
echo "[layrr-container] Dev command: $DEV_CMD"

# ---- Init git for layrr (needs at least one commit) ----
cd "$WORKSPACE"
git config user.email "layrr@layrr.dev"
git config user.name "Layrr"

# ---- Start dev server in background ----
echo "[layrr-container] Starting dev server..."
$DEV_CMD --port 3000 &
DEV_PID=$!

# Wait for dev server to be ready
echo "[layrr-container] Waiting for dev server on port 3000..."
for i in $(seq 1 60); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "[layrr-container] Dev server ready!"
    break
  fi
  sleep 2
done

# ---- Start layrr proxy ----
echo "[layrr-container] Starting layrr proxy on port ${LAYRR_PROXY_PORT:-4567}..."
exec node /opt/layrr/dist/cli.js --port 3000 --proxy-port "${LAYRR_PROXY_PORT:-4567}" --no-open --agent claude
