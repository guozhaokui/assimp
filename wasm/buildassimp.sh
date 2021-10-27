#!/usr/bin/env bash

mkdir -p build
pushd build

clang++ -c\
    --sysroot ${WASI_SDK_HOME}/share/wasi-sysroot \
    --target=wasm32 -nostdlib -g -DWEBASM -DASSIMP_BUILD_SINGLETHREADED -D__wasi__ -DNDEBUG  \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fvisibility=hidden \
    -fwasm-exceptions \
    -std=c++11 \
    -I../../include \
    -Wall \
    ../test.cpp \
    


popd


