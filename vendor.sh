#!/bin/bash
# A hacky hacky (did I say hacky?) way to transport a devbranch to CodeBuild
#
# If this is run on a Dev machine, zip up node_modules/@aws-cdk into
# an archive that will be committed.
#
# If this is run on CodeBuild, unzip that archive back to the target location.
#
# This makes it possible to run with local dependencies w/ modifications on
# CodeBuild.
set -eu
mkdir -p vendor

# Return a hash of the vendor directory
vendorhash() {
    (cd vendor && sha256sum --binary *.tgz | sha256sum)
}

if [[ "${1:-}" == "out" ]]; then
    touch .vendor.installed
    hash="$(vendorhash)"
    if [[ "$(cat .vendor.installed)" == "$hash" ]]; then
        echo "Vendor install up to date" >&2
    else
        echo "Vendoring out" >&2
        (cd vendor && npm install --no-save *.tgz)
        echo "$hash" > .vendor.installed
    fi

elif [[ "${1:-}" == "in" ]]; then
    donor="${2:-}"
    if [[ "$donor" == "" ]]; then
        echo "Usage: vendor.sh in <PATH/TO/AWS-CDK>" >&2
        exit 1
    fi

    echo "Vendoring in from $donor" >&2

    lerna_scopes=$(node -p '[...Object.keys(require("./package.json").dependencies), ...require("./package.json").vendorAdditional || []].map(s => `--scope ${s}`).join(" ")')
    echo $lerna_scopes
    vendorpath=$(cd vendor && pwd)
    (
        cd $donor
        pkgdirs=$(npx lerna --no-private --include-dependencies $lerna_scopes ls -p)
        echo "Packing $pkgdirs" >&2
        for pkgdir in $pkgdirs; do
            (cd $pkgdir && mv $(npm pack --loglevel warn) $vendorpath)
        done
    )
    vendorhash > vendor.hash
else
    echo "Wut?" >&2
    exit 1
fi
