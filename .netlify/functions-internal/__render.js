var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[Object.keys(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/@sveltejs/kit/dist/install-fetch.js
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
async function* toIterator(parts, clone2 = true) {
  for (const part of parts) {
    if ("stream" in part) {
      yield* part.stream();
    } else if (ArrayBuffer.isView(part)) {
      if (clone2) {
        let position = part.byteOffset;
        const end = part.byteOffset + part.byteLength;
        while (position !== end) {
          const size = Math.min(end - position, POOL_SIZE);
          const chunk = part.buffer.slice(position, position + size);
          position += chunk.byteLength;
          yield new Uint8Array(chunk);
        }
      } else {
        yield part;
      }
    } else {
      let position = 0;
      while (position !== part.size) {
        const chunk = part.slice(position, Math.min(part.size, position + POOL_SIZE));
        const buffer = await chunk.arrayBuffer();
        position += buffer.byteLength;
        yield new Uint8Array(buffer);
      }
    }
  }
}
function isFormData(object) {
  return typeof object === "object" && typeof object.append === "function" && typeof object.set === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.delete === "function" && typeof object.keys === "function" && typeof object.values === "function" && typeof object.entries === "function" && typeof object.constructor === "function" && object[NAME] === "FormData";
}
function getHeader(boundary, name, field) {
  let header = "";
  header += `${dashes}${boundary}${carriage}`;
  header += `Content-Disposition: form-data; name="${name}"`;
  if (isBlob(field)) {
    header += `; filename="${field.name}"${carriage}`;
    header += `Content-Type: ${field.type || "application/octet-stream"}`;
  }
  return `${header}${carriage.repeat(2)}`;
}
async function* formDataIterator(form, boundary) {
  for (const [name, value] of form) {
    yield getHeader(boundary, name, value);
    if (isBlob(value)) {
      yield* value.stream();
    } else {
      yield value;
    }
    yield carriage;
  }
  yield getFooter(boundary);
}
function getFormDataLength(form, boundary) {
  let length = 0;
  for (const [name, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name, value));
    length += isBlob(value) ? value.size : Buffer.byteLength(String(value));
    length += carriageLength;
  }
  length += Buffer.byteLength(getFooter(boundary));
  return length;
}
async function consumeBody(data) {
  if (data[INTERNALS$2].disturbed) {
    throw new TypeError(`body used already for: ${data.url}`);
  }
  data[INTERNALS$2].disturbed = true;
  if (data[INTERNALS$2].error) {
    throw data[INTERNALS$2].error;
  }
  let { body } = data;
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (isBlob(body)) {
    body = import_stream.default.Readable.from(body.stream());
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (!(body instanceof import_stream.default)) {
    return Buffer.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data.size > 0 && accumBytes + chunk.length > data.size) {
        const error2 = new FetchError(`content size at ${data.url} over limit: ${data.size}`, "max-size");
        body.destroy(error2);
        throw error2;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error2) {
    const error_ = error2 instanceof FetchBaseError ? error2 : new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error2.message}`, "system", error2);
    throw error_;
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer.from(accum.join(""));
      }
      return Buffer.concat(accum, accumBytes);
    } catch (error2) {
      throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error2.message}`, "system", error2);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
  }
}
function fromRawHeaders(headers = []) {
  return new Headers(headers.reduce((result, value, index, array) => {
    if (index % 2 === 0) {
      result.push(array.slice(index, index + 2));
    }
    return result;
  }, []).filter(([name, value]) => {
    try {
      validateHeaderName(name);
      validateHeaderValue(name, String(value));
      return true;
    } catch {
      return false;
    }
  }));
}
async function fetch(url, options_) {
  return new Promise((resolve2, reject) => {
    const request = new Request(url, options_);
    const options2 = getNodeRequestOptions(request);
    if (!supportedSchemas.has(options2.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${options2.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (options2.protocol === "data:") {
      const data = dataUriToBuffer$1(request.url);
      const response2 = new Response(data, { headers: { "Content-Type": data.typeFull } });
      resolve2(response2);
      return;
    }
    const send = (options2.protocol === "https:" ? import_https.default : import_http.default).request;
    const { signal } = request;
    let response = null;
    const abort = () => {
      const error2 = new AbortError("The operation was aborted.");
      reject(error2);
      if (request.body && request.body instanceof import_stream.default.Readable) {
        request.body.destroy(error2);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error2);
    };
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = () => {
      abort();
      finalize();
    };
    const request_ = send(options2);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = () => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    };
    request_.on("error", (error2) => {
      reject(new FetchError(`request to ${request.url} failed, reason: ${error2.message}`, "system", error2));
      finalize();
    });
    fixResponseChunkedTransferBadEnding(request_, (error2) => {
      response.body.destroy(error2);
    });
    if (process.version < "v14") {
      request_.on("socket", (s2) => {
        let endedWithEventsCount;
        s2.prependListener("end", () => {
          endedWithEventsCount = s2._eventsCount;
        });
        s2.prependListener("close", (hadError) => {
          if (response && endedWithEventsCount < s2._eventsCount && !hadError) {
            const error2 = new Error("Premature close");
            error2.code = "ERR_STREAM_PREMATURE_CLOSE";
            response.body.emit("error", error2);
          }
        });
      });
    }
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location = headers.get("Location");
        const locationURL = location === null ? null : new URL(location, request.url);
        switch (request.redirect) {
          case "error":
            reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            if (locationURL !== null) {
              headers.set("Location", locationURL);
            }
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request.counter >= request.follow) {
              reject(new FetchError(`maximum redirect reached at: ${request.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request.headers),
              follow: request.follow,
              counter: request.counter + 1,
              agent: request.agent,
              compress: request.compress,
              method: request.method,
              body: request.body,
              signal: request.signal,
              size: request.size
            };
            if (response_.statusCode !== 303 && request.body && options_.body instanceof import_stream.default.Readable) {
              reject(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            resolve2(fetch(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
          default:
            return reject(new TypeError(`Redirect option '${request.redirect}' is not a valid value of RequestRedirect`));
        }
      }
      if (signal) {
        response_.once("end", () => {
          signal.removeEventListener("abort", abortAndFinalize);
        });
      }
      let body = (0, import_stream.pipeline)(response_, new import_stream.PassThrough(), reject);
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request.size,
        counter: request.counter,
        highWaterMark: request.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request.compress || request.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      const zlibOptions = {
        flush: import_zlib.default.Z_SYNC_FLUSH,
        finishFlush: import_zlib.default.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = (0, import_stream.pipeline)(body, import_zlib.default.createGunzip(zlibOptions), reject);
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw = (0, import_stream.pipeline)(response_, new import_stream.PassThrough(), reject);
        raw.once("data", (chunk) => {
          body = (chunk[0] & 15) === 8 ? (0, import_stream.pipeline)(body, import_zlib.default.createInflate(), reject) : (0, import_stream.pipeline)(body, import_zlib.default.createInflateRaw(), reject);
          response = new Response(body, responseOptions);
          resolve2(response);
        });
        return;
      }
      if (codings === "br") {
        body = (0, import_stream.pipeline)(body, import_zlib.default.createBrotliDecompress(), reject);
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve2(response);
    });
    writeToStream(request_, request);
  });
}
function fixResponseChunkedTransferBadEnding(request, errorCallback) {
  const LAST_CHUNK = Buffer.from("0\r\n\r\n");
  let isChunkedTransfer = false;
  let properLastChunkReceived = false;
  let previousChunk;
  request.on("response", (response) => {
    const { headers } = response;
    isChunkedTransfer = headers["transfer-encoding"] === "chunked" && !headers["content-length"];
  });
  request.on("socket", (socket) => {
    const onSocketClose = () => {
      if (isChunkedTransfer && !properLastChunkReceived) {
        const error2 = new Error("Premature close");
        error2.code = "ERR_STREAM_PREMATURE_CLOSE";
        errorCallback(error2);
      }
    };
    socket.prependListener("close", onSocketClose);
    request.on("abort", () => {
      socket.removeListener("close", onSocketClose);
    });
    socket.on("data", (buf) => {
      properLastChunkReceived = Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;
      if (!properLastChunkReceived && previousChunk) {
        properLastChunkReceived = Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 && Buffer.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0;
      }
      previousChunk = buf;
    });
  });
}
var import_http, import_https, import_zlib, import_stream, import_util, import_crypto, import_url, commonjsGlobal, src, dataUriToBuffer$1, ponyfill_es2018, POOL_SIZE$1, POOL_SIZE, _Blob, Blob2, Blob$1, FetchBaseError, FetchError, NAME, isURLSearchParameters, isBlob, isAbortSignal, carriage, dashes, carriageLength, getFooter, getBoundary, INTERNALS$2, Body, clone, extractContentType, getTotalBytes, writeToStream, validateHeaderName, validateHeaderValue, Headers, redirectStatus, isRedirect, INTERNALS$1, Response, getSearch, INTERNALS, isRequest, Request, getNodeRequestOptions, AbortError, supportedSchemas;
var init_install_fetch = __esm({
  "node_modules/@sveltejs/kit/dist/install-fetch.js"() {
    init_shims();
    import_http = __toModule(require("http"));
    import_https = __toModule(require("https"));
    import_zlib = __toModule(require("zlib"));
    import_stream = __toModule(require("stream"));
    import_util = __toModule(require("util"));
    import_crypto = __toModule(require("crypto"));
    import_url = __toModule(require("url"));
    commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
    src = dataUriToBuffer;
    dataUriToBuffer$1 = src;
    ponyfill_es2018 = { exports: {} };
    (function(module2, exports) {
      (function(global2, factory) {
        factory(exports);
      })(commonjsGlobal, function(exports2) {
        const SymbolPolyfill = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol : (description) => `Symbol(${description})`;
        function noop2() {
          return void 0;
        }
        function getGlobals() {
          if (typeof self !== "undefined") {
            return self;
          } else if (typeof window !== "undefined") {
            return window;
          } else if (typeof commonjsGlobal !== "undefined") {
            return commonjsGlobal;
          }
          return void 0;
        }
        const globals = getGlobals();
        function typeIsObject(x) {
          return typeof x === "object" && x !== null || typeof x === "function";
        }
        const rethrowAssertionErrorRejection = noop2;
        const originalPromise = Promise;
        const originalPromiseThen = Promise.prototype.then;
        const originalPromiseResolve = Promise.resolve.bind(originalPromise);
        const originalPromiseReject = Promise.reject.bind(originalPromise);
        function newPromise(executor) {
          return new originalPromise(executor);
        }
        function promiseResolvedWith(value) {
          return originalPromiseResolve(value);
        }
        function promiseRejectedWith(reason) {
          return originalPromiseReject(reason);
        }
        function PerformPromiseThen(promise, onFulfilled, onRejected) {
          return originalPromiseThen.call(promise, onFulfilled, onRejected);
        }
        function uponPromise(promise, onFulfilled, onRejected) {
          PerformPromiseThen(PerformPromiseThen(promise, onFulfilled, onRejected), void 0, rethrowAssertionErrorRejection);
        }
        function uponFulfillment(promise, onFulfilled) {
          uponPromise(promise, onFulfilled);
        }
        function uponRejection(promise, onRejected) {
          uponPromise(promise, void 0, onRejected);
        }
        function transformPromiseWith(promise, fulfillmentHandler, rejectionHandler) {
          return PerformPromiseThen(promise, fulfillmentHandler, rejectionHandler);
        }
        function setPromiseIsHandledToTrue(promise) {
          PerformPromiseThen(promise, void 0, rethrowAssertionErrorRejection);
        }
        const queueMicrotask = (() => {
          const globalQueueMicrotask = globals && globals.queueMicrotask;
          if (typeof globalQueueMicrotask === "function") {
            return globalQueueMicrotask;
          }
          const resolvedPromise = promiseResolvedWith(void 0);
          return (fn) => PerformPromiseThen(resolvedPromise, fn);
        })();
        function reflectCall(F, V, args) {
          if (typeof F !== "function") {
            throw new TypeError("Argument is not a function");
          }
          return Function.prototype.apply.call(F, V, args);
        }
        function promiseCall(F, V, args) {
          try {
            return promiseResolvedWith(reflectCall(F, V, args));
          } catch (value) {
            return promiseRejectedWith(value);
          }
        }
        const QUEUE_MAX_ARRAY_SIZE = 16384;
        class SimpleQueue {
          constructor() {
            this._cursor = 0;
            this._size = 0;
            this._front = {
              _elements: [],
              _next: void 0
            };
            this._back = this._front;
            this._cursor = 0;
            this._size = 0;
          }
          get length() {
            return this._size;
          }
          push(element) {
            const oldBack = this._back;
            let newBack = oldBack;
            if (oldBack._elements.length === QUEUE_MAX_ARRAY_SIZE - 1) {
              newBack = {
                _elements: [],
                _next: void 0
              };
            }
            oldBack._elements.push(element);
            if (newBack !== oldBack) {
              this._back = newBack;
              oldBack._next = newBack;
            }
            ++this._size;
          }
          shift() {
            const oldFront = this._front;
            let newFront = oldFront;
            const oldCursor = this._cursor;
            let newCursor = oldCursor + 1;
            const elements = oldFront._elements;
            const element = elements[oldCursor];
            if (newCursor === QUEUE_MAX_ARRAY_SIZE) {
              newFront = oldFront._next;
              newCursor = 0;
            }
            --this._size;
            this._cursor = newCursor;
            if (oldFront !== newFront) {
              this._front = newFront;
            }
            elements[oldCursor] = void 0;
            return element;
          }
          forEach(callback) {
            let i = this._cursor;
            let node = this._front;
            let elements = node._elements;
            while (i !== elements.length || node._next !== void 0) {
              if (i === elements.length) {
                node = node._next;
                elements = node._elements;
                i = 0;
                if (elements.length === 0) {
                  break;
                }
              }
              callback(elements[i]);
              ++i;
            }
          }
          peek() {
            const front = this._front;
            const cursor = this._cursor;
            return front._elements[cursor];
          }
        }
        function ReadableStreamReaderGenericInitialize(reader, stream) {
          reader._ownerReadableStream = stream;
          stream._reader = reader;
          if (stream._state === "readable") {
            defaultReaderClosedPromiseInitialize(reader);
          } else if (stream._state === "closed") {
            defaultReaderClosedPromiseInitializeAsResolved(reader);
          } else {
            defaultReaderClosedPromiseInitializeAsRejected(reader, stream._storedError);
          }
        }
        function ReadableStreamReaderGenericCancel(reader, reason) {
          const stream = reader._ownerReadableStream;
          return ReadableStreamCancel(stream, reason);
        }
        function ReadableStreamReaderGenericRelease(reader) {
          if (reader._ownerReadableStream._state === "readable") {
            defaultReaderClosedPromiseReject(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
          } else {
            defaultReaderClosedPromiseResetToRejected(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
          }
          reader._ownerReadableStream._reader = void 0;
          reader._ownerReadableStream = void 0;
        }
        function readerLockException(name) {
          return new TypeError("Cannot " + name + " a stream using a released reader");
        }
        function defaultReaderClosedPromiseInitialize(reader) {
          reader._closedPromise = newPromise((resolve2, reject) => {
            reader._closedPromise_resolve = resolve2;
            reader._closedPromise_reject = reject;
          });
        }
        function defaultReaderClosedPromiseInitializeAsRejected(reader, reason) {
          defaultReaderClosedPromiseInitialize(reader);
          defaultReaderClosedPromiseReject(reader, reason);
        }
        function defaultReaderClosedPromiseInitializeAsResolved(reader) {
          defaultReaderClosedPromiseInitialize(reader);
          defaultReaderClosedPromiseResolve(reader);
        }
        function defaultReaderClosedPromiseReject(reader, reason) {
          if (reader._closedPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(reader._closedPromise);
          reader._closedPromise_reject(reason);
          reader._closedPromise_resolve = void 0;
          reader._closedPromise_reject = void 0;
        }
        function defaultReaderClosedPromiseResetToRejected(reader, reason) {
          defaultReaderClosedPromiseInitializeAsRejected(reader, reason);
        }
        function defaultReaderClosedPromiseResolve(reader) {
          if (reader._closedPromise_resolve === void 0) {
            return;
          }
          reader._closedPromise_resolve(void 0);
          reader._closedPromise_resolve = void 0;
          reader._closedPromise_reject = void 0;
        }
        const AbortSteps = SymbolPolyfill("[[AbortSteps]]");
        const ErrorSteps = SymbolPolyfill("[[ErrorSteps]]");
        const CancelSteps = SymbolPolyfill("[[CancelSteps]]");
        const PullSteps = SymbolPolyfill("[[PullSteps]]");
        const NumberIsFinite = Number.isFinite || function(x) {
          return typeof x === "number" && isFinite(x);
        };
        const MathTrunc = Math.trunc || function(v) {
          return v < 0 ? Math.ceil(v) : Math.floor(v);
        };
        function isDictionary(x) {
          return typeof x === "object" || typeof x === "function";
        }
        function assertDictionary(obj, context) {
          if (obj !== void 0 && !isDictionary(obj)) {
            throw new TypeError(`${context} is not an object.`);
          }
        }
        function assertFunction(x, context) {
          if (typeof x !== "function") {
            throw new TypeError(`${context} is not a function.`);
          }
        }
        function isObject(x) {
          return typeof x === "object" && x !== null || typeof x === "function";
        }
        function assertObject(x, context) {
          if (!isObject(x)) {
            throw new TypeError(`${context} is not an object.`);
          }
        }
        function assertRequiredArgument(x, position, context) {
          if (x === void 0) {
            throw new TypeError(`Parameter ${position} is required in '${context}'.`);
          }
        }
        function assertRequiredField(x, field, context) {
          if (x === void 0) {
            throw new TypeError(`${field} is required in '${context}'.`);
          }
        }
        function convertUnrestrictedDouble(value) {
          return Number(value);
        }
        function censorNegativeZero(x) {
          return x === 0 ? 0 : x;
        }
        function integerPart(x) {
          return censorNegativeZero(MathTrunc(x));
        }
        function convertUnsignedLongLongWithEnforceRange(value, context) {
          const lowerBound = 0;
          const upperBound = Number.MAX_SAFE_INTEGER;
          let x = Number(value);
          x = censorNegativeZero(x);
          if (!NumberIsFinite(x)) {
            throw new TypeError(`${context} is not a finite number`);
          }
          x = integerPart(x);
          if (x < lowerBound || x > upperBound) {
            throw new TypeError(`${context} is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`);
          }
          if (!NumberIsFinite(x) || x === 0) {
            return 0;
          }
          return x;
        }
        function assertReadableStream(x, context) {
          if (!IsReadableStream(x)) {
            throw new TypeError(`${context} is not a ReadableStream.`);
          }
        }
        function AcquireReadableStreamDefaultReader(stream) {
          return new ReadableStreamDefaultReader(stream);
        }
        function ReadableStreamAddReadRequest(stream, readRequest) {
          stream._reader._readRequests.push(readRequest);
        }
        function ReadableStreamFulfillReadRequest(stream, chunk, done) {
          const reader = stream._reader;
          const readRequest = reader._readRequests.shift();
          if (done) {
            readRequest._closeSteps();
          } else {
            readRequest._chunkSteps(chunk);
          }
        }
        function ReadableStreamGetNumReadRequests(stream) {
          return stream._reader._readRequests.length;
        }
        function ReadableStreamHasDefaultReader(stream) {
          const reader = stream._reader;
          if (reader === void 0) {
            return false;
          }
          if (!IsReadableStreamDefaultReader(reader)) {
            return false;
          }
          return true;
        }
        class ReadableStreamDefaultReader {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "ReadableStreamDefaultReader");
            assertReadableStream(stream, "First parameter");
            if (IsReadableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readRequests = new SimpleQueue();
          }
          get closed() {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          cancel(reason = void 0) {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("cancel"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("cancel"));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
          }
          read() {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("read"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("read from"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readRequest = {
              _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
              _closeSteps: () => resolvePromise({ value: void 0, done: true }),
              _errorSteps: (e) => rejectPromise(e)
            };
            ReadableStreamDefaultReaderRead(this, readRequest);
            return promise;
          }
          releaseLock() {
            if (!IsReadableStreamDefaultReader(this)) {
              throw defaultReaderBrandCheckException("releaseLock");
            }
            if (this._ownerReadableStream === void 0) {
              return;
            }
            if (this._readRequests.length > 0) {
              throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            }
            ReadableStreamReaderGenericRelease(this);
          }
        }
        Object.defineProperties(ReadableStreamDefaultReader.prototype, {
          cancel: { enumerable: true },
          read: { enumerable: true },
          releaseLock: { enumerable: true },
          closed: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamDefaultReader.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamDefaultReader",
            configurable: true
          });
        }
        function IsReadableStreamDefaultReader(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readRequests")) {
            return false;
          }
          return x instanceof ReadableStreamDefaultReader;
        }
        function ReadableStreamDefaultReaderRead(reader, readRequest) {
          const stream = reader._ownerReadableStream;
          stream._disturbed = true;
          if (stream._state === "closed") {
            readRequest._closeSteps();
          } else if (stream._state === "errored") {
            readRequest._errorSteps(stream._storedError);
          } else {
            stream._readableStreamController[PullSteps](readRequest);
          }
        }
        function defaultReaderBrandCheckException(name) {
          return new TypeError(`ReadableStreamDefaultReader.prototype.${name} can only be used on a ReadableStreamDefaultReader`);
        }
        const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {
        }).prototype);
        class ReadableStreamAsyncIteratorImpl {
          constructor(reader, preventCancel) {
            this._ongoingPromise = void 0;
            this._isFinished = false;
            this._reader = reader;
            this._preventCancel = preventCancel;
          }
          next() {
            const nextSteps = () => this._nextSteps();
            this._ongoingPromise = this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, nextSteps, nextSteps) : nextSteps();
            return this._ongoingPromise;
          }
          return(value) {
            const returnSteps = () => this._returnSteps(value);
            return this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, returnSteps, returnSteps) : returnSteps();
          }
          _nextSteps() {
            if (this._isFinished) {
              return Promise.resolve({ value: void 0, done: true });
            }
            const reader = this._reader;
            if (reader._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("iterate"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readRequest = {
              _chunkSteps: (chunk) => {
                this._ongoingPromise = void 0;
                queueMicrotask(() => resolvePromise({ value: chunk, done: false }));
              },
              _closeSteps: () => {
                this._ongoingPromise = void 0;
                this._isFinished = true;
                ReadableStreamReaderGenericRelease(reader);
                resolvePromise({ value: void 0, done: true });
              },
              _errorSteps: (reason) => {
                this._ongoingPromise = void 0;
                this._isFinished = true;
                ReadableStreamReaderGenericRelease(reader);
                rejectPromise(reason);
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promise;
          }
          _returnSteps(value) {
            if (this._isFinished) {
              return Promise.resolve({ value, done: true });
            }
            this._isFinished = true;
            const reader = this._reader;
            if (reader._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("finish iterating"));
            }
            if (!this._preventCancel) {
              const result = ReadableStreamReaderGenericCancel(reader, value);
              ReadableStreamReaderGenericRelease(reader);
              return transformPromiseWith(result, () => ({ value, done: true }));
            }
            ReadableStreamReaderGenericRelease(reader);
            return promiseResolvedWith({ value, done: true });
          }
        }
        const ReadableStreamAsyncIteratorPrototype = {
          next() {
            if (!IsReadableStreamAsyncIterator(this)) {
              return promiseRejectedWith(streamAsyncIteratorBrandCheckException("next"));
            }
            return this._asyncIteratorImpl.next();
          },
          return(value) {
            if (!IsReadableStreamAsyncIterator(this)) {
              return promiseRejectedWith(streamAsyncIteratorBrandCheckException("return"));
            }
            return this._asyncIteratorImpl.return(value);
          }
        };
        if (AsyncIteratorPrototype !== void 0) {
          Object.setPrototypeOf(ReadableStreamAsyncIteratorPrototype, AsyncIteratorPrototype);
        }
        function AcquireReadableStreamAsyncIterator(stream, preventCancel) {
          const reader = AcquireReadableStreamDefaultReader(stream);
          const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
          const iterator = Object.create(ReadableStreamAsyncIteratorPrototype);
          iterator._asyncIteratorImpl = impl;
          return iterator;
        }
        function IsReadableStreamAsyncIterator(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_asyncIteratorImpl")) {
            return false;
          }
          try {
            return x._asyncIteratorImpl instanceof ReadableStreamAsyncIteratorImpl;
          } catch (_a) {
            return false;
          }
        }
        function streamAsyncIteratorBrandCheckException(name) {
          return new TypeError(`ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`);
        }
        const NumberIsNaN = Number.isNaN || function(x) {
          return x !== x;
        };
        function CreateArrayFromList(elements) {
          return elements.slice();
        }
        function CopyDataBlockBytes(dest, destOffset, src2, srcOffset, n) {
          new Uint8Array(dest).set(new Uint8Array(src2, srcOffset, n), destOffset);
        }
        function TransferArrayBuffer(O) {
          return O;
        }
        function IsDetachedBuffer(O) {
          return false;
        }
        function ArrayBufferSlice(buffer, begin, end) {
          if (buffer.slice) {
            return buffer.slice(begin, end);
          }
          const length = end - begin;
          const slice = new ArrayBuffer(length);
          CopyDataBlockBytes(slice, 0, buffer, begin, length);
          return slice;
        }
        function IsNonNegativeNumber(v) {
          if (typeof v !== "number") {
            return false;
          }
          if (NumberIsNaN(v)) {
            return false;
          }
          if (v < 0) {
            return false;
          }
          return true;
        }
        function CloneAsUint8Array(O) {
          const buffer = ArrayBufferSlice(O.buffer, O.byteOffset, O.byteOffset + O.byteLength);
          return new Uint8Array(buffer);
        }
        function DequeueValue(container) {
          const pair = container._queue.shift();
          container._queueTotalSize -= pair.size;
          if (container._queueTotalSize < 0) {
            container._queueTotalSize = 0;
          }
          return pair.value;
        }
        function EnqueueValueWithSize(container, value, size) {
          if (!IsNonNegativeNumber(size) || size === Infinity) {
            throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
          }
          container._queue.push({ value, size });
          container._queueTotalSize += size;
        }
        function PeekQueueValue(container) {
          const pair = container._queue.peek();
          return pair.value;
        }
        function ResetQueue(container) {
          container._queue = new SimpleQueue();
          container._queueTotalSize = 0;
        }
        class ReadableStreamBYOBRequest {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get view() {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("view");
            }
            return this._view;
          }
          respond(bytesWritten) {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("respond");
            }
            assertRequiredArgument(bytesWritten, 1, "respond");
            bytesWritten = convertUnsignedLongLongWithEnforceRange(bytesWritten, "First parameter");
            if (this._associatedReadableByteStreamController === void 0) {
              throw new TypeError("This BYOB request has been invalidated");
            }
            if (IsDetachedBuffer(this._view.buffer))
              ;
            ReadableByteStreamControllerRespond(this._associatedReadableByteStreamController, bytesWritten);
          }
          respondWithNewView(view) {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("respondWithNewView");
            }
            assertRequiredArgument(view, 1, "respondWithNewView");
            if (!ArrayBuffer.isView(view)) {
              throw new TypeError("You can only respond with array buffer views");
            }
            if (this._associatedReadableByteStreamController === void 0) {
              throw new TypeError("This BYOB request has been invalidated");
            }
            if (IsDetachedBuffer(view.buffer))
              ;
            ReadableByteStreamControllerRespondWithNewView(this._associatedReadableByteStreamController, view);
          }
        }
        Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
          respond: { enumerable: true },
          respondWithNewView: { enumerable: true },
          view: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamBYOBRequest.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamBYOBRequest",
            configurable: true
          });
        }
        class ReadableByteStreamController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get byobRequest() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("byobRequest");
            }
            return ReadableByteStreamControllerGetBYOBRequest(this);
          }
          get desiredSize() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("desiredSize");
            }
            return ReadableByteStreamControllerGetDesiredSize(this);
          }
          close() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("close");
            }
            if (this._closeRequested) {
              throw new TypeError("The stream has already been closed; do not close it again!");
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== "readable") {
              throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be closed`);
            }
            ReadableByteStreamControllerClose(this);
          }
          enqueue(chunk) {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("enqueue");
            }
            assertRequiredArgument(chunk, 1, "enqueue");
            if (!ArrayBuffer.isView(chunk)) {
              throw new TypeError("chunk must be an array buffer view");
            }
            if (chunk.byteLength === 0) {
              throw new TypeError("chunk must have non-zero byteLength");
            }
            if (chunk.buffer.byteLength === 0) {
              throw new TypeError(`chunk's buffer must have non-zero byteLength`);
            }
            if (this._closeRequested) {
              throw new TypeError("stream is closed or draining");
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== "readable") {
              throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be enqueued to`);
            }
            ReadableByteStreamControllerEnqueue(this, chunk);
          }
          error(e = void 0) {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("error");
            }
            ReadableByteStreamControllerError(this, e);
          }
          [CancelSteps](reason) {
            ReadableByteStreamControllerClearPendingPullIntos(this);
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableByteStreamControllerClearAlgorithms(this);
            return result;
          }
          [PullSteps](readRequest) {
            const stream = this._controlledReadableByteStream;
            if (this._queueTotalSize > 0) {
              const entry = this._queue.shift();
              this._queueTotalSize -= entry.byteLength;
              ReadableByteStreamControllerHandleQueueDrain(this);
              const view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
              readRequest._chunkSteps(view);
              return;
            }
            const autoAllocateChunkSize = this._autoAllocateChunkSize;
            if (autoAllocateChunkSize !== void 0) {
              let buffer;
              try {
                buffer = new ArrayBuffer(autoAllocateChunkSize);
              } catch (bufferE) {
                readRequest._errorSteps(bufferE);
                return;
              }
              const pullIntoDescriptor = {
                buffer,
                bufferByteLength: autoAllocateChunkSize,
                byteOffset: 0,
                byteLength: autoAllocateChunkSize,
                bytesFilled: 0,
                elementSize: 1,
                viewConstructor: Uint8Array,
                readerType: "default"
              };
              this._pendingPullIntos.push(pullIntoDescriptor);
            }
            ReadableStreamAddReadRequest(stream, readRequest);
            ReadableByteStreamControllerCallPullIfNeeded(this);
          }
        }
        Object.defineProperties(ReadableByteStreamController.prototype, {
          close: { enumerable: true },
          enqueue: { enumerable: true },
          error: { enumerable: true },
          byobRequest: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableByteStreamController.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableByteStreamController",
            configurable: true
          });
        }
        function IsReadableByteStreamController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableByteStream")) {
            return false;
          }
          return x instanceof ReadableByteStreamController;
        }
        function IsReadableStreamBYOBRequest(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_associatedReadableByteStreamController")) {
            return false;
          }
          return x instanceof ReadableStreamBYOBRequest;
        }
        function ReadableByteStreamControllerCallPullIfNeeded(controller) {
          const shouldPull = ReadableByteStreamControllerShouldCallPull(controller);
          if (!shouldPull) {
            return;
          }
          if (controller._pulling) {
            controller._pullAgain = true;
            return;
          }
          controller._pulling = true;
          const pullPromise = controller._pullAlgorithm();
          uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
              controller._pullAgain = false;
              ReadableByteStreamControllerCallPullIfNeeded(controller);
            }
          }, (e) => {
            ReadableByteStreamControllerError(controller, e);
          });
        }
        function ReadableByteStreamControllerClearPendingPullIntos(controller) {
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          controller._pendingPullIntos = new SimpleQueue();
        }
        function ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor) {
          let done = false;
          if (stream._state === "closed") {
            done = true;
          }
          const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
          if (pullIntoDescriptor.readerType === "default") {
            ReadableStreamFulfillReadRequest(stream, filledView, done);
          } else {
            ReadableStreamFulfillReadIntoRequest(stream, filledView, done);
          }
        }
        function ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor) {
          const bytesFilled = pullIntoDescriptor.bytesFilled;
          const elementSize = pullIntoDescriptor.elementSize;
          return new pullIntoDescriptor.viewConstructor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, bytesFilled / elementSize);
        }
        function ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength) {
          controller._queue.push({ buffer, byteOffset, byteLength });
          controller._queueTotalSize += byteLength;
        }
        function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor) {
          const elementSize = pullIntoDescriptor.elementSize;
          const currentAlignedBytes = pullIntoDescriptor.bytesFilled - pullIntoDescriptor.bytesFilled % elementSize;
          const maxBytesToCopy = Math.min(controller._queueTotalSize, pullIntoDescriptor.byteLength - pullIntoDescriptor.bytesFilled);
          const maxBytesFilled = pullIntoDescriptor.bytesFilled + maxBytesToCopy;
          const maxAlignedBytes = maxBytesFilled - maxBytesFilled % elementSize;
          let totalBytesToCopyRemaining = maxBytesToCopy;
          let ready = false;
          if (maxAlignedBytes > currentAlignedBytes) {
            totalBytesToCopyRemaining = maxAlignedBytes - pullIntoDescriptor.bytesFilled;
            ready = true;
          }
          const queue = controller._queue;
          while (totalBytesToCopyRemaining > 0) {
            const headOfQueue = queue.peek();
            const bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
            const destStart = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            CopyDataBlockBytes(pullIntoDescriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
            if (headOfQueue.byteLength === bytesToCopy) {
              queue.shift();
            } else {
              headOfQueue.byteOffset += bytesToCopy;
              headOfQueue.byteLength -= bytesToCopy;
            }
            controller._queueTotalSize -= bytesToCopy;
            ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, pullIntoDescriptor);
            totalBytesToCopyRemaining -= bytesToCopy;
          }
          return ready;
        }
        function ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, size, pullIntoDescriptor) {
          pullIntoDescriptor.bytesFilled += size;
        }
        function ReadableByteStreamControllerHandleQueueDrain(controller) {
          if (controller._queueTotalSize === 0 && controller._closeRequested) {
            ReadableByteStreamControllerClearAlgorithms(controller);
            ReadableStreamClose(controller._controlledReadableByteStream);
          } else {
            ReadableByteStreamControllerCallPullIfNeeded(controller);
          }
        }
        function ReadableByteStreamControllerInvalidateBYOBRequest(controller) {
          if (controller._byobRequest === null) {
            return;
          }
          controller._byobRequest._associatedReadableByteStreamController = void 0;
          controller._byobRequest._view = null;
          controller._byobRequest = null;
        }
        function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller) {
          while (controller._pendingPullIntos.length > 0) {
            if (controller._queueTotalSize === 0) {
              return;
            }
            const pullIntoDescriptor = controller._pendingPullIntos.peek();
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
              ReadableByteStreamControllerShiftPendingPullInto(controller);
              ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
            }
          }
        }
        function ReadableByteStreamControllerPullInto(controller, view, readIntoRequest) {
          const stream = controller._controlledReadableByteStream;
          let elementSize = 1;
          if (view.constructor !== DataView) {
            elementSize = view.constructor.BYTES_PER_ELEMENT;
          }
          const ctor = view.constructor;
          const buffer = TransferArrayBuffer(view.buffer);
          const pullIntoDescriptor = {
            buffer,
            bufferByteLength: buffer.byteLength,
            byteOffset: view.byteOffset,
            byteLength: view.byteLength,
            bytesFilled: 0,
            elementSize,
            viewConstructor: ctor,
            readerType: "byob"
          };
          if (controller._pendingPullIntos.length > 0) {
            controller._pendingPullIntos.push(pullIntoDescriptor);
            ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
            return;
          }
          if (stream._state === "closed") {
            const emptyView = new ctor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, 0);
            readIntoRequest._closeSteps(emptyView);
            return;
          }
          if (controller._queueTotalSize > 0) {
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
              const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
              ReadableByteStreamControllerHandleQueueDrain(controller);
              readIntoRequest._chunkSteps(filledView);
              return;
            }
            if (controller._closeRequested) {
              const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
              ReadableByteStreamControllerError(controller, e);
              readIntoRequest._errorSteps(e);
              return;
            }
          }
          controller._pendingPullIntos.push(pullIntoDescriptor);
          ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor) {
          const stream = controller._controlledReadableByteStream;
          if (ReadableStreamHasBYOBReader(stream)) {
            while (ReadableStreamGetNumReadIntoRequests(stream) > 0) {
              const pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
              ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
            }
          }
        }
        function ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, pullIntoDescriptor) {
          ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, pullIntoDescriptor);
          if (pullIntoDescriptor.bytesFilled < pullIntoDescriptor.elementSize) {
            return;
          }
          ReadableByteStreamControllerShiftPendingPullInto(controller);
          const remainderSize = pullIntoDescriptor.bytesFilled % pullIntoDescriptor.elementSize;
          if (remainderSize > 0) {
            const end = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            const remainder = ArrayBufferSlice(pullIntoDescriptor.buffer, end - remainderSize, end);
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, remainder, 0, remainder.byteLength);
          }
          pullIntoDescriptor.bytesFilled -= remainderSize;
          ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
          ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
        }
        function ReadableByteStreamControllerRespondInternal(controller, bytesWritten) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            ReadableByteStreamControllerRespondInClosedState(controller);
          } else {
            ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, firstDescriptor);
          }
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerShiftPendingPullInto(controller) {
          const descriptor = controller._pendingPullIntos.shift();
          return descriptor;
        }
        function ReadableByteStreamControllerShouldCallPull(controller) {
          const stream = controller._controlledReadableByteStream;
          if (stream._state !== "readable") {
            return false;
          }
          if (controller._closeRequested) {
            return false;
          }
          if (!controller._started) {
            return false;
          }
          if (ReadableStreamHasDefaultReader(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
          }
          if (ReadableStreamHasBYOBReader(stream) && ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            return true;
          }
          const desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
          if (desiredSize > 0) {
            return true;
          }
          return false;
        }
        function ReadableByteStreamControllerClearAlgorithms(controller) {
          controller._pullAlgorithm = void 0;
          controller._cancelAlgorithm = void 0;
        }
        function ReadableByteStreamControllerClose(controller) {
          const stream = controller._controlledReadableByteStream;
          if (controller._closeRequested || stream._state !== "readable") {
            return;
          }
          if (controller._queueTotalSize > 0) {
            controller._closeRequested = true;
            return;
          }
          if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (firstPendingPullInto.bytesFilled > 0) {
              const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
              ReadableByteStreamControllerError(controller, e);
              throw e;
            }
          }
          ReadableByteStreamControllerClearAlgorithms(controller);
          ReadableStreamClose(stream);
        }
        function ReadableByteStreamControllerEnqueue(controller, chunk) {
          const stream = controller._controlledReadableByteStream;
          if (controller._closeRequested || stream._state !== "readable") {
            return;
          }
          const buffer = chunk.buffer;
          const byteOffset = chunk.byteOffset;
          const byteLength = chunk.byteLength;
          const transferredBuffer = TransferArrayBuffer(buffer);
          if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (IsDetachedBuffer(firstPendingPullInto.buffer))
              ;
            firstPendingPullInto.buffer = TransferArrayBuffer(firstPendingPullInto.buffer);
          }
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          if (ReadableStreamHasDefaultReader(stream)) {
            if (ReadableStreamGetNumReadRequests(stream) === 0) {
              ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            } else {
              const transferredView = new Uint8Array(transferredBuffer, byteOffset, byteLength);
              ReadableStreamFulfillReadRequest(stream, transferredView, false);
            }
          } else if (ReadableStreamHasBYOBReader(stream)) {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
          } else {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
          }
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerError(controller, e) {
          const stream = controller._controlledReadableByteStream;
          if (stream._state !== "readable") {
            return;
          }
          ReadableByteStreamControllerClearPendingPullIntos(controller);
          ResetQueue(controller);
          ReadableByteStreamControllerClearAlgorithms(controller);
          ReadableStreamError(stream, e);
        }
        function ReadableByteStreamControllerGetBYOBRequest(controller) {
          if (controller._byobRequest === null && controller._pendingPullIntos.length > 0) {
            const firstDescriptor = controller._pendingPullIntos.peek();
            const view = new Uint8Array(firstDescriptor.buffer, firstDescriptor.byteOffset + firstDescriptor.bytesFilled, firstDescriptor.byteLength - firstDescriptor.bytesFilled);
            const byobRequest = Object.create(ReadableStreamBYOBRequest.prototype);
            SetUpReadableStreamBYOBRequest(byobRequest, controller, view);
            controller._byobRequest = byobRequest;
          }
          return controller._byobRequest;
        }
        function ReadableByteStreamControllerGetDesiredSize(controller) {
          const state = controller._controlledReadableByteStream._state;
          if (state === "errored") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function ReadableByteStreamControllerRespond(controller, bytesWritten) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            if (bytesWritten !== 0) {
              throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
            }
          } else {
            if (bytesWritten === 0) {
              throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
            }
            if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength) {
              throw new RangeError("bytesWritten out of range");
            }
          }
          firstDescriptor.buffer = TransferArrayBuffer(firstDescriptor.buffer);
          ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
        }
        function ReadableByteStreamControllerRespondWithNewView(controller, view) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            if (view.byteLength !== 0) {
              throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
            }
          } else {
            if (view.byteLength === 0) {
              throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
            }
          }
          if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset) {
            throw new RangeError("The region specified by view does not match byobRequest");
          }
          if (firstDescriptor.bufferByteLength !== view.buffer.byteLength) {
            throw new RangeError("The buffer of view has different capacity than byobRequest");
          }
          if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength) {
            throw new RangeError("The region specified by view is larger than byobRequest");
          }
          firstDescriptor.buffer = TransferArrayBuffer(view.buffer);
          ReadableByteStreamControllerRespondInternal(controller, view.byteLength);
        }
        function SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize) {
          controller._controlledReadableByteStream = stream;
          controller._pullAgain = false;
          controller._pulling = false;
          controller._byobRequest = null;
          controller._queue = controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._closeRequested = false;
          controller._started = false;
          controller._strategyHWM = highWaterMark;
          controller._pullAlgorithm = pullAlgorithm;
          controller._cancelAlgorithm = cancelAlgorithm;
          controller._autoAllocateChunkSize = autoAllocateChunkSize;
          controller._pendingPullIntos = new SimpleQueue();
          stream._readableStreamController = controller;
          const startResult = startAlgorithm();
          uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
          }, (r) => {
            ReadableByteStreamControllerError(controller, r);
          });
        }
        function SetUpReadableByteStreamControllerFromUnderlyingSource(stream, underlyingByteSource, highWaterMark) {
          const controller = Object.create(ReadableByteStreamController.prototype);
          let startAlgorithm = () => void 0;
          let pullAlgorithm = () => promiseResolvedWith(void 0);
          let cancelAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingByteSource.start !== void 0) {
            startAlgorithm = () => underlyingByteSource.start(controller);
          }
          if (underlyingByteSource.pull !== void 0) {
            pullAlgorithm = () => underlyingByteSource.pull(controller);
          }
          if (underlyingByteSource.cancel !== void 0) {
            cancelAlgorithm = (reason) => underlyingByteSource.cancel(reason);
          }
          const autoAllocateChunkSize = underlyingByteSource.autoAllocateChunkSize;
          if (autoAllocateChunkSize === 0) {
            throw new TypeError("autoAllocateChunkSize must be greater than 0");
          }
          SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize);
        }
        function SetUpReadableStreamBYOBRequest(request, controller, view) {
          request._associatedReadableByteStreamController = controller;
          request._view = view;
        }
        function byobRequestBrandCheckException(name) {
          return new TypeError(`ReadableStreamBYOBRequest.prototype.${name} can only be used on a ReadableStreamBYOBRequest`);
        }
        function byteStreamControllerBrandCheckException(name) {
          return new TypeError(`ReadableByteStreamController.prototype.${name} can only be used on a ReadableByteStreamController`);
        }
        function AcquireReadableStreamBYOBReader(stream) {
          return new ReadableStreamBYOBReader(stream);
        }
        function ReadableStreamAddReadIntoRequest(stream, readIntoRequest) {
          stream._reader._readIntoRequests.push(readIntoRequest);
        }
        function ReadableStreamFulfillReadIntoRequest(stream, chunk, done) {
          const reader = stream._reader;
          const readIntoRequest = reader._readIntoRequests.shift();
          if (done) {
            readIntoRequest._closeSteps(chunk);
          } else {
            readIntoRequest._chunkSteps(chunk);
          }
        }
        function ReadableStreamGetNumReadIntoRequests(stream) {
          return stream._reader._readIntoRequests.length;
        }
        function ReadableStreamHasBYOBReader(stream) {
          const reader = stream._reader;
          if (reader === void 0) {
            return false;
          }
          if (!IsReadableStreamBYOBReader(reader)) {
            return false;
          }
          return true;
        }
        class ReadableStreamBYOBReader {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "ReadableStreamBYOBReader");
            assertReadableStream(stream, "First parameter");
            if (IsReadableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            }
            if (!IsReadableByteStreamController(stream._readableStreamController)) {
              throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readIntoRequests = new SimpleQueue();
          }
          get closed() {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          cancel(reason = void 0) {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("cancel"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("cancel"));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
          }
          read(view) {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("read"));
            }
            if (!ArrayBuffer.isView(view)) {
              return promiseRejectedWith(new TypeError("view must be an array buffer view"));
            }
            if (view.byteLength === 0) {
              return promiseRejectedWith(new TypeError("view must have non-zero byteLength"));
            }
            if (view.buffer.byteLength === 0) {
              return promiseRejectedWith(new TypeError(`view's buffer must have non-zero byteLength`));
            }
            if (IsDetachedBuffer(view.buffer))
              ;
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("read from"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readIntoRequest = {
              _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
              _closeSteps: (chunk) => resolvePromise({ value: chunk, done: true }),
              _errorSteps: (e) => rejectPromise(e)
            };
            ReadableStreamBYOBReaderRead(this, view, readIntoRequest);
            return promise;
          }
          releaseLock() {
            if (!IsReadableStreamBYOBReader(this)) {
              throw byobReaderBrandCheckException("releaseLock");
            }
            if (this._ownerReadableStream === void 0) {
              return;
            }
            if (this._readIntoRequests.length > 0) {
              throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            }
            ReadableStreamReaderGenericRelease(this);
          }
        }
        Object.defineProperties(ReadableStreamBYOBReader.prototype, {
          cancel: { enumerable: true },
          read: { enumerable: true },
          releaseLock: { enumerable: true },
          closed: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamBYOBReader.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamBYOBReader",
            configurable: true
          });
        }
        function IsReadableStreamBYOBReader(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readIntoRequests")) {
            return false;
          }
          return x instanceof ReadableStreamBYOBReader;
        }
        function ReadableStreamBYOBReaderRead(reader, view, readIntoRequest) {
          const stream = reader._ownerReadableStream;
          stream._disturbed = true;
          if (stream._state === "errored") {
            readIntoRequest._errorSteps(stream._storedError);
          } else {
            ReadableByteStreamControllerPullInto(stream._readableStreamController, view, readIntoRequest);
          }
        }
        function byobReaderBrandCheckException(name) {
          return new TypeError(`ReadableStreamBYOBReader.prototype.${name} can only be used on a ReadableStreamBYOBReader`);
        }
        function ExtractHighWaterMark(strategy, defaultHWM) {
          const { highWaterMark } = strategy;
          if (highWaterMark === void 0) {
            return defaultHWM;
          }
          if (NumberIsNaN(highWaterMark) || highWaterMark < 0) {
            throw new RangeError("Invalid highWaterMark");
          }
          return highWaterMark;
        }
        function ExtractSizeAlgorithm(strategy) {
          const { size } = strategy;
          if (!size) {
            return () => 1;
          }
          return size;
        }
        function convertQueuingStrategy(init2, context) {
          assertDictionary(init2, context);
          const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
          const size = init2 === null || init2 === void 0 ? void 0 : init2.size;
          return {
            highWaterMark: highWaterMark === void 0 ? void 0 : convertUnrestrictedDouble(highWaterMark),
            size: size === void 0 ? void 0 : convertQueuingStrategySize(size, `${context} has member 'size' that`)
          };
        }
        function convertQueuingStrategySize(fn, context) {
          assertFunction(fn, context);
          return (chunk) => convertUnrestrictedDouble(fn(chunk));
        }
        function convertUnderlyingSink(original, context) {
          assertDictionary(original, context);
          const abort = original === null || original === void 0 ? void 0 : original.abort;
          const close = original === null || original === void 0 ? void 0 : original.close;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const type = original === null || original === void 0 ? void 0 : original.type;
          const write = original === null || original === void 0 ? void 0 : original.write;
          return {
            abort: abort === void 0 ? void 0 : convertUnderlyingSinkAbortCallback(abort, original, `${context} has member 'abort' that`),
            close: close === void 0 ? void 0 : convertUnderlyingSinkCloseCallback(close, original, `${context} has member 'close' that`),
            start: start === void 0 ? void 0 : convertUnderlyingSinkStartCallback(start, original, `${context} has member 'start' that`),
            write: write === void 0 ? void 0 : convertUnderlyingSinkWriteCallback(write, original, `${context} has member 'write' that`),
            type
          };
        }
        function convertUnderlyingSinkAbortCallback(fn, original, context) {
          assertFunction(fn, context);
          return (reason) => promiseCall(fn, original, [reason]);
        }
        function convertUnderlyingSinkCloseCallback(fn, original, context) {
          assertFunction(fn, context);
          return () => promiseCall(fn, original, []);
        }
        function convertUnderlyingSinkStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertUnderlyingSinkWriteCallback(fn, original, context) {
          assertFunction(fn, context);
          return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
        }
        function assertWritableStream(x, context) {
          if (!IsWritableStream(x)) {
            throw new TypeError(`${context} is not a WritableStream.`);
          }
        }
        function isAbortSignal2(value) {
          if (typeof value !== "object" || value === null) {
            return false;
          }
          try {
            return typeof value.aborted === "boolean";
          } catch (_a) {
            return false;
          }
        }
        const supportsAbortController = typeof AbortController === "function";
        function createAbortController() {
          if (supportsAbortController) {
            return new AbortController();
          }
          return void 0;
        }
        class WritableStream {
          constructor(rawUnderlyingSink = {}, rawStrategy = {}) {
            if (rawUnderlyingSink === void 0) {
              rawUnderlyingSink = null;
            } else {
              assertObject(rawUnderlyingSink, "First parameter");
            }
            const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
            const underlyingSink = convertUnderlyingSink(rawUnderlyingSink, "First parameter");
            InitializeWritableStream(this);
            const type = underlyingSink.type;
            if (type !== void 0) {
              throw new RangeError("Invalid type is specified");
            }
            const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
            const highWaterMark = ExtractHighWaterMark(strategy, 1);
            SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
          }
          get locked() {
            if (!IsWritableStream(this)) {
              throw streamBrandCheckException$2("locked");
            }
            return IsWritableStreamLocked(this);
          }
          abort(reason = void 0) {
            if (!IsWritableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$2("abort"));
            }
            if (IsWritableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot abort a stream that already has a writer"));
            }
            return WritableStreamAbort(this, reason);
          }
          close() {
            if (!IsWritableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$2("close"));
            }
            if (IsWritableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot close a stream that already has a writer"));
            }
            if (WritableStreamCloseQueuedOrInFlight(this)) {
              return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
            }
            return WritableStreamClose(this);
          }
          getWriter() {
            if (!IsWritableStream(this)) {
              throw streamBrandCheckException$2("getWriter");
            }
            return AcquireWritableStreamDefaultWriter(this);
          }
        }
        Object.defineProperties(WritableStream.prototype, {
          abort: { enumerable: true },
          close: { enumerable: true },
          getWriter: { enumerable: true },
          locked: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStream.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStream",
            configurable: true
          });
        }
        function AcquireWritableStreamDefaultWriter(stream) {
          return new WritableStreamDefaultWriter(stream);
        }
        function CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
          const stream = Object.create(WritableStream.prototype);
          InitializeWritableStream(stream);
          const controller = Object.create(WritableStreamDefaultController.prototype);
          SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
          return stream;
        }
        function InitializeWritableStream(stream) {
          stream._state = "writable";
          stream._storedError = void 0;
          stream._writer = void 0;
          stream._writableStreamController = void 0;
          stream._writeRequests = new SimpleQueue();
          stream._inFlightWriteRequest = void 0;
          stream._closeRequest = void 0;
          stream._inFlightCloseRequest = void 0;
          stream._pendingAbortRequest = void 0;
          stream._backpressure = false;
        }
        function IsWritableStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_writableStreamController")) {
            return false;
          }
          return x instanceof WritableStream;
        }
        function IsWritableStreamLocked(stream) {
          if (stream._writer === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamAbort(stream, reason) {
          var _a;
          if (stream._state === "closed" || stream._state === "errored") {
            return promiseResolvedWith(void 0);
          }
          stream._writableStreamController._abortReason = reason;
          (_a = stream._writableStreamController._abortController) === null || _a === void 0 ? void 0 : _a.abort();
          const state = stream._state;
          if (state === "closed" || state === "errored") {
            return promiseResolvedWith(void 0);
          }
          if (stream._pendingAbortRequest !== void 0) {
            return stream._pendingAbortRequest._promise;
          }
          let wasAlreadyErroring = false;
          if (state === "erroring") {
            wasAlreadyErroring = true;
            reason = void 0;
          }
          const promise = newPromise((resolve2, reject) => {
            stream._pendingAbortRequest = {
              _promise: void 0,
              _resolve: resolve2,
              _reject: reject,
              _reason: reason,
              _wasAlreadyErroring: wasAlreadyErroring
            };
          });
          stream._pendingAbortRequest._promise = promise;
          if (!wasAlreadyErroring) {
            WritableStreamStartErroring(stream, reason);
          }
          return promise;
        }
        function WritableStreamClose(stream) {
          const state = stream._state;
          if (state === "closed" || state === "errored") {
            return promiseRejectedWith(new TypeError(`The stream (in ${state} state) is not in the writable state and cannot be closed`));
          }
          const promise = newPromise((resolve2, reject) => {
            const closeRequest = {
              _resolve: resolve2,
              _reject: reject
            };
            stream._closeRequest = closeRequest;
          });
          const writer = stream._writer;
          if (writer !== void 0 && stream._backpressure && state === "writable") {
            defaultWriterReadyPromiseResolve(writer);
          }
          WritableStreamDefaultControllerClose(stream._writableStreamController);
          return promise;
        }
        function WritableStreamAddWriteRequest(stream) {
          const promise = newPromise((resolve2, reject) => {
            const writeRequest = {
              _resolve: resolve2,
              _reject: reject
            };
            stream._writeRequests.push(writeRequest);
          });
          return promise;
        }
        function WritableStreamDealWithRejection(stream, error2) {
          const state = stream._state;
          if (state === "writable") {
            WritableStreamStartErroring(stream, error2);
            return;
          }
          WritableStreamFinishErroring(stream);
        }
        function WritableStreamStartErroring(stream, reason) {
          const controller = stream._writableStreamController;
          stream._state = "erroring";
          stream._storedError = reason;
          const writer = stream._writer;
          if (writer !== void 0) {
            WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
          }
          if (!WritableStreamHasOperationMarkedInFlight(stream) && controller._started) {
            WritableStreamFinishErroring(stream);
          }
        }
        function WritableStreamFinishErroring(stream) {
          stream._state = "errored";
          stream._writableStreamController[ErrorSteps]();
          const storedError = stream._storedError;
          stream._writeRequests.forEach((writeRequest) => {
            writeRequest._reject(storedError);
          });
          stream._writeRequests = new SimpleQueue();
          if (stream._pendingAbortRequest === void 0) {
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
          }
          const abortRequest = stream._pendingAbortRequest;
          stream._pendingAbortRequest = void 0;
          if (abortRequest._wasAlreadyErroring) {
            abortRequest._reject(storedError);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
          }
          const promise = stream._writableStreamController[AbortSteps](abortRequest._reason);
          uponPromise(promise, () => {
            abortRequest._resolve();
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          }, (reason) => {
            abortRequest._reject(reason);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          });
        }
        function WritableStreamFinishInFlightWrite(stream) {
          stream._inFlightWriteRequest._resolve(void 0);
          stream._inFlightWriteRequest = void 0;
        }
        function WritableStreamFinishInFlightWriteWithError(stream, error2) {
          stream._inFlightWriteRequest._reject(error2);
          stream._inFlightWriteRequest = void 0;
          WritableStreamDealWithRejection(stream, error2);
        }
        function WritableStreamFinishInFlightClose(stream) {
          stream._inFlightCloseRequest._resolve(void 0);
          stream._inFlightCloseRequest = void 0;
          const state = stream._state;
          if (state === "erroring") {
            stream._storedError = void 0;
            if (stream._pendingAbortRequest !== void 0) {
              stream._pendingAbortRequest._resolve();
              stream._pendingAbortRequest = void 0;
            }
          }
          stream._state = "closed";
          const writer = stream._writer;
          if (writer !== void 0) {
            defaultWriterClosedPromiseResolve(writer);
          }
        }
        function WritableStreamFinishInFlightCloseWithError(stream, error2) {
          stream._inFlightCloseRequest._reject(error2);
          stream._inFlightCloseRequest = void 0;
          if (stream._pendingAbortRequest !== void 0) {
            stream._pendingAbortRequest._reject(error2);
            stream._pendingAbortRequest = void 0;
          }
          WritableStreamDealWithRejection(stream, error2);
        }
        function WritableStreamCloseQueuedOrInFlight(stream) {
          if (stream._closeRequest === void 0 && stream._inFlightCloseRequest === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamHasOperationMarkedInFlight(stream) {
          if (stream._inFlightWriteRequest === void 0 && stream._inFlightCloseRequest === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamMarkCloseRequestInFlight(stream) {
          stream._inFlightCloseRequest = stream._closeRequest;
          stream._closeRequest = void 0;
        }
        function WritableStreamMarkFirstWriteRequestInFlight(stream) {
          stream._inFlightWriteRequest = stream._writeRequests.shift();
        }
        function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream) {
          if (stream._closeRequest !== void 0) {
            stream._closeRequest._reject(stream._storedError);
            stream._closeRequest = void 0;
          }
          const writer = stream._writer;
          if (writer !== void 0) {
            defaultWriterClosedPromiseReject(writer, stream._storedError);
          }
        }
        function WritableStreamUpdateBackpressure(stream, backpressure) {
          const writer = stream._writer;
          if (writer !== void 0 && backpressure !== stream._backpressure) {
            if (backpressure) {
              defaultWriterReadyPromiseReset(writer);
            } else {
              defaultWriterReadyPromiseResolve(writer);
            }
          }
          stream._backpressure = backpressure;
        }
        class WritableStreamDefaultWriter {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "WritableStreamDefaultWriter");
            assertWritableStream(stream, "First parameter");
            if (IsWritableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive writing by another writer");
            }
            this._ownerWritableStream = stream;
            stream._writer = this;
            const state = stream._state;
            if (state === "writable") {
              if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._backpressure) {
                defaultWriterReadyPromiseInitialize(this);
              } else {
                defaultWriterReadyPromiseInitializeAsResolved(this);
              }
              defaultWriterClosedPromiseInitialize(this);
            } else if (state === "erroring") {
              defaultWriterReadyPromiseInitializeAsRejected(this, stream._storedError);
              defaultWriterClosedPromiseInitialize(this);
            } else if (state === "closed") {
              defaultWriterReadyPromiseInitializeAsResolved(this);
              defaultWriterClosedPromiseInitializeAsResolved(this);
            } else {
              const storedError = stream._storedError;
              defaultWriterReadyPromiseInitializeAsRejected(this, storedError);
              defaultWriterClosedPromiseInitializeAsRejected(this, storedError);
            }
          }
          get closed() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          get desiredSize() {
            if (!IsWritableStreamDefaultWriter(this)) {
              throw defaultWriterBrandCheckException("desiredSize");
            }
            if (this._ownerWritableStream === void 0) {
              throw defaultWriterLockException("desiredSize");
            }
            return WritableStreamDefaultWriterGetDesiredSize(this);
          }
          get ready() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("ready"));
            }
            return this._readyPromise;
          }
          abort(reason = void 0) {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("abort"));
            }
            if (this._ownerWritableStream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("abort"));
            }
            return WritableStreamDefaultWriterAbort(this, reason);
          }
          close() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("close"));
            }
            const stream = this._ownerWritableStream;
            if (stream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("close"));
            }
            if (WritableStreamCloseQueuedOrInFlight(stream)) {
              return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
            }
            return WritableStreamDefaultWriterClose(this);
          }
          releaseLock() {
            if (!IsWritableStreamDefaultWriter(this)) {
              throw defaultWriterBrandCheckException("releaseLock");
            }
            const stream = this._ownerWritableStream;
            if (stream === void 0) {
              return;
            }
            WritableStreamDefaultWriterRelease(this);
          }
          write(chunk = void 0) {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("write"));
            }
            if (this._ownerWritableStream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("write to"));
            }
            return WritableStreamDefaultWriterWrite(this, chunk);
          }
        }
        Object.defineProperties(WritableStreamDefaultWriter.prototype, {
          abort: { enumerable: true },
          close: { enumerable: true },
          releaseLock: { enumerable: true },
          write: { enumerable: true },
          closed: { enumerable: true },
          desiredSize: { enumerable: true },
          ready: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStreamDefaultWriter.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStreamDefaultWriter",
            configurable: true
          });
        }
        function IsWritableStreamDefaultWriter(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_ownerWritableStream")) {
            return false;
          }
          return x instanceof WritableStreamDefaultWriter;
        }
        function WritableStreamDefaultWriterAbort(writer, reason) {
          const stream = writer._ownerWritableStream;
          return WritableStreamAbort(stream, reason);
        }
        function WritableStreamDefaultWriterClose(writer) {
          const stream = writer._ownerWritableStream;
          return WritableStreamClose(stream);
        }
        function WritableStreamDefaultWriterCloseWithErrorPropagation(writer) {
          const stream = writer._ownerWritableStream;
          const state = stream._state;
          if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
            return promiseResolvedWith(void 0);
          }
          if (state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          return WritableStreamDefaultWriterClose(writer);
        }
        function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, error2) {
          if (writer._closedPromiseState === "pending") {
            defaultWriterClosedPromiseReject(writer, error2);
          } else {
            defaultWriterClosedPromiseResetToRejected(writer, error2);
          }
        }
        function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, error2) {
          if (writer._readyPromiseState === "pending") {
            defaultWriterReadyPromiseReject(writer, error2);
          } else {
            defaultWriterReadyPromiseResetToRejected(writer, error2);
          }
        }
        function WritableStreamDefaultWriterGetDesiredSize(writer) {
          const stream = writer._ownerWritableStream;
          const state = stream._state;
          if (state === "errored" || state === "erroring") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return WritableStreamDefaultControllerGetDesiredSize(stream._writableStreamController);
        }
        function WritableStreamDefaultWriterRelease(writer) {
          const stream = writer._ownerWritableStream;
          const releasedError = new TypeError(`Writer was released and can no longer be used to monitor the stream's closedness`);
          WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
          WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
          stream._writer = void 0;
          writer._ownerWritableStream = void 0;
        }
        function WritableStreamDefaultWriterWrite(writer, chunk) {
          const stream = writer._ownerWritableStream;
          const controller = stream._writableStreamController;
          const chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
          if (stream !== writer._ownerWritableStream) {
            return promiseRejectedWith(defaultWriterLockException("write to"));
          }
          const state = stream._state;
          if (state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
            return promiseRejectedWith(new TypeError("The stream is closing or closed and cannot be written to"));
          }
          if (state === "erroring") {
            return promiseRejectedWith(stream._storedError);
          }
          const promise = WritableStreamAddWriteRequest(stream);
          WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
          return promise;
        }
        const closeSentinel = {};
        class WritableStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get abortReason() {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("abortReason");
            }
            return this._abortReason;
          }
          get signal() {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("signal");
            }
            if (this._abortController === void 0) {
              throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
            }
            return this._abortController.signal;
          }
          error(e = void 0) {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("error");
            }
            const state = this._controlledWritableStream._state;
            if (state !== "writable") {
              return;
            }
            WritableStreamDefaultControllerError(this, e);
          }
          [AbortSteps](reason) {
            const result = this._abortAlgorithm(reason);
            WritableStreamDefaultControllerClearAlgorithms(this);
            return result;
          }
          [ErrorSteps]() {
            ResetQueue(this);
          }
        }
        Object.defineProperties(WritableStreamDefaultController.prototype, {
          error: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStreamDefaultController",
            configurable: true
          });
        }
        function IsWritableStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledWritableStream")) {
            return false;
          }
          return x instanceof WritableStreamDefaultController;
        }
        function SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm) {
          controller._controlledWritableStream = stream;
          stream._writableStreamController = controller;
          controller._queue = void 0;
          controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._abortReason = void 0;
          controller._abortController = createAbortController();
          controller._started = false;
          controller._strategySizeAlgorithm = sizeAlgorithm;
          controller._strategyHWM = highWaterMark;
          controller._writeAlgorithm = writeAlgorithm;
          controller._closeAlgorithm = closeAlgorithm;
          controller._abortAlgorithm = abortAlgorithm;
          const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
          WritableStreamUpdateBackpressure(stream, backpressure);
          const startResult = startAlgorithm();
          const startPromise = promiseResolvedWith(startResult);
          uponPromise(startPromise, () => {
            controller._started = true;
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
          }, (r) => {
            controller._started = true;
            WritableStreamDealWithRejection(stream, r);
          });
        }
        function SetUpWritableStreamDefaultControllerFromUnderlyingSink(stream, underlyingSink, highWaterMark, sizeAlgorithm) {
          const controller = Object.create(WritableStreamDefaultController.prototype);
          let startAlgorithm = () => void 0;
          let writeAlgorithm = () => promiseResolvedWith(void 0);
          let closeAlgorithm = () => promiseResolvedWith(void 0);
          let abortAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingSink.start !== void 0) {
            startAlgorithm = () => underlyingSink.start(controller);
          }
          if (underlyingSink.write !== void 0) {
            writeAlgorithm = (chunk) => underlyingSink.write(chunk, controller);
          }
          if (underlyingSink.close !== void 0) {
            closeAlgorithm = () => underlyingSink.close();
          }
          if (underlyingSink.abort !== void 0) {
            abortAlgorithm = (reason) => underlyingSink.abort(reason);
          }
          SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
        }
        function WritableStreamDefaultControllerClearAlgorithms(controller) {
          controller._writeAlgorithm = void 0;
          controller._closeAlgorithm = void 0;
          controller._abortAlgorithm = void 0;
          controller._strategySizeAlgorithm = void 0;
        }
        function WritableStreamDefaultControllerClose(controller) {
          EnqueueValueWithSize(controller, closeSentinel, 0);
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }
        function WritableStreamDefaultControllerGetChunkSize(controller, chunk) {
          try {
            return controller._strategySizeAlgorithm(chunk);
          } catch (chunkSizeE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, chunkSizeE);
            return 1;
          }
        }
        function WritableStreamDefaultControllerGetDesiredSize(controller) {
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function WritableStreamDefaultControllerWrite(controller, chunk, chunkSize) {
          try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
          } catch (enqueueE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, enqueueE);
            return;
          }
          const stream = controller._controlledWritableStream;
          if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._state === "writable") {
            const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
            WritableStreamUpdateBackpressure(stream, backpressure);
          }
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }
        function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller) {
          const stream = controller._controlledWritableStream;
          if (!controller._started) {
            return;
          }
          if (stream._inFlightWriteRequest !== void 0) {
            return;
          }
          const state = stream._state;
          if (state === "erroring") {
            WritableStreamFinishErroring(stream);
            return;
          }
          if (controller._queue.length === 0) {
            return;
          }
          const value = PeekQueueValue(controller);
          if (value === closeSentinel) {
            WritableStreamDefaultControllerProcessClose(controller);
          } else {
            WritableStreamDefaultControllerProcessWrite(controller, value);
          }
        }
        function WritableStreamDefaultControllerErrorIfNeeded(controller, error2) {
          if (controller._controlledWritableStream._state === "writable") {
            WritableStreamDefaultControllerError(controller, error2);
          }
        }
        function WritableStreamDefaultControllerProcessClose(controller) {
          const stream = controller._controlledWritableStream;
          WritableStreamMarkCloseRequestInFlight(stream);
          DequeueValue(controller);
          const sinkClosePromise = controller._closeAlgorithm();
          WritableStreamDefaultControllerClearAlgorithms(controller);
          uponPromise(sinkClosePromise, () => {
            WritableStreamFinishInFlightClose(stream);
          }, (reason) => {
            WritableStreamFinishInFlightCloseWithError(stream, reason);
          });
        }
        function WritableStreamDefaultControllerProcessWrite(controller, chunk) {
          const stream = controller._controlledWritableStream;
          WritableStreamMarkFirstWriteRequestInFlight(stream);
          const sinkWritePromise = controller._writeAlgorithm(chunk);
          uponPromise(sinkWritePromise, () => {
            WritableStreamFinishInFlightWrite(stream);
            const state = stream._state;
            DequeueValue(controller);
            if (!WritableStreamCloseQueuedOrInFlight(stream) && state === "writable") {
              const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
              WritableStreamUpdateBackpressure(stream, backpressure);
            }
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
          }, (reason) => {
            if (stream._state === "writable") {
              WritableStreamDefaultControllerClearAlgorithms(controller);
            }
            WritableStreamFinishInFlightWriteWithError(stream, reason);
          });
        }
        function WritableStreamDefaultControllerGetBackpressure(controller) {
          const desiredSize = WritableStreamDefaultControllerGetDesiredSize(controller);
          return desiredSize <= 0;
        }
        function WritableStreamDefaultControllerError(controller, error2) {
          const stream = controller._controlledWritableStream;
          WritableStreamDefaultControllerClearAlgorithms(controller);
          WritableStreamStartErroring(stream, error2);
        }
        function streamBrandCheckException$2(name) {
          return new TypeError(`WritableStream.prototype.${name} can only be used on a WritableStream`);
        }
        function defaultControllerBrandCheckException$2(name) {
          return new TypeError(`WritableStreamDefaultController.prototype.${name} can only be used on a WritableStreamDefaultController`);
        }
        function defaultWriterBrandCheckException(name) {
          return new TypeError(`WritableStreamDefaultWriter.prototype.${name} can only be used on a WritableStreamDefaultWriter`);
        }
        function defaultWriterLockException(name) {
          return new TypeError("Cannot " + name + " a stream using a released writer");
        }
        function defaultWriterClosedPromiseInitialize(writer) {
          writer._closedPromise = newPromise((resolve2, reject) => {
            writer._closedPromise_resolve = resolve2;
            writer._closedPromise_reject = reject;
            writer._closedPromiseState = "pending";
          });
        }
        function defaultWriterClosedPromiseInitializeAsRejected(writer, reason) {
          defaultWriterClosedPromiseInitialize(writer);
          defaultWriterClosedPromiseReject(writer, reason);
        }
        function defaultWriterClosedPromiseInitializeAsResolved(writer) {
          defaultWriterClosedPromiseInitialize(writer);
          defaultWriterClosedPromiseResolve(writer);
        }
        function defaultWriterClosedPromiseReject(writer, reason) {
          if (writer._closedPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(writer._closedPromise);
          writer._closedPromise_reject(reason);
          writer._closedPromise_resolve = void 0;
          writer._closedPromise_reject = void 0;
          writer._closedPromiseState = "rejected";
        }
        function defaultWriterClosedPromiseResetToRejected(writer, reason) {
          defaultWriterClosedPromiseInitializeAsRejected(writer, reason);
        }
        function defaultWriterClosedPromiseResolve(writer) {
          if (writer._closedPromise_resolve === void 0) {
            return;
          }
          writer._closedPromise_resolve(void 0);
          writer._closedPromise_resolve = void 0;
          writer._closedPromise_reject = void 0;
          writer._closedPromiseState = "resolved";
        }
        function defaultWriterReadyPromiseInitialize(writer) {
          writer._readyPromise = newPromise((resolve2, reject) => {
            writer._readyPromise_resolve = resolve2;
            writer._readyPromise_reject = reject;
          });
          writer._readyPromiseState = "pending";
        }
        function defaultWriterReadyPromiseInitializeAsRejected(writer, reason) {
          defaultWriterReadyPromiseInitialize(writer);
          defaultWriterReadyPromiseReject(writer, reason);
        }
        function defaultWriterReadyPromiseInitializeAsResolved(writer) {
          defaultWriterReadyPromiseInitialize(writer);
          defaultWriterReadyPromiseResolve(writer);
        }
        function defaultWriterReadyPromiseReject(writer, reason) {
          if (writer._readyPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(writer._readyPromise);
          writer._readyPromise_reject(reason);
          writer._readyPromise_resolve = void 0;
          writer._readyPromise_reject = void 0;
          writer._readyPromiseState = "rejected";
        }
        function defaultWriterReadyPromiseReset(writer) {
          defaultWriterReadyPromiseInitialize(writer);
        }
        function defaultWriterReadyPromiseResetToRejected(writer, reason) {
          defaultWriterReadyPromiseInitializeAsRejected(writer, reason);
        }
        function defaultWriterReadyPromiseResolve(writer) {
          if (writer._readyPromise_resolve === void 0) {
            return;
          }
          writer._readyPromise_resolve(void 0);
          writer._readyPromise_resolve = void 0;
          writer._readyPromise_reject = void 0;
          writer._readyPromiseState = "fulfilled";
        }
        const NativeDOMException = typeof DOMException !== "undefined" ? DOMException : void 0;
        function isDOMExceptionConstructor(ctor) {
          if (!(typeof ctor === "function" || typeof ctor === "object")) {
            return false;
          }
          try {
            new ctor();
            return true;
          } catch (_a) {
            return false;
          }
        }
        function createDOMExceptionPolyfill() {
          const ctor = function DOMException2(message, name) {
            this.message = message || "";
            this.name = name || "Error";
            if (Error.captureStackTrace) {
              Error.captureStackTrace(this, this.constructor);
            }
          };
          ctor.prototype = Object.create(Error.prototype);
          Object.defineProperty(ctor.prototype, "constructor", { value: ctor, writable: true, configurable: true });
          return ctor;
        }
        const DOMException$1 = isDOMExceptionConstructor(NativeDOMException) ? NativeDOMException : createDOMExceptionPolyfill();
        function ReadableStreamPipeTo(source, dest, preventClose, preventAbort, preventCancel, signal) {
          const reader = AcquireReadableStreamDefaultReader(source);
          const writer = AcquireWritableStreamDefaultWriter(dest);
          source._disturbed = true;
          let shuttingDown = false;
          let currentWrite = promiseResolvedWith(void 0);
          return newPromise((resolve2, reject) => {
            let abortAlgorithm;
            if (signal !== void 0) {
              abortAlgorithm = () => {
                const error2 = new DOMException$1("Aborted", "AbortError");
                const actions = [];
                if (!preventAbort) {
                  actions.push(() => {
                    if (dest._state === "writable") {
                      return WritableStreamAbort(dest, error2);
                    }
                    return promiseResolvedWith(void 0);
                  });
                }
                if (!preventCancel) {
                  actions.push(() => {
                    if (source._state === "readable") {
                      return ReadableStreamCancel(source, error2);
                    }
                    return promiseResolvedWith(void 0);
                  });
                }
                shutdownWithAction(() => Promise.all(actions.map((action) => action())), true, error2);
              };
              if (signal.aborted) {
                abortAlgorithm();
                return;
              }
              signal.addEventListener("abort", abortAlgorithm);
            }
            function pipeLoop() {
              return newPromise((resolveLoop, rejectLoop) => {
                function next(done) {
                  if (done) {
                    resolveLoop();
                  } else {
                    PerformPromiseThen(pipeStep(), next, rejectLoop);
                  }
                }
                next(false);
              });
            }
            function pipeStep() {
              if (shuttingDown) {
                return promiseResolvedWith(true);
              }
              return PerformPromiseThen(writer._readyPromise, () => {
                return newPromise((resolveRead, rejectRead) => {
                  ReadableStreamDefaultReaderRead(reader, {
                    _chunkSteps: (chunk) => {
                      currentWrite = PerformPromiseThen(WritableStreamDefaultWriterWrite(writer, chunk), void 0, noop2);
                      resolveRead(false);
                    },
                    _closeSteps: () => resolveRead(true),
                    _errorSteps: rejectRead
                  });
                });
              });
            }
            isOrBecomesErrored(source, reader._closedPromise, (storedError) => {
              if (!preventAbort) {
                shutdownWithAction(() => WritableStreamAbort(dest, storedError), true, storedError);
              } else {
                shutdown(true, storedError);
              }
            });
            isOrBecomesErrored(dest, writer._closedPromise, (storedError) => {
              if (!preventCancel) {
                shutdownWithAction(() => ReadableStreamCancel(source, storedError), true, storedError);
              } else {
                shutdown(true, storedError);
              }
            });
            isOrBecomesClosed(source, reader._closedPromise, () => {
              if (!preventClose) {
                shutdownWithAction(() => WritableStreamDefaultWriterCloseWithErrorPropagation(writer));
              } else {
                shutdown();
              }
            });
            if (WritableStreamCloseQueuedOrInFlight(dest) || dest._state === "closed") {
              const destClosed = new TypeError("the destination writable stream closed before all data could be piped to it");
              if (!preventCancel) {
                shutdownWithAction(() => ReadableStreamCancel(source, destClosed), true, destClosed);
              } else {
                shutdown(true, destClosed);
              }
            }
            setPromiseIsHandledToTrue(pipeLoop());
            function waitForWritesToFinish() {
              const oldCurrentWrite = currentWrite;
              return PerformPromiseThen(currentWrite, () => oldCurrentWrite !== currentWrite ? waitForWritesToFinish() : void 0);
            }
            function isOrBecomesErrored(stream, promise, action) {
              if (stream._state === "errored") {
                action(stream._storedError);
              } else {
                uponRejection(promise, action);
              }
            }
            function isOrBecomesClosed(stream, promise, action) {
              if (stream._state === "closed") {
                action();
              } else {
                uponFulfillment(promise, action);
              }
            }
            function shutdownWithAction(action, originalIsError, originalError) {
              if (shuttingDown) {
                return;
              }
              shuttingDown = true;
              if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
                uponFulfillment(waitForWritesToFinish(), doTheRest);
              } else {
                doTheRest();
              }
              function doTheRest() {
                uponPromise(action(), () => finalize(originalIsError, originalError), (newError) => finalize(true, newError));
              }
            }
            function shutdown(isError, error2) {
              if (shuttingDown) {
                return;
              }
              shuttingDown = true;
              if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
                uponFulfillment(waitForWritesToFinish(), () => finalize(isError, error2));
              } else {
                finalize(isError, error2);
              }
            }
            function finalize(isError, error2) {
              WritableStreamDefaultWriterRelease(writer);
              ReadableStreamReaderGenericRelease(reader);
              if (signal !== void 0) {
                signal.removeEventListener("abort", abortAlgorithm);
              }
              if (isError) {
                reject(error2);
              } else {
                resolve2(void 0);
              }
            }
          });
        }
        class ReadableStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get desiredSize() {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("desiredSize");
            }
            return ReadableStreamDefaultControllerGetDesiredSize(this);
          }
          close() {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("close");
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
              throw new TypeError("The stream is not in a state that permits close");
            }
            ReadableStreamDefaultControllerClose(this);
          }
          enqueue(chunk = void 0) {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("enqueue");
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
              throw new TypeError("The stream is not in a state that permits enqueue");
            }
            return ReadableStreamDefaultControllerEnqueue(this, chunk);
          }
          error(e = void 0) {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("error");
            }
            ReadableStreamDefaultControllerError(this, e);
          }
          [CancelSteps](reason) {
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableStreamDefaultControllerClearAlgorithms(this);
            return result;
          }
          [PullSteps](readRequest) {
            const stream = this._controlledReadableStream;
            if (this._queue.length > 0) {
              const chunk = DequeueValue(this);
              if (this._closeRequested && this._queue.length === 0) {
                ReadableStreamDefaultControllerClearAlgorithms(this);
                ReadableStreamClose(stream);
              } else {
                ReadableStreamDefaultControllerCallPullIfNeeded(this);
              }
              readRequest._chunkSteps(chunk);
            } else {
              ReadableStreamAddReadRequest(stream, readRequest);
              ReadableStreamDefaultControllerCallPullIfNeeded(this);
            }
          }
        }
        Object.defineProperties(ReadableStreamDefaultController.prototype, {
          close: { enumerable: true },
          enqueue: { enumerable: true },
          error: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamDefaultController",
            configurable: true
          });
        }
        function IsReadableStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableStream")) {
            return false;
          }
          return x instanceof ReadableStreamDefaultController;
        }
        function ReadableStreamDefaultControllerCallPullIfNeeded(controller) {
          const shouldPull = ReadableStreamDefaultControllerShouldCallPull(controller);
          if (!shouldPull) {
            return;
          }
          if (controller._pulling) {
            controller._pullAgain = true;
            return;
          }
          controller._pulling = true;
          const pullPromise = controller._pullAlgorithm();
          uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
              controller._pullAgain = false;
              ReadableStreamDefaultControllerCallPullIfNeeded(controller);
            }
          }, (e) => {
            ReadableStreamDefaultControllerError(controller, e);
          });
        }
        function ReadableStreamDefaultControllerShouldCallPull(controller) {
          const stream = controller._controlledReadableStream;
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return false;
          }
          if (!controller._started) {
            return false;
          }
          if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
          }
          const desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
          if (desiredSize > 0) {
            return true;
          }
          return false;
        }
        function ReadableStreamDefaultControllerClearAlgorithms(controller) {
          controller._pullAlgorithm = void 0;
          controller._cancelAlgorithm = void 0;
          controller._strategySizeAlgorithm = void 0;
        }
        function ReadableStreamDefaultControllerClose(controller) {
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
          }
          const stream = controller._controlledReadableStream;
          controller._closeRequested = true;
          if (controller._queue.length === 0) {
            ReadableStreamDefaultControllerClearAlgorithms(controller);
            ReadableStreamClose(stream);
          }
        }
        function ReadableStreamDefaultControllerEnqueue(controller, chunk) {
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
          }
          const stream = controller._controlledReadableStream;
          if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            ReadableStreamFulfillReadRequest(stream, chunk, false);
          } else {
            let chunkSize;
            try {
              chunkSize = controller._strategySizeAlgorithm(chunk);
            } catch (chunkSizeE) {
              ReadableStreamDefaultControllerError(controller, chunkSizeE);
              throw chunkSizeE;
            }
            try {
              EnqueueValueWithSize(controller, chunk, chunkSize);
            } catch (enqueueE) {
              ReadableStreamDefaultControllerError(controller, enqueueE);
              throw enqueueE;
            }
          }
          ReadableStreamDefaultControllerCallPullIfNeeded(controller);
        }
        function ReadableStreamDefaultControllerError(controller, e) {
          const stream = controller._controlledReadableStream;
          if (stream._state !== "readable") {
            return;
          }
          ResetQueue(controller);
          ReadableStreamDefaultControllerClearAlgorithms(controller);
          ReadableStreamError(stream, e);
        }
        function ReadableStreamDefaultControllerGetDesiredSize(controller) {
          const state = controller._controlledReadableStream._state;
          if (state === "errored") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function ReadableStreamDefaultControllerHasBackpressure(controller) {
          if (ReadableStreamDefaultControllerShouldCallPull(controller)) {
            return false;
          }
          return true;
        }
        function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller) {
          const state = controller._controlledReadableStream._state;
          if (!controller._closeRequested && state === "readable") {
            return true;
          }
          return false;
        }
        function SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm) {
          controller._controlledReadableStream = stream;
          controller._queue = void 0;
          controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._started = false;
          controller._closeRequested = false;
          controller._pullAgain = false;
          controller._pulling = false;
          controller._strategySizeAlgorithm = sizeAlgorithm;
          controller._strategyHWM = highWaterMark;
          controller._pullAlgorithm = pullAlgorithm;
          controller._cancelAlgorithm = cancelAlgorithm;
          stream._readableStreamController = controller;
          const startResult = startAlgorithm();
          uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableStreamDefaultControllerCallPullIfNeeded(controller);
          }, (r) => {
            ReadableStreamDefaultControllerError(controller, r);
          });
        }
        function SetUpReadableStreamDefaultControllerFromUnderlyingSource(stream, underlyingSource, highWaterMark, sizeAlgorithm) {
          const controller = Object.create(ReadableStreamDefaultController.prototype);
          let startAlgorithm = () => void 0;
          let pullAlgorithm = () => promiseResolvedWith(void 0);
          let cancelAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingSource.start !== void 0) {
            startAlgorithm = () => underlyingSource.start(controller);
          }
          if (underlyingSource.pull !== void 0) {
            pullAlgorithm = () => underlyingSource.pull(controller);
          }
          if (underlyingSource.cancel !== void 0) {
            cancelAlgorithm = (reason) => underlyingSource.cancel(reason);
          }
          SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
        }
        function defaultControllerBrandCheckException$1(name) {
          return new TypeError(`ReadableStreamDefaultController.prototype.${name} can only be used on a ReadableStreamDefaultController`);
        }
        function ReadableStreamTee(stream, cloneForBranch2) {
          if (IsReadableByteStreamController(stream._readableStreamController)) {
            return ReadableByteStreamTee(stream);
          }
          return ReadableStreamDefaultTee(stream);
        }
        function ReadableStreamDefaultTee(stream, cloneForBranch2) {
          const reader = AcquireReadableStreamDefaultReader(stream);
          let reading = false;
          let canceled1 = false;
          let canceled2 = false;
          let reason1;
          let reason2;
          let branch1;
          let branch2;
          let resolveCancelPromise;
          const cancelPromise = newPromise((resolve2) => {
            resolveCancelPromise = resolve2;
          });
          function pullAlgorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const readRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const chunk1 = chunk;
                  const chunk2 = chunk;
                  if (!canceled1) {
                    ReadableStreamDefaultControllerEnqueue(branch1._readableStreamController, chunk1);
                  }
                  if (!canceled2) {
                    ReadableStreamDefaultControllerEnqueue(branch2._readableStreamController, chunk2);
                  }
                });
              },
              _closeSteps: () => {
                reading = false;
                if (!canceled1) {
                  ReadableStreamDefaultControllerClose(branch1._readableStreamController);
                }
                if (!canceled2) {
                  ReadableStreamDefaultControllerClose(branch2._readableStreamController);
                }
                if (!canceled1 || !canceled2) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promiseResolvedWith(void 0);
          }
          function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function startAlgorithm() {
          }
          branch1 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel1Algorithm);
          branch2 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel2Algorithm);
          uponRejection(reader._closedPromise, (r) => {
            ReadableStreamDefaultControllerError(branch1._readableStreamController, r);
            ReadableStreamDefaultControllerError(branch2._readableStreamController, r);
            if (!canceled1 || !canceled2) {
              resolveCancelPromise(void 0);
            }
          });
          return [branch1, branch2];
        }
        function ReadableByteStreamTee(stream) {
          let reader = AcquireReadableStreamDefaultReader(stream);
          let reading = false;
          let canceled1 = false;
          let canceled2 = false;
          let reason1;
          let reason2;
          let branch1;
          let branch2;
          let resolveCancelPromise;
          const cancelPromise = newPromise((resolve2) => {
            resolveCancelPromise = resolve2;
          });
          function forwardReaderError(thisReader) {
            uponRejection(thisReader._closedPromise, (r) => {
              if (thisReader !== reader) {
                return;
              }
              ReadableByteStreamControllerError(branch1._readableStreamController, r);
              ReadableByteStreamControllerError(branch2._readableStreamController, r);
              if (!canceled1 || !canceled2) {
                resolveCancelPromise(void 0);
              }
            });
          }
          function pullWithDefaultReader() {
            if (IsReadableStreamBYOBReader(reader)) {
              ReadableStreamReaderGenericRelease(reader);
              reader = AcquireReadableStreamDefaultReader(stream);
              forwardReaderError(reader);
            }
            const readRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const chunk1 = chunk;
                  let chunk2 = chunk;
                  if (!canceled1 && !canceled2) {
                    try {
                      chunk2 = CloneAsUint8Array(chunk);
                    } catch (cloneE) {
                      ReadableByteStreamControllerError(branch1._readableStreamController, cloneE);
                      ReadableByteStreamControllerError(branch2._readableStreamController, cloneE);
                      resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                      return;
                    }
                  }
                  if (!canceled1) {
                    ReadableByteStreamControllerEnqueue(branch1._readableStreamController, chunk1);
                  }
                  if (!canceled2) {
                    ReadableByteStreamControllerEnqueue(branch2._readableStreamController, chunk2);
                  }
                });
              },
              _closeSteps: () => {
                reading = false;
                if (!canceled1) {
                  ReadableByteStreamControllerClose(branch1._readableStreamController);
                }
                if (!canceled2) {
                  ReadableByteStreamControllerClose(branch2._readableStreamController);
                }
                if (branch1._readableStreamController._pendingPullIntos.length > 0) {
                  ReadableByteStreamControllerRespond(branch1._readableStreamController, 0);
                }
                if (branch2._readableStreamController._pendingPullIntos.length > 0) {
                  ReadableByteStreamControllerRespond(branch2._readableStreamController, 0);
                }
                if (!canceled1 || !canceled2) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
          }
          function pullWithBYOBReader(view, forBranch2) {
            if (IsReadableStreamDefaultReader(reader)) {
              ReadableStreamReaderGenericRelease(reader);
              reader = AcquireReadableStreamBYOBReader(stream);
              forwardReaderError(reader);
            }
            const byobBranch = forBranch2 ? branch2 : branch1;
            const otherBranch = forBranch2 ? branch1 : branch2;
            const readIntoRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const byobCanceled = forBranch2 ? canceled2 : canceled1;
                  const otherCanceled = forBranch2 ? canceled1 : canceled2;
                  if (!otherCanceled) {
                    let clonedChunk;
                    try {
                      clonedChunk = CloneAsUint8Array(chunk);
                    } catch (cloneE) {
                      ReadableByteStreamControllerError(byobBranch._readableStreamController, cloneE);
                      ReadableByteStreamControllerError(otherBranch._readableStreamController, cloneE);
                      resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                      return;
                    }
                    if (!byobCanceled) {
                      ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                    }
                    ReadableByteStreamControllerEnqueue(otherBranch._readableStreamController, clonedChunk);
                  } else if (!byobCanceled) {
                    ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                  }
                });
              },
              _closeSteps: (chunk) => {
                reading = false;
                const byobCanceled = forBranch2 ? canceled2 : canceled1;
                const otherCanceled = forBranch2 ? canceled1 : canceled2;
                if (!byobCanceled) {
                  ReadableByteStreamControllerClose(byobBranch._readableStreamController);
                }
                if (!otherCanceled) {
                  ReadableByteStreamControllerClose(otherBranch._readableStreamController);
                }
                if (chunk !== void 0) {
                  if (!byobCanceled) {
                    ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                  }
                  if (!otherCanceled && otherBranch._readableStreamController._pendingPullIntos.length > 0) {
                    ReadableByteStreamControllerRespond(otherBranch._readableStreamController, 0);
                  }
                }
                if (!byobCanceled || !otherCanceled) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamBYOBReaderRead(reader, view, readIntoRequest);
          }
          function pull1Algorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1._readableStreamController);
            if (byobRequest === null) {
              pullWithDefaultReader();
            } else {
              pullWithBYOBReader(byobRequest._view, false);
            }
            return promiseResolvedWith(void 0);
          }
          function pull2Algorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2._readableStreamController);
            if (byobRequest === null) {
              pullWithDefaultReader();
            } else {
              pullWithBYOBReader(byobRequest._view, true);
            }
            return promiseResolvedWith(void 0);
          }
          function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function startAlgorithm() {
            return;
          }
          branch1 = CreateReadableByteStream(startAlgorithm, pull1Algorithm, cancel1Algorithm);
          branch2 = CreateReadableByteStream(startAlgorithm, pull2Algorithm, cancel2Algorithm);
          forwardReaderError(reader);
          return [branch1, branch2];
        }
        function convertUnderlyingDefaultOrByteSource(source, context) {
          assertDictionary(source, context);
          const original = source;
          const autoAllocateChunkSize = original === null || original === void 0 ? void 0 : original.autoAllocateChunkSize;
          const cancel = original === null || original === void 0 ? void 0 : original.cancel;
          const pull = original === null || original === void 0 ? void 0 : original.pull;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const type = original === null || original === void 0 ? void 0 : original.type;
          return {
            autoAllocateChunkSize: autoAllocateChunkSize === void 0 ? void 0 : convertUnsignedLongLongWithEnforceRange(autoAllocateChunkSize, `${context} has member 'autoAllocateChunkSize' that`),
            cancel: cancel === void 0 ? void 0 : convertUnderlyingSourceCancelCallback(cancel, original, `${context} has member 'cancel' that`),
            pull: pull === void 0 ? void 0 : convertUnderlyingSourcePullCallback(pull, original, `${context} has member 'pull' that`),
            start: start === void 0 ? void 0 : convertUnderlyingSourceStartCallback(start, original, `${context} has member 'start' that`),
            type: type === void 0 ? void 0 : convertReadableStreamType(type, `${context} has member 'type' that`)
          };
        }
        function convertUnderlyingSourceCancelCallback(fn, original, context) {
          assertFunction(fn, context);
          return (reason) => promiseCall(fn, original, [reason]);
        }
        function convertUnderlyingSourcePullCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => promiseCall(fn, original, [controller]);
        }
        function convertUnderlyingSourceStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertReadableStreamType(type, context) {
          type = `${type}`;
          if (type !== "bytes") {
            throw new TypeError(`${context} '${type}' is not a valid enumeration value for ReadableStreamType`);
          }
          return type;
        }
        function convertReaderOptions(options2, context) {
          assertDictionary(options2, context);
          const mode = options2 === null || options2 === void 0 ? void 0 : options2.mode;
          return {
            mode: mode === void 0 ? void 0 : convertReadableStreamReaderMode(mode, `${context} has member 'mode' that`)
          };
        }
        function convertReadableStreamReaderMode(mode, context) {
          mode = `${mode}`;
          if (mode !== "byob") {
            throw new TypeError(`${context} '${mode}' is not a valid enumeration value for ReadableStreamReaderMode`);
          }
          return mode;
        }
        function convertIteratorOptions(options2, context) {
          assertDictionary(options2, context);
          const preventCancel = options2 === null || options2 === void 0 ? void 0 : options2.preventCancel;
          return { preventCancel: Boolean(preventCancel) };
        }
        function convertPipeOptions(options2, context) {
          assertDictionary(options2, context);
          const preventAbort = options2 === null || options2 === void 0 ? void 0 : options2.preventAbort;
          const preventCancel = options2 === null || options2 === void 0 ? void 0 : options2.preventCancel;
          const preventClose = options2 === null || options2 === void 0 ? void 0 : options2.preventClose;
          const signal = options2 === null || options2 === void 0 ? void 0 : options2.signal;
          if (signal !== void 0) {
            assertAbortSignal(signal, `${context} has member 'signal' that`);
          }
          return {
            preventAbort: Boolean(preventAbort),
            preventCancel: Boolean(preventCancel),
            preventClose: Boolean(preventClose),
            signal
          };
        }
        function assertAbortSignal(signal, context) {
          if (!isAbortSignal2(signal)) {
            throw new TypeError(`${context} is not an AbortSignal.`);
          }
        }
        function convertReadableWritablePair(pair, context) {
          assertDictionary(pair, context);
          const readable = pair === null || pair === void 0 ? void 0 : pair.readable;
          assertRequiredField(readable, "readable", "ReadableWritablePair");
          assertReadableStream(readable, `${context} has member 'readable' that`);
          const writable2 = pair === null || pair === void 0 ? void 0 : pair.writable;
          assertRequiredField(writable2, "writable", "ReadableWritablePair");
          assertWritableStream(writable2, `${context} has member 'writable' that`);
          return { readable, writable: writable2 };
        }
        class ReadableStream2 {
          constructor(rawUnderlyingSource = {}, rawStrategy = {}) {
            if (rawUnderlyingSource === void 0) {
              rawUnderlyingSource = null;
            } else {
              assertObject(rawUnderlyingSource, "First parameter");
            }
            const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
            const underlyingSource = convertUnderlyingDefaultOrByteSource(rawUnderlyingSource, "First parameter");
            InitializeReadableStream(this);
            if (underlyingSource.type === "bytes") {
              if (strategy.size !== void 0) {
                throw new RangeError("The strategy for a byte stream cannot have a size function");
              }
              const highWaterMark = ExtractHighWaterMark(strategy, 0);
              SetUpReadableByteStreamControllerFromUnderlyingSource(this, underlyingSource, highWaterMark);
            } else {
              const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
              const highWaterMark = ExtractHighWaterMark(strategy, 1);
              SetUpReadableStreamDefaultControllerFromUnderlyingSource(this, underlyingSource, highWaterMark, sizeAlgorithm);
            }
          }
          get locked() {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("locked");
            }
            return IsReadableStreamLocked(this);
          }
          cancel(reason = void 0) {
            if (!IsReadableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$1("cancel"));
            }
            if (IsReadableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot cancel a stream that already has a reader"));
            }
            return ReadableStreamCancel(this, reason);
          }
          getReader(rawOptions = void 0) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("getReader");
            }
            const options2 = convertReaderOptions(rawOptions, "First parameter");
            if (options2.mode === void 0) {
              return AcquireReadableStreamDefaultReader(this);
            }
            return AcquireReadableStreamBYOBReader(this);
          }
          pipeThrough(rawTransform, rawOptions = {}) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("pipeThrough");
            }
            assertRequiredArgument(rawTransform, 1, "pipeThrough");
            const transform = convertReadableWritablePair(rawTransform, "First parameter");
            const options2 = convertPipeOptions(rawOptions, "Second parameter");
            if (IsReadableStreamLocked(this)) {
              throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
            }
            if (IsWritableStreamLocked(transform.writable)) {
              throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
            }
            const promise = ReadableStreamPipeTo(this, transform.writable, options2.preventClose, options2.preventAbort, options2.preventCancel, options2.signal);
            setPromiseIsHandledToTrue(promise);
            return transform.readable;
          }
          pipeTo(destination, rawOptions = {}) {
            if (!IsReadableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$1("pipeTo"));
            }
            if (destination === void 0) {
              return promiseRejectedWith(`Parameter 1 is required in 'pipeTo'.`);
            }
            if (!IsWritableStream(destination)) {
              return promiseRejectedWith(new TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`));
            }
            let options2;
            try {
              options2 = convertPipeOptions(rawOptions, "Second parameter");
            } catch (e) {
              return promiseRejectedWith(e);
            }
            if (IsReadableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream"));
            }
            if (IsWritableStreamLocked(destination)) {
              return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream"));
            }
            return ReadableStreamPipeTo(this, destination, options2.preventClose, options2.preventAbort, options2.preventCancel, options2.signal);
          }
          tee() {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("tee");
            }
            const branches = ReadableStreamTee(this);
            return CreateArrayFromList(branches);
          }
          values(rawOptions = void 0) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("values");
            }
            const options2 = convertIteratorOptions(rawOptions, "First parameter");
            return AcquireReadableStreamAsyncIterator(this, options2.preventCancel);
          }
        }
        Object.defineProperties(ReadableStream2.prototype, {
          cancel: { enumerable: true },
          getReader: { enumerable: true },
          pipeThrough: { enumerable: true },
          pipeTo: { enumerable: true },
          tee: { enumerable: true },
          values: { enumerable: true },
          locked: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStream",
            configurable: true
          });
        }
        if (typeof SymbolPolyfill.asyncIterator === "symbol") {
          Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.asyncIterator, {
            value: ReadableStream2.prototype.values,
            writable: true,
            configurable: true
          });
        }
        function CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
          const stream = Object.create(ReadableStream2.prototype);
          InitializeReadableStream(stream);
          const controller = Object.create(ReadableStreamDefaultController.prototype);
          SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
          return stream;
        }
        function CreateReadableByteStream(startAlgorithm, pullAlgorithm, cancelAlgorithm) {
          const stream = Object.create(ReadableStream2.prototype);
          InitializeReadableStream(stream);
          const controller = Object.create(ReadableByteStreamController.prototype);
          SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, 0, void 0);
          return stream;
        }
        function InitializeReadableStream(stream) {
          stream._state = "readable";
          stream._reader = void 0;
          stream._storedError = void 0;
          stream._disturbed = false;
        }
        function IsReadableStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readableStreamController")) {
            return false;
          }
          return x instanceof ReadableStream2;
        }
        function IsReadableStreamLocked(stream) {
          if (stream._reader === void 0) {
            return false;
          }
          return true;
        }
        function ReadableStreamCancel(stream, reason) {
          stream._disturbed = true;
          if (stream._state === "closed") {
            return promiseResolvedWith(void 0);
          }
          if (stream._state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          ReadableStreamClose(stream);
          const reader = stream._reader;
          if (reader !== void 0 && IsReadableStreamBYOBReader(reader)) {
            reader._readIntoRequests.forEach((readIntoRequest) => {
              readIntoRequest._closeSteps(void 0);
            });
            reader._readIntoRequests = new SimpleQueue();
          }
          const sourceCancelPromise = stream._readableStreamController[CancelSteps](reason);
          return transformPromiseWith(sourceCancelPromise, noop2);
        }
        function ReadableStreamClose(stream) {
          stream._state = "closed";
          const reader = stream._reader;
          if (reader === void 0) {
            return;
          }
          defaultReaderClosedPromiseResolve(reader);
          if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach((readRequest) => {
              readRequest._closeSteps();
            });
            reader._readRequests = new SimpleQueue();
          }
        }
        function ReadableStreamError(stream, e) {
          stream._state = "errored";
          stream._storedError = e;
          const reader = stream._reader;
          if (reader === void 0) {
            return;
          }
          defaultReaderClosedPromiseReject(reader, e);
          if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach((readRequest) => {
              readRequest._errorSteps(e);
            });
            reader._readRequests = new SimpleQueue();
          } else {
            reader._readIntoRequests.forEach((readIntoRequest) => {
              readIntoRequest._errorSteps(e);
            });
            reader._readIntoRequests = new SimpleQueue();
          }
        }
        function streamBrandCheckException$1(name) {
          return new TypeError(`ReadableStream.prototype.${name} can only be used on a ReadableStream`);
        }
        function convertQueuingStrategyInit(init2, context) {
          assertDictionary(init2, context);
          const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
          assertRequiredField(highWaterMark, "highWaterMark", "QueuingStrategyInit");
          return {
            highWaterMark: convertUnrestrictedDouble(highWaterMark)
          };
        }
        const byteLengthSizeFunction = (chunk) => {
          return chunk.byteLength;
        };
        Object.defineProperty(byteLengthSizeFunction, "name", {
          value: "size",
          configurable: true
        });
        class ByteLengthQueuingStrategy {
          constructor(options2) {
            assertRequiredArgument(options2, 1, "ByteLengthQueuingStrategy");
            options2 = convertQueuingStrategyInit(options2, "First parameter");
            this._byteLengthQueuingStrategyHighWaterMark = options2.highWaterMark;
          }
          get highWaterMark() {
            if (!IsByteLengthQueuingStrategy(this)) {
              throw byteLengthBrandCheckException("highWaterMark");
            }
            return this._byteLengthQueuingStrategyHighWaterMark;
          }
          get size() {
            if (!IsByteLengthQueuingStrategy(this)) {
              throw byteLengthBrandCheckException("size");
            }
            return byteLengthSizeFunction;
          }
        }
        Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
          highWaterMark: { enumerable: true },
          size: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ByteLengthQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: "ByteLengthQueuingStrategy",
            configurable: true
          });
        }
        function byteLengthBrandCheckException(name) {
          return new TypeError(`ByteLengthQueuingStrategy.prototype.${name} can only be used on a ByteLengthQueuingStrategy`);
        }
        function IsByteLengthQueuingStrategy(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_byteLengthQueuingStrategyHighWaterMark")) {
            return false;
          }
          return x instanceof ByteLengthQueuingStrategy;
        }
        const countSizeFunction = () => {
          return 1;
        };
        Object.defineProperty(countSizeFunction, "name", {
          value: "size",
          configurable: true
        });
        class CountQueuingStrategy {
          constructor(options2) {
            assertRequiredArgument(options2, 1, "CountQueuingStrategy");
            options2 = convertQueuingStrategyInit(options2, "First parameter");
            this._countQueuingStrategyHighWaterMark = options2.highWaterMark;
          }
          get highWaterMark() {
            if (!IsCountQueuingStrategy(this)) {
              throw countBrandCheckException("highWaterMark");
            }
            return this._countQueuingStrategyHighWaterMark;
          }
          get size() {
            if (!IsCountQueuingStrategy(this)) {
              throw countBrandCheckException("size");
            }
            return countSizeFunction;
          }
        }
        Object.defineProperties(CountQueuingStrategy.prototype, {
          highWaterMark: { enumerable: true },
          size: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(CountQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: "CountQueuingStrategy",
            configurable: true
          });
        }
        function countBrandCheckException(name) {
          return new TypeError(`CountQueuingStrategy.prototype.${name} can only be used on a CountQueuingStrategy`);
        }
        function IsCountQueuingStrategy(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_countQueuingStrategyHighWaterMark")) {
            return false;
          }
          return x instanceof CountQueuingStrategy;
        }
        function convertTransformer(original, context) {
          assertDictionary(original, context);
          const flush = original === null || original === void 0 ? void 0 : original.flush;
          const readableType = original === null || original === void 0 ? void 0 : original.readableType;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const transform = original === null || original === void 0 ? void 0 : original.transform;
          const writableType = original === null || original === void 0 ? void 0 : original.writableType;
          return {
            flush: flush === void 0 ? void 0 : convertTransformerFlushCallback(flush, original, `${context} has member 'flush' that`),
            readableType,
            start: start === void 0 ? void 0 : convertTransformerStartCallback(start, original, `${context} has member 'start' that`),
            transform: transform === void 0 ? void 0 : convertTransformerTransformCallback(transform, original, `${context} has member 'transform' that`),
            writableType
          };
        }
        function convertTransformerFlushCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => promiseCall(fn, original, [controller]);
        }
        function convertTransformerStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertTransformerTransformCallback(fn, original, context) {
          assertFunction(fn, context);
          return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
        }
        class TransformStream {
          constructor(rawTransformer = {}, rawWritableStrategy = {}, rawReadableStrategy = {}) {
            if (rawTransformer === void 0) {
              rawTransformer = null;
            }
            const writableStrategy = convertQueuingStrategy(rawWritableStrategy, "Second parameter");
            const readableStrategy = convertQueuingStrategy(rawReadableStrategy, "Third parameter");
            const transformer = convertTransformer(rawTransformer, "First parameter");
            if (transformer.readableType !== void 0) {
              throw new RangeError("Invalid readableType specified");
            }
            if (transformer.writableType !== void 0) {
              throw new RangeError("Invalid writableType specified");
            }
            const readableHighWaterMark = ExtractHighWaterMark(readableStrategy, 0);
            const readableSizeAlgorithm = ExtractSizeAlgorithm(readableStrategy);
            const writableHighWaterMark = ExtractHighWaterMark(writableStrategy, 1);
            const writableSizeAlgorithm = ExtractSizeAlgorithm(writableStrategy);
            let startPromise_resolve;
            const startPromise = newPromise((resolve2) => {
              startPromise_resolve = resolve2;
            });
            InitializeTransformStream(this, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
            SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);
            if (transformer.start !== void 0) {
              startPromise_resolve(transformer.start(this._transformStreamController));
            } else {
              startPromise_resolve(void 0);
            }
          }
          get readable() {
            if (!IsTransformStream(this)) {
              throw streamBrandCheckException("readable");
            }
            return this._readable;
          }
          get writable() {
            if (!IsTransformStream(this)) {
              throw streamBrandCheckException("writable");
            }
            return this._writable;
          }
        }
        Object.defineProperties(TransformStream.prototype, {
          readable: { enumerable: true },
          writable: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(TransformStream.prototype, SymbolPolyfill.toStringTag, {
            value: "TransformStream",
            configurable: true
          });
        }
        function InitializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm) {
          function startAlgorithm() {
            return startPromise;
          }
          function writeAlgorithm(chunk) {
            return TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
          }
          function abortAlgorithm(reason) {
            return TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
          }
          function closeAlgorithm() {
            return TransformStreamDefaultSinkCloseAlgorithm(stream);
          }
          stream._writable = CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);
          function pullAlgorithm() {
            return TransformStreamDefaultSourcePullAlgorithm(stream);
          }
          function cancelAlgorithm(reason) {
            TransformStreamErrorWritableAndUnblockWrite(stream, reason);
            return promiseResolvedWith(void 0);
          }
          stream._readable = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
          stream._backpressure = void 0;
          stream._backpressureChangePromise = void 0;
          stream._backpressureChangePromise_resolve = void 0;
          TransformStreamSetBackpressure(stream, true);
          stream._transformStreamController = void 0;
        }
        function IsTransformStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_transformStreamController")) {
            return false;
          }
          return x instanceof TransformStream;
        }
        function TransformStreamError(stream, e) {
          ReadableStreamDefaultControllerError(stream._readable._readableStreamController, e);
          TransformStreamErrorWritableAndUnblockWrite(stream, e);
        }
        function TransformStreamErrorWritableAndUnblockWrite(stream, e) {
          TransformStreamDefaultControllerClearAlgorithms(stream._transformStreamController);
          WritableStreamDefaultControllerErrorIfNeeded(stream._writable._writableStreamController, e);
          if (stream._backpressure) {
            TransformStreamSetBackpressure(stream, false);
          }
        }
        function TransformStreamSetBackpressure(stream, backpressure) {
          if (stream._backpressureChangePromise !== void 0) {
            stream._backpressureChangePromise_resolve();
          }
          stream._backpressureChangePromise = newPromise((resolve2) => {
            stream._backpressureChangePromise_resolve = resolve2;
          });
          stream._backpressure = backpressure;
        }
        class TransformStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get desiredSize() {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("desiredSize");
            }
            const readableController = this._controlledTransformStream._readable._readableStreamController;
            return ReadableStreamDefaultControllerGetDesiredSize(readableController);
          }
          enqueue(chunk = void 0) {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("enqueue");
            }
            TransformStreamDefaultControllerEnqueue(this, chunk);
          }
          error(reason = void 0) {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("error");
            }
            TransformStreamDefaultControllerError(this, reason);
          }
          terminate() {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("terminate");
            }
            TransformStreamDefaultControllerTerminate(this);
          }
        }
        Object.defineProperties(TransformStreamDefaultController.prototype, {
          enqueue: { enumerable: true },
          error: { enumerable: true },
          terminate: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(TransformStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "TransformStreamDefaultController",
            configurable: true
          });
        }
        function IsTransformStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledTransformStream")) {
            return false;
          }
          return x instanceof TransformStreamDefaultController;
        }
        function SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm) {
          controller._controlledTransformStream = stream;
          stream._transformStreamController = controller;
          controller._transformAlgorithm = transformAlgorithm;
          controller._flushAlgorithm = flushAlgorithm;
        }
        function SetUpTransformStreamDefaultControllerFromTransformer(stream, transformer) {
          const controller = Object.create(TransformStreamDefaultController.prototype);
          let transformAlgorithm = (chunk) => {
            try {
              TransformStreamDefaultControllerEnqueue(controller, chunk);
              return promiseResolvedWith(void 0);
            } catch (transformResultE) {
              return promiseRejectedWith(transformResultE);
            }
          };
          let flushAlgorithm = () => promiseResolvedWith(void 0);
          if (transformer.transform !== void 0) {
            transformAlgorithm = (chunk) => transformer.transform(chunk, controller);
          }
          if (transformer.flush !== void 0) {
            flushAlgorithm = () => transformer.flush(controller);
          }
          SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
        }
        function TransformStreamDefaultControllerClearAlgorithms(controller) {
          controller._transformAlgorithm = void 0;
          controller._flushAlgorithm = void 0;
        }
        function TransformStreamDefaultControllerEnqueue(controller, chunk) {
          const stream = controller._controlledTransformStream;
          const readableController = stream._readable._readableStreamController;
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController)) {
            throw new TypeError("Readable side is not in a state that permits enqueue");
          }
          try {
            ReadableStreamDefaultControllerEnqueue(readableController, chunk);
          } catch (e) {
            TransformStreamErrorWritableAndUnblockWrite(stream, e);
            throw stream._readable._storedError;
          }
          const backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
          if (backpressure !== stream._backpressure) {
            TransformStreamSetBackpressure(stream, true);
          }
        }
        function TransformStreamDefaultControllerError(controller, e) {
          TransformStreamError(controller._controlledTransformStream, e);
        }
        function TransformStreamDefaultControllerPerformTransform(controller, chunk) {
          const transformPromise = controller._transformAlgorithm(chunk);
          return transformPromiseWith(transformPromise, void 0, (r) => {
            TransformStreamError(controller._controlledTransformStream, r);
            throw r;
          });
        }
        function TransformStreamDefaultControllerTerminate(controller) {
          const stream = controller._controlledTransformStream;
          const readableController = stream._readable._readableStreamController;
          ReadableStreamDefaultControllerClose(readableController);
          const error2 = new TypeError("TransformStream terminated");
          TransformStreamErrorWritableAndUnblockWrite(stream, error2);
        }
        function TransformStreamDefaultSinkWriteAlgorithm(stream, chunk) {
          const controller = stream._transformStreamController;
          if (stream._backpressure) {
            const backpressureChangePromise = stream._backpressureChangePromise;
            return transformPromiseWith(backpressureChangePromise, () => {
              const writable2 = stream._writable;
              const state = writable2._state;
              if (state === "erroring") {
                throw writable2._storedError;
              }
              return TransformStreamDefaultControllerPerformTransform(controller, chunk);
            });
          }
          return TransformStreamDefaultControllerPerformTransform(controller, chunk);
        }
        function TransformStreamDefaultSinkAbortAlgorithm(stream, reason) {
          TransformStreamError(stream, reason);
          return promiseResolvedWith(void 0);
        }
        function TransformStreamDefaultSinkCloseAlgorithm(stream) {
          const readable = stream._readable;
          const controller = stream._transformStreamController;
          const flushPromise = controller._flushAlgorithm();
          TransformStreamDefaultControllerClearAlgorithms(controller);
          return transformPromiseWith(flushPromise, () => {
            if (readable._state === "errored") {
              throw readable._storedError;
            }
            ReadableStreamDefaultControllerClose(readable._readableStreamController);
          }, (r) => {
            TransformStreamError(stream, r);
            throw readable._storedError;
          });
        }
        function TransformStreamDefaultSourcePullAlgorithm(stream) {
          TransformStreamSetBackpressure(stream, false);
          return stream._backpressureChangePromise;
        }
        function defaultControllerBrandCheckException(name) {
          return new TypeError(`TransformStreamDefaultController.prototype.${name} can only be used on a TransformStreamDefaultController`);
        }
        function streamBrandCheckException(name) {
          return new TypeError(`TransformStream.prototype.${name} can only be used on a TransformStream`);
        }
        exports2.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
        exports2.CountQueuingStrategy = CountQueuingStrategy;
        exports2.ReadableByteStreamController = ReadableByteStreamController;
        exports2.ReadableStream = ReadableStream2;
        exports2.ReadableStreamBYOBReader = ReadableStreamBYOBReader;
        exports2.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest;
        exports2.ReadableStreamDefaultController = ReadableStreamDefaultController;
        exports2.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
        exports2.TransformStream = TransformStream;
        exports2.TransformStreamDefaultController = TransformStreamDefaultController;
        exports2.WritableStream = WritableStream;
        exports2.WritableStreamDefaultController = WritableStreamDefaultController;
        exports2.WritableStreamDefaultWriter = WritableStreamDefaultWriter;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    })(ponyfill_es2018, ponyfill_es2018.exports);
    POOL_SIZE$1 = 65536;
    if (!globalThis.ReadableStream) {
      try {
        const process2 = require("node:process");
        const { emitWarning } = process2;
        try {
          process2.emitWarning = () => {
          };
          Object.assign(globalThis, require("node:stream/web"));
          process2.emitWarning = emitWarning;
        } catch (error2) {
          process2.emitWarning = emitWarning;
          throw error2;
        }
      } catch (error2) {
        Object.assign(globalThis, ponyfill_es2018.exports);
      }
    }
    try {
      const { Blob: Blob3 } = require("buffer");
      if (Blob3 && !Blob3.prototype.stream) {
        Blob3.prototype.stream = function name(params) {
          let position = 0;
          const blob = this;
          return new ReadableStream({
            type: "bytes",
            async pull(ctrl) {
              const chunk = blob.slice(position, Math.min(blob.size, position + POOL_SIZE$1));
              const buffer = await chunk.arrayBuffer();
              position += buffer.byteLength;
              ctrl.enqueue(new Uint8Array(buffer));
              if (position === blob.size) {
                ctrl.close();
              }
            }
          });
        };
      }
    } catch (error2) {
    }
    POOL_SIZE = 65536;
    _Blob = class Blob {
      #parts = [];
      #type = "";
      #size = 0;
      constructor(blobParts = [], options2 = {}) {
        if (typeof blobParts !== "object" || blobParts === null) {
          throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");
        }
        if (typeof blobParts[Symbol.iterator] !== "function") {
          throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");
        }
        if (typeof options2 !== "object" && typeof options2 !== "function") {
          throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");
        }
        if (options2 === null)
          options2 = {};
        const encoder = new TextEncoder();
        for (const element of blobParts) {
          let part;
          if (ArrayBuffer.isView(element)) {
            part = new Uint8Array(element.buffer.slice(element.byteOffset, element.byteOffset + element.byteLength));
          } else if (element instanceof ArrayBuffer) {
            part = new Uint8Array(element.slice(0));
          } else if (element instanceof Blob) {
            part = element;
          } else {
            part = encoder.encode(element);
          }
          this.#size += ArrayBuffer.isView(part) ? part.byteLength : part.size;
          this.#parts.push(part);
        }
        const type = options2.type === void 0 ? "" : String(options2.type);
        this.#type = /^[\x20-\x7E]*$/.test(type) ? type : "";
      }
      get size() {
        return this.#size;
      }
      get type() {
        return this.#type;
      }
      async text() {
        const decoder = new TextDecoder();
        let str = "";
        for await (const part of toIterator(this.#parts, false)) {
          str += decoder.decode(part, { stream: true });
        }
        str += decoder.decode();
        return str;
      }
      async arrayBuffer() {
        const data = new Uint8Array(this.size);
        let offset = 0;
        for await (const chunk of toIterator(this.#parts, false)) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        return data.buffer;
      }
      stream() {
        const it = toIterator(this.#parts, true);
        return new globalThis.ReadableStream({
          type: "bytes",
          async pull(ctrl) {
            const chunk = await it.next();
            chunk.done ? ctrl.close() : ctrl.enqueue(chunk.value);
          },
          async cancel() {
            await it.return();
          }
        });
      }
      slice(start = 0, end = this.size, type = "") {
        const { size } = this;
        let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
        let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);
        const span = Math.max(relativeEnd - relativeStart, 0);
        const parts = this.#parts;
        const blobParts = [];
        let added = 0;
        for (const part of parts) {
          if (added >= span) {
            break;
          }
          const size2 = ArrayBuffer.isView(part) ? part.byteLength : part.size;
          if (relativeStart && size2 <= relativeStart) {
            relativeStart -= size2;
            relativeEnd -= size2;
          } else {
            let chunk;
            if (ArrayBuffer.isView(part)) {
              chunk = part.subarray(relativeStart, Math.min(size2, relativeEnd));
              added += chunk.byteLength;
            } else {
              chunk = part.slice(relativeStart, Math.min(size2, relativeEnd));
              added += chunk.size;
            }
            relativeEnd -= size2;
            blobParts.push(chunk);
            relativeStart = 0;
          }
        }
        const blob = new Blob([], { type: String(type).toLowerCase() });
        blob.#size = span;
        blob.#parts = blobParts;
        return blob;
      }
      get [Symbol.toStringTag]() {
        return "Blob";
      }
      static [Symbol.hasInstance](object) {
        return object && typeof object === "object" && typeof object.constructor === "function" && (typeof object.stream === "function" || typeof object.arrayBuffer === "function") && /^(Blob|File)$/.test(object[Symbol.toStringTag]);
      }
    };
    Object.defineProperties(_Blob.prototype, {
      size: { enumerable: true },
      type: { enumerable: true },
      slice: { enumerable: true }
    });
    Blob2 = _Blob;
    Blob$1 = Blob2;
    FetchBaseError = class extends Error {
      constructor(message, type) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.type = type;
      }
      get name() {
        return this.constructor.name;
      }
      get [Symbol.toStringTag]() {
        return this.constructor.name;
      }
    };
    FetchError = class extends FetchBaseError {
      constructor(message, type, systemError) {
        super(message, type);
        if (systemError) {
          this.code = this.errno = systemError.code;
          this.erroredSysCall = systemError.syscall;
        }
      }
    };
    NAME = Symbol.toStringTag;
    isURLSearchParameters = (object) => {
      return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME] === "URLSearchParams";
    };
    isBlob = (object) => {
      return typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME]);
    };
    isAbortSignal = (object) => {
      return typeof object === "object" && (object[NAME] === "AbortSignal" || object[NAME] === "EventTarget");
    };
    carriage = "\r\n";
    dashes = "-".repeat(2);
    carriageLength = Buffer.byteLength(carriage);
    getFooter = (boundary) => `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
    getBoundary = () => (0, import_crypto.randomBytes)(8).toString("hex");
    INTERNALS$2 = Symbol("Body internals");
    Body = class {
      constructor(body, {
        size = 0
      } = {}) {
        let boundary = null;
        if (body === null) {
          body = null;
        } else if (isURLSearchParameters(body)) {
          body = Buffer.from(body.toString());
        } else if (isBlob(body))
          ;
        else if (Buffer.isBuffer(body))
          ;
        else if (import_util.types.isAnyArrayBuffer(body)) {
          body = Buffer.from(body);
        } else if (ArrayBuffer.isView(body)) {
          body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
        } else if (body instanceof import_stream.default)
          ;
        else if (isFormData(body)) {
          boundary = `NodeFetchFormDataBoundary${getBoundary()}`;
          body = import_stream.default.Readable.from(formDataIterator(body, boundary));
        } else {
          body = Buffer.from(String(body));
        }
        this[INTERNALS$2] = {
          body,
          boundary,
          disturbed: false,
          error: null
        };
        this.size = size;
        if (body instanceof import_stream.default) {
          body.on("error", (error_) => {
            const error2 = error_ instanceof FetchBaseError ? error_ : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${error_.message}`, "system", error_);
            this[INTERNALS$2].error = error2;
          });
        }
      }
      get body() {
        return this[INTERNALS$2].body;
      }
      get bodyUsed() {
        return this[INTERNALS$2].disturbed;
      }
      async arrayBuffer() {
        const { buffer, byteOffset, byteLength } = await consumeBody(this);
        return buffer.slice(byteOffset, byteOffset + byteLength);
      }
      async blob() {
        const ct = this.headers && this.headers.get("content-type") || this[INTERNALS$2].body && this[INTERNALS$2].body.type || "";
        const buf = await this.buffer();
        return new Blob$1([buf], {
          type: ct
        });
      }
      async json() {
        const buffer = await consumeBody(this);
        return JSON.parse(buffer.toString());
      }
      async text() {
        const buffer = await consumeBody(this);
        return buffer.toString();
      }
      buffer() {
        return consumeBody(this);
      }
    };
    Object.defineProperties(Body.prototype, {
      body: { enumerable: true },
      bodyUsed: { enumerable: true },
      arrayBuffer: { enumerable: true },
      blob: { enumerable: true },
      json: { enumerable: true },
      text: { enumerable: true }
    });
    clone = (instance, highWaterMark) => {
      let p1;
      let p2;
      let { body } = instance;
      if (instance.bodyUsed) {
        throw new Error("cannot clone body after it is used");
      }
      if (body instanceof import_stream.default && typeof body.getBoundary !== "function") {
        p1 = new import_stream.PassThrough({ highWaterMark });
        p2 = new import_stream.PassThrough({ highWaterMark });
        body.pipe(p1);
        body.pipe(p2);
        instance[INTERNALS$2].body = p1;
        body = p2;
      }
      return body;
    };
    extractContentType = (body, request) => {
      if (body === null) {
        return null;
      }
      if (typeof body === "string") {
        return "text/plain;charset=UTF-8";
      }
      if (isURLSearchParameters(body)) {
        return "application/x-www-form-urlencoded;charset=UTF-8";
      }
      if (isBlob(body)) {
        return body.type || null;
      }
      if (Buffer.isBuffer(body) || import_util.types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
        return null;
      }
      if (body && typeof body.getBoundary === "function") {
        return `multipart/form-data;boundary=${body.getBoundary()}`;
      }
      if (isFormData(body)) {
        return `multipart/form-data; boundary=${request[INTERNALS$2].boundary}`;
      }
      if (body instanceof import_stream.default) {
        return null;
      }
      return "text/plain;charset=UTF-8";
    };
    getTotalBytes = (request) => {
      const { body } = request;
      if (body === null) {
        return 0;
      }
      if (isBlob(body)) {
        return body.size;
      }
      if (Buffer.isBuffer(body)) {
        return body.length;
      }
      if (body && typeof body.getLengthSync === "function") {
        return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
      }
      if (isFormData(body)) {
        return getFormDataLength(request[INTERNALS$2].boundary);
      }
      return null;
    };
    writeToStream = (dest, { body }) => {
      if (body === null) {
        dest.end();
      } else if (isBlob(body)) {
        import_stream.default.Readable.from(body.stream()).pipe(dest);
      } else if (Buffer.isBuffer(body)) {
        dest.write(body);
        dest.end();
      } else {
        body.pipe(dest);
      }
    };
    validateHeaderName = typeof import_http.default.validateHeaderName === "function" ? import_http.default.validateHeaderName : (name) => {
      if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
        const error2 = new TypeError(`Header name must be a valid HTTP token [${name}]`);
        Object.defineProperty(error2, "code", { value: "ERR_INVALID_HTTP_TOKEN" });
        throw error2;
      }
    };
    validateHeaderValue = typeof import_http.default.validateHeaderValue === "function" ? import_http.default.validateHeaderValue : (name, value) => {
      if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
        const error2 = new TypeError(`Invalid character in header content ["${name}"]`);
        Object.defineProperty(error2, "code", { value: "ERR_INVALID_CHAR" });
        throw error2;
      }
    };
    Headers = class extends URLSearchParams {
      constructor(init2) {
        let result = [];
        if (init2 instanceof Headers) {
          const raw = init2.raw();
          for (const [name, values] of Object.entries(raw)) {
            result.push(...values.map((value) => [name, value]));
          }
        } else if (init2 == null)
          ;
        else if (typeof init2 === "object" && !import_util.types.isBoxedPrimitive(init2)) {
          const method = init2[Symbol.iterator];
          if (method == null) {
            result.push(...Object.entries(init2));
          } else {
            if (typeof method !== "function") {
              throw new TypeError("Header pairs must be iterable");
            }
            result = [...init2].map((pair) => {
              if (typeof pair !== "object" || import_util.types.isBoxedPrimitive(pair)) {
                throw new TypeError("Each header pair must be an iterable object");
              }
              return [...pair];
            }).map((pair) => {
              if (pair.length !== 2) {
                throw new TypeError("Each header pair must be a name/value tuple");
              }
              return [...pair];
            });
          }
        } else {
          throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
        }
        result = result.length > 0 ? result.map(([name, value]) => {
          validateHeaderName(name);
          validateHeaderValue(name, String(value));
          return [String(name).toLowerCase(), String(value)];
        }) : void 0;
        super(result);
        return new Proxy(this, {
          get(target, p, receiver) {
            switch (p) {
              case "append":
              case "set":
                return (name, value) => {
                  validateHeaderName(name);
                  validateHeaderValue(name, String(value));
                  return URLSearchParams.prototype[p].call(target, String(name).toLowerCase(), String(value));
                };
              case "delete":
              case "has":
              case "getAll":
                return (name) => {
                  validateHeaderName(name);
                  return URLSearchParams.prototype[p].call(target, String(name).toLowerCase());
                };
              case "keys":
                return () => {
                  target.sort();
                  return new Set(URLSearchParams.prototype.keys.call(target)).keys();
                };
              default:
                return Reflect.get(target, p, receiver);
            }
          }
        });
      }
      get [Symbol.toStringTag]() {
        return this.constructor.name;
      }
      toString() {
        return Object.prototype.toString.call(this);
      }
      get(name) {
        const values = this.getAll(name);
        if (values.length === 0) {
          return null;
        }
        let value = values.join(", ");
        if (/^content-encoding$/i.test(name)) {
          value = value.toLowerCase();
        }
        return value;
      }
      forEach(callback, thisArg = void 0) {
        for (const name of this.keys()) {
          Reflect.apply(callback, thisArg, [this.get(name), name, this]);
        }
      }
      *values() {
        for (const name of this.keys()) {
          yield this.get(name);
        }
      }
      *entries() {
        for (const name of this.keys()) {
          yield [name, this.get(name)];
        }
      }
      [Symbol.iterator]() {
        return this.entries();
      }
      raw() {
        return [...this.keys()].reduce((result, key) => {
          result[key] = this.getAll(key);
          return result;
        }, {});
      }
      [Symbol.for("nodejs.util.inspect.custom")]() {
        return [...this.keys()].reduce((result, key) => {
          const values = this.getAll(key);
          if (key === "host") {
            result[key] = values[0];
          } else {
            result[key] = values.length > 1 ? values : values[0];
          }
          return result;
        }, {});
      }
    };
    Object.defineProperties(Headers.prototype, ["get", "entries", "forEach", "values"].reduce((result, property) => {
      result[property] = { enumerable: true };
      return result;
    }, {}));
    redirectStatus = new Set([301, 302, 303, 307, 308]);
    isRedirect = (code) => {
      return redirectStatus.has(code);
    };
    INTERNALS$1 = Symbol("Response internals");
    Response = class extends Body {
      constructor(body = null, options2 = {}) {
        super(body, options2);
        const status = options2.status != null ? options2.status : 200;
        const headers = new Headers(options2.headers);
        if (body !== null && !headers.has("Content-Type")) {
          const contentType = extractContentType(body);
          if (contentType) {
            headers.append("Content-Type", contentType);
          }
        }
        this[INTERNALS$1] = {
          type: "default",
          url: options2.url,
          status,
          statusText: options2.statusText || "",
          headers,
          counter: options2.counter,
          highWaterMark: options2.highWaterMark
        };
      }
      get type() {
        return this[INTERNALS$1].type;
      }
      get url() {
        return this[INTERNALS$1].url || "";
      }
      get status() {
        return this[INTERNALS$1].status;
      }
      get ok() {
        return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
      }
      get redirected() {
        return this[INTERNALS$1].counter > 0;
      }
      get statusText() {
        return this[INTERNALS$1].statusText;
      }
      get headers() {
        return this[INTERNALS$1].headers;
      }
      get highWaterMark() {
        return this[INTERNALS$1].highWaterMark;
      }
      clone() {
        return new Response(clone(this, this.highWaterMark), {
          type: this.type,
          url: this.url,
          status: this.status,
          statusText: this.statusText,
          headers: this.headers,
          ok: this.ok,
          redirected: this.redirected,
          size: this.size
        });
      }
      static redirect(url, status = 302) {
        if (!isRedirect(status)) {
          throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
        }
        return new Response(null, {
          headers: {
            location: new URL(url).toString()
          },
          status
        });
      }
      static error() {
        const response = new Response(null, { status: 0, statusText: "" });
        response[INTERNALS$1].type = "error";
        return response;
      }
      get [Symbol.toStringTag]() {
        return "Response";
      }
    };
    Object.defineProperties(Response.prototype, {
      type: { enumerable: true },
      url: { enumerable: true },
      status: { enumerable: true },
      ok: { enumerable: true },
      redirected: { enumerable: true },
      statusText: { enumerable: true },
      headers: { enumerable: true },
      clone: { enumerable: true }
    });
    getSearch = (parsedURL) => {
      if (parsedURL.search) {
        return parsedURL.search;
      }
      const lastOffset = parsedURL.href.length - 1;
      const hash2 = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
      return parsedURL.href[lastOffset - hash2.length] === "?" ? "?" : "";
    };
    INTERNALS = Symbol("Request internals");
    isRequest = (object) => {
      return typeof object === "object" && typeof object[INTERNALS] === "object";
    };
    Request = class extends Body {
      constructor(input, init2 = {}) {
        let parsedURL;
        if (isRequest(input)) {
          parsedURL = new URL(input.url);
        } else {
          parsedURL = new URL(input);
          input = {};
        }
        let method = init2.method || input.method || "GET";
        method = method.toUpperCase();
        if ((init2.body != null || isRequest(input)) && input.body !== null && (method === "GET" || method === "HEAD")) {
          throw new TypeError("Request with GET/HEAD method cannot have body");
        }
        const inputBody = init2.body ? init2.body : isRequest(input) && input.body !== null ? clone(input) : null;
        super(inputBody, {
          size: init2.size || input.size || 0
        });
        const headers = new Headers(init2.headers || input.headers || {});
        if (inputBody !== null && !headers.has("Content-Type")) {
          const contentType = extractContentType(inputBody, this);
          if (contentType) {
            headers.append("Content-Type", contentType);
          }
        }
        let signal = isRequest(input) ? input.signal : null;
        if ("signal" in init2) {
          signal = init2.signal;
        }
        if (signal != null && !isAbortSignal(signal)) {
          throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");
        }
        this[INTERNALS] = {
          method,
          redirect: init2.redirect || input.redirect || "follow",
          headers,
          parsedURL,
          signal
        };
        this.follow = init2.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init2.follow;
        this.compress = init2.compress === void 0 ? input.compress === void 0 ? true : input.compress : init2.compress;
        this.counter = init2.counter || input.counter || 0;
        this.agent = init2.agent || input.agent;
        this.highWaterMark = init2.highWaterMark || input.highWaterMark || 16384;
        this.insecureHTTPParser = init2.insecureHTTPParser || input.insecureHTTPParser || false;
      }
      get method() {
        return this[INTERNALS].method;
      }
      get url() {
        return (0, import_url.format)(this[INTERNALS].parsedURL);
      }
      get headers() {
        return this[INTERNALS].headers;
      }
      get redirect() {
        return this[INTERNALS].redirect;
      }
      get signal() {
        return this[INTERNALS].signal;
      }
      clone() {
        return new Request(this);
      }
      get [Symbol.toStringTag]() {
        return "Request";
      }
    };
    Object.defineProperties(Request.prototype, {
      method: { enumerable: true },
      url: { enumerable: true },
      headers: { enumerable: true },
      redirect: { enumerable: true },
      clone: { enumerable: true },
      signal: { enumerable: true }
    });
    getNodeRequestOptions = (request) => {
      const { parsedURL } = request[INTERNALS];
      const headers = new Headers(request[INTERNALS].headers);
      if (!headers.has("Accept")) {
        headers.set("Accept", "*/*");
      }
      let contentLengthValue = null;
      if (request.body === null && /^(post|put)$/i.test(request.method)) {
        contentLengthValue = "0";
      }
      if (request.body !== null) {
        const totalBytes = getTotalBytes(request);
        if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
          contentLengthValue = String(totalBytes);
        }
      }
      if (contentLengthValue) {
        headers.set("Content-Length", contentLengthValue);
      }
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", "node-fetch");
      }
      if (request.compress && !headers.has("Accept-Encoding")) {
        headers.set("Accept-Encoding", "gzip,deflate,br");
      }
      let { agent } = request;
      if (typeof agent === "function") {
        agent = agent(parsedURL);
      }
      if (!headers.has("Connection") && !agent) {
        headers.set("Connection", "close");
      }
      const search = getSearch(parsedURL);
      const requestOptions = {
        path: parsedURL.pathname + search,
        pathname: parsedURL.pathname,
        hostname: parsedURL.hostname,
        protocol: parsedURL.protocol,
        port: parsedURL.port,
        hash: parsedURL.hash,
        search: parsedURL.search,
        query: parsedURL.query,
        href: parsedURL.href,
        method: request.method,
        headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
        insecureHTTPParser: request.insecureHTTPParser,
        agent
      };
      return requestOptions;
    };
    AbortError = class extends FetchBaseError {
      constructor(message, type = "aborted") {
        super(message, type);
      }
    };
    supportedSchemas = new Set(["data:", "http:", "https:"]);
  }
});

// node_modules/@sveltejs/adapter-netlify/files/shims.js
var init_shims = __esm({
  "node_modules/@sveltejs/adapter-netlify/files/shims.js"() {
    init_install_fetch();
  }
});

// .svelte-kit/output/server/chunks/__layout-01feaf6f.js
var layout_01feaf6f_exports = {};
__export(layout_01feaf6f_exports, {
  default: () => _layout
});
var _layout;
var init_layout_01feaf6f = __esm({
  ".svelte-kit/output/server/chunks/__layout-01feaf6f.js"() {
    init_shims();
    init_app_907bc18b();
    _layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      return `${$$result.head += `<link href="${"../assets/css/bootstrap.css"}" rel="${"stylesheet"}" type="${"text/css"}" media="${"all"}" data-svelte="svelte-5hcfii"><link href="${"../assets/css/tastebite-styles.css"}" rel="${"stylesheet"}" type="${"text/css"}" media="${"all"}" data-svelte="svelte-5hcfii">`, ""}

<div class="${"container"}">
      <header class="${"tstbite-header bg-white"}"><nav class="${"navbar navbar-expand-lg has-header-inner px-0"}"><a class="${"navbar-brand"}" href="${"index.html"}"><img src="${"assets/images/brands/brand4.svg"}" style="${"max-width: 161px;"}" alt="${"Tastebite"}"></a>
          <div class="${"tstbite-header-links d-flex align-items-center ms-auto order-0 order-lg-2"}"><a href="${"javascript:void(0);"}" class="${"search-link"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"26.667"}" height="${"26.667"}" viewBox="${"0 0 26.667 26.667"}"><path d="${"M24.39,26.276l-4.9-4.9a12.012,12.012,0,1,1,1.885-1.885l4.9,4.9a1.334,1.334,0,0,1-1.886,1.886ZM2.666,12a9.329,9.329,0,0,0,15.827,6.7,1.338,1.338,0,0,1,.206-.206A9.332,9.332,0,1,0,2.666,12Z"}"></path></svg></a>
            <a href="${"#0"}" class="${"ms-4 ms-md-4 me-2 me-md-0 circle"}"><img src="${"assets/images/avatars/avatar1.png"}" alt="${"Avatar"}"></a></div>
          <button class="${"navbar-toggler pe-0 ms-2 ms-md-3"}" type="${"button"}" data-bs-toggle="${"collapse"}" data-bs-target="${"#menu-4"}" aria-controls="${"menu-4"}" aria-expanded="${"false"}" aria-label="${"Toggle navigation"}"><svg data-name="${"Icon/Hamburger"}" xmlns="${"http://www.w3.org/2000/svg"}" width="${"24"}" height="${"24"}" viewBox="${"0 0 24 24"}"><path data-name="${"Icon Color"}" d="${"M1.033,14a1.2,1.2,0,0,1-.409-.069.947.947,0,0,1-.337-.207,1.2,1.2,0,0,1-.216-.333,1.046,1.046,0,0,1-.072-.4A1.072,1.072,0,0,1,.072,12.6a.892.892,0,0,1,.216-.321.947.947,0,0,1,.337-.207A1.2,1.2,0,0,1,1.033,12H22.967a1.206,1.206,0,0,1,.409.069.935.935,0,0,1,.336.207.9.9,0,0,1,.217.321,1.072,1.072,0,0,1,.072.391,1.046,1.046,0,0,1-.072.4,1.206,1.206,0,0,1-.217.333.935.935,0,0,1-.336.207,1.206,1.206,0,0,1-.409.069Zm0-6a1.2,1.2,0,0,1-.409-.069.934.934,0,0,1-.337-.207,1.189,1.189,0,0,1-.216-.333A1.046,1.046,0,0,1,0,6.989,1.068,1.068,0,0,1,.072,6.6a.9.9,0,0,1,.216-.322.947.947,0,0,1,.337-.207A1.2,1.2,0,0,1,1.033,6H22.967a1.206,1.206,0,0,1,.409.068.935.935,0,0,1,.336.207.9.9,0,0,1,.217.322A1.068,1.068,0,0,1,24,6.989a1.046,1.046,0,0,1-.072.4,1.193,1.193,0,0,1-.217.333.923.923,0,0,1-.336.207A1.206,1.206,0,0,1,22.967,8Zm0-6a1.2,1.2,0,0,1-.409-.068.947.947,0,0,1-.337-.207,1.193,1.193,0,0,1-.216-.334A1.039,1.039,0,0,1,0,.988,1.068,1.068,0,0,1,.072.6.892.892,0,0,1,.288.276.934.934,0,0,1,.625.069,1.2,1.2,0,0,1,1.033,0H22.967a1.206,1.206,0,0,1,.409.069.923.923,0,0,1,.336.207A.9.9,0,0,1,23.928.6,1.068,1.068,0,0,1,24,.988a1.039,1.039,0,0,1-.072.4,1.2,1.2,0,0,1-.217.334.935.935,0,0,1-.336.207A1.206,1.206,0,0,1,22.967,2Z"}" transform="${"translate(0 5)"}" fill="${"#000"}"></path></svg></button>
          <div class="${"collapse navbar-collapse"}" id="${"menu-4"}"><ul class="${"navbar-nav m-auto pt-3 pt-lg-0"}"><li class="${"nav-item dropdown"}"><a class="${"nav-link"}" href="${"#"}" role="${"button"}" id="${"HomePage"}" data-bs-toggle="${"dropdown"}" aria-haspopup="${"true"}" aria-expanded="${"false"}"><span>Home Page</span>
                  <svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"9.333"}" height="${"5.333"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></a>
                <div class="${"dropdown-menu"}" aria-labelledby="${"HomePage"}"><a class="${"dropdown-item"}" href="${"index.html"}">Home V1</a>
                  <a class="${"dropdown-item"}" href="${"home-v2.html"}">Home V2</a>
                  <a class="${"dropdown-item"}" href="${"home-v3.html"}">Home V3</a></div></li>
              <li class="${"nav-item dropdown"}"><a class="${"nav-link"}" href="${"#"}" role="${"button"}" id="${"RecipePage"}" data-bs-toggle="${"dropdown"}" aria-haspopup="${"true"}" aria-expanded="${"false"}"><span>Recipe Page</span>
                  <svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"9.333"}" height="${"5.333"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></a>
                <div class="${"dropdown-menu"}" aria-labelledby="${"RecipePage"}"><a class="${"dropdown-item"}" href="${"recipe-full-width.html"}">Full Width</a>
                  <a class="${"dropdown-item"}" href="${"recipe-sidebar.html"}">Sidebar</a></div></li>
              <li class="${"nav-item dropdown"}"><a class="${"nav-link"}" href="${"#"}" role="${"button"}" id="${"Pages"}" data-bs-toggle="${"dropdown"}" aria-haspopup="${"true"}" aria-expanded="${"false"}"><span>Pages</span>
                  <svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"9.333"}" height="${"5.333"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></a>
                <div class="${"dropdown-menu"}" aria-labelledby="${"Pages"}"><a class="${"dropdown-item"}" href="${"category.html"}">Category</a>
                  <a class="${"dropdown-item"}" href="${"archive.html"}">Archive</a>
                  <a class="${"dropdown-item"}" href="${"favorites.html"}">Favorites</a>
                  <a class="${"dropdown-item"}" href="${"profile.html"}">Profile</a>
                  <a class="${"dropdown-item"}" href="${"about.html"}">About</a>
                  <a class="${"dropdown-item"}" href="${"blog.html"}">Blog Page</a>
                  <a class="${"dropdown-item"}" href="${"search-result.html"}">Search Results</a></div></li>
              <li class="${"nav-item"}"><a class="${"nav-link"}" href="${"elements.html"}">Elements</a></li>
              <li class="${"nav-item"}"><a class="${"nav-link"}" href="${"https://fabrx.co/tastebite-food-recipes-website-template/"}" target="${"_blank"}">Buy</a></li></ul></div></nav></header>
  
      
      <div class="${"tstbite-search"}"><div class="${"container"}"><div class="${"input-group search-box"}"><input type="${"text"}" name="${"Search"}" placeholder="${"Search"}" class="${"form-control"}" id="${"Search"}">
            <button type="${"button"}"><img src="${"assets/images/icons/close.svg"}" alt="${"img"}"></button></div>
          <div class="${"search-results"}" id="${"SearchList"}"><div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu111.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Cake</strong>
                  <span class="${"tiny"}">Category</span></div></a></div>
            <div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu112.jpg"}" class="${"rounded-2"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Black Forest Birthday Cake</strong></div></a></div>
            <div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu113.jpg"}" class="${"rounded-2"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Double Thick Layered Sponge Cake</strong></div></a></div>
            <div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu114.jpg"}" class="${"rounded-2"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Cranberry Macaroon Ice cream Cake</strong></div></a></div>
            <div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu115.jpg"}" class="${"rounded-2"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Almond Cinnamon Sponge Cake</strong></div></a></div>
            <div class="${"tstbite-search-list"}"><a href="${"#0"}"><figure><img src="${"assets/images/menus/menu116.jpg"}" class="${"rounded-2"}" alt="${"Menu"}"></figure>
                <div class="${"tstbite-search-name"}"><strong class="${"small"}">Four Mini Birthday Cupcakes</strong></div></a></div>
            <div class="${"text-center py-4"}"><a href="${"#0"}" class="${"btn btn-sm btn-outline-dark px-4 py-2"}">See all 343 results</a></div></div></div></div></div>

${slots.default ? slots.default({}) : ``}`;
    });
  }
});

// .svelte-kit/output/server/chunks/__error-9a67d2a0.js
var error_9a67d2a0_exports = {};
__export(error_9a67d2a0_exports, {
  default: () => _error,
  load: () => load
});
function load({ error: error2, status }) {
  return {
    props: { title: `${status} : ${error2.message}` }
  };
}
var _error;
var init_error_9a67d2a0 = __esm({
  ".svelte-kit/output/server/chunks/__error-9a67d2a0.js"() {
    init_shims();
    init_app_907bc18b();
    _error = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let { title } = $$props;
      if ($$props.title === void 0 && $$bindings.title && title !== void 0)
        $$bindings.title(title);
      return `<h3>${escape(title)}</h3>`;
    });
  }
});

// .svelte-kit/output/server/chunks/index-2c1d5ba2.js
var index_2c1d5ba2_exports = {};
__export(index_2c1d5ba2_exports, {
  default: () => Routes
});
var Routes;
var init_index_2c1d5ba2 = __esm({
  ".svelte-kit/output/server/chunks/index-2c1d5ba2.js"() {
    init_shims();
    init_app_907bc18b();
    Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      return `<section class="${"tstbite-section p-0"}"><div class="${"container"}"><div class="${"card rounded-16 overflow-hidden border-0 bg-secondary mt-0 mt-md-4"}"><div class="${"row g-0"}"><div class="${"col-lg-7"}"><img src="${"assets/images/menus/menu1.jpg"}" class="${"w-100"}" alt="${"Menu"}"></div>
          <div class="${"col-lg-5"}"><div class="${"p-4 p-md-5 d-flex flex-column justify-content-center h-100 position-relative"}"><strong><svg data-name="${"feather-icon/trending-up"}" xmlns="${"http://www.w3.org/2000/svg"}" width="${"20"}" height="${"20"}" viewBox="${"0 0 20 20"}"><rect data-name="${"Bounding Box"}" width="${"20"}" height="${"20"}" fill="${"rgba(255,255,255,0)"}"></rect><path d="${"M.244,11.423a.834.834,0,0,1,0-1.178L6.494,3.994a.834.834,0,0,1,1.178,0L11.25,7.571l5.9-5.9H14.167a.833.833,0,1,1,0-1.667h5A.833.833,0,0,1,20,.833v5a.834.834,0,0,1-1.667,0V2.845L11.839,9.339a.834.834,0,0,1-1.179,0L7.083,5.761l-5.66,5.661a.834.834,0,0,1-1.179,0Z"}" transform="${"translate(0 4.167)"}" fill="${"#ff642f"}"></path></svg>
                <span class="${"ms-2 caption font-weight-medium"}">85% would make this again</span></strong>
              <h4 class="${"my-3"}">Mighty Super Cheesecake</h4>
              <p class="${"big pe-0 pe-md-5 pb-3 pb-sm-5 pb-lg-0"}">Look no further for a creamy and ultra smooth classic cheesecake recipe! no one can deny its simple decadence.</p>
              <a href="${"#0"}" class="${"circle circle-lg tstbite-arrow"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"13.333"}" height="${"13.333"}" viewBox="${"0 0 13.333 13.333"}"><path d="${"M6.077,13.089a.833.833,0,0,1,0-1.178L10.488,7.5H.833a.833.833,0,0,1,0-1.667h9.655L6.077,1.423A.834.834,0,0,1,7.256.244l5.829,5.83a.833.833,0,0,1,0,1.186L7.256,13.089a.834.834,0,0,1-1.179,0Z"}" fill="${"#ff642f"}"></path></svg></a></div></div></div></div>
      
      <section class="${"tstbite-components my-4 my-md-5"}"><h5 class="${"py-3 mb-0"}">Super Delicious</h5>
        <div class="${"row"}"><div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu2.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio1"}" name="${"rate1"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio1"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio2"}" name="${"rate1"}" value="${"2"}">
                      <label for="${"radio2"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio3"}" name="${"rate1"}" value="${"3"}">
                      <label for="${"radio3"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio4"}" name="${"rate1"}" value="${"4"}">
                      <label for="${"radio4"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio5"}" name="${"rate1"}" value="${"5"}">
                      <label for="${"radio5"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Spinach and Cheese Pasta</a></figcaption></figure></div>
          <div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu3.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio6"}" name="${"rate2"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio6"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio7"}" name="${"rate2"}" value="${"2"}">
                      <label for="${"radio7"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio8"}" name="${"rate2"}" value="${"3"}">
                      <label for="${"radio8"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio9"}" name="${"rate2"}" value="${"4"}">
                      <label for="${"radio9"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio10"}" name="${"rate2"}" value="${"5"}">
                      <label for="${"radio10"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Fancy Glazed Dounts</a></figcaption></figure></div>
          <div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu4.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio11"}" name="${"rate3"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio11"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio12"}" name="${"rate3"}" value="${"2"}">
                      <label for="${"radio12"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio13"}" name="${"rate3"}" value="${"3"}">
                      <label for="${"radio13"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio14"}" name="${"rate3"}" value="${"4"}">
                      <label for="${"radio14"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio15"}" name="${"rate3"}" value="${"5"}">
                      <label for="${"radio15"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Mighty Cheesy Breakfast Burger</a></figcaption></figure></div></div></section>
      
      <section class="${"tstbite-components my-4 my-md-5"}"><h5 class="${"py-3 mb-0"}">Sweet Tooth</h5>
        <div class="${"row"}"><div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu5.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio16"}" name="${"rate4"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio16"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio17"}" name="${"rate4"}" value="${"2"}">
                      <label for="${"radio17"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio18"}" name="${"rate4"}" value="${"3"}">
                      <label for="${"radio18"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio19"}" name="${"rate4"}" value="${"4"}">
                      <label for="${"radio19"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio20"}" name="${"rate4"}" value="${"5"}">
                      <label for="${"radio20"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Caramel Strawberry Milkshake</a></figcaption></figure></div>
          <div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu6.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio21"}" name="${"rate5"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio21"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio22"}" name="${"rate5"}" value="${"2"}">
                      <label for="${"radio22"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio23"}" name="${"rate5"}" value="${"3"}">
                      <label for="${"radio23"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio24"}" name="${"rate5"}" value="${"4"}">
                      <label for="${"radio24"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio25"}" name="${"rate5"}" value="${"5"}">
                      <label for="${"radio25"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Chocolate and Banana Jar Cake</a></figcaption></figure></div>
          <div class="${"col-md-4"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation rounded-6"}"><img src="${"assets/images/menus/menu7.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><div class="${"w-100 float-start"}"><div class="${"float-start"}"><div class="${"fabrx-ratings has-rating rating"}"><input type="${"radio"}" id="${"radio26"}" name="${"rate6"}" value="${"1"}" checked="${"checked"}">
                      <label for="${"radio26"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio27"}" name="${"rate6"}" value="${"2"}">
                      <label for="${"radio27"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio28"}" name="${"rate6"}" value="${"3"}">
                      <label for="${"radio28"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio29"}" name="${"rate6"}" value="${"4"}">
                      <label for="${"radio29"}" class="${"custom-starboxes"}"></label>
                      <input type="${"radio"}" id="${"radio30"}" name="${"rate6"}" value="${"5"}">
                      <label for="${"radio30"}" class="${"custom-starboxes"}"></label></div></div></div>
                <a href="${"#0"}" class="${"f-size-20 text-black d-block mt-1 font-weight-semibold"}">Berry Maddness Biscuts</a></figcaption></figure></div></div></section>
      
      <section class="${"tstbite-components my-4 my-md-5"}"><h5 class="${"py-3 mb-0"}">Popular Categories</h5>
        <div class="${"row"}"><div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu8.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Pasta</a></figcaption></figure></div>
          <div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu9.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Pizza</a></figcaption></figure></div>
          <div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu10.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Vegan</a></figcaption></figure></div>
          <div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu11.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Desserts</a></figcaption></figure></div>
          <div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu12.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Smoothies</a></figcaption></figure></div>
          <div class="${"col-lg-2 col-md-4 col-4"}"><figure class="${"my-3 text-center tstbite-card"}"><a href="${"category.html"}" class="${"tstbite-animation stretched-link rounded-circle"}"><img src="${"assets/images/menus/menu13.png"}" class="${"rounded-circle"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"category.html"}" class="${"tstbite-category-title"}">Breakfast</a></figcaption></figure></div></div></section></div>
    
    <section class="${"tstbite-components bg-primary-light my-5 py-5"}"><div class="${"container"}"><div class="${"row"}"><div class="${"col-xl-6 col-lg-8 offset-xl-3 offset-lg-2 text-center py-4 py-md-5"}"><h2 class="${"mb-3 h1"}">Deliciousness to your inbox</h2>
            <p class="${"f-size-24 font-weight-regular"}">Enjoy weekly hand picked recipes <br>and recommendations</p>
            <div class="${"input-group custom-input-group mt-4"}"><input type="${"text"}" class="${"form-control"}" placeholder="${"Email Address"}">
              <div class="${"input-group-append"}"><button class="${"btn btn-primary"}" type="${"button"}">JOIN</button></div></div>
            <small class="${"mt-3 d-block"}">By joining our newsletter you agree to our <a href="${"#0"}" class="${"text-black d-block d-sm-inline-block"}"><u class="${"tstbite-underline"}">Terms and Conditions</u></a></small></div></div></div></section>
    <div class="${"container"}">
      <section class="${"tstbite-components my-4 my-md-5"}"><h5 class="${"py-3 h3 mb-0"}">Hand-Picked Collections</h5>
        <div class="${"row"}"><div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu14.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}" class="${"stretched-link"}">Sushi Combos for your Next Party</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div>
          <div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu15.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}">Everything Bagel</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div>
          <div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu16.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}">Cook Like a Chef</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div>
          <div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu17.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}">Exquisite Dinner Recipe Ideas</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div>
          <div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu18.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}">The Ultimate Cookie Frenzy</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div>
          <div class="${"col-md-6"}"><figure class="${"my-3 tstbite-card"}"><a href="${"#0"}" class="${"tstbite-animation stretched-link rounded-top-6"}"><img src="${"assets/images/menus/menu19.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"tstbite-collection border-top-0 rounded-bottom-6"}"><div class="${"text-black pt-3 pb-4 px-4 d-lg-flex align-items-end justify-content-between text-end"}"><h5 class="${"mb-3 md-lg-0 pe-0 pe-lg-4 text-start"}"><a href="${"#0"}">For the Love of Donuts</a></h5>
                  <span class="${"btn btn-sm btn-outline-dark text-nowrap"}">156 Recipes</span></div></figcaption></figure></div></div></section>
      
      <section class="${"tstbite-components my-4 my-md-5"}"><h5 class="${"py-3 mb-0"}">Latest Recipes</h5>
        <div class="${"row"}"><div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu20.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Caramel Strawberry Milkshake</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu21.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Cashew Vegan Rice</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu22.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Smoked Salmon Salad Sandwich</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu23.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Salmon in Creamy Sun Dried Tomato Sauce</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu24.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Healthy Jam Waffle Breakfast</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu25.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Chocolate and Banana Jar Cake</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu26.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Caramel Blueberry Scones</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu27.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Blueberry Carrot Cake</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu28.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Vegan Cauliflower Salad</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu29.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Roasted Red Pepper Soup</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu30.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Eggs and Avocado Toast</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu31.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Pork Shoulder Cashew Noodles</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu32.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Toasted Farfalle In Pesto Sauce</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu33.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Cheesy Bacon Burger Sliders</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu34.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Fig and Raisins Oatmeal</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu35.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Silky Smooth Panacotta</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu36.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Triple Decker Cranberry Cake</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu37.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Very Berry Healthy Summer Smoothie</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu38.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Crispy Orange Chips</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu39.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Tumeric Lavendar Tea</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu40.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Blue Velvet Brownies</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu41.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Birthday Cupcakes</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu42.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Gourmet Fillet in Roasted Almond Sauce</a></figcaption></figure></div>
          <div class="${"col-lg-3 col-md-4 col-6"}"><figure class="${"my-3 my-md-4 tstbite-card"}"><a href="${"recipe-sidebar.html"}" class="${"tstbite-animation stretched-link rounded-6"}"><img src="${"assets/images/menus/menu43.jpg"}" class="${"w-100"}" alt="${"Menu"}"></a>
              <figcaption class="${"mt-2"}"><a href="${"recipe-sidebar.html"}" class="${"text-black d-block mt-1 font-weight-semibold big"}">Four Ingredient Oatmeal Pancakes</a></figcaption></figure></div></div>
        <div class="${"text-center py-5"}"><a href="${"#0"}" class="${"btn btn-outline-dark px-4 px-md-5 py-1 py-md-2 big font-weight-medium"}">Load More</a></div></section></div>
    
    <footer class="${"tstbite-footer pt-3 pt-md-5 mt-5 bg-lightest-gray"}"><div class="${"container"}"><div class="${"row pt-4 pb-0 pb-md-5"}"><div class="${"col-md-6"}"><div class="${"tastebite-footer-contnet pe-0 pe-lg-5 me-0 me-md-5"}"><a href="${"index.html"}"><img src="${"assets/images/brands/brand4.svg"}" alt="${"Tastebite"}"></a>
              <p class="${"mt-3 text-gray-300 pe-0 pe-lg-5 me-0 me-lg-4"}">&quot;On the other hand, we denounce with righteous indignation and dislike men who are so beguiled and demoralized by the charms of pleasure of the moment</p></div></div>
          <div class="${"col-md-2"}"><h6 class="${"caption font-weight-medium mb-2 inter-font"}"><span>Tastebite</span>
              <span class="${"d-inline-block d-md-none float-end"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"14"}" height="${"8"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></span></h6>
            <ul><li><a href="${"#0"}">About us</a></li>
              <li><a href="${"#0"}">Careers</a></li>
              <li><a href="${"#0"}">Contact us</a></li>
              <li><a href="${"#0"}">Feedback</a></li></ul></div>
          <div class="${"col-md-2"}"><h6 class="${"caption font-weight-medium mb-2 inter-font"}"><span>Legal</span>
              <span class="${"d-inline-block d-md-none float-end"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"14"}" height="${"8"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></span></h6>
            <ul><li><a href="${"#0"}">Terms</a></li>
              <li><a href="${"#0"}">Conditions</a></li>
              <li><a href="${"#0"}">Cookies</a></li>
              <li><a href="${"#0"}">Copyright</a></li></ul></div>
          <div class="${"col-md-2"}"><h6 class="${"caption font-weight-medium mb-2 inter-font"}"><span>Follow</span>
              <span class="${"d-inline-block d-md-none float-end"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"14"}" height="${"8"}" viewBox="${"0 0 9.333 5.333"}"><path d="${"M1.138.2A.667.667,0,0,0,.2,1.138l4,4a.667.667,0,0,0,.943,0l4-4A.667.667,0,1,0,8.2.2L4.667,3.724Z"}"></path></svg></span></h6>
            <ul><li><a href="${"#0"}">Facebook</a></li>
              <li><a href="${"#0"}">Twitter</a></li>
              <li><a href="${"#0"}">Instagram</a></li>
              <li><a href="${"#0"}">Youtube</a></li></ul></div></div></div>
      <div class="${"container"}"><hr>
        <div class="${"row pb-4 pt-2 align-items-center"}"><div class="${"col-md-6 order-2 order-md-0"}"><p class="${"text-gray-300 small text-start mb-0"}">\xA9 2020 Tastebite - All rights reserved</p></div>
          <div class="${"col-md-6"}"><div class="${"tstbite-social text-start text-md-end my-4 my-md-0"}"><a href="${"#0"}"><svg data-name="${"feather-icon/facebook"}" xmlns="${"http://www.w3.org/2000/svg"}" width="${"20"}" height="${"20"}" viewBox="${"0 0 20 20"}"><rect data-name="${"Bounding Box"}" width="${"20"}" height="${"20"}" fill="${"rgba(255,255,255,0)"}"></rect><path d="${"M6.667,18.333H3.333A.834.834,0,0,1,2.5,17.5V11.667H.833A.835.835,0,0,1,0,10.833V7.5a.834.834,0,0,1,.833-.833H2.5V5a5.006,5.006,0,0,1,5-5H10a.834.834,0,0,1,.833.833V4.167A.834.834,0,0,1,10,5H7.5V6.667H10A.833.833,0,0,1,10.808,7.7l-.833,3.334a.831.831,0,0,1-.809.631H7.5V17.5A.834.834,0,0,1,6.667,18.333Zm-5-10V10H3.333a.835.835,0,0,1,.834.833v5.834H5.833V10.833A.834.834,0,0,1,6.667,10h1.85l.416-1.667H6.667A.834.834,0,0,1,5.833,7.5V5A1.669,1.669,0,0,1,7.5,3.333H9.166V1.666H7.5A3.337,3.337,0,0,0,4.167,5V7.5a.835.835,0,0,1-.834.833Z"}" transform="${"translate(5 0.833)"}" fill="${"#7f7f7f"}"></path></svg></a>
              <a href="${"#0"}"><svg data-name="${"feather-icon/instagram"}" xmlns="${"http://www.w3.org/2000/svg"}" width="${"20"}" height="${"20"}" viewBox="${"0 0 20 20"}"><rect data-name="${"Bounding Box"}" width="${"20"}" height="${"20"}" fill="${"rgba(255,255,255,0)"}"></rect><path d="${"M5,18.333a5.005,5.005,0,0,1-5-5V5A5.006,5.006,0,0,1,5,0h8.333a5.005,5.005,0,0,1,5,5v8.333a5,5,0,0,1-5,5ZM1.667,5v8.333A3.337,3.337,0,0,0,5,16.667h8.333a3.337,3.337,0,0,0,3.333-3.333V5a3.337,3.337,0,0,0-3.333-3.334H5A3.338,3.338,0,0,0,1.667,5Zm4.59,7.076A4.164,4.164,0,1,1,9.2,13.3,4.161,4.161,0,0,1,6.256,12.076Zm.713-4.07a2.5,2.5,0,1,0,2.6-1.348A2.527,2.527,0,0,0,9.2,6.631,2.487,2.487,0,0,0,6.97,8.006Zm6.191-2.833a.833.833,0,1,1,.589.244A.834.834,0,0,1,13.161,5.173Z"}" transform="${"translate(0.833 0.833)"}" fill="${"#7f7f7f"}"></path></svg></a>
              <a href="${"#0"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"20.004"}" height="${"20"}" viewBox="${"0 0 20.004 20"}"><g data-name="${"feather-icon/twitter"}" transform="${"translate(0.002)"}"><rect data-name="${"Bounding Box"}" width="${"20"}" height="${"20"}" fill="${"rgba(255,255,255,0)"}"></rect><path d="${"M6.894,16.644A13.387,13.387,0,0,1,.431,14.9a.834.834,0,0,1,.4-1.562H.869c.118,0,.237.007.354.007a8.925,8.925,0,0,0,3.708-.813,8.043,8.043,0,0,1-3.59-4.4A9.651,9.651,0,0,1,1.329,2.55a8.74,8.74,0,0,1,.412-1.214A.833.833,0,0,1,3.184,1.2,8.049,8.049,0,0,0,8.914,4.574l.255.023,0-.2A4.567,4.567,0,0,1,16.78,1.162a8.239,8.239,0,0,0,1.909-1,.827.827,0,0,1,.478-.155.852.852,0,0,1,.663.326.811.811,0,0,1,.149.707,7.28,7.28,0,0,1-1.662,3.145c.012.138.019.276.019.408a13.328,13.328,0,0,1-.922,4.987A11.157,11.157,0,0,1,6.894,16.644ZM2.839,3.378a7.847,7.847,0,0,0,.086,4.238,6.928,6.928,0,0,0,4.081,4.131.833.833,0,0,1,.13,1.451,10.505,10.505,0,0,1-3.025,1.414,10.962,10.962,0,0,0,2.786.367,9.566,9.566,0,0,0,6.869-2.807,10.5,10.5,0,0,0,2.9-7.576,2.817,2.817,0,0,0-.052-.538.834.834,0,0,1,.233-.75,5.6,5.6,0,0,0,.515-.583l-.285.1-.288.091a.831.831,0,0,1-.868-.25,2.9,2.9,0,0,0-5.088,1.953V5.45a.829.829,0,0,1-.812.833c-.084,0-.169,0-.253,0A9.659,9.659,0,0,1,6,5.525,9.669,9.669,0,0,1,2.839,3.378Z"}" transform="${"translate(-0.002 1.658)"}" fill="${"#7f7f7f"}"></path></g></svg></a>
              <a href="${"#0"}"><svg xmlns="${"http://www.w3.org/2000/svg"}" width="${"20.001"}" height="${"20"}" viewBox="${"0 0 20.001 20"}"><g data-name="${"feather-icon/youtube"}" transform="${"translate(0)"}"><rect data-name="${"Bounding Box"}" width="${"20"}" height="${"20"}" fill="${"rgba(255,255,255,0)"}"></rect><path d="${"M9.475,14.547,8.157,14.53c-.7-.013-1.348-.031-1.934-.053l-.592-.025a16.853,16.853,0,0,1-3.019-.316A3.189,3.189,0,0,1,.4,11.881,25.065,25.065,0,0,1,0,7.3,24.913,24.913,0,0,1,.408,2.681,3.168,3.168,0,0,1,2.618.411,17.815,17.815,0,0,1,5.8.089L6.887.049C7.536.029,8.205.016,8.876.008L9.8,0h.484L11.4.01c.584.007,1.173.02,1.748.036l.583.018a21.6,21.6,0,0,1,3.668.317A3.158,3.158,0,0,1,19.6,2.7,25.076,25.076,0,0,1,20,7.289a24.8,24.8,0,0,1-.408,4.58,3.164,3.164,0,0,1-2.209,2.269,16.78,16.78,0,0,1-3.014.315l-.592.025c-.586.023-1.237.041-1.934.053l-1.318.017ZM9.358,1.669c-.816.007-1.6.021-2.32.042l-1.109.04a18.192,18.192,0,0,0-2.868.266A1.468,1.468,0,0,0,2.037,3.031,23.455,23.455,0,0,0,1.667,7.3,23.669,23.669,0,0,0,2.018,11.5a1.488,1.488,0,0,0,1.031,1.024,18.758,18.758,0,0,0,2.977.273l.881.032c.374.011.793.022,1.282.031l1.3.017h1.026l1.3-.017c.488-.009.907-.019,1.282-.031l.881-.032.736-.035a14.14,14.14,0,0,0,2.228-.235,1.468,1.468,0,0,0,1.024-1.012,23.446,23.446,0,0,0,.37-4.232,23.255,23.255,0,0,0-.358-4.234,1.483,1.483,0,0,0-1.006-1.06,17.158,17.158,0,0,0-2.524-.232l-.776-.031c-.681-.023-1.453-.041-2.3-.053l-1.092-.009H9.8ZM7.545,10.616a.823.823,0,0,1-.254-.6V4.566a.835.835,0,0,1,.835-.834.822.822,0,0,1,.41.11l4.792,2.725a.833.833,0,0,1,0,1.449L8.537,10.74a.821.821,0,0,1-.411.111A.845.845,0,0,1,7.545,10.616ZM8.958,8.583l2.272-1.292L8.958,6Z"}" transform="${"translate(0 2.501)"}" fill="${"#7f7f7f"}"></path></g></svg></a></div></div></div></div></footer></section>`;
    });
  }
});

