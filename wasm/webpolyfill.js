
var Module = typeof Module !== 'undefined' ? Module : {};

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function setInstance(instance,mem) {
  currentInstance = instance;
  updateGuestBuffer(mem);
}

/// We call updateGuestBuffer any time the guest's memory may have changed,
/// such as when creating a new instance, or after calling _malloc.
function updateGuestBuffer(mem) {
  var buf = mem.buffer || currentInstance.exports.memory.buffer;
  Module['buffer'] = buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}



// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function warnOnce(text) {
    if (!warnOnce.shown) warnOnce.shown = {};
    if (!warnOnce.shown[text]) {
      warnOnce.shown[text] = 1;
      err(text);
    }
  }

  
  var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));  


  
var WASIPolyfill = {

  args_get: function(argv, argv_buf) {
      return 0;
  },
  
  args_sizes_get: function(argc, argv_buf_size) {
      updateGuestBuffer();
  
      // TODO: Implement command-line arguments.
      GUEST_HEAP32[(argc) >> 2] = 0;
      GUEST_HEAP32[(argv_buf_size) >> 2] = 0;
      return 0;
  },
  
  clock_res_get: function(clock_id, resolution) {
      let host_resolution = _malloc(8);
      let ret = ___wasi_clock_res_get(clock_id, host_resolution);
      copyout_i64(resolution, host_resolution);
      return ret;
  },
  
  clock_time_get: function(clock_id, precision, time) {
      let host_time = _malloc(8);
      let ret = ___wasi_clock_time_get(clock_id, precision, host_time);
      copyout_i64(time, host_time);
      return ret;
  },
  
  environ_get: function(environ, environ_buf) {
      return 0;
  },
  
  environ_sizes_get: function(environ_size, environ_buf_size) {
      updateGuestBuffer();
  
      // TODO: Implement environment variables.
      GUEST_HEAP32[(environ_size) >> 2] = 0;
      GUEST_HEAP32[(environ_buf_size) >> 2] = 0;
      return 0;
  },
  
  fd_prestat_get: function(fd, buf) {
      let host_buf = _malloc(8); // sizeof __wasi_prestat_t
      let ret = ___wasi_fd_prestat_get(fd, host_buf);
      copyout_bytes(buf, host_buf, 8);
      return ret;
  },
  
  fd_prestat_dir_name: function(fd, path, path_len) {
      let host_buf = _malloc(path_len);
      let ret = ___wasi_fd_prestat_get(fd, host_buf, path_len);
      copyout_bytes(buf, host_buf, path_len);
      return ret;
  },
  
  fd_close: function(fd) {
      return ___wasi_fd_close(fd);
  },
  
  fd_datasync: function(fd) {
      return ___wasi_fd_datasync(fd);
  },
  
  fd_pread: function(fd, iovs, iovs_len, offset, nread) {
      let host_iovs = translate_iovs(iovs, iovs_len);
      let host_nread = _malloc(4);
      let ret = ___wasi_fd_pread(fd, host_iovs, iovs_len, offset, host_nread);
      copyout_i32(nread, host_nread);
      free_iovs(host_iovs, iovs_len);
      return ret;
  },
  
  fd_pwrite: function(fd, iovs, iovs_len, offset, nwritten) {
      let host_iovs = translate_ciovs(iovs, iovs_len);
      let host_nwritten = _malloc(4);
      let ret = ___wasi_fd_pwrite(fd, host_iovs, iovs_len, offset, host_nwritten);
      copyout_i32(nwritten, host_nwritten);
      free_ciovs(host_iovs, iovs_len);
      return ret;
  },
  
  fd_read: function(fd, iovs, iovs_len, nread) {
      let host_iovs = translate_iovs(iovs, iovs_len);
      let host_nread = _malloc(4);
      let ret = ___wasi_fd_read(fd, host_iovs, iovs_len, host_nread);
      copyout_i32(nread, host_nread);
      free_iovs(host_iovs, iovs_len);
      return ret;
  },
  
  fd_renumber: function(from, to) {
      return ___wasi_fd_renumber(from, to);
  },
  
  fd_seek: function(fd, offset, whence, newoffset) {
      let host_newoffset = _malloc(8);
      let ret = ___wasi_fd_seek(fd, offset, whence, host_newoffset);
      copyout_i64(newoffset, host_newoffset);
      return ret;
  },
  
  fd_tell: function(fd, newoffset) {
      let host_newoffset = _malloc(8);
      let ret = ___wasi_fd_seek(fd, host_newoffset);
      copyout_i64(newoffset, host_newoffset);
      return ret;
  },
  
  fd_fdstat_get: function(fd, buf) {
      let host_buf = _malloc(24); // sizeof __wasi_fdstat_t
      let ret = ___wasi_fd_fdstat_get(fd, host_buf);
      copyout_bytes(buf, host_buf, 24);
      return ret;
  },
  
  fd_fdstat_set_flags: function(fd, flags) {
      return ___wasi_fd_fdstat_set_flags(fd, flags);
  },
  
  fd_fdstat_set_rights: function(fd, fs_rights_base, fs_rights_inheriting) {
      return ___wasi_fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting);
  },
  
  fd_sync: function(fd) {
      return ___wasi_fd_sync(fd);
  },
  
  fd_write: function(fd, iovs, iovs_len, nwritten) {
      let host_iovs = translate_ciovs(iovs, iovs_len);
      let host_nwritten = _malloc(4);
      let ret = ___wasi_fd_write(fd, host_iovs, iovs_len, host_nwritten);
      copyout_i32(nwritten, host_nwritten);
      free_ciovs(host_iovs, iovs_len);
      return ret;
  },
  
  fd_advise: function(fd, offset, len, advice) {
      return ___wasi_fd_advise(fd, offset, len, advice);
  },
  
  fd_allocate: function(fd, offset, len) {
      return ___wasi_fd_allocate(fd, offset, len);
  },
  
  path_create_directory: function(fd, path, path_len) {
      let host_path = copyin_bytes(path, path_len);
      let ret = ___wasi_path_create_directory(fd, host_path, path_len);
      _free(host_path);
      return ret;
  },
  
  path_link: function(fd0, path0, path_len0, fd1, path1, path_len1) {
      let host_path0 = copyin_bytes(path0, path_len0);
      let host_path1 = copyin_bytes(path1, path_len1);
      let ret = ___wasi_path_link(fd, host_path0, path_len0, fd1, host_path1, path1_len);
      _free(host_path1);
      _free(host_path0);
      return ret;
  },
  
  path_open: function(dirfd, dirflags, path, path_len, oflags, fs_rights_base, fs_rights_inheriting, fs_flags, fd) {
      let host_path = copyin_bytes(path, path_len);
      let host_fd = _malloc(4);
      let ret = ___wasi_path_open(dirfd, dirflags, host_path, path_len, oflags, fs_rights_base, fs_rights_inheriting, fs_flags, host_fd);
      copyout_i32(fd, host_fd);
      _free(host_path);
      return ret;
  },
  
  fd_readdir: function(fd, buf, buf_len, cookie, buf_used) {
      let host_buf = _malloc(buf_len);
      let host_buf_used = _malloc(4);
      let ret = ___wasi_fd_readdir(fd, buf, buf_len, cookie, host_buf_used);
      copyout_i32(buf_used, host_buf_used);
      copyout_bytes(buf, host_buf, buf_len);
      return ret;
  },
  
  path_readlink: function(fd, path, path_len, buf, buf_len, buf_used) {
      let host_path = copyin_bytes(path, path_len);
      let host_buf = _malloc(buf_len);
      let host_buf_used = _malloc(4);
      let ret = ___wasi_path_readlink(fd, path, path_len, buf, buf_len, host_buf_used);
      copyout_i32(buf_used, host_buf_used);
      copyout_bytes(buf, host_buf, buf_len);
      _free(host_path);
      return ret;
  },
  
  path_rename: function(fd0, path0, path_len0, fd1, path1, path_len1) {
      let host_path0 = copyin_bytes(path0, path_len0);
      let host_path1 = copyin_bytes(path1, path_len1);
      let ret = ___wasi_path_rename(fd, host_path0, path_len0, fd1, host_path1, path1_len);
      _free(host_path1);
      _free(host_path0);
      return ret;
  },
  
  fd_filestat_get: function(fd, buf) {
      let host_buf = _malloc(56); // sizeof __wasi_filestat_t
      let ret = ___wasi_fd_filestat_get(host_buf);
      copyout_bytes(buf, host_buf, 56);
      return ret;
  },
  
  fd_filestat_set_size: function(fd, size) {
      return ___wasi_fd_filestat_set_size(fd, size);
  },
  
  fd_filestat_set_times: function(fd, st_atim, st_mtim, fstflags) {
      return ___wasi_fd_filestat_set_times(fd, st_atim, st_mtim, fstflags);
  },
  
  path_filestat_get: function(fd, path, path_len, buf) {
      let host_path = copyin_bytes(path, path_len);
      let host_buf = _malloc(56); // sizeof __wasi_filestat_t
      let ret = ___wasi_path_filestat_get(fd, host_path, path_len, host_buf);
      copyout_bytes(buf, host_buf, 56);
      _free(host_path);
      return ret;
  },
  
  path_filestat_set_times: function(fd, path, path_len, st_atim, st_mtim, flags) {
      let host_path = copyin_bytes(path, path_len);
      let ret = ___wasi_path_filestat_set_times(fd, host_path, st_atim, st_mtim, fstflags);
      _free(host_path);
      return ret;
  },
  
  path_symlink: function(path0, path_len0, fd, path1, path_len1) {
      let host_path0 = copyin_bytes(path0, path0_len);
      let host_path1 = copyin_bytes(path1, path1_len);
      let ret = ___wasi_path_symlink(host_path0, path_len0, fd, host_path1, path_len1);
      _free(host_path1);
      _free(host_path0);
      return ret;
  },
  
  path_unlink_file: function(fd, path, path_len, flags) {
      let host_path = copyin_bytes(path, path_len);
      let ret = ___wasi_path_unlink_file(fd, host_path, path_len, flags);
      _free(host_path);
      return ret;
  },
  
  path_remove_directory: function(fd, path, path_len, flags) {
      let host_path = copyin_bytes(path, path_len);
      let ret = ___wasi_path_remove_directory(fd, host_path, path_len, flags);
      _free(host_path);
      return ret;
  },
  
  poll_oneoff: function(in_, out, nsubscriptions, nevents) {
      let host_in = copyin_bytes(in_, nsubscriptions * 56); // sizeof __wasi_subscription_t
      let host_out = _malloc(nsubscriptions * 32); // sizeof __wasi_event_t
      let host_nevents = _malloc(4);
      let ret = ___wasi_poll_oneoff(host_in, host_out, host_nevents);
      copyout_bytes(out, host_out, nsubscriptions * 32);
      copyout_i32(nevents, host_nevents);
      _free(host_in);
      return ret;
  },
  
  proc_exit: function(rval) {
      let message;
      if (rval == 0) {
          message = "success";
      } else {
          message = "error code " + rval;
      }
      throw new WASIExit(rval, message);
  },
  
  proc_raise: function(sig) {
      if (sig == 18 || // SIGSTOP
          sig == 19 || // SIGTSTP
          sig == 20 || // SIGTTIN
          sig == 21 || // SIGTTOU
          sig == 22 || // SIGURG
          sig == 16 || // SIGCHLD
          sig == 13)   // SIGPIPE
      {
        return 0;
      }
  
      let message = "raised signal " + sig;
      throw new WASIExit(128 + sig, message);
  },
  
  random_get: function(buf, buf_len) {
      let host_buf = _malloc(buf_len);
      let ret = ___wasi_random_get(host_buf, buf_len);
      copyout_bytes(buf, host_buf, buf_len);
      return ret;
  },
  
  sched_yield: function() {
      return ___wasi_sched_yield();
  },
  
  sock_recv: function(sock, ri_data, ri_data_len, ri_flags, ro_datalen, ro_flags) {
      let host_ri_data = translate_iovs(ri_data, ri_data_len);
      let host_ro_datalen = _malloc(4);
      let ret = ___wasi_sock_recv(sock, host_ri_data, ri_data_len, ri_flags, host_ro_data, ro_flags);
      copyout_i32(ro_datalen, host_ro_datalen);
      free_iovs(host_ri_data, ri_data_len);
      return ret;
  },
  
  sock_send: function(sock, si_data, si_data_len, si_flags, so_datalen) {
      let host_si_data = translate_ciovs(si_data, si_data_len);
      let host_so_datalen = _malloc(4);
      let ret = ___wasi_sock_send(sock, host_si_data, si_data_len, si_flags, host_so_datalen);
      copyout_i32(so_datalen, host_so_datalen);
      free_ciovs(host_si_data, si_data_len);
      return ret;
  },
  
  sock_shutdown: function(sock, how) {
      return ___wasi_sock_shutdown(sock, how);
  }
  
  };



  /** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

function abort(what){
  throw 'abort'+what;
}

function memcpy(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
}

function cpyUint8(dest, uint8){
  HEAPU8.set(uint8, dest);
}