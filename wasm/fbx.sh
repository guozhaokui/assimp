#!/usr/bin/env bash

mkdir -p build/AssetLib/FBX
pushd build/AssetLib/FBX

clang++ \
    -c \
    --target=wasm32 -nostdlib -O3 -DWEBASM -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG -DNO_OPENGL3 \
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
    

llvm-ar \
    rc ./fbx.a \
    *.o

popd


