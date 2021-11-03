#include <assimp/postprocess.h> // Post processing flags
#include <assimp/scene.h> // Output data structure
#include <wasi/libc.h>
#include <wasi/api.h>
#include <assimp/DefaultLogger.hpp>
#include <assimp/Exporter.hpp>
#include <assimp/IOStream.hpp>
#include <assimp/IOSystem.hpp>
#include <assimp/Importer.hpp> // C++ importer interface

#define WASM_EXP(e) __attribute__((export_name(#e)))

#define __WASM_SYSCALL_NAME(name) \
    __attribute__((__import_module__("JSRT"), __import_name__(#name)))

bool DoTheImportThing(const char *pFile, const char* outfile);

void *data = nullptr;
int dataLength = 0;

extern "C" {
    // 导入函数
    void jslogs(const char *str) __WASM_SYSCALL_NAME(logs);
    void jslog(const char *str, int len, float f1, float f2, float f3) __WASM_SYSCALL_NAME(log);

    int jsLoadFile(const char *f) __WASM_SYSCALL_NAME(loadFile);
    aiReturn jsSeek(int id, size_t pOffset, aiOrigin pOrigin) __WASM_SYSCALL_NAME(seek);
    // -1表示不存在
    size_t jsFileSize(int id) __WASM_SYSCALL_NAME(filesize);
    // 读取文件id，到outptr中，请求长度为len，outptr已经分配好了，返回实际读的大小
    size_t jsReadFile(int id, int start,void* outptr, int len) __WASM_SYSCALL_NAME(readFile);
    size_t jsTell(int id) __WASM_SYSCALL_NAME(tell);
    void jsFlush(int id) __WASM_SYSCALL_NAME(flush);


    void importToJSON(char* file, char* outfile) WASM_EXP(importToJSON) {
        DoTheImportThing(file, outfile);
    }

    void *_malloc(int sz) WASM_EXP(_malloc) {
        void *ptr = malloc(sz);
        return ptr;
    }

    void _free(void *ptr) WASM_EXP(_free) {
        free(ptr);
    }

    void setData(int ptr, int length) WASM_EXP(setData) {
        data = (void *)ptr;
        dataLength = length;
    }

    void regPath(char* path, int id) WASM_EXP(regPath){
        __wasilibc_register_preopened_fd(id, path);
    }

    void* _new__wasi_filestat_t() WASM_EXP(_new__wasi_filestat_t){
        return malloc(sizeof(__wasi_filestat_t));
    }
    void _set__wasi_filestat_t_info(void* ptr, int filetype, int filesize) WASM_EXP(_set__wasi_filestat_t_info){
        __wasi_filestat_t* p = (__wasi_filestat_t*)ptr;
        p->filetype = filetype;
        p->size=filesize;
    }

}

// My own implementation of IOStream
class MyIOStream : public Assimp::IOStream {
    friend class MyIOSystem;

public:
    std::string file;
    char *pBuffer;
    int length;
    int fid=0;
private:
    //char *pCurPtr;
    int dataPtr=0;

protected:
    // Constructor protected for private usage by MyIOSystem
    MyIOStream(const char *pf) {
        file.assign(pf);
        fid = jsLoadFile(pf);
        length = jsFileSize(fid);
        //leftData = dataLength;
        //pCurPtr = (char *)data;
    }

public:
    virtual ~MyIOStream() {
    }

    // psize 是每个元素的大小。pcount是多少个元素
    size_t Read(void *pvBuffer, size_t pSize, size_t pCount) {
        if(dataPtr>=length) return 0;
        int read = jsReadFile(fid, dataPtr, pvBuffer, pSize*pCount);
        dataPtr+=read;
        return read;
        /*
        int n = pSize * pCount;
        int rlen = n < leftData ? n : leftData;
        memcpy(pvBuffer, pCurPtr, rlen);
        pCurPtr += rlen;
        leftData -= rlen;
        if (leftData < 0) leftData = 0;
        return rlen;
        */
    }

    size_t Write(const void *pvBuffer, size_t pSize, size_t pCount) {
        return 0;
    }

    aiReturn Seek(size_t pOffset, aiOrigin pOrigin) {
        jslogs("seek");
        return jsSeek(fid, pOffset, pOrigin);
    }

    size_t Tell() const {
        jslogs("tell");
        return jsTell(fid);
    }

    size_t FileSize() const {
        jslogs("FileSize");
        return jsFileSize(fid);
        //return dataLength;
    }

    void Flush() {
        jsFlush(fid);
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

bool DoTheImportThing(const char *pFile, const char* outfile) {
    // 先注册文件
    //__wasilibc_register_preopened_fd(101, "xx");
    //__wasilibc_register_preopened_fd(102, "test");

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
    exp.Export(scene, "assjson", outfile);
    // globalExporter = &exp;

    // Now we can access the file's contents.
    // DoTheSceneProcessing( scene);
    // We're done. Everything will be cleaned up by the importer destructor
    return true;
}
