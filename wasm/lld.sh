#!/usr/bin/env bash

mkdir -p build
pushd build


    
# --strip-all 会去掉符号
#    --strip-debug \ -S
#    --compress-relocations \
# --lto-O3 --no-entry -lc -lc++ -lc++abi -lc-printscan-long-double \
${WASI_SDK_HOME}/bin/wasm-ld        \
     --no-entry -lc -lc++ -lc++abi -lc-printscan-long-double \
     --lto-O3 \
    --import-memory \
    --gc-sections \
    --allow-undefined-file=../jslib.imports \
    -L${WASI_SDK_HOME}/share/wasi-sysroot/lib/wasm32-wasi \
    ./AssetLib/FBX/fbx.a \
    ./zip/zip.a \
    ./Common/Common.a \
    ./PostProcessing/PostProcessing.a \
    *.o\
    -o assimp.wasm

popd


