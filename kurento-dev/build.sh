#!/bin/bash

BUILD_TYPE=Debug
BUILD_DIR="build"

if [ ! -d $BUILD_DIR ]; then
    mkdir "$BUILD_DIR"
fi

cd "$BUILD_DIR"
cmake -DCMAKE_BUILD_TYPE=$BUILD_TYPE ..
export MAKEFLAGS="-j 4"
make
