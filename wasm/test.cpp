#include <assimp/Importer.hpp>      // C++ importer interface
#include <assimp/scene.h>           // Output data structure
#include <assimp/postprocess.h>     // Post processing flags
#include <assimp/IOStream.hpp>
#include <assimp/IOSystem.hpp>


#define WASM_EXP __attribute__((visibility("default")))
#define __BTWASM_SYSCALL_NAME(name) \
	__attribute__((__import_module__("BTJSRT"), __import_name__(#name)))

bool DoTheImportThing(const char *pFile);

extern "C" {
// 导入函数
void jslogs(const char *str) __BTWASM_SYSCALL_NAME(logs);
void jslog(const char *str, int len, float f1, float f2, float f3) __BTWASM_SYSCALL_NAME(log);

void WASM_EXP test() {
    DoTheImportThing("");
    jslogs("a");
}
}

// My own implementation of IOStream
class MyIOStream : public Assimp::IOStream {
  friend class MyIOSystem;

protected:
  // Constructor protected for private usage by MyIOSystem
  MyIOStream();

public:
  ~MyIOStream();
  size_t Read( void* pvBuffer, size_t pSize, size_t pCount) {  }
  size_t Write( const void* pvBuffer, size_t pSize, size_t pCount) {  }
  aiReturn Seek( size_t pOffset, aiOrigin pOrigin) {  }
  size_t Tell() const {  }
  size_t FileSize() const {  }
  void Flush () {  }
};

// Fisher Price - My First Filesystem
class MyIOSystem : public Assimp::IOSystem {
  MyIOSystem() {  }
  ~MyIOSystem() {  }

  // Check whether a specific file exists
  bool Exists( const std::string& pFile) const {
  }

  // Get the path delimiter character we'd like to see
  char GetOsSeparator() const {
    return '/';
  }

  //  and finally a method to open a custom stream
  Assimp::IOStream* Open( const std::string& pFile, const std::string& pMode) {
    return new MyIOStream(  );
  }

  void Close( Assimp::IOStream* pFile) { delete pFile; }
};

bool DoTheImportThing( const char* pFile) {
  // Create an instance of the Importer class
  Assimp::Importer importer;
  jslogs((char*)&importer );
            /*

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



