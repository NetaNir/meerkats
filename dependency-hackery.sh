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
tarball=tx-aws-cdk-deps.tar.gz
to_archive="node_modules/@aws-cdk"
if [[ "${CODEBUILD_BUILD_ARN:-}" != "" ]]; then
    if [[ -f $tarball ]]; then
        echo "Unpacking deps from ${tarball}" >&2
        tar xzf $tarball
    fi
else
    echo "Stashing deps into ${tarball}" >&2
    tar czf $tarball $to_archive
fi
