#!/usr/bin/env bash

mkdir -p build
pushd build

clang++ -c\
    --target=wasm32 -nostdlib -O3 -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG -DNO_OPENGL3 \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fvisibility=hidden \
    -fwasm-exceptions \
    -std=c++11 \
    -I../../include \
    -Wall \
    --sysroot=${WASI_SDK_HOME}/share/wasi-sysroot \
    ../test.cpp \
    
#jslib.imports 中的符号在运行时连接
# --strip-all 会去掉符号
#    --strip-debug \ -S
#    --compress-relocations \

wasm-ld        \
    --lto-O3 --no-entry\
    --allow-undefined-file=../jslib.imports \
    --import-memory \
    --export=test \
    --export-dynamic \
    ../build/AssetLib/FBX/fbx.a \
    ../build/Common/Common.a \
    ../build/PostProcessing/PostProcessing.a \
    *.o\
    -o bullet.wasm

popd


