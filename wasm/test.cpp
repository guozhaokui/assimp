#include <assimp/Importer.hpp>      // C++ importer interface
#include <assimp/scene.h>           // Output data structure
#include <assimp/postprocess.h>     // Post processing flags

#define WASM_EXP __attribute__((visibility("default")))
#define __BTWASM_SYSCALL_NAME(name) \
	__attribute__((__import_module__("BTJSRT"), __import_name__(#name)))


bool DoTheImportThing( const char* pFile) {
  // Create an instance of the Importer class
/*
  Assimp::Importer importer;

  // And have it read the given file with some example postprocessing
  // Usually - if speed is not the most important aspect for you - you'll
  // probably to request more postprocessing than we do in this example.
  const aiScene* scene = importer.ReadFile( pFile,
    aiProcess_CalcTangentSpace       |
    aiProcess_Triangulate            |
    aiProcess_JoinIdenticalVertices  |
    aiProcess_SortByPType);

  // If the import failed, report it
  if (nullptr != scene) {
    //DoTheErrorLogging( importer.GetErrorString());
    return false;
  }

  // Now we can access the file's contents.
  //DoTheSceneProcessing( scene);
*/
  // We're done. Everything will be cleaned up by the importer destructor
  return true;
}


extern "C"{
	// 导入函数
	void jslogs(const char* str) __BTWASM_SYSCALL_NAME(logs);
	void jslog(const char* str, int len, float f1, float f2, float f3) __BTWASM_SYSCALL_NAME(log);

	void WASM_EXP test(){
        DoTheImportThing("");
        jslogs("a");
	}

}

