#!/usr/bin/env bash

mkdir -p build
pushd build

clang++ -c\
    --sysroot ${WASI_SDK_HOME}/share/wasi-sysroot \
    --target=wasm32 -nostdlib -g -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG  \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fvisibility=hidden \
    -fwasm-exceptions \
    -std=c++11 \
    -I../../include \
    -Wall \
    ../test.cpp \
    
# --strip-all 会去掉符号
#    --strip-debug \ -S
#    --compress-relocations \
# --lto-O3 --no-entry -lc -lc++ -lc++abi -lc-printscan-long-double \
wasm-ld        \
     --no-entry -lc -lc++ -lc++abi -lc-printscan-long-double \
    --import-memory \
    --export-dynamic \
    --allow-undefined-file=../jslib.imports \
    -L${WASI_SDK_HOME}/share/wasi-sysroot/lib/wasm32-wasi \
    ./AssetLib/FBX/fbx.a \
    ./zip/zip.a \
    ./Common/Common.a \
    ./PostProcessing/PostProcessing.a \
    *.o\
    -o assimp.wasm

popd


