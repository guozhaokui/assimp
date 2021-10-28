#include <assimp/postprocess.h> // Post processing flags
#include <assimp/scene.h> // Output data structure
#include <assimp/IOStream.hpp>
#include <assimp/IOSystem.hpp>
#include <assimp/DefaultLogger.hpp>
#include <assimp/Importer.hpp> // C++ importer interface
#include <assimp/Exporter.hpp>
#include <wasi/libc.h>

#define WASM_EXP(e)  __attribute__((export_name(#e)))

#define __WASM_SYSCALL_NAME(name) \
    __attribute__((__import_module__("JSRT"), __import_name__(#name)))

bool DoTheImportThing(const char *pFile);

void* data=nullptr;
int dataLength=0;

extern "C" {
// 导入函数
void jslogs(const char *str) __WASM_SYSCALL_NAME(logs);
void jslog(const char *str, int len, float f1, float f2, float f3) __WASM_SYSCALL_NAME(log);

void jsLoadFile(const char* f) __WASM_SYSCALL_NAME(loadFile);;
aiReturn jsSeek(size_t pOffset, aiOrigin pOrigin) __WASM_SYSCALL_NAME(seek);
size_t jsTell() __WASM_SYSCALL_NAME(tell);
size_t jsFileSize() __WASM_SYSCALL_NAME(filesize);
void jsFlush() __WASM_SYSCALL_NAME(flush);

void test() WASM_EXP(test) {
    DoTheImportThing("/test/tt.fbx");
}

void*  _malloc(int sz) WASM_EXP(_malloc) {
    void* ptr = malloc(sz);
    return ptr;
}

void _free(void* ptr) WASM_EXP(_free) {
    free(ptr);
}

void setData(int ptr, int length) WASM_EXP(setData) {
    data =(void*) ptr;
    dataLength=length;
}
}



// My own implementation of IOStream
class MyIOStream : public Assimp::IOStream {
    friend class MyIOSystem;

public:    
    std::string file;
    char* pBuffer;
    int length;
private:
    char* pCurPtr;
    int   leftData;
protected:
    // Constructor protected for private usage by MyIOSystem
    MyIOStream(const char* pf) {
      file.assign(pf);
      jsLoadFile(pf);
      leftData = dataLength;
      pCurPtr=(char*)data;
    }

public:
    virtual ~MyIOStream() {
    }

    // psize 是每个元素的大小。pcount是多少个元素
    size_t Read(void *pvBuffer, size_t pSize, size_t pCount) {
      //jslogs((char*)pvBuffer);
      //return 0;
      int n = pSize*pCount;
      int rlen = n<leftData?n:leftData;
      memcpy(pvBuffer, pCurPtr, rlen);
      pCurPtr+=rlen;
      leftData-=rlen;
      if(leftData<0)leftData=0;
      return rlen;
    }

    size_t Write(const void *pvBuffer, size_t pSize, size_t pCount) {
        return 0;
    }

    aiReturn Seek(size_t pOffset, aiOrigin pOrigin) {
      jslogs("seek");
      return jsSeek(pOffset, pOrigin);
    }

    size_t Tell() const {
      jslogs("tell");
        return jsTell();
    }

    size_t FileSize() const {
      jslogs("FileSize");
      //return jsFileSize();
      return dataLength;
    }

    void Flush() {
        jsFlush();
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
        jslogs("Exists()");
        return true;
    }

    // Get the path delimiter character we'd like to see
    virtual char getOsSeparator() const {
        return '/';
    }

    //  and finally a method to open a custom stream
    virtual Assimp::IOStream *Open(const char *pFile, const char *pMode = "rb") {
        jslogs("Open()");
        jslogs(pFile);
        return new MyIOStream(pFile);
    }

    void Close(Assimp::IOStream *pFile) { delete pFile; }
};

bool DoTheImportThing(const char *pFile) {
    // 先注册文件
    __wasilibc_register_preopened_fd(101, "xx");


    Assimp::DefaultLogger::create("", Assimp::Logger::VERBOSE);

    // Create an instance of the Importer class
    Assimp::Importer importer;

    // the import process will now use this implementation to access any file
    // importer.ReadFile( pFile, SomeFlag | SomeOtherFlag);

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
    if (nullptr == scene) {
        // DoTheErrorLogging( importer.GetErrorString());
        return false;
    }

	Assimp::Exporter exp;
    exp.Export(scene,"assjson","/xx/xx");
	//globalExporter = &exp;

    // Now we can access the file's contents.
    // DoTheSceneProcessing( scene);
    // We're done. Everything will be cleaned up by the importer destructor
    return true;
}