// .svelte-kit/output/server/chunks/app-907bc18b.js
function get_single_valued_header(headers, key) {
  const value = headers[key];
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return void 0;
    }
    if (value.length > 1) {
      throw new Error(`Multiple headers provided for ${key}. Multiple may be provided only for set-cookie`);
    }
    return value[0];
  }
  return value;
}
function resolve(base2, path) {
  if (scheme.test(path))
    return path;
  const base_match = absolute.exec(base2);
  const path_match = absolute.exec(path);
  if (!base_match) {
    throw new Error(`bad base path: "${base2}"`);
  }
  const baseparts = path_match ? [] : base2.slice(base_match[0].length).split("/");
  const pathparts = path_match ? path.slice(path_match[0].length).split("/") : path.split("/");
  baseparts.pop();
  for (let i = 0; i < pathparts.length; i += 1) {
    const part = pathparts[i];
    if (part === ".")
      continue;
    else if (part === "..")
      baseparts.pop();
    else
      baseparts.push(part);
  }
  const prefix = path_match && path_match[0] || base_match && base_match[0] || "";
  return `${prefix}${baseparts.join("/")}`;
}
function is_root_relative(path) {
  return path[0] === "/" && path[1] !== "/";
}
function coalesce_to_error(err) {
  return err instanceof Error || err && err.name && err.message ? err : new Error(JSON.stringify(err));
}
function lowercase_keys(obj) {
  const clone2 = {};
  for (const key in obj) {
    clone2[key.toLowerCase()] = obj[key];
  }
  return clone2;
}
function error(body) {
  return {
    status: 500,
    body,
    headers: {}
  };
}
function is_string(s2) {
  return typeof s2 === "string" || s2 instanceof String;
}
function is_content_type_textual(content_type) {
  if (!content_type)
    return true;
  const [type] = content_type.split(";");
  return type === "text/plain" || type === "application/json" || type === "application/x-www-form-urlencoded" || type === "multipart/form-data";
}
async function render_endpoint(request, route, match) {
  const mod = await route.load();
  const handler2 = mod[request.method.toLowerCase().replace("delete", "del")];
  if (!handler2) {
    return;
  }
  const params = route.params(match);
  const response = await handler2({ ...request, params });
  const preface = `Invalid response from route ${request.path}`;
  if (!response) {
    return;
  }
  if (typeof response !== "object") {
    return error(`${preface}: expected an object, got ${typeof response}`);
  }
  let { status = 200, body, headers = {} } = response;
  headers = lowercase_keys(headers);
  const type = get_single_valued_header(headers, "content-type");
  const is_type_textual = is_content_type_textual(type);
  if (!is_type_textual && !(body instanceof Uint8Array || is_string(body))) {
    return error(`${preface}: body must be an instance of string or Uint8Array if content-type is not a supported textual content-type`);
  }
  let normalized_body;
  if ((typeof body === "object" || typeof body === "undefined") && !(body instanceof Uint8Array) && (!type || type.startsWith("application/json"))) {
    headers = { ...headers, "content-type": "application/json; charset=utf-8" };
    normalized_body = JSON.stringify(typeof body === "undefined" ? {} : body);
  } else {
    normalized_body = body;
  }
  return { status, body: normalized_body, headers };
}
function devalue(value) {
  var counts = new Map();
  function walk(thing) {
    if (typeof thing === "function") {
      throw new Error("Cannot stringify a function");
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          var proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            throw new Error("Cannot stringify arbitrary non-POJOs");
          }
          if (Object.getOwnPropertySymbols(thing).length > 0) {
            throw new Error("Cannot stringify POJOs with symbolic keys");
          }
          Object.keys(thing).forEach(function(key) {
            return walk(thing[key]);
          });
      }
    }
  }
  walk(value);
  var names = new Map();
  Array.from(counts).filter(function(entry) {
    return entry[1] > 1;
  }).sort(function(a, b) {
    return b[1] - a[1];
  }).forEach(function(entry, i) {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    var type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return "Object(" + stringify(thing.valueOf()) + ")";
      case "RegExp":
        return "new RegExp(" + stringifyString(thing.source) + ', "' + thing.flags + '")';
      case "Date":
        return "new Date(" + thing.getTime() + ")";
      case "Array":
        var members = thing.map(function(v, i) {
          return i in thing ? stringify(v) : "";
        });
        var tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return "[" + members.join(",") + tail + "]";
      case "Set":
      case "Map":
        return "new " + type + "([" + Array.from(thing).map(stringify).join(",") + "])";
      default:
        var obj = "{" + Object.keys(thing).map(function(key) {
          return safeKey(key) + ":" + stringify(thing[key]);
        }).join(",") + "}";
        var proto = Object.getPrototypeOf(thing);
        if (proto === null) {
          return Object.keys(thing).length > 0 ? "Object.assign(Object.create(null)," + obj + ")" : "Object.create(null)";
        }
        return obj;
    }
  }
  var str = stringify(value);
  if (names.size) {
    var params_1 = [];
    var statements_1 = [];
    var values_1 = [];
    names.forEach(function(name, thing) {
      params_1.push(name);
      if (isPrimitive(thing)) {
        values_1.push(stringifyPrimitive(thing));
        return;
      }
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values_1.push("Object(" + stringify(thing.valueOf()) + ")");
          break;
        case "RegExp":
          values_1.push(thing.toString());
          break;
        case "Date":
          values_1.push("new Date(" + thing.getTime() + ")");
          break;
        case "Array":
          values_1.push("Array(" + thing.length + ")");
          thing.forEach(function(v, i) {
            statements_1.push(name + "[" + i + "]=" + stringify(v));
          });
          break;
        case "Set":
          values_1.push("new Set");
          statements_1.push(name + "." + Array.from(thing).map(function(v) {
            return "add(" + stringify(v) + ")";
          }).join("."));
          break;
        case "Map":
          values_1.push("new Map");
          statements_1.push(name + "." + Array.from(thing).map(function(_a) {
            var k = _a[0], v = _a[1];
            return "set(" + stringify(k) + ", " + stringify(v) + ")";
          }).join("."));
          break;
        default:
          values_1.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach(function(key) {
            statements_1.push("" + name + safeProp(key) + "=" + stringify(thing[key]));
          });
      }
    });
    statements_1.push("return " + str);
    return "(function(" + params_1.join(",") + "){" + statements_1.join(";") + "}(" + values_1.join(",") + "))";
  } else {
    return str;
  }
}
function getName(num) {
  var name = "";
  do {
    name = chars[num % chars.length] + name;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name) ? name + "_" : name;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string")
    return stringifyString(thing);
  if (thing === void 0)
    return "void 0";
  if (thing === 0 && 1 / thing < 0)
    return "-0";
  var str = String(thing);
  if (typeof thing === "number")
    return str.replace(/^(-)?0\./, "$1.");
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
  var result = '"';
  for (var i = 0; i < str.length; i += 1) {
    var char = str.charAt(i);
    var code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$1) {
      result += escaped$1[char];
    } else if (code >= 55296 && code <= 57343) {
      var next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += "\\u" + code.toString(16).toUpperCase();
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
function noop() {
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function writable(value, start = noop) {
  let stop;
  const subscribers = new Set();
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set) || noop;
    }
    run2(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update, subscribe };
}
function hash(value) {
  let hash2 = 5381;
  let i = value.length;
  if (typeof value === "string") {
    while (i)
      hash2 = hash2 * 33 ^ value.charCodeAt(--i);
  } else {
    while (i)
      hash2 = hash2 * 33 ^ value[--i];
  }
  return (hash2 >>> 0).toString(36);
}
function escape_json_string_in_html(str) {
  return escape$1(str, escape_json_string_in_html_dict, (code) => `\\u${code.toString(16).toUpperCase()}`);
}
function escape_html_attr(str) {
  return '"' + escape$1(str, escape_html_attr_dict, (code) => `&#${code};`) + '"';
}
function escape$1(str, dict, unicode_encoder) {
  let result = "";
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);
    const code = char.charCodeAt(0);
    if (char in dict) {
      result += dict[char];
    } else if (code >= 55296 && code <= 57343) {
      const next = str.charCodeAt(i + 1);
      if (code <= 56319 && next >= 56320 && next <= 57343) {
        result += char + str[++i];
      } else {
        result += unicode_encoder(code);
      }
    } else {
      result += char;
    }
  }
  return result;
}
async function render_response({
  branch,
  options: options2,
  $session,
  page_config,
  status,
  error: error2,
  page
}) {
  const css2 = new Set(options2.entry.css);
  const js = new Set(options2.entry.js);
  const styles = new Set();
  const serialized_data = [];
  let rendered;
  let is_private = false;
  let maxage;
  if (error2) {
    error2.stack = options2.get_stack(error2);
  }
  if (page_config.ssr) {
    branch.forEach(({ node, loaded, fetched, uses_credentials }) => {
      if (node.css)
        node.css.forEach((url) => css2.add(url));
      if (node.js)
        node.js.forEach((url) => js.add(url));
      if (node.styles)
        node.styles.forEach((content) => styles.add(content));
      if (fetched && page_config.hydrate)
        serialized_data.push(...fetched);
      if (uses_credentials)
        is_private = true;
      maxage = loaded.maxage;
    });
    const session = writable($session);
    const props = {
      stores: {
        page: writable(null),
        navigating: writable(null),
        session
      },
      page,
      components: branch.map(({ node }) => node.module.default)
    };
    for (let i = 0; i < branch.length; i += 1) {
      props[`props_${i}`] = await branch[i].loaded.props;
    }
    let session_tracking_active = false;
    const unsubscribe = session.subscribe(() => {
      if (session_tracking_active)
        is_private = true;
    });
    session_tracking_active = true;
    try {
      rendered = options2.root.render(props);
    } finally {
      unsubscribe();
    }
  } else {
    rendered = { head: "", html: "", css: { code: "", map: null } };
  }
  const include_js = page_config.router || page_config.hydrate;
  if (!include_js)
    js.clear();
  const links = options2.amp ? styles.size > 0 || rendered.css.code.length > 0 ? `<style amp-custom>${Array.from(styles).concat(rendered.css.code).join("\n")}</style>` : "" : [
    ...Array.from(js).map((dep) => `<link rel="modulepreload" href="${dep}">`),
    ...Array.from(css2).map((dep) => `<link rel="stylesheet" href="${dep}">`)
  ].join("\n		");
  let init2 = "";
  if (options2.amp) {
    init2 = `
		<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
		<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
		<script async src="https://cdn.ampproject.org/v0.js"><\/script>`;
    init2 += options2.service_worker ? '<script async custom-element="amp-install-serviceworker" src="https://cdn.ampproject.org/v0/amp-install-serviceworker-0.1.js"><\/script>' : "";
  } else if (include_js) {
    init2 = `<script type="module">
			import { start } from ${s$1(options2.entry.file)};
			start({
				target: ${options2.target ? `document.querySelector(${s$1(options2.target)})` : "document.body"},
				paths: ${s$1(options2.paths)},
				session: ${try_serialize($session, (error3) => {
      throw new Error(`Failed to serialize session data: ${error3.message}`);
    })},
				host: ${page && page.host ? s$1(page.host) : "location.host"},
				route: ${!!page_config.router},
				spa: ${!page_config.ssr},
				trailing_slash: ${s$1(options2.trailing_slash)},
				hydrate: ${page_config.ssr && page_config.hydrate ? `{
					status: ${status},
					error: ${serialize_error(error2)},
					nodes: [
						${(branch || []).map(({ node }) => `import(${s$1(node.entry)})`).join(",\n						")}
					],
					page: {
						host: ${page && page.host ? s$1(page.host) : "location.host"}, // TODO this is redundant
						path: ${page && page.path ? try_serialize(page.path, (error3) => {
      throw new Error(`Failed to serialize page.path: ${error3.message}`);
    }) : null},
						query: new URLSearchParams(${page && page.query ? s$1(page.query.toString()) : ""}),
						params: ${page && page.params ? try_serialize(page.params, (error3) => {
      throw new Error(`Failed to serialize page.params: ${error3.message}`);
    }) : null}
					}
				}` : "null"}
			});
		<\/script>`;
  }
  if (options2.service_worker) {
    init2 += options2.amp ? `<amp-install-serviceworker src="${options2.service_worker}" layout="nodisplay"></amp-install-serviceworker>` : `<script>
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.register('${options2.service_worker}');
			}
		<\/script>`;
  }
  const head = [
    rendered.head,
    styles.size && !options2.amp ? `<style data-svelte>${Array.from(styles).join("\n")}</style>` : "",
    links,
    init2
  ].join("\n\n		");
  const body = options2.amp ? rendered.html : `${rendered.html}

			${serialized_data.map(({ url, body: body2, json }) => {
    let attributes = `type="application/json" data-type="svelte-data" data-url=${escape_html_attr(url)}`;
    if (body2)
      attributes += ` data-body="${hash(body2)}"`;
    return `<script ${attributes}>${json}<\/script>`;
  }).join("\n\n	")}
		`;
  const headers = {
    "content-type": "text/html"
  };
  if (maxage) {
    headers["cache-control"] = `${is_private ? "private" : "public"}, max-age=${maxage}`;
  }
  if (!options2.floc) {
    headers["permissions-policy"] = "interest-cohort=()";
  }
  return {
    status,
    headers,
    body: options2.template({ head, body })
  };
}
function try_serialize(data, fail) {
  try {
    return devalue(data);
  } catch (err) {
    if (fail)
      fail(coalesce_to_error(err));
    return null;
  }
}
function serialize_error(error2) {
  if (!error2)
    return null;
  let serialized = try_serialize(error2);
  if (!serialized) {
    const { name, message, stack } = error2;
    serialized = try_serialize({ ...error2, name, message, stack });
  }
  if (!serialized) {
    serialized = "{}";
  }
  return serialized;
}
function normalize(loaded) {
  const has_error_status = loaded.status && loaded.status >= 400 && loaded.status <= 599 && !loaded.redirect;
  if (loaded.error || has_error_status) {
    const status = loaded.status;
    if (!loaded.error && has_error_status) {
      return {
        status: status || 500,
        error: new Error()
      };
    }
    const error2 = typeof loaded.error === "string" ? new Error(loaded.error) : loaded.error;
    if (!(error2 instanceof Error)) {
      return {
        status: 500,
        error: new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof error2}"`)
      };
    }
    if (!status || status < 400 || status > 599) {
      console.warn('"error" returned from load() without a valid status code \u2014 defaulting to 500');
      return { status: 500, error: error2 };
    }
    return { status, error: error2 };
  }
  if (loaded.redirect) {
    if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')
      };
    }
    if (typeof loaded.redirect !== "string") {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be a string')
      };
    }
  }
  if (loaded.context) {
    throw new Error('You are returning "context" from a load function. "context" was renamed to "stuff", please adjust your code accordingly.');
  }
  return loaded;
}
async function load_node({
  request,
  options: options2,
  state,
  route,
  page,
  node,
  $session,
  stuff,
  prerender_enabled,
  is_leaf,
  is_error,
  status,
  error: error2
}) {
  const { module: module2 } = node;
  let uses_credentials = false;
  const fetched = [];
  let set_cookie_headers = [];
  let loaded;
  const page_proxy = new Proxy(page, {
    get: (target, prop, receiver) => {
      if (prop === "query" && prerender_enabled) {
        throw new Error("Cannot access query on a page with prerendering enabled");
      }
      return Reflect.get(target, prop, receiver);
    }
  });
  if (module2.load) {
    const load_input = {
      page: page_proxy,
      get session() {
        uses_credentials = true;
        return $session;
      },
      fetch: async (resource, opts = {}) => {
        let url;
        if (typeof resource === "string") {
          url = resource;
        } else {
          url = resource.url;
          opts = {
            method: resource.method,
            headers: resource.headers,
            body: resource.body,
            mode: resource.mode,
            credentials: resource.credentials,
            cache: resource.cache,
            redirect: resource.redirect,
            referrer: resource.referrer,
            integrity: resource.integrity,
            ...opts
          };
        }
        const resolved = resolve(request.path, url.split("?")[0]);
        let response;
        const prefix = options2.paths.assets || options2.paths.base;
        const filename = (resolved.startsWith(prefix) ? resolved.slice(prefix.length) : resolved).slice(1);
        const filename_html = `${filename}/index.html`;
        const asset = options2.manifest.assets.find((d) => d.file === filename || d.file === filename_html);
        if (asset) {
          response = options2.read ? new Response(options2.read(asset.file), {
            headers: asset.type ? { "content-type": asset.type } : {}
          }) : await fetch(`http://${page.host}/${asset.file}`, opts);
        } else if (is_root_relative(resolved)) {
          const relative = resolved;
          const headers = {
            ...opts.headers
          };
          if (opts.credentials !== "omit") {
            uses_credentials = true;
            headers.cookie = request.headers.cookie;
            if (!headers.authorization) {
              headers.authorization = request.headers.authorization;
            }
          }
          if (opts.body && typeof opts.body !== "string") {
            throw new Error("Request body must be a string");
          }
          const search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
          const rendered = await respond({
            host: request.host,
            method: opts.method || "GET",
            headers,
            path: relative,
            rawBody: opts.body == null ? null : new TextEncoder().encode(opts.body),
            query: new URLSearchParams(search)
          }, options2, {
            fetched: url,
            initiator: route
          });
          if (rendered) {
            if (state.prerender) {
              state.prerender.dependencies.set(relative, rendered);
            }
            response = new Response(rendered.body, {
              status: rendered.status,
              headers: rendered.headers
            });
          }
        } else {
          if (resolved.startsWith("//")) {
            throw new Error(`Cannot request protocol-relative URL (${url}) in server-side fetch`);
          }
          if (typeof request.host !== "undefined") {
            const { hostname: fetch_hostname } = new URL(url);
            const [server_hostname] = request.host.split(":");
            if (`.${fetch_hostname}`.endsWith(`.${server_hostname}`) && opts.credentials !== "omit") {
              uses_credentials = true;
              opts.headers = {
                ...opts.headers,
                cookie: request.headers.cookie
              };
            }
          }
          const external_request = new Request(url, opts);
          response = await options2.hooks.externalFetch.call(null, external_request);
        }
        if (response) {
          const proxy = new Proxy(response, {
            get(response2, key, _receiver) {
              async function text() {
                const body = await response2.text();
                const headers = {};
                for (const [key2, value] of response2.headers) {
                  if (key2 === "set-cookie") {
                    set_cookie_headers = set_cookie_headers.concat(value);
                  } else if (key2 !== "etag") {
                    headers[key2] = value;
                  }
                }
                if (!opts.body || typeof opts.body === "string") {
                  fetched.push({
                    url,
                    body: opts.body,
                    json: `{"status":${response2.status},"statusText":${s(response2.statusText)},"headers":${s(headers)},"body":"${escape_json_string_in_html(body)}"}`
                  });
                }
                return body;
              }
              if (key === "text") {
                return text;
              }
              if (key === "json") {
                return async () => {
                  return JSON.parse(await text());
                };
              }
              return Reflect.get(response2, key, response2);
            }
          });
          return proxy;
        }
        return response || new Response("Not found", {
          status: 404
        });
      },
      stuff: { ...stuff }
    };
    if (is_error) {
      load_input.status = status;
      load_input.error = error2;
    }
    loaded = await module2.load.call(null, load_input);
  } else {
    loaded = {};
  }
  if (!loaded && is_leaf && !is_error)
    return;
  if (!loaded) {
    throw new Error(`${node.entry} - load must return a value except for page fall through`);
  }
  return {
    node,
    loaded: normalize(loaded),
    stuff: loaded.stuff || stuff,
    fetched,
    set_cookie_headers,
    uses_credentials
  };
}
async function respond_with_error({ request, options: options2, state, $session, status, error: error2 }) {
  const default_layout = await options2.load_component(options2.manifest.layout);
  const default_error = await options2.load_component(options2.manifest.error);
  const page = {
    host: request.host,
    path: request.path,
    query: request.query,
    params: {}
  };
  const loaded = await load_node({
    request,
    options: options2,
    state,
    route: null,
    page,
    node: default_layout,
    $session,
    stuff: {},
    prerender_enabled: is_prerender_enabled(options2, default_error, state),
    is_leaf: false,
    is_error: false
  });
  const branch = [
    loaded,
    await load_node({
      request,
      options: options2,
      state,
      route: null,
      page,
      node: default_error,
      $session,
      stuff: loaded ? loaded.stuff : {},
      prerender_enabled: is_prerender_enabled(options2, default_error, state),
      is_leaf: false,
      is_error: true,
      status,
      error: error2
    })
  ];
  try {
    return await render_response({
      options: options2,
      $session,
      page_config: {
        hydrate: options2.hydrate,
        router: options2.router,
        ssr: options2.ssr
      },
      status,
      error: error2,
      branch,
      page
    });
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return {
      status: 500,
      headers: {},
      body: error3.stack
    };
  }
}
function is_prerender_enabled(options2, node, state) {
  return options2.prerender && (!!node.module.prerender || !!state.prerender && state.prerender.all);
}
async function respond$1(opts) {
  const { request, options: options2, state, $session, route } = opts;
  let nodes;
  try {
    nodes = await Promise.all(route.a.map((id) => id ? options2.load_component(id) : void 0));
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return await respond_with_error({
      request,
      options: options2,
      state,
      $session,
      status: 500,
      error: error3
    });
  }
  const leaf = nodes[nodes.length - 1].module;
  let page_config = get_page_config(leaf, options2);
  if (!leaf.prerender && state.prerender && !state.prerender.all) {
    return {
      status: 204,
      headers: {}
    };
  }
  let branch = [];
  let status = 200;
  let error2;
  let set_cookie_headers = [];
  ssr:
    if (page_config.ssr) {
      let stuff = {};
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        let loaded;
        if (node) {
          try {
            loaded = await load_node({
              ...opts,
              node,
              stuff,
              prerender_enabled: is_prerender_enabled(options2, node, state),
              is_leaf: i === nodes.length - 1,
              is_error: false
            });
            if (!loaded)
              return;
            set_cookie_headers = set_cookie_headers.concat(loaded.set_cookie_headers);
            if (loaded.loaded.redirect) {
              return with_cookies({
                status: loaded.loaded.status,
                headers: {
                  location: encodeURI(loaded.loaded.redirect)
                }
              }, set_cookie_headers);
            }
            if (loaded.loaded.error) {
              ({ status, error: error2 } = loaded.loaded);
            }
          } catch (err) {
            const e = coalesce_to_error(err);
            options2.handle_error(e, request);
            status = 500;
            error2 = e;
          }
          if (loaded && !error2) {
            branch.push(loaded);
          }
          if (error2) {
            while (i--) {
              if (route.b[i]) {
                const error_node = await options2.load_component(route.b[i]);
                let node_loaded;
                let j = i;
                while (!(node_loaded = branch[j])) {
                  j -= 1;
                }
                try {
                  const error_loaded = await load_node({
                    ...opts,
                    node: error_node,
                    stuff: node_loaded.stuff,
                    prerender_enabled: is_prerender_enabled(options2, error_node, state),
                    is_leaf: false,
                    is_error: true,
                    status,
                    error: error2
                  });
                  if (error_loaded.loaded.error) {
                    continue;
                  }
                  page_config = get_page_config(error_node.module, options2);
                  branch = branch.slice(0, j + 1).concat(error_loaded);
                  break ssr;
                } catch (err) {
                  const e = coalesce_to_error(err);
                  options2.handle_error(e, request);
                  continue;
                }
              }
            }
            return with_cookies(await respond_with_error({
              request,
              options: options2,
              state,
              $session,
              status,
              error: error2
            }), set_cookie_headers);
          }
        }
        if (loaded && loaded.loaded.stuff) {
          stuff = {
            ...stuff,
            ...loaded.loaded.stuff
          };
        }
      }
    }
  try {
    return with_cookies(await render_response({
      ...opts,
      page_config,
      status,
      error: error2,
      branch: branch.filter(Boolean)
    }), set_cookie_headers);
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return with_cookies(await respond_with_error({
      ...opts,
      status: 500,
      error: error3
    }), set_cookie_headers);
  }
}
function get_page_config(leaf, options2) {
  return {
    ssr: "ssr" in leaf ? !!leaf.ssr : options2.ssr,
    router: "router" in leaf ? !!leaf.router : options2.router,
    hydrate: "hydrate" in leaf ? !!leaf.hydrate : options2.hydrate
  };
}
function with_cookies(response, set_cookie_headers) {
  if (set_cookie_headers.length) {
    response.headers["set-cookie"] = set_cookie_headers;
  }
  return response;
}
async function render_page(request, route, match, options2, state) {
  if (state.initiator === route) {
    return {
      status: 404,
      headers: {},
      body: `Not found: ${request.path}`
    };
  }
  const params = route.params(match);
  const page = {
    host: request.host,
    path: request.path,
    query: request.query,
    params
  };
  const $session = await options2.hooks.getSession(request);
  const response = await respond$1({
    request,
    options: options2,
    state,
    $session,
    route,
    page
  });
  if (response) {
    return response;
  }
  if (state.fetched) {
    return {
      status: 500,
      headers: {},
      body: `Bad request in load function: failed to fetch ${state.fetched}`
    };
  }
}
function read_only_form_data() {
  const map = new Map();
  return {
    append(key, value) {
      if (map.has(key)) {
        (map.get(key) || []).push(value);
      } else {
        map.set(key, [value]);
      }
    },
    data: new ReadOnlyFormData(map)
  };
}
function parse_body(raw, headers) {
  if (!raw)
    return raw;
  const content_type = headers["content-type"];
  const [type, ...directives] = content_type ? content_type.split(/;\s*/) : [];
  const text = () => new TextDecoder(headers["content-encoding"] || "utf-8").decode(raw);
  switch (type) {
    case "text/plain":
      return text();
    case "application/json":
      return JSON.parse(text());
    case "application/x-www-form-urlencoded":
      return get_urlencoded(text());
    case "multipart/form-data": {
      const boundary = directives.find((directive) => directive.startsWith("boundary="));
      if (!boundary)
        throw new Error("Missing boundary");
      return get_multipart(text(), boundary.slice("boundary=".length));
    }
    default:
      return raw;
  }
}
function get_urlencoded(text) {
  const { data, append } = read_only_form_data();
  text.replace(/\+/g, " ").split("&").forEach((str) => {
    const [key, value] = str.split("=");
    append(decodeURIComponent(key), decodeURIComponent(value));
  });
  return data;
}
function get_multipart(text, boundary) {
  const parts = text.split(`--${boundary}`);
  if (parts[0] !== "" || parts[parts.length - 1].trim() !== "--") {
    throw new Error("Malformed form data");
  }
  const { data, append } = read_only_form_data();
  parts.slice(1, -1).forEach((part) => {
    const match = /\s*([\s\S]+?)\r\n\r\n([\s\S]*)\s*/.exec(part);
    if (!match) {
      throw new Error("Malformed form data");
    }
    const raw_headers = match[1];
    const body = match[2].trim();
    let key;
    const headers = {};
    raw_headers.split("\r\n").forEach((str) => {
      const [raw_header, ...raw_directives] = str.split("; ");
      let [name, value] = raw_header.split(": ");
      name = name.toLowerCase();
      headers[name] = value;
      const directives = {};
      raw_directives.forEach((raw_directive) => {
        const [name2, value2] = raw_directive.split("=");
        directives[name2] = JSON.parse(value2);
      });
      if (name === "content-disposition") {
        if (value !== "form-data")
          throw new Error("Malformed form data");
        if (directives.filename) {
          throw new Error("File upload is not yet implemented");
        }
        if (directives.name) {
          key = directives.name;
        }
      }
    });
    if (!key)
      throw new Error("Malformed form data");
    append(key, body);
  });
  return data;
}
async function respond(incoming, options2, state = {}) {
  if (incoming.path !== "/" && options2.trailing_slash !== "ignore") {
    const has_trailing_slash = incoming.path.endsWith("/");
    if (has_trailing_slash && options2.trailing_slash === "never" || !has_trailing_slash && options2.trailing_slash === "always" && !(incoming.path.split("/").pop() || "").includes(".")) {
      const path = has_trailing_slash ? incoming.path.slice(0, -1) : incoming.path + "/";
      const q = incoming.query.toString();
      return {
        status: 301,
        headers: {
          location: options2.paths.base + path + (q ? `?${q}` : "")
        }
      };
    }
  }
  const headers = lowercase_keys(incoming.headers);
  const request = {
    ...incoming,
    headers,
    body: parse_body(incoming.rawBody, headers),
    params: {},
    locals: {}
  };
  try {
    return await options2.hooks.handle({
      request,
      resolve: async (request2) => {
        if (state.prerender && state.prerender.fallback) {
          return await render_response({
            options: options2,
            $session: await options2.hooks.getSession(request2),
            page_config: { ssr: false, router: true, hydrate: true },
            status: 200,
            branch: []
          });
        }
        const decoded = decodeURI(request2.path);
        for (const route of options2.manifest.routes) {
          const match = route.pattern.exec(decoded);
          if (!match)
            continue;
          const response = route.type === "endpoint" ? await render_endpoint(request2, route, match) : await render_page(request2, route, match, options2, state);
          if (response) {
            if (response.status === 200) {
              const cache_control = get_single_valued_header(response.headers, "cache-control");
              if (!cache_control || !/(no-store|immutable)/.test(cache_control)) {
                let if_none_match_value = request2.headers["if-none-match"];
                if (if_none_match_value?.startsWith('W/"')) {
                  if_none_match_value = if_none_match_value.substring(2);
                }
                const etag = `"${hash(response.body || "")}"`;
                if (if_none_match_value === etag) {
                  return {
                    status: 304,
                    headers: {}
                  };
                }
                response.headers["etag"] = etag;
              }
            }
            return response;
          }
        }
        const $session = await options2.hooks.getSession(request2);
        return await respond_with_error({
          request: request2,
          options: options2,
          state,
          $session,
          status: 404,
          error: new Error(`Not found: ${request2.path}`)
        });
      }
    });
  } catch (err) {
    const e = coalesce_to_error(err);
    options2.handle_error(e, request);
    return {
      status: 500,
      headers: {},
      body: options2.dev ? e.stack : e.message
    };
  }
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
function setContext(key, context) {
  get_current_component().$$.context.set(key, context);
}
function escape(html) {
  return String(html).replace(/["'&<>]/g, (match) => escaped[match]);
}
function validate_component(component, name) {
  if (!component || !component.$$render) {
    if (name === "svelte:component")
      name += " this={...}";
    throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
  }
  return component;
}
function create_ssr_component(fn) {
  function $$render(result, props, bindings, slots, context) {
    const parent_component = current_component;
    const $$ = {
      on_destroy,
      context: new Map(context || (parent_component ? parent_component.$$.context : [])),
      on_mount: [],
      before_update: [],
      after_update: [],
      callbacks: blank_object()
    };
    set_current_component({ $$ });
    const html = fn(result, props, bindings, slots);
    set_current_component(parent_component);
    return html;
  }
  return {
    render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
      on_destroy = [];
      const result = { title: "", head: "", css: new Set() };
      const html = $$render(result, props, {}, $$slots, context);
      run_all(on_destroy);
      return {
        html,
        css: {
          code: Array.from(result.css).map((css2) => css2.code).join("\n"),
          map: null
        },
        head: result.title + result.head
      };
    },
    $$render
  };
}
function afterUpdate() {
}
function set_paths(paths) {
  base = paths.base;
  assets = paths.assets || base;
}
function set_prerendering(value) {
}
function init(settings = default_settings) {
  set_paths(settings.paths);
  set_prerendering(settings.prerendering || false);
  const hooks = get_hooks(user_hooks);
  options = {
    amp: false,
    dev: false,
    entry: {
      file: assets + "/_app/start-f5f5b0d6.js",
      css: [assets + "/_app/assets/start-61d1577b.css"],
      js: [assets + "/_app/start-f5f5b0d6.js", assets + "/_app/chunks/vendor-a191d1a2.js"]
    },
    fetched: void 0,
    floc: false,
    get_component_path: (id) => assets + "/_app/" + entry_lookup[id],
    get_stack: (error2) => String(error2),
    handle_error: (error2, request) => {
      hooks.handleError({ error: error2, request });
      error2.stack = options.get_stack(error2);
    },
    hooks,
    hydrate: true,
    initiator: void 0,
    load_component,
    manifest,
    paths: settings.paths,
    prerender: true,
    read: settings.read,
    root: Root,
    service_worker: null,
    router: true,
    ssr: true,
    target: "#svelte",
    template,
    trailing_slash: "never"
  };
}
async function load_component(file) {
  const { entry, css: css2, js, styles } = metadata_lookup[file];
  return {
    module: await module_lookup[file](),
    entry: assets + "/_app/" + entry,
    css: css2.map((dep) => assets + "/_app/" + dep),
    js: js.map((dep) => assets + "/_app/" + dep),
    styles
  };
}
function render(request, {
  prerender
} = {}) {
  const host = request.headers["host"];
  return respond({ ...request, host }, options, { prerender });
}
var __accessCheck, __privateGet, __privateAdd, __privateSet, _map, absolute, scheme, chars, unsafeChars, reserved, escaped$1, objectProtoOwnPropertyNames, subscriber_queue, escape_json_string_in_html_dict, escape_html_attr_dict, s$1, s, ReadOnlyFormData, current_component, escaped, missing_component, on_destroy, css, Root, base, assets, user_hooks, template, options, default_settings, empty, manifest, get_hooks, module_lookup, metadata_lookup;
var init_app_907bc18b = __esm({
  ".svelte-kit/output/server/chunks/app-907bc18b.js"() {
    init_shims();
    __accessCheck = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    __privateGet = (obj, member, getter) => {
      __accessCheck(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    __privateAdd = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    __privateSet = (obj, member, value, setter) => {
      __accessCheck(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    absolute = /^([a-z]+:)?\/?\//;
    scheme = /^[a-z]+:/;
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
    unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
    reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
    escaped$1 = {
      "<": "\\u003C",
      ">": "\\u003E",
      "/": "\\u002F",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
    Promise.resolve();
    subscriber_queue = [];
    escape_json_string_in_html_dict = {
      '"': '\\"',
      "<": "\\u003C",
      ">": "\\u003E",
      "/": "\\u002F",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    escape_html_attr_dict = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    };
    s$1 = JSON.stringify;
    s = JSON.stringify;
    ReadOnlyFormData = class {
      constructor(map) {
        __privateAdd(this, _map, void 0);
        __privateSet(this, _map, map);
      }
      get(key) {
        const value = __privateGet(this, _map).get(key);
        return value && value[0];
      }
      getAll(key) {
        return __privateGet(this, _map).get(key);
      }
      has(key) {
        return __privateGet(this, _map).has(key);
      }
      *[Symbol.iterator]() {
        for (const [key, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield [key, value[i]];
          }
        }
      }
      *entries() {
        for (const [key, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield [key, value[i]];
          }
        }
      }
      *keys() {
        for (const [key] of __privateGet(this, _map))
          yield key;
      }
      *values() {
        for (const [, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield value[i];
          }
        }
      }
    };
    _map = new WeakMap();
    Promise.resolve();
    escaped = {
      '"': "&quot;",
      "'": "&#39;",
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;"
    };
    missing_component = {
      $$render: () => ""
    };
    css = {
      code: "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}",
      map: null
    };
    Root = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let { stores } = $$props;
      let { page } = $$props;
      let { components } = $$props;
      let { props_0 = null } = $$props;
      let { props_1 = null } = $$props;
      let { props_2 = null } = $$props;
      setContext("__svelte__", stores);
      afterUpdate(stores.page.notify);
      if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0)
        $$bindings.stores(stores);
      if ($$props.page === void 0 && $$bindings.page && page !== void 0)
        $$bindings.page(page);
      if ($$props.components === void 0 && $$bindings.components && components !== void 0)
        $$bindings.components(components);
      if ($$props.props_0 === void 0 && $$bindings.props_0 && props_0 !== void 0)
        $$bindings.props_0(props_0);
      if ($$props.props_1 === void 0 && $$bindings.props_1 && props_1 !== void 0)
        $$bindings.props_1(props_1);
      if ($$props.props_2 === void 0 && $$bindings.props_2 && props_2 !== void 0)
        $$bindings.props_2(props_2);
      $$result.css.add(css);
      {
        stores.page.set(page);
      }
      return `


${validate_component(components[0] || missing_component, "svelte:component").$$render($$result, Object.assign(props_0 || {}), {}, {
        default: () => `${components[1] ? `${validate_component(components[1] || missing_component, "svelte:component").$$render($$result, Object.assign(props_1 || {}), {}, {
          default: () => `${components[2] ? `${validate_component(components[2] || missing_component, "svelte:component").$$render($$result, Object.assign(props_2 || {}), {}, {})}` : ``}`
        })}` : ``}`
      })}

${``}`;
    });
    base = "";
    assets = "";
    user_hooks = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      [Symbol.toStringTag]: "Module"
    });
    template = ({ head, body }) => '<!DOCTYPE html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<meta name="description" content="" />\n		<link rel="icon" href="/favicon.png" />\n		<meta name="viewport" content="width=device-width, initial-scale=1" />\n		' + head + '\n	</head>\n	<body>\n		<div id="svelte">' + body + '</div>\n\n\n		\n<script src="assets/js/bootstrap.bundle.min.js"><\/script>\n<script src="assets/js/html5.min.js"><\/script>\n<script src="assets/js/sticky.min.js"><\/script>\n<script src="assets/js/swiper-bundle.min.js"><\/script>\n<script src="assets/js/masonry.min.js"><\/script>\n<script src="assets/js/tastebite-scripts.js"><\/script>\n	</body>\n</html>\n';
    options = null;
    default_settings = { paths: { "base": "", "assets": "" } };
    empty = () => ({});
    manifest = {
      assets: [{ "file": ".DS_Store", "size": 6148, "type": null }, { "file": "assets/.DS_Store", "size": 6148, "type": null }, { "file": "assets/css/.DS_Store", "size": 6148, "type": null }, { "file": "assets/css/bootstrap.css", "size": 192445, "type": "text/css" }, { "file": "assets/css/swiper-bundle.min.css", "size": 13679, "type": "text/css" }, { "file": "assets/css/tastebite-styles.css", "size": 251198, "type": "text/css" }, { "file": "assets/images/avatars/avatar1.png", "size": 1763, "type": "image/png" }, { "file": "assets/images/avatars/avatar10.png", "size": 2752, "type": "image/png" }, { "file": "assets/images/avatars/avatar11.png", "size": 1793, "type": "image/png" }, { "file": "assets/images/avatars/avatar12.png", "size": 8658, "type": "image/png" }, { "file": "assets/images/avatars/avatar2.png", "size": 12345, "type": "image/png" }, { "file": "assets/images/avatars/avatar3.png", "size": 4785, "type": "image/png" }, { "file": "assets/images/avatars/avatar4.png", "size": 2636, "type": "image/png" }, { "file": "assets/images/avatars/avatar5.png", "size": 2827, "type": "image/png" }, { "file": "assets/images/avatars/avatar6.png", "size": 2806, "type": "image/png" }, { "file": "assets/images/avatars/avatar7.png", "size": 2708, "type": "image/png" }, { "file": "assets/images/avatars/avatar8.png", "size": 2513, "type": "image/png" }, { "file": "assets/images/avatars/avatar9.png", "size": 2538, "type": "image/png" }, { "file": "assets/images/banner1.jpg", "size": 123371, "type": "image/jpeg" }, { "file": "assets/images/brands/brand1.svg", "size": 33223, "type": "image/svg+xml" }, { "file": "assets/images/brands/brand2.svg", "size": 30175, "type": "image/svg+xml" }, { "file": "assets/images/brands/brand3.svg", "size": 8024, "type": "image/svg+xml" }, { "file": "assets/images/brands/brand4.svg", "size": 28670, "type": "image/svg+xml" }, { "file": "assets/images/brands/facebook-logo.svg", "size": 6324, "type": "image/svg+xml" }, { "file": "assets/images/brands/google-logo.svg", "size": 6918, "type": "image/svg+xml" }, { "file": "assets/images/favicon.ico", "size": 107498, "type": "image/vnd.microsoft.icon" }, { "file": "assets/images/icons/activity.svg", "size": 289, "type": "image/svg+xml" }, { "file": "assets/images/icons/airplay.svg", "size": 382, "type": "image/svg+xml" }, { "file": "assets/images/icons/alert-circle.svg", "size": 344, "type": "image/svg+xml" }, { "file": "assets/images/icons/alert-octagon.svg", "size": 555, "type": "image/svg+xml" }, { "file": "assets/images/icons/alert-triangle.svg", "size": 483, "type": "image/svg+xml" }, { "file": "assets/images/icons/align-center.svg", "size": 266, "type": "image/svg+xml" }, { "file": "assets/images/icons/align-justify.svg", "size": 265, "type": "image/svg+xml" }, { "file": "assets/images/icons/align-left.svg", "size": 265, "type": "image/svg+xml" }, { "file": "assets/images/icons/align-right.svg", "size": 266, "type": "image/svg+xml" }, { "file": "assets/images/icons/anchor.svg", "size": 312, "type": "image/svg+xml" }, { "file": "assets/images/icons/aperture.svg", "size": 939, "type": "image/svg+xml" }, { "file": "assets/images/icons/archive.svg", "size": 291, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-down-circle.svg", "size": 390, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-down-left.svg", "size": 329, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-down-right.svg", "size": 231, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-down.svg", "size": 273, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-left-circle.svg", "size": 391, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-left.svg", "size": 419, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-right-circle.svg", "size": 405, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-right.svg", "size": 288, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-up-circle.svg", "size": 383, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-up-left.svg", "size": 362, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-up-right.svg", "size": 319, "type": "image/svg+xml" }, { "file": "assets/images/icons/arrow-up.svg", "size": 397, "type": "image/svg+xml" }, { "file": "assets/images/icons/at-sign.svg", "size": 361, "type": "image/svg+xml" }, { "file": "assets/images/icons/atthe-rate.svg", "size": 490, "type": "image/svg+xml" }, { "file": "assets/images/icons/award.svg", "size": 431, "type": "image/svg+xml" }, { "file": "assets/images/icons/badge-heart.svg", "size": 617, "type": "image/svg+xml" }, { "file": "assets/images/icons/bar-chart.svg", "size": 238, "type": "image/svg+xml" }, { "file": "assets/images/icons/bar-chart2.svg", "size": 238, "type": "image/svg+xml" }, { "file": "assets/images/icons/battery-charging.svg", "size": 687, "type": "image/svg+xml" }, { "file": "assets/images/icons/battery.svg", "size": 297, "type": "image/svg+xml" }, { "file": "assets/images/icons/behance.svg", "size": 2725, "type": "image/svg+xml" }, { "file": "assets/images/icons/bell-off.svg", "size": 751, "type": "image/svg+xml" }, { "file": "assets/images/icons/bell.svg", "size": 651, "type": "image/svg+xml" }, { "file": "assets/images/icons/bluetooth.svg", "size": 458, "type": "image/svg+xml" }, { "file": "assets/images/icons/bold.svg", "size": 242, "type": "image/svg+xml" }, { "file": "assets/images/icons/book-open.svg", "size": 495, "type": "image/svg+xml" }, { "file": "assets/images/icons/book.svg", "size": 334, "type": "image/svg+xml" }, { "file": "assets/images/icons/bookmark.svg", "size": 433, "type": "image/svg+xml" }, { "file": "assets/images/icons/box.svg", "size": 607, "type": "image/svg+xml" }, { "file": "assets/images/icons/briefcase.svg", "size": 364, "type": "image/svg+xml" }, { "file": "assets/images/icons/calendar.svg", "size": 522, "type": "image/svg+xml" }, { "file": "assets/images/icons/camera-off.svg", "size": 721, "type": "image/svg+xml" }, { "file": "assets/images/icons/camera.svg", "size": 460, "type": "image/svg+xml" }, { "file": "assets/images/icons/cast.svg", "size": 747, "type": "image/svg+xml" }, { "file": "assets/images/icons/chat.svg", "size": 442, "type": "image/svg+xml" }, { "file": "assets/images/icons/check-circle.svg", "size": 396, "type": "image/svg+xml" }, { "file": "assets/images/icons/check-square.svg", "size": 364, "type": "image/svg+xml" }, { "file": "assets/images/icons/check.svg", "size": 212, "type": "image/svg+xml" }, { "file": "assets/images/icons/checked.svg", "size": 689, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevron-down.svg", "size": 205, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevron-left.svg", "size": 208, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevron-right.svg", "size": 209, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevron-up.svg", "size": 212, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevrons-down.svg", "size": 347, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevrons-left.svg", "size": 349, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevrons-right.svg", "size": 373, "type": "image/svg+xml" }, { "file": "assets/images/icons/chevrons-up.svg", "size": 347, "type": "image/svg+xml" }, { "file": "assets/images/icons/chrome.svg", "size": 726, "type": "image/svg+xml" }, { "file": "assets/images/icons/circle.svg", "size": 271, "type": "image/svg+xml" }, { "file": "assets/images/icons/clipboard.svg", "size": 375, "type": "image/svg+xml" }, { "file": "assets/images/icons/clock.svg", "size": 341, "type": "image/svg+xml" }, { "file": "assets/images/icons/close.svg", "size": 511, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud-drizzle.svg", "size": 592, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud-lighting.svg", "size": 497, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud-off.svg", "size": 606, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud-rain.svg", "size": 473, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud-snow.svg", "size": 634, "type": "image/svg+xml" }, { "file": "assets/images/icons/cloud.svg", "size": 405, "type": "image/svg+xml" }, { "file": "assets/images/icons/code.svg", "size": 364, "type": "image/svg+xml" }, { "file": "assets/images/icons/codepen.svg", "size": 1198, "type": "image/svg+xml" }, { "file": "assets/images/icons/codesandbox.svg", "size": 1015, "type": "image/svg+xml" }, { "file": "assets/images/icons/coffee.svg", "size": 376, "type": "image/svg+xml" }, { "file": "assets/images/icons/columns.svg", "size": 379, "type": "image/svg+xml" }, { "file": "assets/images/icons/command.svg", "size": 444, "type": "image/svg+xml" }, { "file": "assets/images/icons/compass.svg", "size": 552, "type": "image/svg+xml" }, { "file": "assets/images/icons/copy.svg", "size": 395, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-down-left.svg", "size": 356, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-down-right.svg", "size": 362, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-left-down.svg", "size": 377, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-left-up.svg", "size": 363, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-right-down.svg", "size": 347, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-right-up.svg", "size": 339, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-up-left.svg", "size": 372, "type": "image/svg+xml" }, { "file": "assets/images/icons/corner-up-right.svg", "size": 363, "type": "image/svg+xml" }, { "file": "assets/images/icons/cpu.svg", "size": 588, "type": "image/svg+xml" }, { "file": "assets/images/icons/credit-card.svg", "size": 271, "type": "image/svg+xml" }, { "file": "assets/images/icons/crop.svg", "size": 369, "type": "image/svg+xml" }, { "file": "assets/images/icons/crosshair.svg", "size": 440, "type": "image/svg+xml" }, { "file": "assets/images/icons/database.svg", "size": 737, "type": "image/svg+xml" }, { "file": "assets/images/icons/delete.svg", "size": 632, "type": "image/svg+xml" }, { "file": "assets/images/icons/disc.svg", "size": 320, "type": "image/svg+xml" }, { "file": "assets/images/icons/doller-sign.svg", "size": 337, "type": "image/svg+xml" }, { "file": "assets/images/icons/down-arrow.svg", "size": 228, "type": "image/svg+xml" }, { "file": "assets/images/icons/down-arrow2.svg", "size": 205, "type": "image/svg+xml" }, { "file": "assets/images/icons/download-cloud.svg", "size": 549, "type": "image/svg+xml" }, { "file": "assets/images/icons/download.svg", "size": 464, "type": "image/svg+xml" }, { "file": "assets/images/icons/dribbble.svg", "size": 1531, "type": "image/svg+xml" }, { "file": "assets/images/icons/droplet.svg", "size": 302, "type": "image/svg+xml" }, { "file": "assets/images/icons/edit-2.svg", "size": 503, "type": "image/svg+xml" }, { "file": "assets/images/icons/edit-3.svg", "size": 558, "type": "image/svg+xml" }, { "file": "assets/images/icons/edit.svg", "size": 833, "type": "image/svg+xml" }, { "file": "assets/images/icons/email.svg", "size": 529, "type": "image/svg+xml" }, { "file": "assets/images/icons/external-link.svg", "size": 454, "type": "image/svg+xml" }, { "file": "assets/images/icons/eye-off.svg", "size": 1224, "type": "image/svg+xml" }, { "file": "assets/images/icons/eye.svg", "size": 1041, "type": "image/svg+xml" }, { "file": "assets/images/icons/facebook.svg", "size": 863, "type": "image/svg+xml" }, { "file": "assets/images/icons/facebook2.svg", "size": 323, "type": "image/svg+xml" }, { "file": "assets/images/icons/fast-forward.svg", "size": 497, "type": "image/svg+xml" }, { "file": "assets/images/icons/feather.svg", "size": 1736, "type": "image/svg+xml" }, { "file": "assets/images/icons/figma.svg", "size": 2552, "type": "image/svg+xml" }, { "file": "assets/images/icons/file-minus.svg", "size": 2927, "type": "image/svg+xml" }, { "file": "assets/images/icons/file-plus.svg", "size": 3229, "type": "image/svg+xml" }, { "file": "assets/images/icons/file-text.svg", "size": 3481, "type": "image/svg+xml" }, { "file": "assets/images/icons/file.svg", "size": 2694, "type": "image/svg+xml" }, { "file": "assets/images/icons/film.svg", "size": 1895, "type": "image/svg+xml" }, { "file": "assets/images/icons/filter.svg", "size": 1107, "type": "image/svg+xml" }, { "file": "assets/images/icons/flag.svg", "size": 2343, "type": "image/svg+xml" }, { "file": "assets/images/icons/folder-minus.svg", "size": 1523, "type": "image/svg+xml" }, { "file": "assets/images/icons/folder-plus.svg", "size": 1849, "type": "image/svg+xml" }, { "file": "assets/images/icons/folder.svg", "size": 1293, "type": "image/svg+xml" }, { "file": "assets/images/icons/framer.svg", "size": 1617, "type": "image/svg+xml" }, { "file": "assets/images/icons/frown.svg", "size": 2271, "type": "image/svg+xml" }, { "file": "assets/images/icons/gift.svg", "size": 2295, "type": "image/svg+xml" }, { "file": "assets/images/icons/git-branch.svg", "size": 1741, "type": "image/svg+xml" }, { "file": "assets/images/icons/git-commit.svg", "size": 1355, "type": "image/svg+xml" }, { "file": "assets/images/icons/git-merge.svg", "size": 1713, "type": "image/svg+xml" }, { "file": "assets/images/icons/git-pull-request.svg", "size": 1890, "type": "image/svg+xml" }, { "file": "assets/images/icons/github.svg", "size": 3734, "type": "image/svg+xml" }, { "file": "assets/images/icons/gitlab.svg", "size": 1682, "type": "image/svg+xml" }, { "file": "assets/images/icons/globe.svg", "size": 1926, "type": "image/svg+xml" }, { "file": "assets/images/icons/google2.svg", "size": 1110, "type": "image/svg+xml" }, { "file": "assets/images/icons/grid.svg", "size": 1793, "type": "image/svg+xml" }, { "file": "assets/images/icons/hard-drive.svg", "size": 2206, "type": "image/svg+xml" }, { "file": "assets/images/icons/hash.svg", "size": 2303, "type": "image/svg+xml" }, { "file": "assets/images/icons/headphones.svg", "size": 1571, "type": "image/svg+xml" }, { "file": "assets/images/icons/heart fill.svg", "size": 1070, "type": "image/svg+xml" }, { "file": "assets/images/icons/heart-outline.svg", "size": 656, "type": "image/svg+xml" }, { "file": "assets/images/icons/heart.svg", "size": 455, "type": "image/svg+xml" }, { "file": "assets/images/icons/help-circle.svg", "size": 2151, "type": "image/svg+xml" }, { "file": "assets/images/icons/hexagon.svg", "size": 1595, "type": "image/svg+xml" }, { "file": "assets/images/icons/home.svg", "size": 1448, "type": "image/svg+xml" }, { "file": "assets/images/icons/image.svg", "size": 1891, "type": "image/svg+xml" }, { "file": "assets/images/icons/inbox.svg", "size": 2013, "type": "image/svg+xml" }, { "file": "assets/images/icons/info.svg", "size": 1373, "type": "image/svg+xml" }, { "file": "assets/images/icons/instagram.svg", "size": 806, "type": "image/svg+xml" }, { "file": "assets/images/icons/italic.svg", "size": 1141, "type": "image/svg+xml" }, { "file": "assets/images/icons/key.svg", "size": 1948, "type": "image/svg+xml" }, { "file": "assets/images/icons/layers.svg", "size": 1944, "type": "image/svg+xml" }, { "file": "assets/images/icons/layout.svg", "size": 1249, "type": "image/svg+xml" }, { "file": "assets/images/icons/left-arrow.svg", "size": 254, "type": "image/svg+xml" }, { "file": "assets/images/icons/life-buoy.svg", "size": 2092, "type": "image/svg+xml" }, { "file": "assets/images/icons/link-2.svg", "size": 2161, "type": "image/svg+xml" }, { "file": "assets/images/icons/link.svg", "size": 2456, "type": "image/svg+xml" }, { "file": "assets/images/icons/linkedin.svg", "size": 2158, "type": "image/svg+xml" }, { "file": "assets/images/icons/list.svg", "size": 2116, "type": "image/svg+xml" }, { "file": "assets/images/icons/loader.svg", "size": 2882, "type": "image/svg+xml" }, { "file": "assets/images/icons/lock.svg", "size": 463, "type": "image/svg+xml" }, { "file": "assets/images/icons/log-in.svg", "size": 3245, "type": "image/svg+xml" }, { "file": "assets/images/icons/log-out.svg", "size": 3472, "type": "image/svg+xml" }, { "file": "assets/images/icons/logout.svg", "size": 555, "type": "image/svg+xml" }, { "file": "assets/images/icons/mail.svg", "size": 529, "type": "image/svg+xml" }, { "file": "assets/images/icons/map-pin.svg", "size": 2197, "type": "image/svg+xml" }, { "file": "assets/images/icons/map.svg", "size": 3296, "type": "image/svg+xml" }, { "file": "assets/images/icons/maximize-2.svg", "size": 4841, "type": "image/svg+xml" }, { "file": "assets/images/icons/maximize.svg", "size": 2527, "type": "image/svg+xml" }, { "file": "assets/images/icons/meh.svg", "size": 1795, "type": "image/svg+xml" }, { "file": "assets/images/icons/menu-bar.svg", "size": 229, "type": "image/svg+xml" }, { "file": "assets/images/icons/menu.svg", "size": 1239, "type": "image/svg+xml" }, { "file": "assets/images/icons/message-circle.svg", "size": 1908, "type": "image/svg+xml" }, { "file": "assets/images/icons/message-square.svg", "size": 1140, "type": "image/svg+xml" }, { "file": "assets/images/icons/mic-off.svg", "size": 3621, "type": "image/svg+xml" }, { "file": "assets/images/icons/mic.svg", "size": 1848, "type": "image/svg+xml" }, { "file": "assets/images/icons/minimize-2.svg", "size": 4764, "type": "image/svg+xml" }, { "file": "assets/images/icons/minimize.svg", "size": 2499, "type": "image/svg+xml" }, { "file": "assets/images/icons/minus-circle.svg", "size": 1140, "type": "image/svg+xml" }, { "file": "assets/images/icons/minus-square.svg", "size": 1285, "type": "image/svg+xml" }, { "file": "assets/images/icons/minus.svg", "size": 702, "type": "image/svg+xml" }, { "file": "assets/images/icons/monitor.svg", "size": 1321, "type": "image/svg+xml" }, { "file": "assets/images/icons/moon.svg", "size": 1383, "type": "image/svg+xml" }, { "file": "assets/images/icons/more-horizontal.svg", "size": 1150, "type": "image/svg+xml" }, { "file": "assets/images/icons/more-vertical.svg", "size": 1130, "type": "image/svg+xml" }, { "file": "assets/images/icons/more.svg", "size": 330, "type": "image/svg+xml" }, { "file": "assets/images/icons/mouse-pointer.svg", "size": 1233, "type": "image/svg+xml" }, { "file": "assets/images/icons/move.svg", "size": 9139, "type": "image/svg+xml" }, { "file": "assets/images/icons/music.svg", "size": 1582, "type": "image/svg+xml" }, { "file": "assets/images/icons/navigation-2.svg", "size": 981, "type": "image/svg+xml" }, { "file": "assets/images/icons/navigation.svg", "size": 1e3, "type": "image/svg+xml" }, { "file": "assets/images/icons/octagon.svg", "size": 1333, "type": "image/svg+xml" }, { "file": "assets/images/icons/package.svg", "size": 2284, "type": "image/svg+xml" }, { "file": "assets/images/icons/paperclip.svg", "size": 1777, "type": "image/svg+xml" }, { "file": "assets/images/icons/pause-circle.svg", "size": 1452, "type": "image/svg+xml" }, { "file": "assets/images/icons/pause.svg", "size": 1191, "type": "image/svg+xml" }, { "file": "assets/images/icons/pen-tool.svg", "size": 3120, "type": "image/svg+xml" }, { "file": "assets/images/icons/percent.svg", "size": 1761, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-call.svg", "size": 3432, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-forwarded.svg", "size": 5076, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-incoming.svg", "size": 4927, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-missed.svg", "size": 3655, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-off.svg", "size": 3629, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone-outgoing.svg", "size": 5075, "type": "image/svg+xml" }, { "file": "assets/images/icons/phone.svg", "size": 2720, "type": "image/svg+xml" }, { "file": "assets/images/icons/pie-chart.svg", "size": 1626, "type": "image/svg+xml" }, { "file": "assets/images/icons/play-circle.svg", "size": 1267, "type": "image/svg+xml" }, { "file": "assets/images/icons/play.svg", "size": 367, "type": "image/svg+xml" }, { "file": "assets/images/icons/plus-circle.svg", "size": 1490, "type": "image/svg+xml" }, { "file": "assets/images/icons/plus-square.svg", "size": 1635, "type": "image/svg+xml" }, { "file": "assets/images/icons/plus.svg", "size": 1057, "type": "image/svg+xml" }, { "file": "assets/images/icons/pocket.svg", "size": 1669, "type": "image/svg+xml" }, { "file": "assets/images/icons/power.svg", "size": 1406, "type": "image/svg+xml" }, { "file": "assets/images/icons/printer.svg", "size": 884, "type": "image/svg+xml" }, { "file": "assets/images/icons/radio.svg", "size": 2743, "type": "image/svg+xml" }, { "file": "assets/images/icons/refresh-ccw.svg", "size": 5319, "type": "image/svg+xml" }, { "file": "assets/images/icons/refresh-cw.svg", "size": 5474, "type": "image/svg+xml" }, { "file": "assets/images/icons/repeat.svg", "size": 5436, "type": "image/svg+xml" }, { "file": "assets/images/icons/reply.svg", "size": 611, "type": "image/svg+xml" }, { "file": "assets/images/icons/rewind.svg", "size": 1134, "type": "image/svg+xml" }, { "file": "assets/images/icons/right-arrow.svg", "size": 340, "type": "image/svg+xml" }, { "file": "assets/images/icons/right-arrow2.svg", "size": 255, "type": "image/svg+xml" }, { "file": "assets/images/icons/rotate-ccw.svg", "size": 3292, "type": "image/svg+xml" }, { "file": "assets/images/icons/rotate-cw.svg", "size": 3070, "type": "image/svg+xml" }, { "file": "assets/images/icons/rss.svg", "size": 1337, "type": "image/svg+xml" }, { "file": "assets/images/icons/save.svg", "size": 702, "type": "image/svg+xml" }, { "file": "assets/images/icons/scissors.svg", "size": 2594, "type": "image/svg+xml" }, { "file": "assets/images/icons/search-light.svg", "size": 476, "type": "image/svg+xml" }, { "file": "assets/images/icons/search.svg", "size": 323, "type": "image/svg+xml" }, { "file": "assets/images/icons/send.svg", "size": 1793, "type": "image/svg+xml" }, { "file": "assets/images/icons/server.svg", "size": 2162, "type": "image/svg+xml" }, { "file": "assets/images/icons/settings.svg", "size": 6972, "type": "image/svg+xml" }, { "file": "assets/images/icons/share-2.svg", "size": 2675, "type": "image/svg+xml" }, { "file": "assets/images/icons/share.svg", "size": 3306, "type": "image/svg+xml" }, { "file": "assets/images/icons/shield-off.svg", "size": 2485, "type": "image/svg+xml" }, { "file": "assets/images/icons/shield.svg", "size": 1747, "type": "image/svg+xml" }, { "file": "assets/images/icons/shopping-bag.svg", "size": 2290, "type": "image/svg+xml" }, { "file": "assets/images/icons/shopping-cart.svg", "size": 1814, "type": "image/svg+xml" }, { "file": "assets/images/icons/shuffle.svg", "size": 5107, "type": "image/svg+xml" }, { "file": "assets/images/icons/sidebar.svg", "size": 1158, "type": "image/svg+xml" }, { "file": "assets/images/icons/skip-back.svg", "size": 1143, "type": "image/svg+xml" }, { "file": "assets/images/icons/skip-forward.svg", "size": 1111, "type": "image/svg+xml" }, { "file": "assets/images/icons/slack.svg", "size": 4237, "type": "image/svg+xml" }, { "file": "assets/images/icons/slash.svg", "size": 1103, "type": "image/svg+xml" }, { "file": "assets/images/icons/sliders.svg", "size": 2656, "type": "image/svg+xml" }, { "file": "assets/images/icons/smartphone.svg", "size": 1361, "type": "image/svg+xml" }, { "file": "assets/images/icons/smile.svg", "size": 2316, "type": "image/svg+xml" }, { "file": "assets/images/icons/speaker.svg", "size": 1731, "type": "image/svg+xml" }, { "file": "assets/images/icons/square.svg", "size": 1055, "type": "image/svg+xml" }, { "file": "assets/images/icons/star fill.svg", "size": 1074, "type": "image/svg+xml" }, { "file": "assets/images/icons/star half.svg", "size": 2556, "type": "image/svg+xml" }, { "file": "assets/images/icons/star-fill.svg", "size": 368, "type": "image/svg+xml" }, { "file": "assets/images/icons/star-five.svg", "size": 2686, "type": "image/svg+xml" }, { "file": "assets/images/icons/star.svg", "size": 739, "type": "image/svg+xml" }, { "file": "assets/images/icons/stop-circle.svg", "size": 1278, "type": "image/svg+xml" }, { "file": "assets/images/icons/sun.svg", "size": 3316, "type": "image/svg+xml" }, { "file": "assets/images/icons/sunrise.svg", "size": 4704, "type": "image/svg+xml" }, { "file": "assets/images/icons/sunset.svg", "size": 4632, "type": "image/svg+xml" }, { "file": "assets/images/icons/tablet.svg", "size": 1348, "type": "image/svg+xml" }, { "file": "assets/images/icons/tag.svg", "size": 1620, "type": "image/svg+xml" }, { "file": "assets/images/icons/target.svg", "size": 1674, "type": "image/svg+xml" }, { "file": "assets/images/icons/terminal.svg", "size": 1180, "type": "image/svg+xml" }, { "file": "assets/images/icons/thermometer.svg", "size": 1521, "type": "image/svg+xml" }, { "file": "assets/images/icons/thumbs-down.svg", "size": 1878, "type": "image/svg+xml" }, { "file": "assets/images/icons/thumbs-up.svg", "size": 1878, "type": "image/svg+xml" }, { "file": "assets/images/icons/toggle-left.svg", "size": 1526, "type": "image/svg+xml" }, { "file": "assets/images/icons/toggle-right.svg", "size": 1406, "type": "image/svg+xml" }, { "file": "assets/images/icons/tool.svg", "size": 1976, "type": "image/svg+xml" }, { "file": "assets/images/icons/trade.svg", "size": 597, "type": "image/svg+xml" }, { "file": "assets/images/icons/trash-2.svg", "size": 2290, "type": "image/svg+xml" }, { "file": "assets/images/icons/trash.svg", "size": 1812, "type": "image/svg+xml" }, { "file": "assets/images/icons/trello.svg", "size": 1755, "type": "image/svg+xml" }, { "file": "assets/images/icons/trending-down.svg", "size": 2827, "type": "image/svg+xml" }, { "file": "assets/images/icons/trending-up.svg", "size": 2905, "type": "image/svg+xml" }, { "file": "assets/images/icons/triangle.svg", "size": 1425, "type": "image/svg+xml" }, { "file": "assets/images/icons/truck.svg", "size": 2003, "type": "image/svg+xml" }, { "file": "assets/images/icons/tv.svg", "size": 1477, "type": "image/svg+xml" }, { "file": "assets/images/icons/twitch.svg", "size": 1234, "type": "image/svg+xml" }, { "file": "assets/images/icons/twitter-fill.svg", "size": 924, "type": "image/svg+xml" }, { "file": "assets/images/icons/twitter.svg", "size": 1375, "type": "image/svg+xml" }, { "file": "assets/images/icons/type.svg", "size": 1326, "type": "image/svg+xml" }, { "file": "assets/images/icons/umbrella.svg", "size": 1229, "type": "image/svg+xml" }, { "file": "assets/images/icons/underline.svg", "size": 1302, "type": "image/svg+xml" }, { "file": "assets/images/icons/unlock.svg", "size": 1482, "type": "image/svg+xml" }, { "file": "assets/images/icons/upload-cloud.svg", "size": 4342, "type": "image/svg+xml" }, { "file": "assets/images/icons/upload.svg", "size": 839, "type": "image/svg+xml" }, { "file": "assets/images/icons/user-check.svg", "size": 2130, "type": "image/svg+xml" }, { "file": "assets/images/icons/user-minus.svg", "size": 1853, "type": "image/svg+xml" }, { "file": "assets/images/icons/user-plus.svg", "size": 2259, "type": "image/svg+xml" }, { "file": "assets/images/icons/user-x.svg", "size": 2514, "type": "image/svg+xml" }, { "file": "assets/images/icons/user.svg", "size": 455, "type": "image/svg+xml" }, { "file": "assets/images/icons/users.svg", "size": 2589, "type": "image/svg+xml" }, { "file": "assets/images/icons/video-off.svg", "size": 2413, "type": "image/svg+xml" }, { "file": "assets/images/icons/video.svg", "size": 1312, "type": "image/svg+xml" }, { "file": "assets/images/icons/voicemail.svg", "size": 1552, "type": "image/svg+xml" }, { "file": "assets/images/icons/volume-1.svg", "size": 1531, "type": "image/svg+xml" }, { "file": "assets/images/icons/volume-2.svg", "size": 1945, "type": "image/svg+xml" }, { "file": "assets/images/icons/volume-x.svg", "size": 1998, "type": "image/svg+xml" }, { "file": "assets/images/icons/volume.svg", "size": 1128, "type": "image/svg+xml" }, { "file": "assets/images/icons/watch.svg", "size": 2900, "type": "image/svg+xml" }, { "file": "assets/images/icons/wifi-off.svg", "size": 3056, "type": "image/svg+xml" }, { "file": "assets/images/icons/wifi.svg", "size": 2033, "type": "image/svg+xml" }, { "file": "assets/images/icons/wind.svg", "size": 2872, "type": "image/svg+xml" }, { "file": "assets/images/icons/x-circle.svg", "size": 1756, "type": "image/svg+xml" }, { "file": "assets/images/icons/x-octagon.svg", "size": 2179, "type": "image/svg+xml" }, { "file": "assets/images/icons/x-square.svg", "size": 1901, "type": "image/svg+xml" }, { "file": "assets/images/icons/x.svg", "size": 1335, "type": "image/svg+xml" }, { "file": "assets/images/icons/youtube.svg", "size": 1732, "type": "image/svg+xml" }, { "file": "assets/images/icons/zap-off.svg", "size": 2257, "type": "image/svg+xml" }, { "file": "assets/images/icons/zap.svg", "size": 1109, "type": "image/svg+xml" }, { "file": "assets/images/icons/zoom-in.svg", "size": 2006, "type": "image/svg+xml" }, { "file": "assets/images/icons/zoom-out.svg", "size": 1584, "type": "image/svg+xml" }, { "file": "assets/images/menus/menu1.jpg", "size": 50156, "type": "image/jpeg" }, { "file": "assets/images/menus/menu10.png", "size": 14619, "type": "image/png" }, { "file": "assets/images/menus/menu100.png", "size": 26413, "type": "image/png" }, { "file": "assets/images/menus/menu101.png", "size": 26213, "type": "image/png" }, { "file": "assets/images/menus/menu102.png", "size": 31134, "type": "image/png" }, { "file": "assets/images/menus/menu103.png", "size": 22001, "type": "image/png" }, { "file": "assets/images/menus/menu104.png", "size": 23204, "type": "image/png" }, { "file": "assets/images/menus/menu105.png", "size": 32850, "type": "image/png" }, { "file": "assets/images/menus/menu106.png", "size": 25894, "type": "image/png" }, { "file": "assets/images/menus/menu107.png", "size": 21601, "type": "image/png" }, { "file": "assets/images/menus/menu108.png", "size": 35542, "type": "image/png" }, { "file": "assets/images/menus/menu109.png", "size": 35225, "type": "image/png" }, { "file": "assets/images/menus/menu11.png", "size": 10578, "type": "image/png" }, { "file": "assets/images/menus/menu110.png", "size": 119302, "type": "image/png" }, { "file": "assets/images/menus/menu111.png", "size": 6125, "type": "image/png" }, { "file": "assets/images/menus/menu112.jpg", "size": 3811, "type": "image/jpeg" }, { "file": "assets/images/menus/menu113.jpg", "size": 4103, "type": "image/jpeg" }, { "file": "assets/images/menus/menu114.jpg", "size": 4497, "type": "image/jpeg" }, { "file": "assets/images/menus/menu115.jpg", "size": 3807, "type": "image/jpeg" }, { "file": "assets/images/menus/menu116.jpg", "size": 3365, "type": "image/jpeg" }, { "file": "assets/images/menus/menu117.jpg", "size": 34286, "type": "image/jpeg" }, { "file": "assets/images/menus/menu118.jpg", "size": 42841, "type": "image/jpeg" }, { "file": "assets/images/menus/menu119.jpg", "size": 35162, "type": "image/jpeg" }, { "file": "assets/images/menus/menu12.png", "size": 11326, "type": "image/png" }, { "file": "assets/images/menus/menu120.jpg", "size": 53531, "type": "image/jpeg" }, { "file": "assets/images/menus/menu121.jpg", "size": 47962, "type": "image/jpeg" }, { "file": "assets/images/menus/menu122.jpg", "size": 43998, "type": "image/jpeg" }, { "file": "assets/images/menus/menu123.jpg", "size": 38088, "type": "image/jpeg" }, { "file": "assets/images/menus/menu124.jpg", "size": 39826, "type": "image/jpeg" }, { "file": "assets/images/menus/menu125.jpg", "size": 24183, "type": "image/jpeg" }, { "file": "assets/images/menus/menu126.jpg", "size": 41719, "type": "image/jpeg" }, { "file": "assets/images/menus/menu127.jpg", "size": 37783, "type": "image/jpeg" }, { "file": "assets/images/menus/menu128.jpg", "size": 37558, "type": "image/jpeg" }, { "file": "assets/images/menus/menu129.jpg", "size": 31747, "type": "image/jpeg" }, { "file": "assets/images/menus/menu13.png", "size": 15136, "type": "image/png" }, { "file": "assets/images/menus/menu130.jpg", "size": 30303, "type": "image/jpeg" }, { "file": "assets/images/menus/menu131.jpg", "size": 41299, "type": "image/jpeg" }, { "file": "assets/images/menus/menu132.jpg", "size": 40611, "type": "image/jpeg" }, { "file": "assets/images/menus/menu133.jpg", "size": 37190, "type": "image/jpeg" }, { "file": "assets/images/menus/menu134.jpg", "size": 43891, "type": "image/jpeg" }, { "file": "assets/images/menus/menu135.jpg", "size": 49682, "type": "image/jpeg" }, { "file": "assets/images/menus/menu136.jpg", "size": 22487, "type": "image/jpeg" }, { "file": "assets/images/menus/menu137.jpg", "size": 26733, "type": "image/jpeg" }, { "file": "assets/images/menus/menu138.jpg", "size": 24071, "type": "image/jpeg" }, { "file": "assets/images/menus/menu139.jpg", "size": 18062, "type": "image/jpeg" }, { "file": "assets/images/menus/menu14.jpg", "size": 62277, "type": "image/jpeg" }, { "file": "assets/images/menus/menu140.jpg", "size": 21542, "type": "image/jpeg" }, { "file": "assets/images/menus/menu141.jpg", "size": 102793, "type": "image/jpeg" }, { "file": "assets/images/menus/menu142.jpg", "size": 53664, "type": "image/jpeg" }, { "file": "assets/images/menus/menu143.jpg", "size": 90291, "type": "image/jpeg" }, { "file": "assets/images/menus/menu144.jpg", "size": 99858, "type": "image/jpeg" }, { "file": "assets/images/menus/menu145.jpg", "size": 13220, "type": "image/jpeg" }, { "file": "assets/images/menus/menu146.jpg", "size": 3155, "type": "image/jpeg" }, { "file": "assets/images/menus/menu147.jpg", "size": 7186, "type": "image/jpeg" }, { "file": "assets/images/menus/menu148.jpg", "size": 5048, "type": "image/jpeg" }, { "file": "assets/images/menus/menu149.jpg", "size": 6812, "type": "image/jpeg" }, { "file": "assets/images/menus/menu15.jpg", "size": 68739, "type": "image/jpeg" }, { "file": "assets/images/menus/menu150.jpg", "size": 167272, "type": "image/jpeg" }, { "file": "assets/images/menus/menu151.jpg", "size": 13191, "type": "image/jpeg" }, { "file": "assets/images/menus/menu152.png", "size": 15098, "type": "image/png" }, { "file": "assets/images/menus/menu153.jpg", "size": 38408, "type": "image/jpeg" }, { "file": "assets/images/menus/menu16.jpg", "size": 68116, "type": "image/jpeg" }, { "file": "assets/images/menus/menu17.jpg", "size": 78282, "type": "image/jpeg" }, { "file": "assets/images/menus/menu18.jpg", "size": 49456, "type": "image/jpeg" }, { "file": "assets/images/menus/menu19.jpg", "size": 25282, "type": "image/jpeg" }, { "file": "assets/images/menus/menu2.jpg", "size": 46524, "type": "image/jpeg" }, { "file": "assets/images/menus/menu20.jpg", "size": 16922, "type": "image/jpeg" }, { "file": "assets/images/menus/menu21.jpg", "size": 48946, "type": "image/jpeg" }, { "file": "assets/images/menus/menu22.jpg", "size": 27334, "type": "image/jpeg" }, { "file": "assets/images/menus/menu23.jpg", "size": 55662, "type": "image/jpeg" }, { "file": "assets/images/menus/menu24.jpg", "size": 41694, "type": "image/jpeg" }, { "file": "assets/images/menus/menu25.jpg", "size": 38160, "type": "image/jpeg" }, { "file": "assets/images/menus/menu26.jpg", "size": 42113, "type": "image/jpeg" }, { "file": "assets/images/menus/menu27.jpg", "size": 31660, "type": "image/jpeg" }, { "file": "assets/images/menus/menu28.jpg", "size": 51234, "type": "image/jpeg" }, { "file": "assets/images/menus/menu29.jpg", "size": 50331, "type": "image/jpeg" }, { "file": "assets/images/menus/menu3.jpg", "size": 18840, "type": "image/jpeg" }, { "file": "assets/images/menus/menu30.jpg", "size": 49194, "type": "image/jpeg" }, { "file": "assets/images/menus/menu31.jpg", "size": 46480, "type": "image/jpeg" }, { "file": "assets/images/menus/menu32.jpg", "size": 42916, "type": "image/jpeg" }, { "file": "assets/images/menus/menu33.jpg", "size": 39236, "type": "image/jpeg" }, { "file": "assets/images/menus/menu34.jpg", "size": 44519, "type": "image/jpeg" }, { "file": "assets/images/menus/menu35.jpg", "size": 37455, "type": "image/jpeg" }, { "file": "assets/images/menus/menu36.jpg", "size": 41629, "type": "image/jpeg" }, { "file": "assets/images/menus/menu37.jpg", "size": 23518, "type": "image/jpeg" }, { "file": "assets/images/menus/menu38.jpg", "size": 24429, "type": "image/jpeg" }, { "file": "assets/images/menus/menu39.jpg", "size": 21950, "type": "image/jpeg" }, { "file": "assets/images/menus/menu4.jpg", "size": 36385, "type": "image/jpeg" }, { "file": "assets/images/menus/menu40.jpg", "size": 17839, "type": "image/jpeg" }, { "file": "assets/images/menus/menu41.jpg", "size": 16230, "type": "image/jpeg" }, { "file": "assets/images/menus/menu42.jpg", "size": 26716, "type": "image/jpeg" }, { "file": "assets/images/menus/menu43.jpg", "size": 29501, "type": "image/jpeg" }, { "file": "assets/images/menus/menu44.jpg", "size": 31646, "type": "image/jpeg" }, { "file": "assets/images/menus/menu46.jpg", "size": 21174, "type": "image/jpeg" }, { "file": "assets/images/menus/menu47.jpg", "size": 20768, "type": "image/jpeg" }, { "file": "assets/images/menus/menu48.jpg", "size": 20523, "type": "image/jpeg" }, { "file": "assets/images/menus/menu49.jpg", "size": 12167, "type": "image/jpeg" }, { "file": "assets/images/menus/menu5.jpg", "size": 28082, "type": "image/jpeg" }, { "file": "assets/images/menus/menu50.jpg", "size": 16633, "type": "image/jpeg" }, { "file": "assets/images/menus/menu51.jpg", "size": 14433, "type": "image/jpeg" }, { "file": "assets/images/menus/menu52.jpg", "size": 66743, "type": "image/jpeg" }, { "file": "assets/images/menus/menu53.jpg", "size": 103094, "type": "image/jpeg" }, { "file": "assets/images/menus/menu54.jpg", "size": 82439, "type": "image/jpeg" }, { "file": "assets/images/menus/menu55.jpg", "size": 16658, "type": "image/jpeg" }, { "file": "assets/images/menus/menu56.jpg", "size": 13009, "type": "image/jpeg" }, { "file": "assets/images/menus/menu57.jpg", "size": 14205, "type": "image/jpeg" }, { "file": "assets/images/menus/menu58.jpg", "size": 12013, "type": "image/jpeg" }, { "file": "assets/images/menus/menu59.jpg", "size": 29182, "type": "image/jpeg" }, { "file": "assets/images/menus/menu6.jpg", "size": 34986, "type": "image/jpeg" }, { "file": "assets/images/menus/menu60.jpg", "size": 10803, "type": "image/jpeg" }, { "file": "assets/images/menus/menu61.jpg", "size": 9224, "type": "image/jpeg" }, { "file": "assets/images/menus/menu62.jpg", "size": 8778, "type": "image/jpeg" }, { "file": "assets/images/menus/menu63.jpg", "size": 11985, "type": "image/jpeg" }, { "file": "assets/images/menus/menu64.jpg", "size": 5865, "type": "image/jpeg" }, { "file": "assets/images/menus/menu65.jpg", "size": 13014, "type": "image/jpeg" }, { "file": "assets/images/menus/menu66.jpg", "size": 47949, "type": "image/jpeg" }, { "file": "assets/images/menus/menu67.jpg", "size": 49062, "type": "image/jpeg" }, { "file": "assets/images/menus/menu68.jpg", "size": 46728, "type": "image/jpeg" }, { "file": "assets/images/menus/menu69.jpg", "size": 26184, "type": "image/jpeg" }, { "file": "assets/images/menus/menu7.jpg", "size": 34507, "type": "image/jpeg" }, { "file": "assets/images/menus/menu70.jpg", "size": 45654, "type": "image/jpeg" }, { "file": "assets/images/menus/menu71.jpg", "size": 23619, "type": "image/jpeg" }, { "file": "assets/images/menus/menu72.jpg", "size": 60204, "type": "image/jpeg" }, { "file": "assets/images/menus/menu73.jpg", "size": 56573, "type": "image/jpeg" }, { "file": "assets/images/menus/menu74.jpg", "size": 43034, "type": "image/jpeg" }, { "file": "assets/images/menus/menu75.jpg", "size": 36493, "type": "image/jpeg" }, { "file": "assets/images/menus/menu76.jpg", "size": 42779, "type": "image/jpeg" }, { "file": "assets/images/menus/menu77.jpg", "size": 23812, "type": "image/jpeg" }, { "file": "assets/images/menus/menu78.jpg", "size": 51286, "type": "image/jpeg" }, { "file": "assets/images/menus/menu79.jpg", "size": 48702, "type": "image/jpeg" }, { "file": "assets/images/menus/menu8.png", "size": 15073, "type": "image/png" }, { "file": "assets/images/menus/menu80.jpg", "size": 35254, "type": "image/jpeg" }, { "file": "assets/images/menus/menu81.jpg", "size": 41972, "type": "image/jpeg" }, { "file": "assets/images/menus/menu82.jpg", "size": 39224, "type": "image/jpeg" }, { "file": "assets/images/menus/menu83.jpg", "size": 35092, "type": "image/jpeg" }, { "file": "assets/images/menus/menu84.jpg", "size": 19881, "type": "image/jpeg" }, { "file": "assets/images/menus/menu85.jpg", "size": 53736, "type": "image/jpeg" }, { "file": "assets/images/menus/menu86.jpg", "size": 35459, "type": "image/jpeg" }, { "file": "assets/images/menus/menu87.jpg", "size": 47714, "type": "image/jpeg" }, { "file": "assets/images/menus/menu88.jpg", "size": 41499, "type": "image/jpeg" }, { "file": "assets/images/menus/menu89.jpg", "size": 38147, "type": "image/jpeg" }, { "file": "assets/images/menus/menu9.png", "size": 12157, "type": "image/png" }, { "file": "assets/images/menus/menu90.jpg", "size": 200115, "type": "image/jpeg" }, { "file": "assets/images/menus/menu91.png", "size": 35820, "type": "image/png" }, { "file": "assets/images/menus/menu92.png", "size": 27884, "type": "image/png" }, { "file": "assets/images/menus/menu93.png", "size": 27656, "type": "image/png" }, { "file": "assets/images/menus/menu94.png", "size": 37323, "type": "image/png" }, { "file": "assets/images/menus/menu95.png", "size": 36681, "type": "image/png" }, { "file": "assets/images/menus/menu96.png", "size": 29018, "type": "image/png" }, { "file": "assets/images/menus/menu97.png", "size": 31425, "type": "image/png" }, { "file": "assets/images/menus/menu98.png", "size": 44103, "type": "image/png" }, { "file": "assets/images/menus/menu99.png", "size": 17690, "type": "image/png" }, { "file": "assets/images/moreproducts.jpg", "size": 98750, "type": "image/jpeg" }, { "file": "assets/images/tastebite.jpg", "size": 124951, "type": "image/jpeg" }, { "file": "assets/images/teams/team1.png", "size": 16200, "type": "image/png" }, { "file": "assets/images/teams/team10.png", "size": 17650, "type": "image/png" }, { "file": "assets/images/teams/team11.png", "size": 15084, "type": "image/png" }, { "file": "assets/images/teams/team12.png", "size": 13381, "type": "image/png" }, { "file": "assets/images/teams/team2.png", "size": 15793, "type": "image/png" }, { "file": "assets/images/teams/team3.png", "size": 15684, "type": "image/png" }, { "file": "assets/images/teams/team4.png", "size": 16489, "type": "image/png" }, { "file": "assets/images/teams/team5.png", "size": 15758, "type": "image/png" }, { "file": "assets/images/teams/team6.png", "size": 16197, "type": "image/png" }, { "file": "assets/images/teams/team7.png", "size": 13151, "type": "image/png" }, { "file": "assets/images/teams/team8.png", "size": 11408, "type": "image/png" }, { "file": "assets/images/teams/team9.png", "size": 15142, "type": "image/png" }, { "file": "assets/images/templates/aboutx1.jpg", "size": 69934, "type": "image/jpeg" }, { "file": "assets/images/templates/archivex1.jpg", "size": 623635, "type": "image/jpeg" }, { "file": "assets/images/templates/blogx1.jpg", "size": 107902, "type": "image/jpeg" }, { "file": "assets/images/templates/categoryx1.jpg", "size": 490059, "type": "image/jpeg" }, { "file": "assets/images/templates/favoritesx1.jpg", "size": 70027, "type": "image/jpeg" }, { "file": "assets/images/templates/home1x1.jpg", "size": 50124, "type": "image/jpeg" }, { "file": "assets/images/templates/home2x1.jpg", "size": 59230, "type": "image/jpeg" }, { "file": "assets/images/templates/home3x1.jpg", "size": 64340, "type": "image/jpeg" }, { "file": "assets/images/templates/profilex1.jpg", "size": 12029, "type": "image/jpeg" }, { "file": "assets/images/templates/recipe2x1.jpg", "size": 50165, "type": "image/jpeg" }, { "file": "assets/images/templates/recipex1.jpg", "size": 53732, "type": "image/jpeg" }, { "file": "assets/images/templates/searchx1.jpg", "size": 59798, "type": "image/jpeg" }, { "file": "assets/js/.DS_Store", "size": 6148, "type": null }, { "file": "assets/js/bootstrap.bundle.min.js", "size": 80821, "type": "application/javascript" }, { "file": "assets/js/html5.min.js", "size": 2427, "type": "application/javascript" }, { "file": "assets/js/masonry.min.js", "size": 48335, "type": "application/javascript" }, { "file": "assets/js/sticky.min.js", "size": 7038, "type": "application/javascript" }, { "file": "assets/js/swiper-bundle.min.js", "size": 139390, "type": "application/javascript" }, { "file": "assets/js/tastebite-scripts.js", "size": 3656, "type": "application/javascript" }, { "file": "favicon.png", "size": 1571, "type": "image/png" }],
      layout: "src/routes/__layout.svelte",
      error: "src/routes/__error.svelte",
      routes: [
        {
          type: "page",
          pattern: /^\/$/,
          params: empty,
          a: ["src/routes/__layout.svelte", "src/routes/index.svelte"],
          b: ["src/routes/__error.svelte"]
        }
      ]
    };
    get_hooks = (hooks) => ({
      getSession: hooks.getSession || (() => ({})),
      handle: hooks.handle || (({ request, resolve: resolve2 }) => resolve2(request)),
      handleError: hooks.handleError || (({ error: error2 }) => console.error(error2.stack)),
      externalFetch: hooks.externalFetch || fetch
    });
    module_lookup = {
      "src/routes/__layout.svelte": () => Promise.resolve().then(() => (init_layout_01feaf6f(), layout_01feaf6f_exports)),
      "src/routes/__error.svelte": () => Promise.resolve().then(() => (init_error_9a67d2a0(), error_9a67d2a0_exports)),
      "src/routes/index.svelte": () => Promise.resolve().then(() => (init_index_2c1d5ba2(), index_2c1d5ba2_exports))
    };
    metadata_lookup = { "src/routes/__layout.svelte": { "entry": "pages/__layout.svelte-e3744be3.js", "css": [], "js": ["pages/__layout.svelte-e3744be3.js", "chunks/vendor-a191d1a2.js"], "styles": [] }, "src/routes/__error.svelte": { "entry": "pages/__error.svelte-59d807f9.js", "css": [], "js": ["pages/__error.svelte-59d807f9.js", "chunks/vendor-a191d1a2.js"], "styles": [] }, "src/routes/index.svelte": { "entry": "pages/index.svelte-17ac3357.js", "css": [], "js": ["pages/index.svelte-17ac3357.js", "chunks/vendor-a191d1a2.js"], "styles": [] } };
  }
});

// .svelte-kit/netlify/entry.js
__export(exports, {
  handler: () => handler
});
init_shims();

// .svelte-kit/output/server/app.js
init_shims();
init_app_907bc18b();

// .svelte-kit/netlify/entry.js
init();
async function handler(event) {
  const { path, httpMethod, headers, rawQuery, body, isBase64Encoded } = event;
  const query = new URLSearchParams(rawQuery);
  const encoding = isBase64Encoded ? "base64" : headers["content-encoding"] || "utf-8";
  const rawBody = typeof body === "string" ? Buffer.from(body, encoding) : body;
  const rendered = await render({
    method: httpMethod,
    headers,
    path,
    query,
    rawBody
  });
  if (!rendered) {
    return {
      statusCode: 404,
      body: "Not found"
    };
  }
  const partial_response = {
    statusCode: rendered.status,
    ...split_headers(rendered.headers)
  };
  if (rendered.body instanceof Uint8Array) {
    return {
      ...partial_response,
      isBase64Encoded: true,
      body: Buffer.from(rendered.body).toString("base64")
    };
  }
  return {
    ...partial_response,
    body: rendered.body
  };
}
function split_headers(headers) {
  const h = {};
  const m = {};
  for (const key in headers) {
    const value = headers[key];
    const target = Array.isArray(value) ? m : h;
    target[key] = value;
  }
  return {
    headers: h,
    multiValueHeaders: m
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
/*! fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
