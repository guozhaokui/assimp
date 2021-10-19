#!/usr/bin/env bash

mkdir -p build
pushd build

clang++ -c\
    --target=wasm32 -nostdlib -O3 -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG  \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fvisibility=hidden \
    -fwasm-exceptions \
    -std=c++11 \
    -I../../include \
    -Wall \
    --sysroot=${WASI_SDK_HOME}/share/wasi-sysroot \
    ../test.cpp \
    
# --strip-all 会去掉符号
#    --strip-debug \ -S
#    --compress-relocations \

wasm-ld        \
    --lto-O3 --no-entry\
    --import-memory \
    --export-dynamic \
    ../build/AssetLib/FBX/fbx.a \
    ../build/Common/Common.a \
    ../build/PostProcessing/PostProcessing.a \
    *.o\
    -o assimp.wasm

popd


