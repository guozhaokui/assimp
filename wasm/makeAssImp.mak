GCC=clang
CFLAGS=--target=wasm32 -nostdlib -Wl,--no-entry -O3 -DWEBASM -DSINGLE_THREAD -DBT_USE_DOUBLE_PRECISION -D__wasi__ -DNDEBUG -DNO_OPENGL3\
-Wl,--export-all -Wl,--lto-O3 \
-I../../src 

CPPFLAGS=${CFLAGS} -std=c++11 


SRCS = \
../../src/LinearMath/btAlignedAllocator.cpp \


BCS = $(SRCS:.cpp=.o)

all: build 
include $(SRCS:.cpp=.d)

build: $(BCS)
	$(GCC) $(CPPFLAGS) $(BCS)

%.bc: %.cpp
	$(GCC) $(CPPFLAGS) $< -o $@
	
# https://www.gnu.org/software/make/manual/html_node/Automatic-Prerequisites.html
%.o: %.cpp
	@set -e; rm -f $@; \
	$(GCC) -MM $(CPPFLAGS) $< > $@.$$$$; \
	sed 's,\($*\)\.o[ :]*,\1.bc $@ : ,g' < $@.$$$$ > $@; \
	rm -f $@.$$$$

clean:
	find ../../../source -name "*.bc" | xargs rm -f

