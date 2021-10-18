#include <assimp/cimport.h>        // Plain-C interface
#include <assimp/scene.h>          // Output data structure
#include <assimp/postprocess.h>    // Post processing flags

#define WASM_EXP __attribute__((visibility("default")))
#define __BTWASM_SYSCALL_NAME(name) \
	__attribute__((__import_module__("BTJSRT"), __import_name__(#name)))


bool DoTheImportThing( const char* pFile) {
// Start the import on the given file with some example postprocessing
// Usually - if speed is not the most important aspect for you - you'll t
// probably to request more postprocessing than we do in this example.
const struct aiScene* scene = aiImportFile( pFile,
    aiProcess_CalcTangentSpace       |
    aiProcess_Triangulate            |
    aiProcess_JoinIdenticalVertices  |
    aiProcess_SortByPType);

// If the import failed, report it
if( NULL != scene) {
    return false;
}

// Now we can access the file's contents
//DoTheSceneProcessing( scene);

// We're done. Release all resources associated with this import
aiReleaseImport( scene);
return true;
}


extern "C"{
	void WASM_EXP test(){
        DoTheImportThing("");
	}
}

