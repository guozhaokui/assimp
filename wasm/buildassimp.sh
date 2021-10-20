#!/usr/bin/env bash

mkdir -p build
pushd build

clang++ -c\
    --sysroot ${WASI_SDK_HOME}/share/wasi-sysroot \
    --target=wasm32 -nostdlib -O3 -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG  \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fvisibility=hidden \
    -fno-exceptions \
    -std=c++11 \
    -I../../include \
    -Wall \
    ../test.cpp \
    
# --strip-all 会去掉符号
#    --strip-debug \ -S
#    --compress-relocations \

wasm-ld        \
    --lto-O3 --no-entry -lc -lc++ -lc++abi -lc-printscan-long-double \
    --import-memory \
    --export-dynamic \
    -L${WASI_SDK_HOME}/share/wasi-sysroot/lib/wasm32-wasi \
    ./AssetLib/FBX/fbx.a \
    ./Common/Common.a \
    ./PostProcessing/PostProcessing.a \
    *.o\
    -o assimp.wasm

popd


