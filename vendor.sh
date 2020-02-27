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

mkdir -p node_modules

if [[ "${1:-}" == "out" ]]; then
    touch node_modules/.vendor.installed
    hash="$(vendorhash)"
    if [[ "$(cat node_modules/.vendor.installed)" == "$hash" ]]; then
        echo "Vendor install up to date" >&2
    else
        echo "Vendoring out" >&2
        # Die in a fire NPM!
        #
        # 2 things here:
        #
        # - We *must* cd to 'vendor', because 'npm install vendor/*.tgz' will make it think
        # all arguments with a single slash in it are NPM packges or GitHub addresses.
        #
        # - We *must* --save to 'package.json' because otherwise 'npm install' will disregard
        # other requirements and happily deinstall 'source-map-support', for example.
        # Since we don't actually want the tarballs referenced in package.json (this is a hack!)
        # we have to copy package.json out, do the manipulation, and then copy it back.
        cp package.{json,json.bak}
        (cd vendor && npm install --save *.tgz && npm install)
        mv package.{json.bak,json}
        echo "$hash" > node_modules/.vendor.installed
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
    npm run build
else
    echo "Wut?" >&2
    exit 1
fi
