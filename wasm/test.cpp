#include <assimp/postprocess.h> // Post processing flags
#include <assimp/scene.h> // Output data structure
#include <assimp/IOStream.hpp>
#include <assimp/IOSystem.hpp>
#include <assimp/Importer.hpp> // C++ importer interface

#define WASM_EXP __attribute__((visibility("default")))
#define __BTWASM_SYSCALL_NAME(name) \
    __attribute__((__import_module__("BTJSRT"), __import_name__(#name)))

bool DoTheImportThing(const char *pFile);

extern "C" {
// 导入函数
void jslogs(const char *str) __BTWASM_SYSCALL_NAME(logs);
void jslog(const char *str, int len, float f1, float f2, float f3) __BTWASM_SYSCALL_NAME(log);

void jsLoadFile(const char* f) __BTWASM_SYSCALL_NAME(loadFile);;

void WASM_EXP test() {
    DoTheImportThing("/test/tt.fbx");
}

void* _malloc(int sz) {
    return malloc(sz);
}

void _delete(void* ptr) {
    delete ptr;
}
}

// My own implementation of IOStream
class MyIOStream : public Assimp::IOStream {
    friend class MyIOSystem;

public:    
    std::string file;
    char* pBuffer;
    int length;
protected:
    // Constructor protected for private usage by MyIOSystem
    MyIOStream(const char* pf) {
      file.assign(pf);
      jsLoadFile(pf);
    }

public:
    virtual ~MyIOStream() {
    }

    // psize 是每个元素的大小。pcount是多少个元素
    size_t Read(void *pvBuffer, size_t pSize, size_t pCount) {
      jslogs((char*)pvBuffer);
      return 0;
    }

    size_t Write(const void *pvBuffer, size_t pSize, size_t pCount) {
    }

    aiReturn Seek(size_t pOffset, aiOrigin pOrigin) {
      jslogs((char*)555);
    }

    size_t Tell() const {
      jslogs((char*)333);
    }
    size_t FileSize() const {
      jslogs((char*)444);
    }

    void Flush() {
    }
};

// Fisher Price - My First Filesystem
class MyIOSystem : public Assimp::IOSystem {
public:
    MyIOSystem() {
    }
    virtual ~MyIOSystem() {
    }

    // Check whether a specific file exists
    virtual bool Exists(const char *pFile) const {
        jslogs((char *)22);
        return true;
    }

    // Get the path delimiter character we'd like to see
    virtual char getOsSeparator() const {
        return '/';
    }

    //  and finally a method to open a custom stream
    virtual Assimp::IOStream *Open(const char *pFile, const char *pMode = "rb") {
        return new MyIOStream(pFile);
    }

    void Close(Assimp::IOStream *pFile) { delete pFile; }
};

bool DoTheImportThing(const char *pFile) {
    // Create an instance of the Importer class
    Assimp::Importer importer;

    // the import process will now use this implementation to access any file
    // importer.ReadFile( pFile, SomeFlag | SomeOtherFlag);

    jslogs((char *)&importer);

    // put my custom IO handling in place
    importer.SetIOHandler(new MyIOSystem());


    // And have it read the given file with some example postprocessing
    // Usually - if speed is not the most important aspect for you - you'll
    // probably to request more postprocessing than we do in this example.
    const aiScene *scene = importer.ReadFile(pFile,
            aiProcess_CalcTangentSpace |
                    aiProcess_Triangulate |
                    aiProcess_JoinIdenticalVertices |
                    aiProcess_SortByPType);

    // If the import failed, report it
    if (nullptr != scene) {
        // DoTheErrorLogging( importer.GetErrorString());
        return false;
    }

    // Now we can access the file's contents.
    // DoTheSceneProcessing( scene);
    // We're done. Everything will be cleaned up by the importer destructor
    return true;
}
