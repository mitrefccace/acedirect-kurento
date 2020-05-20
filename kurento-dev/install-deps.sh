#!/bin/bash

export DEBIAN_FRONTEND=noninteractive

DIRS=(
    kurento-module-creator
    kms-cmake-utils
    kms-jsonrpc
    kms-core
    kms-elements
    kms-filters
    kurento-media-server
)

for DIR in "${DIRS[@]}"; do
    echo "+ Install Build-Depends for '${DIR}'"
    mk-build-deps --install --remove \
        --tool='apt-get -o Debug::pkgProblemResolver=yes --no-install-recommends --yes' \
        "${DIR}/debian/control"
done