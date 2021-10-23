#!/usr/bin/env bash

mkdir -p build/zip
pushd build/zip

clang \
    -c \
    --target=wasm32 -nostdlib -O1 -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG \
    -fvisibility=hidden \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fwasm-exceptions \
    -I../../../contrib/zlib \
    -Wall \
    --sysroot=${WASI_SDK_HOME}/share/wasi-sysroot \
    ../../../contrib/zip/src/*.c \
    ../../../contrib/zlib/*.c \
    ../../../contrib/unzip/*.c \

llvm-ar \
    rc ./zip.a \
    *.o

popd


