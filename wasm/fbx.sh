#!/usr/bin/env bash

mkdir -p build/AssetLib/FBX
pushd build/AssetLib/FBX

clang++ \
    -c \
    --target=wasm32 -nostdlib -g -DWEBASM -DASSIMP_BUILD_SINGLETHREADED -D__wasi__ -DNDEBUG \
    -fvisibility=hidden \
    -mthread-model single \
    -fno-threadsafe-statics \
    -fwasm-exceptions \
    -std=c++11 \
    -I../../../../code/AssetLib/FBX \
    -I../../../../include \
    -Wall \
    --sysroot=${WASI_SDK_HOME}/share/wasi-sysroot \
    ../../../../code/AssetLib/FBX/*.cpp \
    ../../../../code/AssetLib/Assjson/*.cpp \

# 用c++编译c会有链接问题
clang \
    -c \
    --target=wasm32 -nostdlib -g -DWEBASM -DASSIMP_BUILD_SINGLETHREADED -D__wasi__ -DNDEBUG \
    -fvisibility=hidden \
    -I../../../../include \
    -Wall \
    --sysroot=${WASI_SDK_HOME}/share/wasi-sysroot \
    ../../../../code/AssetLib/Assjson/*.c \


llvm-ar \
    rc ./fbx.a \
    *.o

popd


