#!/bin/bash
# Need this script because 'cdk deploy' won't run cdk-assets (yet)
set -euo pipefail

echo "[local-deploy.sh] Synth" >&2
npx cdk synth Dev-\*

echo "[local-deploy.sh] Assets" >&2
for f in cdk.out/Dev-*.assets.json; do
    npx cdk-assets --path $f publish --verbose
done

echo "[local-deploy.sh] Deploy" >&2
exec npx cdk deploy Dev-\*
