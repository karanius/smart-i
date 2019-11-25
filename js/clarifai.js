/**
 * Clarifai JavaScript SDK v2.9.1
 *
 * Last updated: Thu Aug 15 2019 07:00:35 GMT+0000 (Coordinated Universal Time)
 *
 * Visit https://developer.clarifai.com
 *
 * Copyright (c) 2016-present, Clarifai, Inc.
 * All rights reserved.
 * Licensed under the Apache License, Version 2.0.
 *
 * The source tree of this library can be found at
 *   https://github.com/Clarifai/clarifai-javascript
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    // rawAsap provides everything we need except exception management.
    var rawAsap = require("./raw");
    // RawTasks are recycled to reduce GC churn.
    var freeTasks = [];
    // We queue errors to ensure they are thrown in right order (FIFO).
    // Array-as-queue is good enough here, since we are just dealing with exceptions.
    var pendingErrors = [];
    var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);
    
    function throwFirstError() {
        if (pendingErrors.length) {
            throw pendingErrors.shift();
        }
    }
    
    /**
     * Calls a task as soon as possible after returning, in its own event, with priority
     * over other events like animation, reflow, and repaint. An error thrown from an
     * event will not interrupt, nor even substantially slow down the processing of
     * other events, but will be rather postponed to a lower priority event.
     * @param {{call}} task A callable object, typically a function that takes no
     * arguments.
     */
    module.exports = asap;
    function asap(task) {
        var rawTask;
        if (freeTasks.length) {
            rawTask = freeTasks.pop();
        } else {
            rawTask = new RawTask();
        }
        rawTask.task = task;
        rawAsap(rawTask);
    }
    
    // We wrap tasks with recyclable task objects.  A task object implements
    // `call`, just like a function.
    function RawTask() {
        this.task = null;
    }
    
    // The sole purpose of wrapping the task is to catch the exception and recycle
    // the task object after its single use.
    RawTask.prototype.call = function () {
        try {
            this.task.call();
        } catch (error) {
            if (asap.onerror) {
                // This hook exists purely for testing purposes.
                // Its name will be periodically randomized to break any code that
                // depends on its existence.
                asap.onerror(error);
            } else {
                // In a web browser, exceptions are not fatal. However, to avoid
                // slowing down the queue of pending tasks, we rethrow the error in a
                // lower priority turn.
                pendingErrors.push(error);
                requestErrorThrow();
            }
        } finally {
            this.task = null;
            freeTasks[freeTasks.length] = this;
        }
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/browser-asap.js","/../node_modules/asap")
    },{"./raw":2,"buffer":30,"pBGvAp":35}],2:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    // Use the fastest means possible to execute a task in its own turn, with
    // priority over other events including IO, animation, reflow, and redraw
    // events in browsers.
    //
    // An exception thrown by a task will permanently interrupt the processing of
    // subsequent tasks. The higher level `asap` function ensures that if an
    // exception is thrown by a task, that the task queue will continue flushing as
    // soon as possible, but if you use `rawAsap` directly, you are responsible to
    // either ensure that no exceptions are thrown from your task, or to manually
    // call `rawAsap.requestFlush` if an exception is thrown.
    module.exports = rawAsap;
    function rawAsap(task) {
        if (!queue.length) {
            requestFlush();
            flushing = true;
        }
        // Equivalent to push, but avoids a function call.
        queue[queue.length] = task;
    }
    
    var queue = [];
    // Once a flush has been requested, no further calls to `requestFlush` are
    // necessary until the next `flush` completes.
    var flushing = false;
    // `requestFlush` is an implementation-specific method that attempts to kick
    // off a `flush` event as quickly as possible. `flush` will attempt to exhaust
    // the event queue before yielding to the browser's own event loop.
    var requestFlush;
    // The position of the next task to execute in the task queue. This is
    // preserved between calls to `flush` so that it can be resumed if
    // a task throws an exception.
    var index = 0;
    // If a task schedules additional tasks recursively, the task queue can grow
    // unbounded. To prevent memory exhaustion, the task queue will periodically
    // truncate already-completed tasks.
    var capacity = 1024;
    
    // The flush function processes all tasks that have been scheduled with
    // `rawAsap` unless and until one of those tasks throws an exception.
    // If a task throws an exception, `flush` ensures that its state will remain
    // consistent and will resume where it left off when called again.
    // However, `flush` does not make any arrangements to be called again if an
    // exception is thrown.
    function flush() {
        while (index < queue.length) {
            var currentIndex = index;
            // Advance the index before calling the task. This ensures that we will
            // begin flushing on the next task the task throws an error.
            index = index + 1;
            queue[currentIndex].call();
            // Prevent leaking memory for long chains of recursive calls to `asap`.
            // If we call `asap` within tasks scheduled by `asap`, the queue will
            // grow, but to avoid an O(n) walk for every task we execute, we don't
            // shift tasks off the queue after they have been executed.
            // Instead, we periodically shift 1024 tasks off the queue.
            if (index > capacity) {
                // Manually shift all values starting at the index back to the
                // beginning of the queue.
                for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                    queue[scan] = queue[scan + index];
                }
                queue.length -= index;
                index = 0;
            }
        }
        queue.length = 0;
        index = 0;
        flushing = false;
    }
    
    // `requestFlush` is implemented using a strategy based on data collected from
    // every available SauceLabs Selenium web driver worker at time of writing.
    // https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593
    
    // Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
    // have WebKitMutationObserver but not un-prefixed MutationObserver.
    // Must use `global` or `self` instead of `window` to work in both frames and web
    // workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.
    
    /* globals self */
    var scope = typeof global !== "undefined" ? global : self;
    var BrowserMutationObserver = scope.MutationObserver || scope.WebKitMutationObserver;
    
    // MutationObservers are desirable because they have high priority and work
    // reliably everywhere they are implemented.
    // They are implemented in all modern browsers.
    //
    // - Android 4-4.3
    // - Chrome 26-34
    // - Firefox 14-29
    // - Internet Explorer 11
    // - iPad Safari 6-7.1
    // - iPhone Safari 7-7.1
    // - Safari 6-7
    if (typeof BrowserMutationObserver === "function") {
        requestFlush = makeRequestCallFromMutationObserver(flush);
    
    // MessageChannels are desirable because they give direct access to the HTML
    // task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
    // 11-12, and in web workers in many engines.
    // Although message channels yield to any queued rendering and IO tasks, they
    // would be better than imposing the 4ms delay of timers.
    // However, they do not work reliably in Internet Explorer or Safari.
    
    // Internet Explorer 10 is the only browser that has setImmediate but does
    // not have MutationObservers.
    // Although setImmediate yields to the browser's renderer, it would be
    // preferrable to falling back to setTimeout since it does not have
    // the minimum 4ms penalty.
    // Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
    // Desktop to a lesser extent) that renders both setImmediate and
    // MessageChannel useless for the purposes of ASAP.
    // https://github.com/kriskowal/q/issues/396
    
    // Timers are implemented universally.
    // We fall back to timers in workers in most engines, and in foreground
    // contexts in the following browsers.
    // However, note that even this simple case requires nuances to operate in a
    // broad spectrum of browsers.
    //
    // - Firefox 3-13
    // - Internet Explorer 6-9
    // - iPad Safari 4.3
    // - Lynx 2.8.7
    } else {
        requestFlush = makeRequestCallFromTimer(flush);
    }
    
    // `requestFlush` requests that the high priority event queue be flushed as
    // soon as possible.
    // This is useful to prevent an error thrown in a task from stalling the event
    // queue if the exception handled by Node.jsâ€™s
    // `process.on("uncaughtException")` or by a domain.
    rawAsap.requestFlush = requestFlush;
    
    // To request a high priority event, we induce a mutation observer by toggling
    // the text of a text node between "1" and "-1".
    function makeRequestCallFromMutationObserver(callback) {
        var toggle = 1;
        var observer = new BrowserMutationObserver(callback);
        var node = document.createTextNode("");
        observer.observe(node, {characterData: true});
        return function requestCall() {
            toggle = -toggle;
            node.data = toggle;
        };
    }
    
    // The message channel technique was discovered by Malte Ubl and was the
    // original foundation for this library.
    // http://www.nonblocking.io/2011/06/windownexttick.html
    
    // Safari 6.0.5 (at least) intermittently fails to create message ports on a
    // page's first load. Thankfully, this version of Safari supports
    // MutationObservers, so we don't need to fall back in that case.
    
    // function makeRequestCallFromMessageChannel(callback) {
    //     var channel = new MessageChannel();
    //     channel.port1.onmessage = callback;
    //     return function requestCall() {
    //         channel.port2.postMessage(0);
    //     };
    // }
    
    // For reasons explained above, we are also unable to use `setImmediate`
    // under any circumstances.
    // Even if we were, there is another bug in Internet Explorer 10.
    // It is not sufficient to assign `setImmediate` to `requestFlush` because
    // `setImmediate` must be called *by name* and therefore must be wrapped in a
    // closure.
    // Never forget.
    
    // function makeRequestCallFromSetImmediate(callback) {
    //     return function requestCall() {
    //         setImmediate(callback);
    //     };
    // }
    
    // Safari 6.0 has a problem where timers will get lost while the user is
    // scrolling. This problem does not impact ASAP because Safari 6.0 supports
    // mutation observers, so that implementation is used instead.
    // However, if we ever elect to use timers in Safari, the prevalent work-around
    // is to add a scroll event listener that calls for a flush.
    
    // `setTimeout` does not call the passed callback if the delay is less than
    // approximately 7 in web workers in Firefox 8 through 18, and sometimes not
    // even then.
    
    function makeRequestCallFromTimer(callback) {
        return function requestCall() {
            // We dispatch a timeout with a specified delay of 0 for engines that
            // can reliably accommodate that request. This will usually be snapped
            // to a 4 milisecond delay, but once we're flushing, there's no delay
            // between events.
            var timeoutHandle = setTimeout(handleTimer, 0);
            // However, since this timer gets frequently dropped in Firefox
            // workers, we enlist an interval handle that will try to fire
            // an event 20 times per second until it succeeds.
            var intervalHandle = setInterval(handleTimer, 50);
    
            function handleTimer() {
                // Whichever timer succeeds will cancel both timers and
                // execute the callback.
                clearTimeout(timeoutHandle);
                clearInterval(intervalHandle);
                callback();
            }
        };
    }
    
    // This is for `asap.js` only.
    // Its name will be periodically randomized to break any code that depends on
    // its existence.
    rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;
    
    // ASAP was originally a nextTick shim included in Q. This was factored out
    // into this ASAP package. It was later adapted to RSVP which made further
    // amendments. These decisions, particularly to marginalize MessageChannel and
    // to capture the MutationObserver implementation in a closure, were integrated
    // back into ASAP proper.
    // https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/browser-raw.js","/../node_modules/asap")
    },{"buffer":30,"pBGvAp":35}],3:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    var domain; // The domain module is executed on demand
    var hasSetImmediate = typeof setImmediate === "function";
    
    // Use the fastest means possible to execute a task in its own turn, with
    // priority over other events including network IO events in Node.js.
    //
    // An exception thrown by a task will permanently interrupt the processing of
    // subsequent tasks. The higher level `asap` function ensures that if an
    // exception is thrown by a task, that the task queue will continue flushing as
    // soon as possible, but if you use `rawAsap` directly, you are responsible to
    // either ensure that no exceptions are thrown from your task, or to manually
    // call `rawAsap.requestFlush` if an exception is thrown.
    module.exports = rawAsap;
    function rawAsap(task) {
        if (!queue.length) {
            requestFlush();
            flushing = true;
        }
        // Avoids a function call
        queue[queue.length] = task;
    }
    
    var queue = [];
    // Once a flush has been requested, no further calls to `requestFlush` are
    // necessary until the next `flush` completes.
    var flushing = false;
    // The position of the next task to execute in the task queue. This is
    // preserved between calls to `flush` so that it can be resumed if
    // a task throws an exception.
    var index = 0;
    // If a task schedules additional tasks recursively, the task queue can grow
    // unbounded. To prevent memory excaustion, the task queue will periodically
    // truncate already-completed tasks.
    var capacity = 1024;
    
    // The flush function processes all tasks that have been scheduled with
    // `rawAsap` unless and until one of those tasks throws an exception.
    // If a task throws an exception, `flush` ensures that its state will remain
    // consistent and will resume where it left off when called again.
    // However, `flush` does not make any arrangements to be called again if an
    // exception is thrown.
    function flush() {
        while (index < queue.length) {
            var currentIndex = index;
            // Advance the index before calling the task. This ensures that we will
            // begin flushing on the next task the task throws an error.
            index = index + 1;
            queue[currentIndex].call();
            // Prevent leaking memory for long chains of recursive calls to `asap`.
            // If we call `asap` within tasks scheduled by `asap`, the queue will
            // grow, but to avoid an O(n) walk for every task we execute, we don't
            // shift tasks off the queue after they have been executed.
            // Instead, we periodically shift 1024 tasks off the queue.
            if (index > capacity) {
                // Manually shift all values starting at the index back to the
                // beginning of the queue.
                for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                    queue[scan] = queue[scan + index];
                }
                queue.length -= index;
                index = 0;
            }
        }
        queue.length = 0;
        index = 0;
        flushing = false;
    }
    
    rawAsap.requestFlush = requestFlush;
    function requestFlush() {
        // Ensure flushing is not bound to any domain.
        // It is not sufficient to exit the domain, because domains exist on a stack.
        // To execute code outside of any domain, the following dance is necessary.
        var parentDomain = process.domain;
        if (parentDomain) {
            if (!domain) {
                // Lazy execute the domain module.
                // Only employed if the user elects to use domains.
                domain = require("domain");
            }
            domain.active = process.domain = null;
        }
    
        // `setImmediate` is slower that `process.nextTick`, but `process.nextTick`
        // cannot handle recursion.
        // `requestFlush` will only be called recursively from `asap.js`, to resume
        // flushing after an error is thrown into a domain.
        // Conveniently, `setImmediate` was introduced in the same version
        // `process.nextTick` started throwing recursion errors.
        if (flushing && hasSetImmediate) {
            setImmediate(flush);
        } else {
            process.nextTick(flush);
        }
    
        if (parentDomain) {
            domain.active = process.domain = parentDomain;
        }
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/raw.js","/../node_modules/asap")
    },{"buffer":30,"domain":31,"pBGvAp":35}],4:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    module.exports = require('./lib/axios');
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/index.js","/../node_modules/axios")
    },{"./lib/axios":6,"buffer":30,"pBGvAp":35}],5:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    var settle = require('./../core/settle');
    var buildURL = require('./../helpers/buildURL');
    var parseHeaders = require('./../helpers/parseHeaders');
    var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
    var createError = require('../core/createError');
    
    module.exports = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
    
        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }
    
        var request = new XMLHttpRequest();
    
        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password || '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }
    
        request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);
    
        // Set the request timeout in MS
        request.timeout = config.timeout;
    
        // Listen for ready state
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }
    
          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
            return;
          }
    
          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };
    
          settle(resolve, reject, response);
    
          // Clean up request
          request = null;
        };
    
        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }
    
          reject(createError('Request aborted', config, 'ECONNABORTED', request));
    
          // Clean up request
          request = null;
        };
    
        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));
    
          // Clean up request
          request = null;
        };
    
        // Handle timeout
        request.ontimeout = function handleTimeout() {
          reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
            request));
    
          // Clean up request
          request = null;
        };
    
        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          var cookies = require('./../helpers/cookies');
    
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;
    
          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }
    
        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }
    
        // Add withCredentials to request if needed
        if (config.withCredentials) {
          request.withCredentials = true;
        }
    
        // Add responseType to request if needed
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
            // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
            if (config.responseType !== 'json') {
              throw e;
            }
          }
        }
    
        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }
    
        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }
    
        if (config.cancelToken) {
          // Handle cancellation
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }
    
            request.abort();
            reject(cancel);
            // Clean up request
            request = null;
          });
        }
    
        if (requestData === undefined) {
          requestData = null;
        }
    
        // Send the request
        request.send(requestData);
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/adapters/xhr.js","/../node_modules/axios/lib/adapters")
    },{"../core/createError":12,"./../core/settle":16,"./../helpers/buildURL":20,"./../helpers/cookies":22,"./../helpers/isURLSameOrigin":24,"./../helpers/parseHeaders":26,"./../utils":28,"buffer":30,"pBGvAp":35}],6:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./utils');
    var bind = require('./helpers/bind');
    var Axios = require('./core/Axios');
    var mergeConfig = require('./core/mergeConfig');
    var defaults = require('./defaults');
    
    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);
    
      // Copy axios.prototype to instance
      utils.extend(instance, Axios.prototype, context);
    
      // Copy context to instance
      utils.extend(instance, context);
    
      return instance;
    }
    
    // Create the default instance to be exported
    var axios = createInstance(defaults);
    
    // Expose Axios class to allow class inheritance
    axios.Axios = Axios;
    
    // Factory for creating new instances
    axios.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios.defaults, instanceConfig));
    };
    
    // Expose Cancel & CancelToken
    axios.Cancel = require('./cancel/Cancel');
    axios.CancelToken = require('./cancel/CancelToken');
    axios.isCancel = require('./cancel/isCancel');
    
    // Expose all/spread
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = require('./helpers/spread');
    
    module.exports = axios;
    
    // Allow use of default import syntax in TypeScript
    module.exports.default = axios;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/axios.js","/../node_modules/axios/lib")
    },{"./cancel/Cancel":7,"./cancel/CancelToken":8,"./cancel/isCancel":9,"./core/Axios":10,"./core/mergeConfig":15,"./defaults":18,"./helpers/bind":19,"./helpers/spread":27,"./utils":28,"buffer":30,"pBGvAp":35}],7:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }
    
    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };
    
    Cancel.prototype.__CANCEL__ = true;
    
    module.exports = Cancel;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/cancel/Cancel.js","/../node_modules/axios/lib/cancel")
    },{"buffer":30,"pBGvAp":35}],8:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var Cancel = require('./Cancel');
    
    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }
    
      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });
    
      var token = this;
      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }
    
        token.reason = new Cancel(message);
        resolvePromise(token.reason);
      });
    }
    
    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };
    
    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };
    
    module.exports = CancelToken;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/cancel/CancelToken.js","/../node_modules/axios/lib/cancel")
    },{"./Cancel":7,"buffer":30,"pBGvAp":35}],9:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    module.exports = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/cancel/isCancel.js","/../node_modules/axios/lib/cancel")
    },{"buffer":30,"pBGvAp":35}],10:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    var buildURL = require('../helpers/buildURL');
    var InterceptorManager = require('./InterceptorManager');
    var dispatchRequest = require('./dispatchRequest');
    var mergeConfig = require('./mergeConfig');
    
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }
    
    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof config === 'string') {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        config = config || {};
      }
    
      config = mergeConfig(this.defaults, config);
      config.method = config.method ? config.method.toLowerCase() : 'get';
    
      // Hook up interceptors middleware
      var chain = [dispatchRequest, undefined];
      var promise = Promise.resolve(config);
    
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected);
      });
    
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected);
      });
    
      while (chain.length) {
        promise = promise.then(chain.shift(), chain.shift());
      }
    
      return promise;
    };
    
    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };
    
    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url
        }));
      };
    });
    
    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, data, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });
    
    module.exports = Axios;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/Axios.js","/../node_modules/axios/lib/core")
    },{"../helpers/buildURL":20,"./../utils":28,"./InterceptorManager":11,"./dispatchRequest":13,"./mergeConfig":15,"buffer":30,"pBGvAp":35}],11:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    function InterceptorManager() {
      this.handlers = [];
    }
    
    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
      return this.handlers.length - 1;
    };
    
    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };
    
    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };
    
    module.exports = InterceptorManager;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/InterceptorManager.js","/../node_modules/axios/lib/core")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],12:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var enhanceError = require('./enhanceError');
    
    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    module.exports = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/createError.js","/../node_modules/axios/lib/core")
    },{"./enhanceError":14,"buffer":30,"pBGvAp":35}],13:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    var transformData = require('./transformData');
    var isCancel = require('../cancel/isCancel');
    var defaults = require('../defaults');
    var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
    var combineURLs = require('./../helpers/combineURLs');
    
    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }
    
    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    module.exports = function dispatchRequest(config) {
      throwIfCancellationRequested(config);
    
      // Support baseURL config
      if (config.baseURL && !isAbsoluteURL(config.url)) {
        config.url = combineURLs(config.baseURL, config.url);
      }
    
      // Ensure headers exist
      config.headers = config.headers || {};
    
      // Transform request data
      config.data = transformData(
        config.data,
        config.headers,
        config.transformRequest
      );
    
      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers || {}
      );
    
      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );
    
      var adapter = config.adapter || defaults.adapter;
    
      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);
    
        // Transform response data
        response.data = transformData(
          response.data,
          response.headers,
          config.transformResponse
        );
    
        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);
    
          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData(
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }
    
        return Promise.reject(reason);
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/dispatchRequest.js","/../node_modules/axios/lib/core")
    },{"../cancel/isCancel":9,"../defaults":18,"./../helpers/combineURLs":21,"./../helpers/isAbsoluteURL":23,"./../utils":28,"./transformData":17,"buffer":30,"pBGvAp":35}],14:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    module.exports = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }
    
      error.request = request;
      error.response = response;
      error.isAxiosError = true;
    
      error.toJSON = function() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code
        };
      };
      return error;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/enhanceError.js","/../node_modules/axios/lib/core")
    },{"buffer":30,"pBGvAp":35}],15:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('../utils');
    
    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    module.exports = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};
    
      utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        }
      });
    
      utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
        if (utils.isObject(config2[prop])) {
          config[prop] = utils.deepMerge(config1[prop], config2[prop]);
        } else if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        } else if (utils.isObject(config1[prop])) {
          config[prop] = utils.deepMerge(config1[prop]);
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });
    
      utils.forEach([
        'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
        'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
        'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
        'socketPath'
      ], function defaultToConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });
    
      return config;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/mergeConfig.js","/../node_modules/axios/lib/core")
    },{"../utils":28,"buffer":30,"pBGvAp":35}],16:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var createError = require('./createError');
    
    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    module.exports = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/settle.js","/../node_modules/axios/lib/core")
    },{"./createError":12,"buffer":30,"pBGvAp":35}],17:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    module.exports = function transformData(data, headers, fns) {
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });
    
      return data;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/transformData.js","/../node_modules/axios/lib/core")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],18:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./utils');
    var normalizeHeaderName = require('./helpers/normalizeHeaderName');
    
    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }
    
    function getDefaultAdapter() {
      var adapter;
      // Only Node.JS has a process variable that is of [[Class]] process
      if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = require('./adapters/http');
      } else if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = require('./adapters/xhr');
      }
      return adapter;
    }
    
    var defaults = {
      adapter: getDefaultAdapter(),
    
      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');
        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils.isObject(data)) {
          setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
          return JSON.stringify(data);
        }
        return data;
      }],
    
      transformResponse: [function transformResponse(data) {
        /*eslint no-param-reassign:0*/
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) { /* Ignore */ }
        }
        return data;
      }],
    
      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,
    
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
    
      maxContentLength: -1,
    
      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };
    
    defaults.headers = {
      common: {
        'Accept': 'application/json, text/plain, */*'
      }
    };
    
    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });
    
    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });
    
    module.exports = defaults;
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/defaults.js","/../node_modules/axios/lib")
    },{"./adapters/http":5,"./adapters/xhr":5,"./helpers/normalizeHeaderName":25,"./utils":28,"buffer":30,"pBGvAp":35}],19:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    module.exports = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/bind.js","/../node_modules/axios/lib/helpers")
    },{"buffer":30,"pBGvAp":35}],20:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    function encode(val) {
      return encodeURIComponent(val).
        replace(/%40/gi, '@').
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }
    
    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    module.exports = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }
    
      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];
    
        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }
    
          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }
    
          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });
    
        serializedParams = parts.join('&');
      }
    
      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }
    
        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }
    
      return url;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/buildURL.js","/../node_modules/axios/lib/helpers")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],21:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    module.exports = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/combineURLs.js","/../node_modules/axios/lib/helpers")
    },{"buffer":30,"pBGvAp":35}],22:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    module.exports = (
      utils.isStandardBrowserEnv() ?
    
      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));
    
              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }
    
              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }
    
              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }
    
              if (secure === true) {
                cookie.push('secure');
              }
    
              document.cookie = cookie.join('; ');
            },
    
            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },
    
            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :
    
      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/cookies.js","/../node_modules/axios/lib/helpers")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],23:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    module.exports = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/isAbsoluteURL.js","/../node_modules/axios/lib/helpers")
    },{"buffer":30,"pBGvAp":35}],24:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    module.exports = (
      utils.isStandardBrowserEnv() ?
    
      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;
    
          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;
    
            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }
    
            urlParsingNode.setAttribute('href', href);
    
            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }
    
          originURL = resolveURL(window.location.href);
    
          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :
    
      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/isURLSameOrigin.js","/../node_modules/axios/lib/helpers")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],25:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('../utils');
    
    module.exports = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/normalizeHeaderName.js","/../node_modules/axios/lib/helpers")
    },{"../utils":28,"buffer":30,"pBGvAp":35}],26:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var utils = require('./../utils');
    
    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];
    
    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    module.exports = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;
    
      if (!headers) { return parsed; }
    
      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));
    
        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });
    
      return parsed;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/parseHeaders.js","/../node_modules/axios/lib/helpers")
    },{"./../utils":28,"buffer":30,"pBGvAp":35}],27:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    module.exports = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/spread.js","/../node_modules/axios/lib/helpers")
    },{"buffer":30,"pBGvAp":35}],28:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var bind = require('./helpers/bind');
    var isBuffer = require('is-buffer');
    
    /*global toString:true*/
    
    // utils is a library of generic helper functions non-specific to axios
    
    var toString = Object.prototype.toString;
    
    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return toString.call(val) === '[object Array]';
    }
    
    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }
    
    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return (typeof FormData !== 'undefined') && (val instanceof FormData);
    }
    
    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
      }
      return result;
    }
    
    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }
    
    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }
    
    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }
    
    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }
    
    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }
    
    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }
    
    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }
    
    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }
    
    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }
    
    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
    }
    
    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }
    
    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }
    
    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }
    
      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }
    
      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }
    
    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          result[key] = merge(result[key], val);
        } else {
          result[key] = val;
        }
      }
    
      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }
    
    /**
     * Function equal to merge with the difference being that no reference
     * to original objects is kept.
     *
     * @see merge
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function deepMerge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          result[key] = deepMerge(result[key], val);
        } else if (typeof val === 'object') {
          result[key] = deepMerge({}, val);
        } else {
          result[key] = val;
        }
      }
    
      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }
    
    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }
    
    module.exports = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      deepMerge: deepMerge,
      extend: extend,
      trim: trim
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/utils.js","/../node_modules/axios/lib")
    },{"./helpers/bind":19,"buffer":30,"is-buffer":34,"pBGvAp":35}],29:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    ;(function (exports) {
        'use strict';
    
      var Arr = (typeof Uint8Array !== 'undefined')
        ? Uint8Array
        : Array
    
        var PLUS   = '+'.charCodeAt(0)
        var SLASH  = '/'.charCodeAt(0)
        var NUMBER = '0'.charCodeAt(0)
        var LOWER  = 'a'.charCodeAt(0)
        var UPPER  = 'A'.charCodeAt(0)
        var PLUS_URL_SAFE = '-'.charCodeAt(0)
        var SLASH_URL_SAFE = '_'.charCodeAt(0)
    
        function decode (elt) {
            var code = elt.charCodeAt(0)
            if (code === PLUS ||
                code === PLUS_URL_SAFE)
                return 62 // '+'
            if (code === SLASH ||
                code === SLASH_URL_SAFE)
                return 63 // '/'
            if (code < NUMBER)
                return -1 //no match
            if (code < NUMBER + 10)
                return code - NUMBER + 26 + 26
            if (code < UPPER + 26)
                return code - UPPER
            if (code < LOWER + 26)
                return code - LOWER + 26
        }
    
        function b64ToByteArray (b64) {
            var i, j, l, tmp, placeHolders, arr
    
            if (b64.length % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
            }
    
            // the number of equal signs (place holders)
            // if there are two placeholders, than the two characters before it
            // represent one byte
            // if there is only one, then the three characters before it represent 2 bytes
            // this is just a cheap hack to not do indexOf twice
            var len = b64.length
            placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0
    
            // base64 is 4/3 + up to two characters of the original data
            arr = new Arr(b64.length * 3 / 4 - placeHolders)
    
            // if there are placeholders, only get up to the last complete 4 chars
            l = placeHolders > 0 ? b64.length - 4 : b64.length
    
            var L = 0
    
            function push (v) {
                arr[L++] = v
            }
    
            for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
                push((tmp & 0xFF0000) >> 16)
                push((tmp & 0xFF00) >> 8)
                push(tmp & 0xFF)
            }
    
            if (placeHolders === 2) {
                tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
                push(tmp & 0xFF)
            } else if (placeHolders === 1) {
                tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
                push((tmp >> 8) & 0xFF)
                push(tmp & 0xFF)
            }
    
            return arr
        }
    
        function uint8ToBase64 (uint8) {
            var i,
                extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
                output = "",
                temp, length
    
            function encode (num) {
                return lookup.charAt(num)
            }
    
            function tripletToBase64 (num) {
                return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
            }
    
            // go through the array every three bytes, we'll deal with trailing stuff later
            for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
                temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
                output += tripletToBase64(temp)
            }
    
            // pad the end with zeros, but make sure to not forget the extra bytes
            switch (extraBytes) {
                case 1:
                    temp = uint8[uint8.length - 1]
                    output += encode(temp >> 2)
                    output += encode((temp << 4) & 0x3F)
                    output += '=='
                    break
                case 2:
                    temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
                    output += encode(temp >> 10)
                    output += encode((temp >> 4) & 0x3F)
                    output += encode((temp << 2) & 0x3F)
                    output += '='
                    break
            }
    
            return output
        }
    
        exports.toByteArray = b64ToByteArray
        exports.fromByteArray = uint8ToBase64
    }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/base64-js/lib/b64.js","/../node_modules/base64-js/lib")
    },{"buffer":30,"pBGvAp":35}],30:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    /*!
     * The buffer module from node.js, for the browser.
     *
     * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
     * @license  MIT
     */
    
    var base64 = require('base64-js')
    var ieee754 = require('ieee754')
    
    exports.Buffer = Buffer
    exports.SlowBuffer = Buffer
    exports.INSPECT_MAX_BYTES = 50
    Buffer.poolSize = 8192
    
    /**
     * If `Buffer._useTypedArrays`:
     *   === true    Use Uint8Array implementation (fastest)
     *   === false   Use Object implementation (compatible down to IE6)
     */
    Buffer._useTypedArrays = (function () {
      // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
      // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
      // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
      // because we need to be able to add all the node Buffer API methods. This is an issue
      // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
      try {
        var buf = new ArrayBuffer(0)
        var arr = new Uint8Array(buf)
        arr.foo = function () { return 42 }
        return 42 === arr.foo() &&
            typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
      } catch (e) {
        return false
      }
    })()
    
    /**
     * Class: Buffer
     * =============
     *
     * The Buffer constructor returns instances of `Uint8Array` that are augmented
     * with function properties for all the node `Buffer` API functions. We use
     * `Uint8Array` so that square bracket notation works as expected -- it returns
     * a single octet.
     *
     * By augmenting the instances, we can avoid modifying the `Uint8Array`
     * prototype.
     */
    function Buffer (subject, encoding, noZero) {
      if (!(this instanceof Buffer))
        return new Buffer(subject, encoding, noZero)
    
      var type = typeof subject
    
      // Workaround: node's base64 implementation allows for non-padded strings
      // while base64-js does not.
      if (encoding === 'base64' && type === 'string') {
        subject = stringtrim(subject)
        while (subject.length % 4 !== 0) {
          subject = subject + '='
        }
      }
    
      // Find the length
      var length
      if (type === 'number')
        length = coerce(subject)
      else if (type === 'string')
        length = Buffer.byteLength(subject, encoding)
      else if (type === 'object')
        length = coerce(subject.length) // assume that object is array-like
      else
        throw new Error('First argument needs to be a number, array or string.')
    
      var buf
      if (Buffer._useTypedArrays) {
        // Preferred: Return an augmented `Uint8Array` instance for best performance
        buf = Buffer._augment(new Uint8Array(length))
      } else {
        // Fallback: Return THIS instance of Buffer (created by `new`)
        buf = this
        buf.length = length
        buf._isBuffer = true
      }
    
      var i
      if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
        // Speed optimization -- use set if we're copying from a typed array
        buf._set(subject)
      } else if (isArrayish(subject)) {
        // Treat array-ish objects as a byte array
        for (i = 0; i < length; i++) {
          if (Buffer.isBuffer(subject))
            buf[i] = subject.readUInt8(i)
          else
            buf[i] = subject[i]
        }
      } else if (type === 'string') {
        buf.write(subject, 0, encoding)
      } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
        for (i = 0; i < length; i++) {
          buf[i] = 0
        }
      }
    
      return buf
    }
    
    // STATIC METHODS
    // ==============
    
    Buffer.isEncoding = function (encoding) {
      switch (String(encoding).toLowerCase()) {
        case 'hex':
        case 'utf8':
        case 'utf-8':
        case 'ascii':
        case 'binary':
        case 'base64':
        case 'raw':
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return true
        default:
          return false
      }
    }
    
    Buffer.isBuffer = function (b) {
      return !!(b !== null && b !== undefined && b._isBuffer)
    }
    
    Buffer.byteLength = function (str, encoding) {
      var ret
      str = str + ''
      switch (encoding || 'utf8') {
        case 'hex':
          ret = str.length / 2
          break
        case 'utf8':
        case 'utf-8':
          ret = utf8ToBytes(str).length
          break
        case 'ascii':
        case 'binary':
        case 'raw':
          ret = str.length
          break
        case 'base64':
          ret = base64ToBytes(str).length
          break
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          ret = str.length * 2
          break
        default:
          throw new Error('Unknown encoding')
      }
      return ret
    }
    
    Buffer.concat = function (list, totalLength) {
      assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
          'list should be an Array.')
    
      if (list.length === 0) {
        return new Buffer(0)
      } else if (list.length === 1) {
        return list[0]
      }
    
      var i
      if (typeof totalLength !== 'number') {
        totalLength = 0
        for (i = 0; i < list.length; i++) {
          totalLength += list[i].length
        }
      }
    
      var buf = new Buffer(totalLength)
      var pos = 0
      for (i = 0; i < list.length; i++) {
        var item = list[i]
        item.copy(buf, pos)
        pos += item.length
      }
      return buf
    }
    
    // BUFFER INSTANCE METHODS
    // =======================
    
    function _hexWrite (buf, string, offset, length) {
      offset = Number(offset) || 0
      var remaining = buf.length - offset
      if (!length) {
        length = remaining
      } else {
        length = Number(length)
        if (length > remaining) {
          length = remaining
        }
      }
    
      // must be an even number of digits
      var strLen = string.length
      assert(strLen % 2 === 0, 'Invalid hex string')
    
      if (length > strLen / 2) {
        length = strLen / 2
      }
      for (var i = 0; i < length; i++) {
        var byte = parseInt(string.substr(i * 2, 2), 16)
        assert(!isNaN(byte), 'Invalid hex string')
        buf[offset + i] = byte
      }
      Buffer._charsWritten = i * 2
      return i
    }
    
    function _utf8Write (buf, string, offset, length) {
      var charsWritten = Buffer._charsWritten =
        blitBuffer(utf8ToBytes(string), buf, offset, length)
      return charsWritten
    }
    
    function _asciiWrite (buf, string, offset, length) {
      var charsWritten = Buffer._charsWritten =
        blitBuffer(asciiToBytes(string), buf, offset, length)
      return charsWritten
    }
    
    function _binaryWrite (buf, string, offset, length) {
      return _asciiWrite(buf, string, offset, length)
    }
    
    function _base64Write (buf, string, offset, length) {
      var charsWritten = Buffer._charsWritten =
        blitBuffer(base64ToBytes(string), buf, offset, length)
      return charsWritten
    }
    
    function _utf16leWrite (buf, string, offset, length) {
      var charsWritten = Buffer._charsWritten =
        blitBuffer(utf16leToBytes(string), buf, offset, length)
      return charsWritten
    }
    
    Buffer.prototype.write = function (string, offset, length, encoding) {
      // Support both (string, offset, length, encoding)
      // and the legacy (string, encoding, offset, length)
      if (isFinite(offset)) {
        if (!isFinite(length)) {
          encoding = length
          length = undefined
        }
      } else {  // legacy
        var swap = encoding
        encoding = offset
        offset = length
        length = swap
      }
    
      offset = Number(offset) || 0
      var remaining = this.length - offset
      if (!length) {
        length = remaining
      } else {
        length = Number(length)
        if (length > remaining) {
          length = remaining
        }
      }
      encoding = String(encoding || 'utf8').toLowerCase()
    
      var ret
      switch (encoding) {
        case 'hex':
          ret = _hexWrite(this, string, offset, length)
          break
        case 'utf8':
        case 'utf-8':
          ret = _utf8Write(this, string, offset, length)
          break
        case 'ascii':
          ret = _asciiWrite(this, string, offset, length)
          break
        case 'binary':
          ret = _binaryWrite(this, string, offset, length)
          break
        case 'base64':
          ret = _base64Write(this, string, offset, length)
          break
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          ret = _utf16leWrite(this, string, offset, length)
          break
        default:
          throw new Error('Unknown encoding')
      }
      return ret
    }
    
    Buffer.prototype.toString = function (encoding, start, end) {
      var self = this
    
      encoding = String(encoding || 'utf8').toLowerCase()
      start = Number(start) || 0
      end = (end !== undefined)
        ? Number(end)
        : end = self.length
    
      // Fastpath empty strings
      if (end === start)
        return ''
    
      var ret
      switch (encoding) {
        case 'hex':
          ret = _hexSlice(self, start, end)
          break
        case 'utf8':
        case 'utf-8':
          ret = _utf8Slice(self, start, end)
          break
        case 'ascii':
          ret = _asciiSlice(self, start, end)
          break
        case 'binary':
          ret = _binarySlice(self, start, end)
          break
        case 'base64':
          ret = _base64Slice(self, start, end)
          break
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          ret = _utf16leSlice(self, start, end)
          break
        default:
          throw new Error('Unknown encoding')
      }
      return ret
    }
    
    Buffer.prototype.toJSON = function () {
      return {
        type: 'Buffer',
        data: Array.prototype.slice.call(this._arr || this, 0)
      }
    }
    
    // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
    Buffer.prototype.copy = function (target, target_start, start, end) {
      var source = this
    
      if (!start) start = 0
      if (!end && end !== 0) end = this.length
      if (!target_start) target_start = 0
    
      // Copy 0 bytes; we're done
      if (end === start) return
      if (target.length === 0 || source.length === 0) return
    
      // Fatal error conditions
      assert(end >= start, 'sourceEnd < sourceStart')
      assert(target_start >= 0 && target_start < target.length,
          'targetStart out of bounds')
      assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
      assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')
    
      // Are we oob?
      if (end > this.length)
        end = this.length
      if (target.length - target_start < end - start)
        end = target.length - target_start + start
    
      var len = end - start
    
      if (len < 100 || !Buffer._useTypedArrays) {
        for (var i = 0; i < len; i++)
          target[i + target_start] = this[i + start]
      } else {
        target._set(this.subarray(start, start + len), target_start)
      }
    }
    
    function _base64Slice (buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf)
      } else {
        return base64.fromByteArray(buf.slice(start, end))
      }
    }
    
    function _utf8Slice (buf, start, end) {
      var res = ''
      var tmp = ''
      end = Math.min(buf.length, end)
    
      for (var i = start; i < end; i++) {
        if (buf[i] <= 0x7F) {
          res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
          tmp = ''
        } else {
          tmp += '%' + buf[i].toString(16)
        }
      }
    
      return res + decodeUtf8Char(tmp)
    }
    
    function _asciiSlice (buf, start, end) {
      var ret = ''
      end = Math.min(buf.length, end)
    
      for (var i = start; i < end; i++)
        ret += String.fromCharCode(buf[i])
      return ret
    }
    
    function _binarySlice (buf, start, end) {
      return _asciiSlice(buf, start, end)
    }
    
    function _hexSlice (buf, start, end) {
      var len = buf.length
    
      if (!start || start < 0) start = 0
      if (!end || end < 0 || end > len) end = len
    
      var out = ''
      for (var i = start; i < end; i++) {
        out += toHex(buf[i])
      }
      return out
    }
    
    function _utf16leSlice (buf, start, end) {
      var bytes = buf.slice(start, end)
      var res = ''
      for (var i = 0; i < bytes.length; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
      }
      return res
    }
    
    Buffer.prototype.slice = function (start, end) {
      var len = this.length
      start = clamp(start, len, 0)
      end = clamp(end, len, len)
    
      if (Buffer._useTypedArrays) {
        return Buffer._augment(this.subarray(start, end))
      } else {
        var sliceLen = end - start
        var newBuf = new Buffer(sliceLen, undefined, true)
        for (var i = 0; i < sliceLen; i++) {
          newBuf[i] = this[i + start]
        }
        return newBuf
      }
    }
    
    // `get` will be removed in Node 0.13+
    Buffer.prototype.get = function (offset) {
      console.log('.get() is deprecated. Access using array indexes instead.')
      return this.readUInt8(offset)
    }
    
    // `set` will be removed in Node 0.13+
    Buffer.prototype.set = function (v, offset) {
      console.log('.set() is deprecated. Access using array indexes instead.')
      return this.writeUInt8(v, offset)
    }
    
    Buffer.prototype.readUInt8 = function (offset, noAssert) {
      if (!noAssert) {
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset < this.length, 'Trying to read beyond buffer length')
      }
    
      if (offset >= this.length)
        return
    
      return this[offset]
    }
    
    function _readUInt16 (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      var val
      if (littleEndian) {
        val = buf[offset]
        if (offset + 1 < len)
          val |= buf[offset + 1] << 8
      } else {
        val = buf[offset] << 8
        if (offset + 1 < len)
          val |= buf[offset + 1]
      }
      return val
    }
    
    Buffer.prototype.readUInt16LE = function (offset, noAssert) {
      return _readUInt16(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readUInt16BE = function (offset, noAssert) {
      return _readUInt16(this, offset, false, noAssert)
    }
    
    function _readUInt32 (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      var val
      if (littleEndian) {
        if (offset + 2 < len)
          val = buf[offset + 2] << 16
        if (offset + 1 < len)
          val |= buf[offset + 1] << 8
        val |= buf[offset]
        if (offset + 3 < len)
          val = val + (buf[offset + 3] << 24 >>> 0)
      } else {
        if (offset + 1 < len)
          val = buf[offset + 1] << 16
        if (offset + 2 < len)
          val |= buf[offset + 2] << 8
        if (offset + 3 < len)
          val |= buf[offset + 3]
        val = val + (buf[offset] << 24 >>> 0)
      }
      return val
    }
    
    Buffer.prototype.readUInt32LE = function (offset, noAssert) {
      return _readUInt32(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readUInt32BE = function (offset, noAssert) {
      return _readUInt32(this, offset, false, noAssert)
    }
    
    Buffer.prototype.readInt8 = function (offset, noAssert) {
      if (!noAssert) {
        assert(offset !== undefined && offset !== null,
            'missing offset')
        assert(offset < this.length, 'Trying to read beyond buffer length')
      }
    
      if (offset >= this.length)
        return
    
      var neg = this[offset] & 0x80
      if (neg)
        return (0xff - this[offset] + 1) * -1
      else
        return this[offset]
    }
    
    function _readInt16 (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      var val = _readUInt16(buf, offset, littleEndian, true)
      var neg = val & 0x8000
      if (neg)
        return (0xffff - val + 1) * -1
      else
        return val
    }
    
    Buffer.prototype.readInt16LE = function (offset, noAssert) {
      return _readInt16(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readInt16BE = function (offset, noAssert) {
      return _readInt16(this, offset, false, noAssert)
    }
    
    function _readInt32 (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      var val = _readUInt32(buf, offset, littleEndian, true)
      var neg = val & 0x80000000
      if (neg)
        return (0xffffffff - val + 1) * -1
      else
        return val
    }
    
    Buffer.prototype.readInt32LE = function (offset, noAssert) {
      return _readInt32(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readInt32BE = function (offset, noAssert) {
      return _readInt32(this, offset, false, noAssert)
    }
    
    function _readFloat (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
      }
    
      return ieee754.read(buf, offset, littleEndian, 23, 4)
    }
    
    Buffer.prototype.readFloatLE = function (offset, noAssert) {
      return _readFloat(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readFloatBE = function (offset, noAssert) {
      return _readFloat(this, offset, false, noAssert)
    }
    
    function _readDouble (buf, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
      }
    
      return ieee754.read(buf, offset, littleEndian, 52, 8)
    }
    
    Buffer.prototype.readDoubleLE = function (offset, noAssert) {
      return _readDouble(this, offset, true, noAssert)
    }
    
    Buffer.prototype.readDoubleBE = function (offset, noAssert) {
      return _readDouble(this, offset, false, noAssert)
    }
    
    Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset < this.length, 'trying to write beyond buffer length')
        verifuint(value, 0xff)
      }
    
      if (offset >= this.length) return
    
      this[offset] = value
    }
    
    function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
        verifuint(value, 0xffff)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
        buf[offset + i] =
            (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                (littleEndian ? i : 1 - i) * 8
      }
    }
    
    Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
      _writeUInt16(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
      _writeUInt16(this, value, offset, false, noAssert)
    }
    
    function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
        verifuint(value, 0xffffffff)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
        buf[offset + i] =
            (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
      }
    }
    
    Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
      _writeUInt32(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
      _writeUInt32(this, value, offset, false, noAssert)
    }
    
    Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset < this.length, 'Trying to write beyond buffer length')
        verifsint(value, 0x7f, -0x80)
      }
    
      if (offset >= this.length)
        return
    
      if (value >= 0)
        this.writeUInt8(value, offset, noAssert)
      else
        this.writeUInt8(0xff + value + 1, offset, noAssert)
    }
    
    function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
        verifsint(value, 0x7fff, -0x8000)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      if (value >= 0)
        _writeUInt16(buf, value, offset, littleEndian, noAssert)
      else
        _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
    }
    
    Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
      _writeInt16(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
      _writeInt16(this, value, offset, false, noAssert)
    }
    
    function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
        verifsint(value, 0x7fffffff, -0x80000000)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      if (value >= 0)
        _writeUInt32(buf, value, offset, littleEndian, noAssert)
      else
        _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
    }
    
    Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
      _writeInt32(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
      _writeInt32(this, value, offset, false, noAssert)
    }
    
    function _writeFloat (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
        verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      ieee754.write(buf, value, offset, littleEndian, 23, 4)
    }
    
    Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
      _writeFloat(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
      _writeFloat(this, value, offset, false, noAssert)
    }
    
    function _writeDouble (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        assert(value !== undefined && value !== null, 'missing value')
        assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
        assert(offset !== undefined && offset !== null, 'missing offset')
        assert(offset + 7 < buf.length,
            'Trying to write beyond buffer length')
        verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
      }
    
      var len = buf.length
      if (offset >= len)
        return
    
      ieee754.write(buf, value, offset, littleEndian, 52, 8)
    }
    
    Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
      _writeDouble(this, value, offset, true, noAssert)
    }
    
    Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
      _writeDouble(this, value, offset, false, noAssert)
    }
    
    // fill(value, start=0, end=buffer.length)
    Buffer.prototype.fill = function (value, start, end) {
      if (!value) value = 0
      if (!start) start = 0
      if (!end) end = this.length
    
      if (typeof value === 'string') {
        value = value.charCodeAt(0)
      }
    
      assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
      assert(end >= start, 'end < start')
    
      // Fill 0 bytes; we're done
      if (end === start) return
      if (this.length === 0) return
    
      assert(start >= 0 && start < this.length, 'start out of bounds')
      assert(end >= 0 && end <= this.length, 'end out of bounds')
    
      for (var i = start; i < end; i++) {
        this[i] = value
      }
    }
    
    Buffer.prototype.inspect = function () {
      var out = []
      var len = this.length
      for (var i = 0; i < len; i++) {
        out[i] = toHex(this[i])
        if (i === exports.INSPECT_MAX_BYTES) {
          out[i + 1] = '...'
          break
        }
      }
      return '<Buffer ' + out.join(' ') + '>'
    }
    
    /**
     * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
     * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
     */
    Buffer.prototype.toArrayBuffer = function () {
      if (typeof Uint8Array !== 'undefined') {
        if (Buffer._useTypedArrays) {
          return (new Buffer(this)).buffer
        } else {
          var buf = new Uint8Array(this.length)
          for (var i = 0, len = buf.length; i < len; i += 1)
            buf[i] = this[i]
          return buf.buffer
        }
      } else {
        throw new Error('Buffer.toArrayBuffer not supported in this browser')
      }
    }
    
    // HELPER FUNCTIONS
    // ================
    
    function stringtrim (str) {
      if (str.trim) return str.trim()
      return str.replace(/^\s+|\s+$/g, '')
    }
    
    var BP = Buffer.prototype
    
    /**
     * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
     */
    Buffer._augment = function (arr) {
      arr._isBuffer = true
    
      // save reference to original Uint8Array get/set methods before overwriting
      arr._get = arr.get
      arr._set = arr.set
    
      // deprecated, will be removed in node 0.13+
      arr.get = BP.get
      arr.set = BP.set
    
      arr.write = BP.write
      arr.toString = BP.toString
      arr.toLocaleString = BP.toString
      arr.toJSON = BP.toJSON
      arr.copy = BP.copy
      arr.slice = BP.slice
      arr.readUInt8 = BP.readUInt8
      arr.readUInt16LE = BP.readUInt16LE
      arr.readUInt16BE = BP.readUInt16BE
      arr.readUInt32LE = BP.readUInt32LE
      arr.readUInt32BE = BP.readUInt32BE
      arr.readInt8 = BP.readInt8
      arr.readInt16LE = BP.readInt16LE
      arr.readInt16BE = BP.readInt16BE
      arr.readInt32LE = BP.readInt32LE
      arr.readInt32BE = BP.readInt32BE
      arr.readFloatLE = BP.readFloatLE
      arr.readFloatBE = BP.readFloatBE
      arr.readDoubleLE = BP.readDoubleLE
      arr.readDoubleBE = BP.readDoubleBE
      arr.writeUInt8 = BP.writeUInt8
      arr.writeUInt16LE = BP.writeUInt16LE
      arr.writeUInt16BE = BP.writeUInt16BE
      arr.writeUInt32LE = BP.writeUInt32LE
      arr.writeUInt32BE = BP.writeUInt32BE
      arr.writeInt8 = BP.writeInt8
      arr.writeInt16LE = BP.writeInt16LE
      arr.writeInt16BE = BP.writeInt16BE
      arr.writeInt32LE = BP.writeInt32LE
      arr.writeInt32BE = BP.writeInt32BE
      arr.writeFloatLE = BP.writeFloatLE
      arr.writeFloatBE = BP.writeFloatBE
      arr.writeDoubleLE = BP.writeDoubleLE
      arr.writeDoubleBE = BP.writeDoubleBE
      arr.fill = BP.fill
      arr.inspect = BP.inspect
      arr.toArrayBuffer = BP.toArrayBuffer
    
      return arr
    }
    
    // slice(start, end)
    function clamp (index, len, defaultValue) {
      if (typeof index !== 'number') return defaultValue
      index = ~~index;  // Coerce to integer.
      if (index >= len) return len
      if (index >= 0) return index
      index += len
      if (index >= 0) return index
      return 0
    }
    
    function coerce (length) {
      // Coerce length to a number (possibly NaN), round up
      // in case it's fractional (e.g. 123.456) then do a
      // double negate to coerce a NaN to 0. Easy, right?
      length = ~~Math.ceil(+length)
      return length < 0 ? 0 : length
    }
    
    function isArray (subject) {
      return (Array.isArray || function (subject) {
        return Object.prototype.toString.call(subject) === '[object Array]'
      })(subject)
    }
    
    function isArrayish (subject) {
      return isArray(subject) || Buffer.isBuffer(subject) ||
          subject && typeof subject === 'object' &&
          typeof subject.length === 'number'
    }
    
    function toHex (n) {
      if (n < 16) return '0' + n.toString(16)
      return n.toString(16)
    }
    
    function utf8ToBytes (str) {
      var byteArray = []
      for (var i = 0; i < str.length; i++) {
        var b = str.charCodeAt(i)
        if (b <= 0x7F)
          byteArray.push(str.charCodeAt(i))
        else {
          var start = i
          if (b >= 0xD800 && b <= 0xDFFF) i++
          var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
          for (var j = 0; j < h.length; j++)
            byteArray.push(parseInt(h[j], 16))
        }
      }
      return byteArray
    }
    
    function asciiToBytes (str) {
      var byteArray = []
      for (var i = 0; i < str.length; i++) {
        // Node's code seems to be doing this and not & 0x7F..
        byteArray.push(str.charCodeAt(i) & 0xFF)
      }
      return byteArray
    }
    
    function utf16leToBytes (str) {
      var c, hi, lo
      var byteArray = []
      for (var i = 0; i < str.length; i++) {
        c = str.charCodeAt(i)
        hi = c >> 8
        lo = c % 256
        byteArray.push(lo)
        byteArray.push(hi)
      }
    
      return byteArray
    }
    
    function base64ToBytes (str) {
      return base64.toByteArray(str)
    }
    
    function blitBuffer (src, dst, offset, length) {
      var pos
      for (var i = 0; i < length; i++) {
        if ((i + offset >= dst.length) || (i >= src.length))
          break
        dst[i + offset] = src[i]
      }
      return i
    }
    
    function decodeUtf8Char (str) {
      try {
        return decodeURIComponent(str)
      } catch (err) {
        return String.fromCharCode(0xFFFD) // UTF 8 invalid char
      }
    }
    
    /*
     * We have to make sure that the value is a valid integer. This means that it
     * is non-negative. It has no fractional component and that it does not
     * exceed the maximum allowed value.
     */
    function verifuint (value, max) {
      assert(typeof value === 'number', 'cannot write a non-number as a number')
      assert(value >= 0, 'specified a negative value for writing an unsigned value')
      assert(value <= max, 'value is larger than maximum value for type')
      assert(Math.floor(value) === value, 'value has a fractional component')
    }
    
    function verifsint (value, max, min) {
      assert(typeof value === 'number', 'cannot write a non-number as a number')
      assert(value <= max, 'value larger than maximum allowed value')
      assert(value >= min, 'value smaller than minimum allowed value')
      assert(Math.floor(value) === value, 'value has a fractional component')
    }
    
    function verifIEEE754 (value, max, min) {
      assert(typeof value === 'number', 'cannot write a non-number as a number')
      assert(value <= max, 'value larger than maximum allowed value')
      assert(value >= min, 'value smaller than minimum allowed value')
    }
    
    function assert (test, message) {
      if (!test) throw new Error(message || 'Failed assertion')
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/buffer/index.js","/../node_modules/buffer")
    },{"base64-js":29,"buffer":30,"ieee754":33,"pBGvAp":35}],31:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    // This file should be ES5 compatible
    /* eslint prefer-spread:0, no-var:0, prefer-reflect:0, no-magic-numbers:0 */
    'use strict'
    module.exports = (function () {
        // Import Events
        var events = require('events')
    
        // Export Domain
        var domain = {}
        domain.createDomain = domain.create = function () {
            var d = new events.EventEmitter()
    
            function emitError (e) {
                d.emit('error', e)
            }
    
            d.add = function (emitter) {
                emitter.on('error', emitError)
            }
            d.remove = function (emitter) {
                emitter.removeListener('error', emitError)
            }
            d.bind = function (fn) {
                return function () {
                    var args = Array.prototype.slice.call(arguments)
                    try {
                        fn.apply(null, args)
                    }
                    catch (err) {
                        emitError(err)
                    }
                }
            }
            d.intercept = function (fn) {
                return function (err) {
                    if ( err ) {
                        emitError(err)
                    }
                    else {
                        var args = Array.prototype.slice.call(arguments, 1)
                        try {
                            fn.apply(null, args)
                        }
                        catch (err) {
                            emitError(err)
                        }
                    }
                }
            }
            d.run = function (fn) {
                try {
                    fn()
                }
                catch (err) {
                    emitError(err)
                }
                return this
            }
            d.dispose = function () {
                this.removeAllListeners()
                return this
            }
            d.enter = d.exit = function () {
                return this
            }
            return d
        }
        return domain
    }).call(this)
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/domain-browser/index.js","/../node_modules/domain-browser")
    },{"buffer":30,"events":32,"pBGvAp":35}],32:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    
    function EventEmitter() {
      this._events = this._events || {};
      this._maxListeners = this._maxListeners || undefined;
    }
    module.exports = EventEmitter;
    
    // Backwards-compat with node 0.10.x
    EventEmitter.EventEmitter = EventEmitter;
    
    EventEmitter.prototype._events = undefined;
    EventEmitter.prototype._maxListeners = undefined;
    
    // By default EventEmitters will print a warning if more than 10 listeners are
    // added to it. This is a useful default which helps finding memory leaks.
    EventEmitter.defaultMaxListeners = 10;
    
    // Obviously not all Emitters should be limited to 10. This function allows
    // that to be increased. Set to zero for unlimited.
    EventEmitter.prototype.setMaxListeners = function(n) {
      if (!isNumber(n) || n < 0 || isNaN(n))
        throw TypeError('n must be a positive number');
      this._maxListeners = n;
      return this;
    };
    
    EventEmitter.prototype.emit = function(type) {
      var er, handler, len, args, i, listeners;
    
      if (!this._events)
        this._events = {};
    
      // If there is no 'error' event listener then throw.
      if (type === 'error') {
        if (!this._events.error ||
            (isObject(this._events.error) && !this._events.error.length)) {
          er = arguments[1];
          if (er instanceof Error) {
            throw er; // Unhandled 'error' event
          }
          throw TypeError('Uncaught, unspecified "error" event.');
        }
      }
    
      handler = this._events[type];
    
      if (isUndefined(handler))
        return false;
    
      if (isFunction(handler)) {
        switch (arguments.length) {
          // fast cases
          case 1:
            handler.call(this);
            break;
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            len = arguments.length;
            args = new Array(len - 1);
            for (i = 1; i < len; i++)
              args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      } else if (isObject(handler)) {
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
    
        listeners = handler.slice();
        len = listeners.length;
        for (i = 0; i < len; i++)
          listeners[i].apply(this, args);
      }
    
      return true;
    };
    
    EventEmitter.prototype.addListener = function(type, listener) {
      var m;
    
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      if (!this._events)
        this._events = {};
    
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (this._events.newListener)
        this.emit('newListener', type,
                  isFunction(listener.listener) ?
                  listener.listener : listener);
    
      if (!this._events[type])
        // Optimize the case of one listener. Don't need the extra array object.
        this._events[type] = listener;
      else if (isObject(this._events[type]))
        // If we've already got an array, just append.
        this._events[type].push(listener);
      else
        // Adding the second element, need to change to array.
        this._events[type] = [this._events[type], listener];
    
      // Check for listener leak
      if (isObject(this._events[type]) && !this._events[type].warned) {
        var m;
        if (!isUndefined(this._maxListeners)) {
          m = this._maxListeners;
        } else {
          m = EventEmitter.defaultMaxListeners;
        }
    
        if (m && m > 0 && this._events[type].length > m) {
          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          if (typeof console.trace === 'function') {
            // not supported in IE 10
            console.trace();
          }
        }
      }
    
      return this;
    };
    
    EventEmitter.prototype.on = EventEmitter.prototype.addListener;
    
    EventEmitter.prototype.once = function(type, listener) {
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      var fired = false;
    
      function g() {
        this.removeListener(type, g);
    
        if (!fired) {
          fired = true;
          listener.apply(this, arguments);
        }
      }
    
      g.listener = listener;
      this.on(type, g);
    
      return this;
    };
    
    // emits a 'removeListener' event iff the listener was removed
    EventEmitter.prototype.removeListener = function(type, listener) {
      var list, position, length, i;
    
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      if (!this._events || !this._events[type])
        return this;
    
      list = this._events[type];
      length = list.length;
      position = -1;
    
      if (list === listener ||
          (isFunction(list.listener) && list.listener === listener)) {
        delete this._events[type];
        if (this._events.removeListener)
          this.emit('removeListener', type, listener);
    
      } else if (isObject(list)) {
        for (i = length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            position = i;
            break;
          }
        }
    
        if (position < 0)
          return this;
    
        if (list.length === 1) {
          list.length = 0;
          delete this._events[type];
        } else {
          list.splice(position, 1);
        }
    
        if (this._events.removeListener)
          this.emit('removeListener', type, listener);
      }
    
      return this;
    };
    
    EventEmitter.prototype.removeAllListeners = function(type) {
      var key, listeners;
    
      if (!this._events)
        return this;
    
      // not listening for removeListener, no need to emit
      if (!this._events.removeListener) {
        if (arguments.length === 0)
          this._events = {};
        else if (this._events[type])
          delete this._events[type];
        return this;
      }
    
      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        for (key in this._events) {
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = {};
        return this;
      }
    
      listeners = this._events[type];
    
      if (isFunction(listeners)) {
        this.removeListener(type, listeners);
      } else {
        // LIFO order
        while (listeners.length)
          this.removeListener(type, listeners[listeners.length - 1]);
      }
      delete this._events[type];
    
      return this;
    };
    
    EventEmitter.prototype.listeners = function(type) {
      var ret;
      if (!this._events || !this._events[type])
        ret = [];
      else if (isFunction(this._events[type]))
        ret = [this._events[type]];
      else
        ret = this._events[type].slice();
      return ret;
    };
    
    EventEmitter.listenerCount = function(emitter, type) {
      var ret;
      if (!emitter._events || !emitter._events[type])
        ret = 0;
      else if (isFunction(emitter._events[type]))
        ret = 1;
      else
        ret = emitter._events[type].length;
      return ret;
    };
    
    function isFunction(arg) {
      return typeof arg === 'function';
    }
    
    function isNumber(arg) {
      return typeof arg === 'number';
    }
    
    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }
    
    function isUndefined(arg) {
      return arg === void 0;
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/events/events.js","/../node_modules/events")
    },{"buffer":30,"pBGvAp":35}],33:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    exports.read = function (buffer, offset, isLE, mLen, nBytes) {
      var e, m
      var eLen = (nBytes * 8) - mLen - 1
      var eMax = (1 << eLen) - 1
      var eBias = eMax >> 1
      var nBits = -7
      var i = isLE ? (nBytes - 1) : 0
      var d = isLE ? -1 : 1
      var s = buffer[offset + i]
    
      i += d
    
      e = s & ((1 << (-nBits)) - 1)
      s >>= (-nBits)
      nBits += eLen
      for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}
    
      m = e & ((1 << (-nBits)) - 1)
      e >>= (-nBits)
      nBits += mLen
      for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}
    
      if (e === 0) {
        e = 1 - eBias
      } else if (e === eMax) {
        return m ? NaN : ((s ? -1 : 1) * Infinity)
      } else {
        m = m + Math.pow(2, mLen)
        e = e - eBias
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
    }
    
    exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c
      var eLen = (nBytes * 8) - mLen - 1
      var eMax = (1 << eLen) - 1
      var eBias = eMax >> 1
      var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
      var i = isLE ? 0 : (nBytes - 1)
      var d = isLE ? 1 : -1
      var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0
    
      value = Math.abs(value)
    
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0
        e = eMax
      } else {
        e = Math.floor(Math.log(value) / Math.LN2)
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--
          c *= 2
        }
        if (e + eBias >= 1) {
          value += rt / c
        } else {
          value += rt * Math.pow(2, 1 - eBias)
        }
        if (value * c >= 2) {
          e++
          c /= 2
        }
    
        if (e + eBias >= eMax) {
          m = 0
          e = eMax
        } else if (e + eBias >= 1) {
          m = ((value * c) - 1) * Math.pow(2, mLen)
          e = e + eBias
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
          e = 0
        }
      }
    
      for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}
    
      e = (e << mLen) | m
      eLen += mLen
      for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}
    
      buffer[offset + i - d] |= s * 128
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/ieee754/index.js","/../node_modules/ieee754")
    },{"buffer":30,"pBGvAp":35}],34:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    /*!
     * Determine if an object is a Buffer
     *
     * @author   Feross Aboukhadijeh <https://feross.org>
     * @license  MIT
     */
    
    module.exports = function isBuffer (obj) {
      return obj != null && obj.constructor != null &&
        typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/is-buffer/index.js","/../node_modules/is-buffer")
    },{"buffer":30,"pBGvAp":35}],35:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    // shim for using process in browser
    
    var process = module.exports = {};
    
    process.nextTick = (function () {
        var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
        var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
        ;
    
        if (canSetImmediate) {
            return function (f) { return window.setImmediate(f) };
        }
    
        if (canPost) {
            var queue = [];
            window.addEventListener('message', function (ev) {
                var source = ev.source;
                if ((source === window || source === null) && ev.data === 'process-tick') {
                    ev.stopPropagation();
                    if (queue.length > 0) {
                        var fn = queue.shift();
                        fn();
                    }
                }
            }, true);
    
            return function nextTick(fn) {
                queue.push(fn);
                window.postMessage('process-tick', '*');
            };
        }
    
        return function nextTick(fn) {
            setTimeout(fn, 0);
        };
    })();
    
    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];
    
    function noop() {}
    
    process.on = noop;
    process.addListener = noop;
    process.once = noop;
    process.off = noop;
    process.removeListener = noop;
    process.removeAllListeners = noop;
    process.emit = noop;
    
    process.binding = function (name) {
        throw new Error('process.binding is not supported');
    }
    
    // TODO(shtylman)
    process.cwd = function () { return '/' };
    process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/process/browser.js","/../node_modules/process")
    },{"buffer":30,"pBGvAp":35}],36:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    module.exports = require('./lib')
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/index.js","/../node_modules/promise")
    },{"./lib":41,"buffer":30,"pBGvAp":35}],37:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var asap = require('asap/raw');
    
    function noop() {}
    
    // States:
    //
    // 0 - pending
    // 1 - fulfilled with _value
    // 2 - rejected with _value
    // 3 - adopted the state of another promise, _value
    //
    // once the state is no longer pending (0) it is immutable
    
    // All `_` prefixed properties will be reduced to `_{random number}`
    // at build time to obfuscate them and discourage their use.
    // We don't use symbols or Object.defineProperty to fully hide them
    // because the performance isn't good enough.
    
    
    // to avoid using try/catch inside critical functions, we
    // extract them to here.
    var LAST_ERROR = null;
    var IS_ERROR = {};
    function getThen(obj) {
      try {
        return obj.then;
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    
    function tryCallOne(fn, a) {
      try {
        return fn(a);
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    function tryCallTwo(fn, a, b) {
      try {
        fn(a, b);
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    
    module.exports = Promise;
    
    function Promise(fn) {
      if (typeof this !== 'object') {
        throw new TypeError('Promises must be constructed via new');
      }
      if (typeof fn !== 'function') {
        throw new TypeError('Promise constructor\'s argument is not a function');
      }
      this._40 = 0;
      this._65 = 0;
      this._55 = null;
      this._72 = null;
      if (fn === noop) return;
      doResolve(fn, this);
    }
    Promise._37 = null;
    Promise._87 = null;
    Promise._61 = noop;
    
    Promise.prototype.then = function(onFulfilled, onRejected) {
      if (this.constructor !== Promise) {
        return safeThen(this, onFulfilled, onRejected);
      }
      var res = new Promise(noop);
      handle(this, new Handler(onFulfilled, onRejected, res));
      return res;
    };
    
    function safeThen(self, onFulfilled, onRejected) {
      return new self.constructor(function (resolve, reject) {
        var res = new Promise(noop);
        res.then(resolve, reject);
        handle(self, new Handler(onFulfilled, onRejected, res));
      });
    }
    function handle(self, deferred) {
      while (self._65 === 3) {
        self = self._55;
      }
      if (Promise._37) {
        Promise._37(self);
      }
      if (self._65 === 0) {
        if (self._40 === 0) {
          self._40 = 1;
          self._72 = deferred;
          return;
        }
        if (self._40 === 1) {
          self._40 = 2;
          self._72 = [self._72, deferred];
          return;
        }
        self._72.push(deferred);
        return;
      }
      handleResolved(self, deferred);
    }
    
    function handleResolved(self, deferred) {
      asap(function() {
        var cb = self._65 === 1 ? deferred.onFulfilled : deferred.onRejected;
        if (cb === null) {
          if (self._65 === 1) {
            resolve(deferred.promise, self._55);
          } else {
            reject(deferred.promise, self._55);
          }
          return;
        }
        var ret = tryCallOne(cb, self._55);
        if (ret === IS_ERROR) {
          reject(deferred.promise, LAST_ERROR);
        } else {
          resolve(deferred.promise, ret);
        }
      });
    }
    function resolve(self, newValue) {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) {
        return reject(
          self,
          new TypeError('A promise cannot be resolved with itself.')
        );
      }
      if (
        newValue &&
        (typeof newValue === 'object' || typeof newValue === 'function')
      ) {
        var then = getThen(newValue);
        if (then === IS_ERROR) {
          return reject(self, LAST_ERROR);
        }
        if (
          then === self.then &&
          newValue instanceof Promise
        ) {
          self._65 = 3;
          self._55 = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(then.bind(newValue), self);
          return;
        }
      }
      self._65 = 1;
      self._55 = newValue;
      finale(self);
    }
    
    function reject(self, newValue) {
      self._65 = 2;
      self._55 = newValue;
      if (Promise._87) {
        Promise._87(self, newValue);
      }
      finale(self);
    }
    function finale(self) {
      if (self._40 === 1) {
        handle(self, self._72);
        self._72 = null;
      }
      if (self._40 === 2) {
        for (var i = 0; i < self._72.length; i++) {
          handle(self, self._72[i]);
        }
        self._72 = null;
      }
    }
    
    function Handler(onFulfilled, onRejected, promise){
      this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
      this.onRejected = typeof onRejected === 'function' ? onRejected : null;
      this.promise = promise;
    }
    
    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     *
     * Makes no guarantees about asynchrony.
     */
    function doResolve(fn, promise) {
      var done = false;
      var res = tryCallTwo(fn, function (value) {
        if (done) return;
        done = true;
        resolve(promise, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(promise, reason);
      });
      if (!done && res === IS_ERROR) {
        done = true;
        reject(promise, LAST_ERROR);
      }
    }
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/core.js","/../node_modules/promise/lib")
    },{"asap/raw":3,"buffer":30,"pBGvAp":35}],38:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var Promise = require('./core.js');
    
    module.exports = Promise;
    Promise.prototype.done = function (onFulfilled, onRejected) {
      var self = arguments.length ? this.then.apply(this, arguments) : this;
      self.then(null, function (err) {
        setTimeout(function () {
          throw err;
        }, 0);
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/done.js","/../node_modules/promise/lib")
    },{"./core.js":37,"buffer":30,"pBGvAp":35}],39:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    //This file contains the ES6 extensions to the core Promises/A+ API
    
    var Promise = require('./core.js');
    
    module.exports = Promise;
    
    /* Static Functions */
    
    var TRUE = valuePromise(true);
    var FALSE = valuePromise(false);
    var NULL = valuePromise(null);
    var UNDEFINED = valuePromise(undefined);
    var ZERO = valuePromise(0);
    var EMPTYSTRING = valuePromise('');
    
    function valuePromise(value) {
      var p = new Promise(Promise._61);
      p._65 = 1;
      p._55 = value;
      return p;
    }
    Promise.resolve = function (value) {
      if (value instanceof Promise) return value;
    
      if (value === null) return NULL;
      if (value === undefined) return UNDEFINED;
      if (value === true) return TRUE;
      if (value === false) return FALSE;
      if (value === 0) return ZERO;
      if (value === '') return EMPTYSTRING;
    
      if (typeof value === 'object' || typeof value === 'function') {
        try {
          var then = value.then;
          if (typeof then === 'function') {
            return new Promise(then.bind(value));
          }
        } catch (ex) {
          return new Promise(function (resolve, reject) {
            reject(ex);
          });
        }
      }
      return valuePromise(value);
    };
    
    Promise.all = function (arr) {
      var args = Array.prototype.slice.call(arr);
    
      return new Promise(function (resolve, reject) {
        if (args.length === 0) return resolve([]);
        var remaining = args.length;
        function res(i, val) {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            if (val instanceof Promise && val.then === Promise.prototype.then) {
              while (val._65 === 3) {
                val = val._55;
              }
              if (val._65 === 1) return res(i, val._55);
              if (val._65 === 2) reject(val._55);
              val.then(function (val) {
                res(i, val);
              }, reject);
              return;
            } else {
              var then = val.then;
              if (typeof then === 'function') {
                var p = new Promise(then.bind(val));
                p.then(function (val) {
                  res(i, val);
                }, reject);
                return;
              }
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        }
        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };
    
    Promise.reject = function (value) {
      return new Promise(function (resolve, reject) {
        reject(value);
      });
    };
    
    Promise.race = function (values) {
      return new Promise(function (resolve, reject) {
        values.forEach(function(value){
          Promise.resolve(value).then(resolve, reject);
        });
      });
    };
    
    /* Prototype Methods */
    
    Promise.prototype['catch'] = function (onRejected) {
      return this.then(null, onRejected);
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/es6-extensions.js","/../node_modules/promise/lib")
    },{"./core.js":37,"buffer":30,"pBGvAp":35}],40:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var Promise = require('./core.js');
    
    module.exports = Promise;
    Promise.prototype['finally'] = function (f) {
      return this.then(function (value) {
        return Promise.resolve(f()).then(function () {
          return value;
        });
      }, function (err) {
        return Promise.resolve(f()).then(function () {
          throw err;
        });
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/finally.js","/../node_modules/promise/lib")
    },{"./core.js":37,"buffer":30,"pBGvAp":35}],41:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    module.exports = require('./core.js');
    require('./done.js');
    require('./finally.js');
    require('./es6-extensions.js');
    require('./node-extensions.js');
    require('./synchronous.js');
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/index.js","/../node_modules/promise/lib")
    },{"./core.js":37,"./done.js":38,"./es6-extensions.js":39,"./finally.js":40,"./node-extensions.js":42,"./synchronous.js":43,"buffer":30,"pBGvAp":35}],42:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    // This file contains then/promise specific extensions that are only useful
    // for node.js interop
    
    var Promise = require('./core.js');
    var asap = require('asap');
    
    module.exports = Promise;
    
    /* Static Functions */
    
    Promise.denodeify = function (fn, argumentCount) {
      if (
        typeof argumentCount === 'number' && argumentCount !== Infinity
      ) {
        return denodeifyWithCount(fn, argumentCount);
      } else {
        return denodeifyWithoutCount(fn);
      }
    };
    
    var callbackFn = (
      'function (err, res) {' +
      'if (err) { rj(err); } else { rs(res); }' +
      '}'
    );
    function denodeifyWithCount(fn, argumentCount) {
      var args = [];
      for (var i = 0; i < argumentCount; i++) {
        args.push('a' + i);
      }
      var body = [
        'return function (' + args.join(',') + ') {',
        'var self = this;',
        'return new Promise(function (rs, rj) {',
        'var res = fn.call(',
        ['self'].concat(args).concat([callbackFn]).join(','),
        ');',
        'if (res &&',
        '(typeof res === "object" || typeof res === "function") &&',
        'typeof res.then === "function"',
        ') {rs(res);}',
        '});',
        '};'
      ].join('');
      return Function(['Promise', 'fn'], body)(Promise, fn);
    }
    function denodeifyWithoutCount(fn) {
      var fnLength = Math.max(fn.length - 1, 3);
      var args = [];
      for (var i = 0; i < fnLength; i++) {
        args.push('a' + i);
      }
      var body = [
        'return function (' + args.join(',') + ') {',
        'var self = this;',
        'var args;',
        'var argLength = arguments.length;',
        'if (arguments.length > ' + fnLength + ') {',
        'args = new Array(arguments.length + 1);',
        'for (var i = 0; i < arguments.length; i++) {',
        'args[i] = arguments[i];',
        '}',
        '}',
        'return new Promise(function (rs, rj) {',
        'var cb = ' + callbackFn + ';',
        'var res;',
        'switch (argLength) {',
        args.concat(['extra']).map(function (_, index) {
          return (
            'case ' + (index) + ':' +
            'res = fn.call(' + ['self'].concat(args.slice(0, index)).concat('cb').join(',') + ');' +
            'break;'
          );
        }).join(''),
        'default:',
        'args[argLength] = cb;',
        'res = fn.apply(self, args);',
        '}',
        
        'if (res &&',
        '(typeof res === "object" || typeof res === "function") &&',
        'typeof res.then === "function"',
        ') {rs(res);}',
        '});',
        '};'
      ].join('');
    
      return Function(
        ['Promise', 'fn'],
        body
      )(Promise, fn);
    }
    
    Promise.nodeify = function (fn) {
      return function () {
        var args = Array.prototype.slice.call(arguments);
        var callback =
          typeof args[args.length - 1] === 'function' ? args.pop() : null;
        var ctx = this;
        try {
          return fn.apply(this, arguments).nodeify(callback, ctx);
        } catch (ex) {
          if (callback === null || typeof callback == 'undefined') {
            return new Promise(function (resolve, reject) {
              reject(ex);
            });
          } else {
            asap(function () {
              callback.call(ctx, ex);
            })
          }
        }
      }
    };
    
    Promise.prototype.nodeify = function (callback, ctx) {
      if (typeof callback != 'function') return this;
    
      this.then(function (value) {
        asap(function () {
          callback.call(ctx, null, value);
        });
      }, function (err) {
        asap(function () {
          callback.call(ctx, err);
        });
      });
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/node-extensions.js","/../node_modules/promise/lib")
    },{"./core.js":37,"asap":1,"buffer":30,"pBGvAp":35}],43:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var Promise = require('./core.js');
    
    module.exports = Promise;
    Promise.enableSynchronous = function () {
      Promise.prototype.isPending = function() {
        return this.getState() == 0;
      };
    
      Promise.prototype.isFulfilled = function() {
        return this.getState() == 1;
      };
    
      Promise.prototype.isRejected = function() {
        return this.getState() == 2;
      };
    
      Promise.prototype.getValue = function () {
        if (this._65 === 3) {
          return this._55.getValue();
        }
    
        if (!this.isFulfilled()) {
          throw new Error('Cannot get a value of an unfulfilled promise.');
        }
    
        return this._55;
      };
    
      Promise.prototype.getReason = function () {
        if (this._65 === 3) {
          return this._55.getReason();
        }
    
        if (!this.isRejected()) {
          throw new Error('Cannot get a rejection reason of a non-rejected promise.');
        }
    
        return this._55;
      };
    
      Promise.prototype.getState = function () {
        if (this._65 === 3) {
          return this._55.getState();
        }
        if (this._65 === -1 || this._65 === -2) {
          return 0;
        }
    
        return this._65;
      };
    };
    
    Promise.disableSynchronous = function() {
      Promise.prototype.isPending = undefined;
      Promise.prototype.isFulfilled = undefined;
      Promise.prototype.isRejected = undefined;
      Promise.prototype.getValue = undefined;
      Promise.prototype.getReason = undefined;
      Promise.prototype.getState = undefined;
    };
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/synchronous.js","/../node_modules/promise/lib")
    },{"./core.js":37,"buffer":30,"pBGvAp":35}],44:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    (function(module) {
        'use strict';
    
        module.exports.is_uri = is_iri;
        module.exports.is_http_uri = is_http_iri;
        module.exports.is_https_uri = is_https_iri;
        module.exports.is_web_uri = is_web_iri;
        // Create aliases
        module.exports.isUri = is_iri;
        module.exports.isHttpUri = is_http_iri;
        module.exports.isHttpsUri = is_https_iri;
        module.exports.isWebUri = is_web_iri;
    
    
        // private function
        // internal URI spitter method - direct from RFC 3986
        var splitUri = function(uri) {
            var splitted = uri.match(/(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/);
            return splitted;
        };
    
        function is_iri(value) {
            if (!value) {
                return;
            }
    
            // check for illegal characters
            if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(value)) return;
    
            // check for hex escapes that aren't complete
            if (/%[^0-9a-f]/i.test(value)) return;
            if (/%[0-9a-f](:?[^0-9a-f]|$)/i.test(value)) return;
    
            var splitted = [];
            var scheme = '';
            var authority = '';
            var path = '';
            var query = '';
            var fragment = '';
            var out = '';
    
            // from RFC 3986
            splitted = splitUri(value);
            scheme = splitted[1]; 
            authority = splitted[2];
            path = splitted[3];
            query = splitted[4];
            fragment = splitted[5];
    
            // scheme and path are required, though the path can be empty
            if (!(scheme && scheme.length && path.length >= 0)) return;
    
            // if authority is present, the path must be empty or begin with a /
            if (authority && authority.length) {
                if (!(path.length === 0 || /^\//.test(path))) return;
            } else {
                // if authority is not present, the path must not start with //
                if (/^\/\//.test(path)) return;
            }
    
            // scheme must begin with a letter, then consist of letters, digits, +, ., or -
            if (!/^[a-z][a-z0-9\+\-\.]*$/.test(scheme.toLowerCase()))  return;
    
            // re-assemble the URL per section 5.3 in RFC 3986
            out += scheme + ':';
            if (authority && authority.length) {
                out += '//' + authority;
            }
    
            out += path;
    
            if (query && query.length) {
                out += '?' + query;
            }
    
            if (fragment && fragment.length) {
                out += '#' + fragment;
            }
    
            return out;
        }
    
        function is_http_iri(value, allowHttps) {
            if (!is_iri(value)) {
                return;
            }
    
            var splitted = [];
            var scheme = '';
            var authority = '';
            var path = '';
            var port = '';
            var query = '';
            var fragment = '';
            var out = '';
    
            // from RFC 3986
            splitted = splitUri(value);
            scheme = splitted[1]; 
            authority = splitted[2];
            path = splitted[3];
            query = splitted[4];
            fragment = splitted[5];
    
            if (!scheme)  return;
    
            if(allowHttps) {
                if (scheme.toLowerCase() != 'https') return;
            } else {
                if (scheme.toLowerCase() != 'http') return;
            }
    
            // fully-qualified URIs must have an authority section that is
            // a valid host
            if (!authority) {
                return;
            }
    
            // enable port component
            if (/:(\d+)$/.test(authority)) {
                port = authority.match(/:(\d+)$/)[0];
                authority = authority.replace(/:\d+$/, '');
            }
    
            out += scheme + ':';
            out += '//' + authority;
            
            if (port) {
                out += port;
            }
            
            out += path;
            
            if(query && query.length){
                out += '?' + query;
            }
    
            if(fragment && fragment.length){
                out += '#' + fragment;
            }
            
            return out;
        }
    
        function is_https_iri(value) {
            return is_http_iri(value, true);
        }
    
        function is_web_iri(value) {
            return (is_http_iri(value) || is_https_iri(value));
        }
    
    })(module);
    
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/valid-url/index.js","/../node_modules/valid-url")
    },{"buffer":30,"pBGvAp":35}],45:[function(require,module,exports){
    module.exports={
      "name": "clarifai",
      "version": "2.9.1",
      "description": "Official Clarifai Javascript SDK",
      "main": "dist/index.js",
      "repository": "https://github.com/Clarifai/clarifai-javascript",
      "author": "Clarifai Inc.",
      "license": "Apache-2.0",
      "scripts": {
        "jsdoc": "jsdoc src/* -t node_modules/minami -d docs/$npm_package_version && jsdoc src/* -t node_modules/minami -d docs/latest",
        "test": "gulp test",
        "unittest": "gulp unittest",
        "watch": "gulp watch",
        "build": "npm run clean && gulp build && npm run jsdoc",
        "release": "release-it",
        "clean": "gulp cleanbuild"
      },
      "dependencies": {
        "axios": ">=0.11.1 <2",
        "promise": "^7.1.1",
        "valid-url": "^1.0.9"
      },
      "devDependencies": {
        "axios-mock-adapter": "^1.16.0",
        "babel-eslint": "^6.1.2",
        "babel-preset-es2015": "^6.14.0",
        "babel-register": "^6.14.0",
        "babelify": "^7.3.0",
        "del": "^2.0.2",
        "envify": "^3.4.0",
        "gulp": "^3.9.1",
        "gulp-babel": "^6.1.2",
        "gulp-browserify": "^0.5.1",
        "gulp-eslint": "^2.0.0",
        "gulp-insert": "^0.5.0",
        "gulp-jasmine": "^4.0.0",
        "gulp-notify": "2.2.0",
        "gulp-rename": "^1.2.2",
        "gulp-replace-task": "^0.11.0",
        "gulp-uglify": "^1.4.1",
        "gulp-util": "^3.0.6",
        "jsdoc": "^3.4.1",
        "minami": "^1.1.1",
        "release-it": "^2.9.0"
      }
    }
    
    },{}],46:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    
    var _require = require('./helpers'),
        checkType = _require.checkType;
    
    var Models = require('./Models');
    var Inputs = require('./Inputs');
    var Concepts = require('./Concepts');
    var Workflow = require('./Workflow');
    var Workflows = require('./Workflows');
    var Solutions = require('./solutions/Solutions');
    
    var _require2 = require('./constants'),
        API = _require2.API,
        ERRORS = _require2.ERRORS,
        getBasePath = _require2.getBasePath;
    
    var TOKEN_PATH = API.TOKEN_PATH;
    
    
    if (typeof window !== 'undefined' && !('Promise' in window)) {
      window.Promise = require('promise');
    }
    
    if (typeof global !== 'undefined' && !('Promise' in global)) {
      global.Promise = require('promise');
    }
    
    /**
     * top-level class that allows access to models, inputs and concepts
     * @class
     */
    
    var App = function () {
      function App(arg1, arg2, arg3) {
        _classCallCheck(this, App);
    
        var optionsObj = arg1;
        if ((typeof arg1 === 'undefined' ? 'undefined' : _typeof(arg1)) !== 'object' || arg1 === null) {
          optionsObj = arg3 || {};
          optionsObj.clientId = arg1;
          optionsObj.clientSecret = arg2;
        }
        this._validate(optionsObj);
        this._init(optionsObj);
      }
    
      /**
       * Gets a token from the API using client credentials
       * @return {Promise(token, error)} A Promise that is fulfilled with the token string or rejected with an error
       *
       * @deprecated Please switch to using the API key.
       */
    
    
      _createClass(App, [{
        key: 'getToken',
        value: function getToken() {
          return this._config.token();
        }
    
        /**
         * Sets the token to use for the API
         * @param {String}         _token    The token you are setting
         * @return {Boolean}                 true if token has valid fields, false if not
         *
         * @deprecated Please switch to using the API key.
         */
    
      }, {
        key: 'setToken',
        value: function setToken(_token) {
          var token = _token;
          var now = new Date().getTime();
          if (typeof _token === 'string') {
            token = {
              accessToken: _token,
              expiresIn: 176400
            };
          } else {
            token = {
              accessToken: _token.access_token || _token.accessToken,
              expiresIn: _token.expires_in || _token.expiresIn
            };
          }
          if (token.accessToken && token.expiresIn || token.access_token && token.expires_in) {
            if (!token.expireTime) {
              token.expireTime = now + token.expiresIn * 1000;
            }
            this._config._token = token;
            return true;
          }
          return false;
        }
      }, {
        key: '_validate',
        value: function _validate(_ref) {
          var clientId = _ref.clientId,
              clientSecret = _ref.clientSecret,
              token = _ref.token,
              apiKey = _ref.apiKey,
              sessionToken = _ref.sessionToken;
    
          if (clientId || clientSecret) {
            console.warn('Client ID/secret has been deprecated. Please switch to using the API key. See here how to do ' + 'the switch: https://blog.clarifai.com/introducing-api-keys-a-safer-way-to-authenticate-your-applications');
          }
          if ((!clientId || !clientSecret) && !token && !apiKey && !sessionToken) {
            throw ERRORS.paramsRequired(['apiKey']);
          }
        }
      }, {
        key: '_init',
        value: function _init(options) {
          var _this = this;
    
          var apiEndpoint = options.apiEndpoint || process && process.env && process.env.API_ENDPOINT || 'https://api.clarifai.com';
          this._config = {
            apiEndpoint: apiEndpoint,
            clientId: options.clientId,
            clientSecret: options.clientSecret,
            apiKey: options.apiKey,
            sessionToken: options.sessionToken,
            basePath: getBasePath(apiEndpoint, options.userId, options.appId),
            token: function token() {
              return new Promise(function (resolve, reject) {
                var now = new Date().getTime();
                if (checkType(/Object/, _this._config._token) && _this._config._token.expireTime > now) {
                  resolve(_this._config._token);
                } else {
                  _this._getToken(resolve, reject);
                }
              });
            }
          };
          if (options.token) {
            this.setToken(options.token);
          }
          this.models = new Models(this._config);
          this.inputs = new Inputs(this._config);
          this.concepts = new Concepts(this._config);
          this.workflow = new Workflow(this._config);
          this.workflows = new Workflows(this._config);
          this.solutions = new Solutions(this._config);
        }
    
        /**
         * @deprecated Please switch to using the API key.
         */
    
      }, {
        key: '_getToken',
        value: function _getToken(resolve, reject) {
          var _this2 = this;
    
          this._requestToken().then(function (response) {
            if (response.status === 200) {
              _this2.setToken(response.data);
              resolve(_this2._config._token);
            } else {
              reject(response);
            }
          }, reject);
        }
    
        /**
         * @deprecated Please switch to using the API key.
         */
    
      }, {
        key: '_requestToken',
        value: function _requestToken() {
          var url = '' + this._config.basePath + TOKEN_PATH;
          var clientId = this._config.clientId;
          var clientSecret = this._config.clientSecret;
          return axios({
            'url': url,
            'method': 'POST',
            'auth': {
              'username': clientId,
              'password': clientSecret
            }
          });
        }
      }]);
    
      return App;
    }();
    
    module.exports = App;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJjaGVja1R5cGUiLCJNb2RlbHMiLCJJbnB1dHMiLCJDb25jZXB0cyIsIldvcmtmbG93IiwiV29ya2Zsb3dzIiwiU29sdXRpb25zIiwiQVBJIiwiRVJST1JTIiwiZ2V0QmFzZVBhdGgiLCJUT0tFTl9QQVRIIiwid2luZG93IiwiUHJvbWlzZSIsImdsb2JhbCIsIkFwcCIsImFyZzEiLCJhcmcyIiwiYXJnMyIsIm9wdGlvbnNPYmoiLCJjbGllbnRJZCIsImNsaWVudFNlY3JldCIsIl92YWxpZGF0ZSIsIl9pbml0IiwiX2NvbmZpZyIsInRva2VuIiwiX3Rva2VuIiwibm93IiwiRGF0ZSIsImdldFRpbWUiLCJhY2Nlc3NUb2tlbiIsImV4cGlyZXNJbiIsImFjY2Vzc190b2tlbiIsImV4cGlyZXNfaW4iLCJleHBpcmVUaW1lIiwiYXBpS2V5Iiwic2Vzc2lvblRva2VuIiwiY29uc29sZSIsIndhcm4iLCJwYXJhbXNSZXF1aXJlZCIsIm9wdGlvbnMiLCJhcGlFbmRwb2ludCIsInByb2Nlc3MiLCJlbnYiLCJBUElfRU5EUE9JTlQiLCJiYXNlUGF0aCIsInVzZXJJZCIsImFwcElkIiwicmVzb2x2ZSIsInJlamVjdCIsIl9nZXRUb2tlbiIsInNldFRva2VuIiwibW9kZWxzIiwiaW5wdXRzIiwiY29uY2VwdHMiLCJ3b3JrZmxvdyIsIndvcmtmbG93cyIsInNvbHV0aW9ucyIsIl9yZXF1ZXN0VG9rZW4iLCJ0aGVuIiwicmVzcG9uc2UiLCJzdGF0dXMiLCJkYXRhIiwidXJsIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjs7ZUFDa0JBLFFBQVEsV0FBUixDO0lBQWJDLFMsWUFBQUEsUzs7QUFDTCxJQUFJQyxTQUFTRixRQUFRLFVBQVIsQ0FBYjtBQUNBLElBQUlHLFNBQVNILFFBQVEsVUFBUixDQUFiO0FBQ0EsSUFBSUksV0FB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QixPQUFsQixDQUFoQjtBQUNBLFdBQUsrQixRQUFMLEdBQWdCLElBQUlsRCxRQUFKLENBQWEsS0FBS21CLE9BQWxCLENBQWhCO0FBQ0EsV0FBS2dDLFNBQUwsR0FBaUIsSUFBSWxELFNBQUosQ0FBYyxLQUFLa0IsT0FBbkIsQ0FBakI7QUFDQSxXQUFLaUMsU0FBTCxHQUFpQixJQUFJbEQsU0FBSixDQUFjLEtBQUtpQixPQUFuQixDQUFqQjtBQUNEOztBQUVEOzs7Ozs7OEJBR1V3QixPLEVBQVNDLE0sRUFBUTtBQUFBOztBQUN6QixXQUFLUyxhQUFMLEdBQXFCQyxJQUFyQixDQUNFLFVBQUNDLFFBQUQsRUFBYztBQUNaLFlBQUlBLFNBQVNDLE1BQVQsS0FBb0IsR0FBeEIsRUFBNkI7QUFDM0IsaUJBQUtWLFFBQUwsQ0FBY1MsU0FBU0UsSUFBdkI7QUFDQWQsa0JBQVEsT0FBS3hCLE9BQUwsQ0FBYUUsTUFBckI7QUFDRCxTQUhELE1BR087QUFDTHVCLGlCQUFPVyxRQUFQO0FBQ0Q7QUFDRixPQVJILEVBU0VYLE1BVEY7QUFXRDs7QUFFRDs7Ozs7O29DQUdnQjtBQUNkLFVBQUljLFdBQVMsS0FBS3ZDLE9BQUwsQ0FBYXFCLFFBQXRCLEdBQWlDbEMsVUFBckM7QUFDQSxVQUFJUyxXQUFXLEtBQUtJLE9BQUwsQ0FBYUosUUFBNUI7QUFDQSxVQUFJQyxlQUFlLEtBQUtHLE9BQUwsQ0FBYUgsWUFBaEM7QUFDQSxhQUFPdEIsTUFBTTtBQUNYLGVBQU9nRSxHQURJO0FBRVgsa0JBQVUsTUFGQztBQUdYLGdCQUFRO0FBQ04sc0JBQVkzQyxRQUROO0FBRU4sc0JBQVlDO0FBRk47QUFIRyxPQUFOLENBQVA7QUFRRDs7Ozs7O0FBR0gyQyxPQUFPQyxPQUFQLEdBQWlCbEQsR0FBakIiLCJmaWxlIjoiQXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCB7Y2hlY2tUeXBlfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IE1vZGVscyA9IHJlcXVpcmUoJy4vTW9kZWxzJyk7XG5sZXQgSW5wdXRzID0gcmVxdWlyZSgnLi9JbnB1dHMnKTtcbmxldCBDb25jZXB0cyA9IHJlcXVpcmUoJy4vQ29uY2VwdHMnKTtcbmxldCBXb3JrZmxvdyA9IHJlcXVpcmUoJy4vV29ya2Zsb3cnKTtcbmxldCBXb3JrZmxvd3MgPSByZXF1aXJlKCcuL1dvcmtmbG93cycpO1xubGV0IFNvbHV0aW9ucyA9IHJlcXVpcmUoJy4vc29sdXRpb25zL1NvbHV0aW9ucycpO1xubGV0IHtBUEksIEVSUk9SUywgZ2V0QmFzZVBhdGh9ID0gcmVxdWlyZSgnLi9jb25zdGFudHMnKTtcbmxldCB7VE9LRU5fUEFUSH0gPSBBUEk7XG5cbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAhKCdQcm9taXNlJyBpbiB3aW5kb3cpKSB7XG4gIHdpbmRvdy5Qcm9taXNlID0gcmVxdWlyZSgncHJvbWlzZScpO1xufVxuXG5pZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgISgnUHJvbWlzZScgaW4gZ2xvYmFsKSkge1xuICBnbG9iYWwuUHJvbWlzZSA9IHJlcXVpcmUoJ3Byb21pc2UnKTtcbn1cblxuLyoqXG4gKiB0b3AtbGV2ZWwgY2xhc3MgdGhhdCBhbGxvd3MgYWNjZXNzIHRvIG1vZGVscywgaW5wdXRzIGFuZCBjb25jZXB0c1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIEFwcCB7XG4gIGNvbnN0cnVjdG9yKGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgICBsZXQgb3B0aW9uc09iaiA9IGFyZzE7XG4gICAgaWYgKHR5cGVvZiBhcmcxICE9PSAnb2JqZWN0JyB8fCBhcmcxID09PSBudWxsKSB7XG4gICAgICBvcHRpb25zT2JqID0gYXJnMyB8fCB7fTtcbiAgICAgIG9wdGlvbnNPYmouY2xpZW50SWQgPSBhcmcxO1xuICAgICAgb3B0aW9uc09iai5jbGllbnRTZWNyZXQgPSBhcmcyO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZGF0ZShvcHRpb25zT2JqKTtcbiAgICB0aGlzLl9pbml0KG9wdGlvbnNPYmopO1xuXG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIHRva2VuIGZyb20gdGhlIEFQSSB1c2luZyBjbGllbnQgY3JlZGVudGlhbHNcbiAgICogQHJldHVybiB7UHJvbWlzZSh0b2tlbiwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgdG9rZW4gc3RyaW5nIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgUGxlYXNlIHN3aXRjaCB0byB1c2luZyB0aGUgQVBJIGtleS5cbiAgICovXG4gIGdldFRva2VuKCkge1xuICAgIHJldHVybiB0aGlzLl9jb25maWcudG9rZW4oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB0b2tlbiB0byB1c2UgZm9yIHRoZSBBUElcbiAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgX3Rva2VuICAgIFRoZSB0b2tlbiB5b3UgYXJlIHNldHRpbmdcbiAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgIHRydWUgaWYgdG9rZW4gaGFzIHZhbGlkIGZpZWxkcywgZmFsc2UgaWYgbm90XG4gICAqXG4gICAqIEBkZXByZWNhdGVkIFBsZWFzZSBzd2l0Y2ggdG8gdXNpbmcgdGhlIEFQSSBrZXkuXG4gICAqL1xuICBzZXRUb2tlbihfdG9rZW4pIHtcbiAgICBsZXQgdG9rZW4gPSBfdG9rZW47XG4gICAgbGV0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGlmICh0eXBlb2YgX3Rva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgdG9rZW4gPSB7XG4gICAgICAgIGFjY2Vzc1Rva2VuOiBfdG9rZW4sXG4gICAgICAgIGV4cGlyZXNJbjogMTc2NDAwXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0b2tlbiA9IHtcbiAgICAgICAgYWNjZXNzVG9rZW46IF90b2tlbi5hY2Nlc3NfdG9rZW4gfHwgX3Rva2VuLmFjY2Vzc1Rva2VuLFxuICAgICAgICBleHBpcmVzSW46IF90b2tlbi5leHBpcmVzX2luIHx8IF90b2tlbi5leHBpcmVzSW5cbiAgICAgIH07XG4gICAgfVxuICAgIGlmICgodG9rZW4uYWNjZXNzVG9rZW4gJiYgdG9rZW4uZXhwaXJlc0luKSB8fFxuICAgICAgKHRva2VuLmFjY2Vzc190b2tlbiAmJiB0b2tlbi5leHBpcmVzX2luKSkge1xuICAgICAgaWYgKCF0b2tlbi5leHBpcmVUaW1lKSB7XG4gICAgICAgIHRva2VuLmV4cGlyZVRpbWUgPSBub3cgKyAodG9rZW4uZXhwaXJlc0luICogMTAwMCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jb25maWcuX3Rva2VuID0gdG9rZW47XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX3ZhbGlkYXRlKHtjbGllbnRJZCwgY2xpZW50U2VjcmV0LCB0b2tlbiwgYXBpS2V5LCBzZXNzaW9uVG9rZW59KSB7XG4gICAgaWYgKGNsaWVudElkIHx8IGNsaWVudFNlY3JldCkge1xuICAgICAgY29uc29sZS53YXJuKCdDbGllbnQgSUQvc2VjcmV0IGhhcyBiZWVuIGRlcHJlY2F0ZWQuIFBsZWFzZSBzd2l0Y2ggdG8gdXNpbmcgdGhlIEFQSSBrZXkuIFNlZSBoZXJlIGhvdyB0byBkbyAnICtcbiAgICAgICAgJ3RoZSBzd2l0Y2g6IGh0dHBzOi8vYmxvZy5jbGFyaWZhaS5jb20vaW50cm9kdWNpbmctYXBpLWtleXMtYS1zYWZlci13YXktdG8tYXV0aGVudGljYXRlLXlvdXItYXBwbGljYXRpb25zJyk7XG4gICAgfVxuICAgIGlmICgoIWNsaWVudElkIHx8ICFjbGllbnRTZWNyZXQpICYmICF0b2tlbiAmJiAhYXBpS2V5ICYmICFzZXNzaW9uVG9rZW4pIHtcbiAgICAgIHRocm93IEVSUk9SUy5wYXJhbXNSZXF1aXJlZChbJ2FwaUtleSddKTtcbiAgICB9XG4gIH1cblxuICBfaW5pdChvcHRpb25zKSB7XG4gICAgbGV0IGFwaUVuZHBvaW50ID0gb3B0aW9ucy5hcGlFbmRwb2ludCB8fFxuICAgICAgKHByb2Nlc3MgJiYgcHJvY2Vzcy5lbnYgJiYgcHJvY2Vzcy5lbnYuQVBJX0VORFBPSU5UKSB8fCAnaHR0cHM6Ly9hcGkuY2xhcmlmYWkuY29tJztcbiAgICB0aGlzLl9jb25maWcgPSB7XG4gICAgICBhcGlFbmRwb2ludCxcbiAgICAgIGNsaWVudElkOiBvcHRpb25zLmNsaWVudElkLFxuICAgICAgY2xpZW50U2VjcmV0OiBvcHRpb25zLmNsaWVudFNlY3JldCxcbiAgICAgIGFwaUtleTogb3B0aW9ucy5hcGlLZXksXG4gICAgICBzZXNzaW9uVG9rZW46IG9wdGlvbnMuc2Vzc2lvblRva2VuLFxuICAgICAgYmFzZVBhdGg6IGdldEJhc2VQYXRoKGFwaUVuZHBvaW50LCBvcHRpb25zLnVzZXJJZCwgb3B0aW9ucy5hcHBJZCksXG4gICAgICB0b2tlbjogKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoY2hlY2tUeXBlKC9PYmplY3QvLCB0aGlzLl9jb25maWcuX3Rva2VuKSAmJiB0aGlzLl9jb25maWcuX3Rva2VuLmV4cGlyZVRpbWUgPiBub3cpIHtcbiAgICAgICAgICAgIHJlc29sdmUodGhpcy5fY29uZmlnLl90b2tlbik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2dldFRva2VuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLnRva2VuKSB7XG4gICAgICB0aGlzLnNldFRva2VuKG9wdGlvbnMudG9rZW4pO1xuICAgIH1cbiAgICB0aGlzLm1vZGVscyA9IG5ldyBNb2RlbHModGhpcy5fY29uZmlnKTtcbiAgICB0aGlzLmlucHV0cyA9IG5ldyBJbnB1dHModGhpcy5fY29uZmlnKTtcbiAgICB0aGlzLmNvbmNlcHRzID0gbmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZyk7XG4gICAgdGhpcy53b3JrZmxvdyA9IG5ldyBXb3JrZmxvdyh0aGlzLl9jb25maWcpO1xuICAgIHRoaXMud29ya2Zsb3dzID0gbmV3IFdvcmtmbG93cyh0aGlzLl9jb25maWcpO1xuICAgIHRoaXMuc29sdXRpb25zID0gbmV3IFNvbHV0aW9ucyh0aGlzLl9jb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIFBsZWFzZSBzd2l0Y2ggdG8gdXNpbmcgdGhlIEFQSSBrZXkuXG4gICAqL1xuICBfZ2V0VG9rZW4ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcmVxdWVzdFRva2VuKCkudGhlbihcbiAgICAgIChyZXNwb25zZSkgPT4ge1xuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICB0aGlzLnNldFRva2VuKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fY29uZmlnLl90b2tlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJlamVjdFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgUGxlYXNlIHN3aXRjaCB0byB1c2luZyB0aGUgQVBJIGtleS5cbiAgICovXG4gIF9yZXF1ZXN0VG9rZW4oKSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke1RPS0VOX1BBVEh9YDtcbiAgICBsZXQgY2xpZW50SWQgPSB0aGlzLl9jb25maWcuY2xpZW50SWQ7XG4gICAgbGV0IGNsaWVudFNlY3JldCA9IHRoaXMuX2NvbmZpZy5jbGllbnRTZWNyZXQ7XG4gICAgcmV0dXJuIGF4aW9zKHtcbiAgICAgICd1cmwnOiB1cmwsXG4gICAgICAnbWV0aG9kJzogJ1BPU1QnLFxuICAgICAgJ2F1dGgnOiB7XG4gICAgICAgICd1c2VybmFtZSc6IGNsaWVudElkLFxuICAgICAgICAncGFzc3dvcmQnOiBjbGllbnRTZWNyZXRcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcDtcbiJdfQ==
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/App.js","/")
    },{"./Concepts":48,"./Inputs":50,"./Models":53,"./Workflow":56,"./Workflows":57,"./constants":58,"./helpers":60,"./solutions/Solutions":62,"axios":4,"buffer":30,"pBGvAp":35,"promise":36}],47:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    /**
     * class representing a concept and its info
     * @class
     */
    var Concept = function Concept(_config, data) {
      _classCallCheck(this, Concept);
    
      this.id = data.id;
      this.name = data.name;
      this.createdAt = data.created_at || data.createdAt;
      this.appId = data.app_id || data.appId;
      this.value = data.value || null;
      this._config = _config;
      this.rawData = data;
    };
    
    ;
    
    module.exports = Concept;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNvbmNlcHQuanMiXSwibmFtZXMiOlsiQ29uY2VwdCIsIl9jb25maWciLCJkYXRhIiwiaWQiLCJuYW1lIiwiY3JlYXRlZEF0IiwiY3JlYXRlZF9hdCIsImFwcElkIiwiYXBwX2lkIiwidmFsdWUiLCJyYXdEYXRhIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7O0lBSU1BLE8sR0FDSixpQkFBWUMsT0FBWixFQUFxQkMsSUFBckIsRUFBMkI7QUFBQTs7QUFDekIsT0FBS0MsRUFBTCxHQUFVRCxLQUFLQyxFQUFmO0FBQ0EsT0FBS0MsSUFBTCxHQUFZRixLQUFLRSxJQUFqQjtBQUNBLE9BQUtDLFNBQUwsR0FBaUJILEtBQUtJLFVBQUwsSUFBbUJKLEtBQUtHLFNBQXpDO0FBQ0EsT0FBS0UsS0FBTCxHQUFhTCxLQUFLTSxNQUFMLElBQWVOLEtBQUtLLEtBQWpDO0FBQ0EsT0FBS0UsS0FBTCxHQUFhUCxLQUFLTyxLQUFMLElBQWMsSUFBM0I7QUFDQSxPQUFLUixPQUFMLEdBQWVBLE9BQWY7QUFDQSxPQUFLUyxPQUFMLEdBQWVSLElBQWY7QUFDRCxDOztBQUVIOztBQUVBUyxPQUFPQyxPQUFQLEdBQWlCWixPQUFqQiIsImZpbGUiOiJDb25jZXB0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb25jZXB0IGFuZCBpdHMgaW5mb1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIENvbmNlcHQge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xuICAgIHRoaXMuY3JlYXRlZEF0ID0gZGF0YS5jcmVhdGVkX2F0IHx8IGRhdGEuY3JlYXRlZEF0O1xuICAgIHRoaXMuYXBwSWQgPSBkYXRhLmFwcF9pZCB8fCBkYXRhLmFwcElkO1xuICAgIHRoaXMudmFsdWUgPSBkYXRhLnZhbHVlIHx8IG51bGw7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uY2VwdDtcbiJdfQ==
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Concept.js","/")
    },{"buffer":30,"pBGvAp":35}],48:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var Concept = require('./Concept');
    
    var _require = require('./constants'),
        API = _require.API,
        replaceVars = _require.replaceVars;
    
    var CONCEPTS_PATH = API.CONCEPTS_PATH,
        CONCEPT_PATH = API.CONCEPT_PATH,
        CONCEPT_SEARCH_PATH = API.CONCEPT_SEARCH_PATH;
    
    var _require2 = require('./utils'),
        wrapToken = _require2.wrapToken,
        formatConcept = _require2.formatConcept;
    
    var _require3 = require('./helpers'),
        isSuccess = _require3.isSuccess,
        checkType = _require3.checkType;
    
    /**
     * class representing a collection of concepts
     * @class
     */
    
    
    var Concepts = function () {
      function Concepts(_config) {
        var _this = this;
    
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Concepts);
    
        this._config = _config;
        this.rawData = rawData;
        rawData.forEach(function (conceptData, index) {
          _this[index] = new Concept(_this._config, conceptData);
        });
        this.length = rawData.length;
      }
    
      /**
       * List all the concepts
       * @param {object}     options     Object with keys explained below: (optional)
       *    @param {number}    options.page        The page number (optional, default: 1)
       *    @param {number}    options.perPage     Number of images to return per page (optional, default: 20)
       * @return {Promise(Concepts, error)} A Promise that is fulfilled with a Concepts instance or rejected with an error
       */
    
    
      _createClass(Concepts, [{
        key: 'list',
        value: function list() {
          var _this2 = this;
    
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + CONCEPTS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, {
                headers: headers,
                params: {
                  'page': options.page,
                  'per_page': options.perPage
                }
              }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Concepts(_this2._config, response.data.concepts));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * List a single concept given an id
         * @param {String}     id          The concept's id
         * @return {Promise(Concept, error)} A Promise that is fulfilled with a Concept instance or rejected with an error
         */
    
      }, {
        key: 'get',
        value: function get(id) {
          var _this3 = this;
    
          var url = '' + this._config.basePath + replaceVars(CONCEPT_PATH, [id]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Concept(_this3._config, response.data.concept));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Add a list of concepts given an id and name
         * @param {object|object[]}   concepts       Can be a single media object or an array of media objects
         *   @param  {object|string}    concepts[].concept         If string, this is assumed to be the concept id. Otherwise, an object with the following attributes
         *     @param  {object}           concepts[].concept.id      The new concept's id (Required)
         *     @param  {object}           concepts[].concept.name    The new concept's name
         * @return {Promise(Concepts, error)}             A Promise that is fulfilled with a Concepts instance or rejected with an error
         */
    
      }, {
        key: 'create',
        value: function create() {
          var _this4 = this;
    
          var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    
          if (checkType(/(Object|String)/, concepts)) {
            concepts = [concepts];
          }
          var data = {
            'concepts': concepts.map(formatConcept)
          };
          var url = '' + this._config.basePath + CONCEPTS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Concepts(_this4._config, response.data.concepts));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Search for a concept given a name. A wildcard can be given (example: The name "bo*" will match with "boat" and "bow" given those concepts exist
         * @param  {string}   name  The name of the concept to search for
         * @return {Promise(Concepts, error)} A Promise that is fulfilled with a Concepts instance or rejected with an error
         */
    
      }, {
        key: 'search',
        value: function search(name) {
          var _this5 = this;
    
          var language = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    
          var url = '' + this._config.basePath + CONCEPT_SEARCH_PATH;
          return wrapToken(this._config, function (headers) {
            var params = {
              'concept_query': { name: name, language: language }
            };
            return new Promise(function (resolve, reject) {
              axios.post(url, params, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Concepts(_this5._config, response.data.concepts));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Update a concepts
         * @param {object|object[]}   concepts       Can be a single concept object or an array of concept objects
         *   @param  {object}           concepts[].concept         A concept object with the following attributes
         *     @param  {object}           concepts[].concept.id      The concept's id (Required)
         *     @param  {object}           concepts[].concept.name    The concept's new name
         * @param {string}            [action=overwrite]  The action to use for the PATCH
         * @return {Promise(Concepts, error)}             A Promise that is fulfilled with a Concepts instance or rejected with an error
         */
    
      }, {
        key: 'update',
        value: function update() {
          var _this6 = this;
    
          var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
          var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'overwrite';
    
          if (!checkType(/Array/, concepts)) {
            concepts = [concepts];
          }
          var data = {
            concepts: concepts,
            action: action
          };
          var url = '' + this._config.basePath + CONCEPTS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.patch(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Concepts(_this6._config, response.data.concepts));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }]);
    
      return Concepts;
    }();
    
    ;
    
    module.exports = Concepts;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNvbmNlcHRzLmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkNvbmNlcHQiLCJBUEkiLCJyZXBsYWNlVmFycyIsIkNPTkNFUFRTX1BBVEgiLCJDT05DRVBUX1BBVEgiLCJDT05DRVBUX1NFQVJDSF9QQVRIIiwid3JhcFRva2VuIiwiZm9ybWF0Q29uY2VwdCIsImlzU3VjY2VzcyIsImNoZWNrVHlwZSIsIkNvbmNlcHRzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwiY29uY2VwdERhdGEiLCJpbmRleCIsImxlbmd0aCIsIm9wdGlvbnMiLCJwYWdlIiwicGVyUGFnZSIsInVybCIsImJhc2VQYXRoIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0IiwicGFyYW1zIiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsImNvbmNlcHRzIiwiaWQiLCJjb25jZXB0IiwibWFwIiwicG9zdCIsIm5hbWUiLCJsYW5ndWFnZSIsImFjdGlvbiIsInBhdGNoIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBSUEsUUFBUUMsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFJQyxVQUFVRCxRQUFRLFdBQVIsQ0FBZDs7ZUFDeUJBLFFBQVEsYUFBUixDO0lBQXBCRSxHLFlBQUFBLEc7SUFBS0MsVyxZQUFBQSxXOztJQUNMQyxhLEdBQW9ERixHLENBQXBERSxhO0lBQWVDLFksR0FBcUNILEcsQ0FBckNHLFk7SUFBY0MsbUIsR0FBdUJKLEcsQ0FBdkJJLG1COztnQkFDRE4sUUFBUSxTQUFSLEM7SUFBNUJPLFMsYUFBQUEsUztJQUFXQyxhLGFBQUFBLGE7O2dCQUNhUixRQUFRLFdBQVIsQztJQUF4QlMsUyxhQUFBQSxTO0lBQVdDLFMsYUFBQUEsUzs7QUFFaEI7Ozs7OztJQUlNQyxRO0FBQ0osb0JBQVlDLE9BQVosRUFBbUM7QUFBQTs7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pD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YixXQUFhOztBQUMxQyxVQUFJLENBQUM3QixVQUFVLE9BQVYsRUFBbUJzQixRQUFuQixDQUFMLEVBQW1DO0FBQ2pDQSxtQkFBVyxDQUFDQSxRQUFELENBQVg7QUFDRDtBQUNELFVBQU1ELE9BQU87QUFDWEMsMEJBRFc7QUFFWE87QUFGVyxPQUFiO0FBSUEsVUFBTWxCLFdBQVMsS0FBS1QsT0FBTCxDQUFhVSxRQUF0QixHQUFpQ2xCLGFBQXZDO0FBQ0EsYUFBT0csVUFBVSxLQUFLSyxPQUFmLEVBQXdCLG1CQUFXO0FBQ3hDLGVBQU8sSUFBSVksT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0QzNCLGdCQUFNeUMsS0FBTixDQUFZbkIsR0FBWixFQUFpQlUsSUFBakIsRUFBdUIsRUFBRVIsZ0JBQUYsRUFBdkIsRUFDR00sSUFESCxDQUNRLFVBQUNDLFFBQUQsRUFBYztBQUNsQixnQkFBSXJCLFVBQVVxQixRQUFWLENBQUosRUFBeUI7QUFDdkJMLHNCQUFRLElBQUlkLFFBQUosQ0FBYSxPQUFLQyxPQUFsQixFQUEyQmtCLFNBQVNDLElBQVQsQ0FBY0MsUUFBekMsQ0FBUjtBQUNELGFBRkQsTUFFTztBQUNMTixxQkFBT0ksUUFBUDtBQUNEO0FBQ0YsV0FQSCxFQU9LSixNQVBMO0FBUUQsU0FUTSxDQUFQO0FBVUQsT0FYTSxDQUFQO0FBWUQ7Ozs7OztBQUNGOztBQUVEZSxPQUFPQyxPQUFQLEdBQWlCL0IsUUFBakIiLCJmaWxlIjoiQ29uY2VwdHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IENvbmNlcHQgPSByZXF1aXJlKCcuL0NvbmNlcHQnKTtcbmxldCB7QVBJLCByZXBsYWNlVmFyc30gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtDT05DRVBUU19QQVRILCBDT05DRVBUX1BBVEgsIENPTkNFUFRfU0VBUkNIX1BBVEh9ID0gQVBJO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdENvbmNlcHR9ID0gcmVxdWlyZSgnLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsIGNoZWNrVHlwZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb2xsZWN0aW9uIG9mIGNvbmNlcHRzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgQ29uY2VwdHMge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCByYXdEYXRhID0gW10pIHtcbiAgICB0aGlzLl9jb25maWcgPSBfY29uZmlnO1xuICAgIHRoaXMucmF3RGF0YSA9IHJhd0RhdGE7XG4gICAgcmF3RGF0YS5mb3JFYWNoKChjb25jZXB0RGF0YSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXNbaW5kZXhdID0gbmV3IENvbmNlcHQodGhpcy5fY29uZmlnLCBjb25jZXB0RGF0YSk7XG4gICAgfSk7XG4gICAgdGhpcy5sZW5ndGggPSByYXdEYXRhLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0IGFsbCB0aGUgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgICBAcGFyYW0ge251bWJlcn0gICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgICBAcGFyYW0ge251bWJlcn0gICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbGlzdChvcHRpb25zID0ge3BhZ2U6IDEsIHBlclBhZ2U6IDIwfSkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7XG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICdwYWdlJzogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgJ3Blcl9wYWdlJzogb3B0aW9ucy5wZXJQYWdlLFxuICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgQ29uY2VwdHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHRzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGlzdCBhIHNpbmdsZSBjb25jZXB0IGdpdmVuIGFuIGlkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgaWQgICAgICAgICAgVGhlIGNvbmNlcHQncyBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHQsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBDb25jZXB0IGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhDT05DRVBUX1BBVEgsIFtpZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHQodGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHQpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0IG9mIGNvbmNlcHRzIGdpdmVuIGFuIGlkIGFuZCBuYW1lXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgIGNvbmNlcHRzICAgICAgIENhbiBiZSBhIHNpbmdsZSBtZWRpYSBvYmplY3Qgb3IgYW4gYXJyYXkgb2YgbWVkaWEgb2JqZWN0c1xuICAgKiAgIEBwYXJhbSAge29iamVjdHxzdHJpbmd9ICAgIGNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgIElmIHN0cmluZywgdGhpcyBpcyBhc3N1bWVkIHRvIGJlIHRoZSBjb25jZXB0IGlkLiBPdGhlcndpc2UsIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlc1xuICAgKiAgICAgQHBhcmFtICB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgVGhlIG5ldyBjb25jZXB0J3MgaWQgKFJlcXVpcmVkKVxuICAgKiAgICAgQHBhcmFtICB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0Lm5hbWUgICAgVGhlIG5ldyBjb25jZXB0J3MgbmFtZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9ICAgICAgICAgICAgIEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgY3JlYXRlKGNvbmNlcHRzID0gW10pIHtcbiAgICBpZiAoY2hlY2tUeXBlKC8oT2JqZWN0fFN0cmluZykvLCBjb25jZXB0cykpIHtcbiAgICAgIGNvbmNlcHRzID0gW2NvbmNlcHRzXTtcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICAnY29uY2VwdHMnOiBjb25jZXB0cy5tYXAoZm9ybWF0Q29uY2VwdClcbiAgICB9O1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgZGF0YSwge2hlYWRlcnN9KVxuICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShuZXcgQ29uY2VwdHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHRzKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggZm9yIGEgY29uY2VwdCBnaXZlbiBhIG5hbWUuIEEgd2lsZGNhcmQgY2FuIGJlIGdpdmVuIChleGFtcGxlOiBUaGUgbmFtZSBcImJvKlwiIHdpbGwgbWF0Y2ggd2l0aCBcImJvYXRcIiBhbmQgXCJib3dcIiBnaXZlbiB0aG9zZSBjb25jZXB0cyBleGlzdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICAgbmFtZSAgVGhlIG5hbWUgb2YgdGhlIGNvbmNlcHQgdG8gc2VhcmNoIGZvclxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgc2VhcmNoKG5hbWUsIGxhbmd1YWdlID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUX1NFQVJDSF9QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICBsZXQgcGFyYW1zID0ge1xuICAgICAgICAnY29uY2VwdF9xdWVyeSc6IHtuYW1lLCBsYW5ndWFnZX1cbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgcGFyYW1zLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5jb25jZXB0cykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgIGNvbmNlcHRzICAgICAgIENhbiBiZSBhIHNpbmdsZSBjb25jZXB0IG9iamVjdCBvciBhbiBhcnJheSBvZiBjb25jZXB0IG9iamVjdHNcbiAgICogICBAcGFyYW0gIHtvYmplY3R9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQgICAgICAgICBBIGNvbmNlcHQgb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzXG4gICAqICAgICBAcGFyYW0gIHtvYmplY3R9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICBUaGUgY29uY2VwdCdzIGlkIChSZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSAge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC5uYW1lICAgIFRoZSBjb25jZXB0J3MgbmV3IG5hbWVcbiAgICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgW2FjdGlvbj1vdmVyd3JpdGVdICBUaGUgYWN0aW9uIHRvIHVzZSBmb3IgdGhlIFBBVENIXG4gICAqIEByZXR1cm4ge1Byb21pc2UoQ29uY2VwdHMsIGVycm9yKX0gICAgICAgICAgICAgQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBDb25jZXB0cyBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB1cGRhdGUoY29uY2VwdHMgPSBbXSwgYWN0aW9uID0gJ292ZXJ3cml0ZScpIHtcbiAgICBpZiAoIWNoZWNrVHlwZSgvQXJyYXkvLCBjb25jZXB0cykpIHtcbiAgICAgIGNvbmNlcHRzID0gW2NvbmNlcHRzXTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIGNvbmNlcHRzLFxuICAgICAgYWN0aW9uXG4gICAgfTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIGhlYWRlcnMgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7IGhlYWRlcnMgfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5jb25jZXB0cykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uY2VwdHM7XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Concepts.js","/")
    },{"./Concept":47,"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35}],49:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var Concepts = require('./Concepts');
    var Regions = require('./Regions');
    
    var _require = require('./constants'),
        API = _require.API;
    
    var INPUTS_PATH = API.INPUTS_PATH;
    
    /**
     * class representing an input
     * @class
     */
    
    var Input = function () {
      function Input(_config, data) {
        _classCallCheck(this, Input);
    
        this.id = data.id;
        this.createdAt = data.created_at || data.createdAt;
        this.imageUrl = data.data.image.url;
        this.concepts = new Concepts(_config, data.data.concepts);
        this.regions = new Regions(_config, data.data.regions || []);
        this.score = data.score;
        this.metadata = data.data.metadata;
        if (data.data.geo && data.data.geo['geo_point']) {
          this.geo = { geoPoint: data.data.geo['geo_point'] };
        }
        this.rawData = data;
        this._config = _config;
      }
    
      /**
       * Merge concepts to an input
       * @param {object[]}         concepts    Object with keys explained below:
       *   @param {object}           concepts[].concept
       *     @param {string}           concepts[].concept.id        The concept id (required)
       *     @param {boolean}          concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
       * @param {object}           metadata                      Object with key values to attach to the input (optional)
       * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
       */
    
    
      _createClass(Input, [{
        key: 'mergeConcepts',
        value: function mergeConcepts(concepts, metadata) {
          return this._update('merge', concepts, metadata);
        }
    
        /**
         * Delete concept from an input
         * @param {object[]}         concepts    Object with keys explained below:
         *   @param {object}           concepts[].concept
         *     @param {string}           concepts[].concept.id        The concept id (required)
         *     @param {boolean}          concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @param {object}           metadata                      Object with key values to attach to the input (optional)
         * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
         */
    
      }, {
        key: 'deleteConcepts',
        value: function deleteConcepts(concepts, metadata) {
          return this._update('remove', concepts, metadata);
        }
    
        /**
         * Overwrite inputs
         * @param {object[]}         concepts                      Array of object with keys explained below:
         *   @param {object}           concepts[].concept
         *     @param {string}           concepts[].concept.id         The concept id (required)
         *     @param {boolean}          concepts[].concept.value      Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @param {object}           metadata                      Object with key values to attach to the input (optional)
         * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
         */
    
      }, {
        key: 'overwriteConcepts',
        value: function overwriteConcepts(concepts, metadata) {
          return this._update('overwrite', concepts, metadata);
        }
      }, {
        key: '_update',
        value: function _update(action) {
          var concepts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
          var metadata = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    
          var url = '' + this._config.basePath + INPUTS_PATH;
          var inputData = {};
          if (concepts.length) {
            inputData.concepts = concepts;
          }
          if (metadata !== null) {
            inputData.metadata = metadata;
          }
          var data = {
            action: action,
            inputs: [{
              id: this.id,
              data: inputData
            }]
          };
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              return axios.patch(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Input(response.data.input));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }]);
    
      return Input;
    }();
    
    ;
    
    module.exports = Input;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIklucHV0LmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkNvbmNlcHRzIiwiUmVnaW9ucyIsIkFQSSIsIklOUFVUU19QQVRIIiwiSW5wdXQiLCJfY29uZmlnIiwiZGF0YSIsImlkIiwiY3JlYXRlZEF0IiwiY3JlYXRlZF9hdCIsImltYWdlVXJsIiwiaW1hZ2UiLCJ1cmwiLCJjb25jZXB0cyIsInJlZ2lvbnMiLCJzY29yZSIsIm1ldGFkYXRhIiwiZ2VvIiwiZ2VvUG9pbnQiLCJyYXdEYXRhIiwiX3VwZGF0ZSIsImFjdGlvbiIsImJhc2VQYXRoIiwiaW5wdXREYXRhIiwibGVuZ3RoIiwiaW5wdXRzIiwid3JhcFRva2VuIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicGF0Y2giLCJ0aGVuIiwicmVzcG9uc2UiLCJpc1N1Y2Nlc3MiLCJpbnB1dCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQUlBLFFBQVFDLFFBQVEsT0FBUixDQUFaO0FBQ0EsSUFBSUMsV0FBV0QsUUFBUSxZQUFSLENBQWY7QUFDQSxJQUFJRSxVQUFVRixRQUFRLFdBQVIsQ0FBZDs7ZUFDWUEsUUFBUSxhQUFSLEM7SUFBUEcsRyxZQUFBQSxHOztJQUNBQyxXLEdBQWVELEcsQ0FBZkMsVzs7QUFFTDs7Ozs7SUFJTUMsSztBQUNKLGlCQUFZQyxPQUFaLEVBQXFCQyxJQUFyQixFQUEyQjtBQUFBOztBQUN6QixTQUFLQyxFQUFMLEdBQVVELEtBQUtDLEVBQWY7QUFDQSxTQUFLQyxTQUFMLEdBQWlCRixLQUFLRyxVQUFMLElBQW1CSCxLQUFLRSxTQUF6QztBQUNBLFNBQUtFLFFBQUwsR0FBZ0JKLEtBQUtBLElBQUwsQ0FBVUssS0FBVixDQUFnQkMsR0FBaEM7QUFDQSxTQUFLQyxRQUFMLEdBQWdCLElBQUliLFFBQUosQ0FBYUssT0FBYixFQUFzQkMsS0FBS0EsSUFBTCxDQUFVTyxRQUFoQyxDQUFoQjtBQUNBLFNBQUtDLE9BQUwsR0FBZSxJQUFJYixPQUFKLENBQVlJLE9BQVosRUFBcUJDLEtBQUtBLElBQUwsQ0FBVVEsT0FBVixJQUFxQixFQUExQyxDQUFmO0FBQ0EsU0FBS0MsS0FBTCxHQUFhVCxLQUFLUyxLQUFsQjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JWLEtBQUtBLElBQUwsQ0FBVVUsUUFBMUI7QUFDQSxRQUFJVixLQUFLQSxJQUFMLENBQVVXLEdBQVYsSUFBaUJYLEtBQUtBLElBQUwsQ0FBVVcsR0FBVixDQUFjLFdBQWQsQ0FBckIsRUFBaUQ7QUFDL0MsV0FBS0EsR0FBTCxHQUFXLEVBQUNDLFVBQVVaLEtBQUtBLElBQUwsQ0FBVVcsR0FBVixDQUFjLFdBQWQsQ0FBWCxFQUFYO0FBQ0Q7QUFDRCxTQUFLRSxPQUFMLEdBQWViLElBQWY7QUFDQSxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7OztrQ0FTY1EsUSxFQUFVRyxRLEVBQVU7QUFDaEMsYUFBTyxLQUFLSSxPQUFMLENBQWEsT0FBYixFQUFzQlAsUUFBdEIsRUFBZ0NHLFFBQWhDLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O21DQVNlSCxRLEVBQVVHLFEsRUFBVTtBQUNqQyxhQUFPLEtBQUtJLE9BQUwsQ0FBYSxRQUFiLEVBQXVCUCxRQUF2QixFQUFpQ0csUUFBakMsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7c0NBU2tCSCxRLEVBQVVHLFEsRUFBVTtBQUNwQyxhQUFPLEtBQUtJLE9BQUwsQ0FBYSxXQUFiLEVBQTBCUCxRQUExQixFQUFvQ0csUUFBcEMsQ0FBUDtBQUNEOzs7NEJBRU9LLE0sRUFBd0M7QUFBQSxVQUFoQ1IsUUFBZ0MsdUVBQXJCLEVBQXFCO0FBQUEsVUFBakJHLFFBQWlCLHVFQUFOLElBQU07O0FBQzlDLFVBQUlKLFdBQVMsS0FBS1AsT0FBTCxDQUFhaUIsUUFBdEIsR0FBaUNuQixXQUFyQztBQUNBLFVBQUlvQixZQUFZLEVBQWhCO0FBQ0EsVUFBSVYsU0FBU1csTUFBYixFQUFxQjtBQUNuQkQsa0JBQVVWLFFBQVYsR0FBcUJBLFFBQXJCO0FBQ0Q7QUFDRCxVQUFJRyxhQUFhLElBQWpCLEVBQXVCO0FBQ3JCTyxrQkFBVVAsUUFBVixHQUFxQkEsUUFBckI7QUFDRDtBQUNELFVBQUlWLE9BQU87QUFDVGUsc0JBRFM7QUFFVEksZ0JBQVEsQ0FDTjtBQUNFbEIsY0FBSSxLQUFLQSxFQURYO0FBRUVELGdCQUFNaUI7QUFGUixTQURNO0FBRkMsT0FBWDtBQVNBLGFBQU9HLFVBQVUsS0FBS3JCLE9BQWYsRUFBd0IsVUFBQ3NCLE9BQUQsRUFBYTtBQUMxQyxlQUFPLElBQUlDLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsaUJBQU9oQyxNQUFNaUMsS0FBTixDQUFZbkIsR0FBWixFQUFpQk4sSUFBakIsRUFBdUIsRUFBQ3FCLGdCQUFELEVBQXZCLEVBQ0pLLElBREksQ0FDQyxVQUFDQyxRQUFELEVBQWM7QUFDbEIsZ0JBQUlDLFVBQVVELFFBQVYsQ0FBSixFQUF5QjtBQUN2Qkosc0JBQVEsSUFBSXpCLEtBQUosQ0FBVTZCLFNBQVMzQixJQUFULENBQWM2QixLQUF4QixDQUFSO0FBQ0QsYUFGRCxNQUVPO0FBQ0xMLHFCQUFPRyxRQUFQO0FBQ0Q7QUFDRixXQVBJLEVBT0ZILE1BUEUsQ0FBUDtBQVFELFNBVE0sQ0FBUDtBQVVELE9BWE0sQ0FBUDtBQVlEOzs7Ozs7QUFFSDs7QUFFQU0sT0FBT0MsT0FBUCxHQUFpQmpDLEtBQWpCIiwiZmlsZSI6IklucHV0LmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCBDb25jZXB0cyA9IHJlcXVpcmUoJy4vQ29uY2VwdHMnKTtcbmxldCBSZWdpb25zID0gcmVxdWlyZSgnLi9SZWdpb25zJyk7XG5sZXQge0FQSX0gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtJTlBVVFNfUEFUSH0gPSBBUEk7XG5cbi8qKlxuICogY2xhc3MgcmVwcmVzZW50aW5nIGFuIGlucHV0XG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgSW5wdXQge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5jcmVhdGVkQXQgPSBkYXRhLmNyZWF0ZWRfYXQgfHwgZGF0YS5jcmVhdGVkQXQ7XG4gICAgdGhpcy5pbWFnZVVybCA9IGRhdGEuZGF0YS5pbWFnZS51cmw7XG4gICAgdGhpcy5jb25jZXB0cyA9IG5ldyBDb25jZXB0cyhfY29uZmlnLCBkYXRhLmRhdGEuY29uY2VwdHMpO1xuICAgIHRoaXMucmVnaW9ucyA9IG5ldyBSZWdpb25zKF9jb25maWcsIGRhdGEuZGF0YS5yZWdpb25zIHx8IFtdKTtcbiAgICB0aGlzLnNjb3JlID0gZGF0YS5zY29yZTtcbiAgICB0aGlzLm1ldGFkYXRhID0gZGF0YS5kYXRhLm1ldGFkYXRhO1xuICAgIGlmIChkYXRhLmRhdGEuZ2VvICYmIGRhdGEuZGF0YS5nZW9bJ2dlb19wb2ludCddKSB7XG4gICAgICB0aGlzLmdlbyA9IHtnZW9Qb2ludDogZGF0YS5kYXRhLmdlb1snZ2VvX3BvaW50J119O1xuICAgIH1cbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY29uY2VwdHMgdG8gYW4gaW5wdXRcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBjb25jZXB0cyAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgIFRoZSBjb25jZXB0IGlkIChyZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIG1ldGFkYXRhICAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGtleSB2YWx1ZXMgdG8gYXR0YWNoIHRvIHRoZSBpbnB1dCAob3B0aW9uYWwpXG4gICAqIEByZXR1cm4ge1Byb21pc2UoSW5wdXQsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXQgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbWVyZ2VDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdtZXJnZScsIGNvbmNlcHRzLCBtZXRhZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGNvbmNlcHQgZnJvbSBhbiBpbnB1dFxuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGNvbmNlcHRzICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgbWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5IHZhbHVlcyB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dCBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBkZWxldGVDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdyZW1vdmUnLCBjb25jZXB0cywgbWV0YWRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0ZSBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBjb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBvYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC52YWx1ZSAgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgbWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5IHZhbHVlcyB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dCBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBvdmVyd3JpdGVDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdvdmVyd3JpdGUnLCBjb25jZXB0cywgbWV0YWRhdGEpO1xuICB9XG5cbiAgX3VwZGF0ZShhY3Rpb24sIGNvbmNlcHRzID0gW10sIG1ldGFkYXRhID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtJTlBVVFNfUEFUSH1gO1xuICAgIGxldCBpbnB1dERhdGEgPSB7fTtcbiAgICBpZiAoY29uY2VwdHMubGVuZ3RoKSB7XG4gICAgICBpbnB1dERhdGEuY29uY2VwdHMgPSBjb25jZXB0cztcbiAgICB9XG4gICAgaWYgKG1ldGFkYXRhICE9PSBudWxsKSB7XG4gICAgICBpbnB1dERhdGEubWV0YWRhdGEgPSBtZXRhZGF0YTtcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICBhY3Rpb24sXG4gICAgICBpbnB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgIGRhdGE6IGlucHV0RGF0YVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfTtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5wYXRjaCh1cmwsIGRhdGEsIHtoZWFkZXJzfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUobmV3IElucHV0KHJlc3BvbnNlLmRhdGEuaW5wdXQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXQ7XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Input.js","/")
    },{"./Concepts":48,"./Regions":55,"./constants":58,"axios":4,"buffer":30,"pBGvAp":35}],50:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var Input = require('./Input');
    
    var _require = require('./constants'),
        API = _require.API,
        ERRORS = _require.ERRORS,
        MAX_BATCH_SIZE = _require.MAX_BATCH_SIZE,
        replaceVars = _require.replaceVars;
    
    var INPUT_PATH = API.INPUT_PATH,
        INPUTS_PATH = API.INPUTS_PATH,
        INPUTS_STATUS_PATH = API.INPUTS_STATUS_PATH,
        SEARCH_PATH = API.SEARCH_PATH,
        SEARCH_FEEDBACK_PATH = API.SEARCH_FEEDBACK_PATH;
    
    var _require2 = require('./utils'),
        wrapToken = _require2.wrapToken,
        formatInput = _require2.formatInput,
        formatImagesSearch = _require2.formatImagesSearch,
        formatConceptsSearch = _require2.formatConceptsSearch;
    
    var _require3 = require('./helpers'),
        isSuccess = _require3.isSuccess,
        checkType = _require3.checkType,
        clone = _require3.clone;
    
    /**
     * class representing a collection of inputs
     * @class
     */
    
    
    var Inputs = function () {
      function Inputs(_config) {
        var _this = this;
    
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Inputs);
    
        this.rawData = rawData;
        rawData.forEach(function (inputData, index) {
          if (inputData.input && inputData.score) {
            inputData.input.score = inputData.score;
            inputData = inputData.input;
          }
          _this[index] = new Input(_this._config, inputData);
        });
        this.length = rawData.length;
        this._config = _config;
      }
    
      /**
       * Get all inputs in app
       * @param {Object}    options  Object with keys explained below: (optional)
       *   @param {Number}    options.page  The page number (optional, default: 1)
       *   @param {Number}    options.perPage  Number of images to return per page (optional, default: 20)
       * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
       */
    
    
      _createClass(Inputs, [{
        key: 'list',
        value: function list() {
          var _this2 = this;
    
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + INPUTS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, {
                headers: headers,
                params: {
                  page: options.page,
                  per_page: options.perPage
                }
              }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Inputs(_this2._config, response.data.inputs));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Adds an input or multiple inputs
         * @param {object|object[]}        inputs                                Can be a single media object or an array of media objects (max of 128 inputs/call; passing > 128 will throw an exception)
         *   @param {object|string}          inputs[].input                        If string, is given, this is assumed to be an image url
         *     @param {string}                 inputs[].input.(url|base64)           Can be a publicly accessibly url or base64 string representing image bytes (required)
         *     @param {string}                 inputs[].input.id                     ID of input (optional)
         *     @param {number[]}               inputs[].input.crop                   An array containing the percent to be cropped from top, left, bottom and right (optional)
         *     @param {boolean}               inputs[].input.allowDuplicateUrl       Whether to allow duplicate URL
         *     @param {object[]}               inputs[].input.metadata               Object with key and values pair (value can be string, array or other objects) to attach to the input (optional)
         *     @param {object}                 inputs[].input.geo                    Object with latitude and longitude coordinates to associate with an input. Can be used in search query as the proximity of an input to a reference point (optional)
         *       @param {number}                 inputs[].input.geo.latitude           +/- latitude val of geodata
         *       @param {number}                 inputs[].input.geo.longitude          +/- longitude val of geodata
         *     @param {object[]}               inputs[].input.concepts               An array of concepts to attach to media object (optional)
         *       @param {object|string}          inputs[].input.concepts[].concept     If string, is given, this is assumed to be concept id with value equals true
         *         @param {string}                 inputs[].input.concepts[].concept.id          The concept id (required)
         *         @param {boolean}                inputs[].input.concepts[].concept.value       Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
         */
    
      }, {
        key: 'create',
        value: function create(inputs) {
          var _this3 = this;
    
          if (checkType(/(String|Object)/, inputs)) {
            inputs = [inputs];
          }
          var url = '' + this._config.basePath + INPUTS_PATH;
          if (inputs.length > MAX_BATCH_SIZE) {
            throw ERRORS.MAX_INPUTS;
          }
          return wrapToken(this._config, function (headers) {
            var data = {
              inputs: inputs.map(formatInput)
            };
            return new Promise(function (resolve, reject) {
              axios.post(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Inputs(_this3._config, response.data.inputs));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Get input by id
         * @param {String}    id  The input id
         * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
         */
    
      }, {
        key: 'get',
        value: function get(id) {
          var _this4 = this;
    
          var url = '' + this._config.basePath + replaceVars(INPUT_PATH, [id]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Input(_this4._config, response.data.input));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Delete an input or a list of inputs by id or all inputs if no id is passed
         * @param {string|string[]}    id           The id of input to delete (optional)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'delete',
        value: function _delete() {
          var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    
          var val = void 0;
          // delete an input
          if (checkType(/String/, id)) {
            var url = '' + this._config.basePath + replaceVars(INPUT_PATH, [id]);
            val = wrapToken(this._config, function (headers) {
              return axios.delete(url, { headers: headers });
            });
          } else {
            val = this._deleteInputs(id);
          }
          return val;
        }
      }, {
        key: '_deleteInputs',
        value: function _deleteInputs() {
          var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    
          var url = '' + this._config.basePath + INPUTS_PATH;
          return wrapToken(this._config, function (headers) {
            var data = id === null ? { delete_all: true } : { ids: id };
            return axios({
              url: url,
              method: 'delete',
              headers: headers,
              data: data
            });
          });
        }
    
        /**
         * Merge concepts to inputs in bulk
         * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
         *   @param {object}           inputs[].input
         *     @param {string}           inputs[].input.id        The id of the input to update
         *     @param {string}           inputs[].input.concepts  Object with keys explained below:
         *       @param {object}           inputs[].input.concepts[].concept
         *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
         *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
         */
    
      }, {
        key: 'mergeConcepts',
        value: function mergeConcepts(inputs) {
          inputs.action = 'merge';
          return this.update(inputs);
        }
    
        /**
         * Delete concepts to inputs in bulk
         * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
         *   @param {object}           inputs[].input
         *     @param {string}           inputs[].input.id                           The id of the input to update
         *     @param {string}           inputs[].input.concepts                     Object with keys explained below:
         *       @param {object}           inputs[].input.concepts[].concept
         *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
         *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
         */
    
      }, {
        key: 'deleteConcepts',
        value: function deleteConcepts(inputs) {
          inputs.action = 'remove';
          return this.update(inputs);
        }
    
        /**
         * Overwrite inputs in bulk
         * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
         *   @param {object}           inputs[].input
         *     @param {string}           inputs[].input.id                           The id of the input to update
         *     @param {string}           inputs[].input.concepts                     Object with keys explained below:
         *       @param {object}           inputs[].input.concepts[].concept
         *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
         *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
         */
    
      }, {
        key: 'overwriteConcepts',
        value: function overwriteConcepts(inputs) {
          inputs.action = 'overwrite';
          return this.update(inputs);
        }
    
        /**
         * @param {object[]}         inputs    List of inputs to update (max of 128 inputs/call; passing > 128 will throw an exception)
         *   @param {object}           inputs[].input
         *     @param {string}           inputs[].input.id                           The id of the input to update
         *     @param {object}           inputs[].input.metadata                     Object with key values to attach to the input (optional)
         *     @param {object}           inputs[].input.geo                          Object with latitude and longitude coordinates to associate with an input. Can be used in search query as the proximity of an input to a reference point (optional)
         *       @param {number}           inputs[].input.geo.latitude                 +/- latitude val of geodata
         *       @param {number}           inputs[].input.geo.longitude                +/- longitude val of geodata
         *     @param {string}           inputs[].input.concepts                     Object with keys explained below (optional):
         *       @param {object}           inputs[].input.concepts[].concept
         *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
         *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
         * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
         */
    
      }, {
        key: 'update',
        value: function update(inputs) {
          var _this5 = this;
    
          var url = '' + this._config.basePath + INPUTS_PATH;
          var inputsList = Array.isArray(inputs) ? inputs : [inputs];
          if (inputsList.length > MAX_BATCH_SIZE) {
            throw ERRORS.MAX_INPUTS;
          }
          var data = {
            action: inputs.action,
            inputs: inputsList.map(function (input) {
              return formatInput(input, false);
            })
          };
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.patch(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Inputs(_this5._config, response.data.inputs));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Search for inputs or outputs based on concepts or images
         *   @param {object[]}               queries          List of all predictions to match with
         *     @param {object}                 queries[].concept            An object with the following keys:
         *       @param {string}                 queries[].concept.id          The concept id
         *       @param {string}                 queries[].concept.type        Search over 'input' to get input matches to criteria or 'output' to get inputs that are visually similar to the criteria (default: 'output')
         *       @param {string}                 queries[].concept.name        The concept name
         *       @param {boolean}                queries[].concept.value       Indicates whether or not the term should match with the prediction returned (default: true)
         *     @param {object}                 queries[].input              An image object that contains the following keys:
         *       @param {string}                 queries[].input.id            The input id
         *       @param {string}                 queries[].input.type          Search over 'input' to get input matches to criteria or 'output' to get inputs that are visually similar to the criteria (default: 'output')
         *       @param {string}                 queries[].input.(base64|url)  Can be a publicly accessibly url or base64 string representing image bytes (required)
         *       @param {number[]}               queries[].input.crop          An array containing the percent to be cropped from top, left, bottom and right (optional)
         *       @param {object}                 queries[].input.metadata      An object with key and value specified by user to refine search with (optional)
         * @param {Object}                   options       Object with keys explained below: (optional)
         *    @param {Number}                  options.page          The page number (optional, default: 1)
         *    @param {Number}                  options.perPage       Number of images to return per page (optional, default: 20)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'search',
        value: function search() {
          var queries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
          var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { page: 1, perPage: 20 };
    
          var formattedAnds = [];
          var url = '' + this._config.basePath + SEARCH_PATH;
          var data = {
            query: {
              ands: []
            },
            pagination: {
              page: options.page,
              per_page: options.perPage
            }
          };
    
          if (!Array.isArray(queries)) {
            queries = [queries];
          }
          if (queries.length > 0) {
            queries.forEach(function (query) {
              if (query.input) {
                formattedAnds = formattedAnds.concat(formatImagesSearch(query.input));
              } else if (query.concept) {
                formattedAnds = formattedAnds.concat(formatConceptsSearch(query.concept));
              }
            });
            data.query.ands = formattedAnds;
          }
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  var _data = clone(response.data);
                  _data.rawData = clone(response.data);
                  resolve(_data);
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }, {
        key: 'searchFeedback',
        value: function searchFeedback(inputID, searchID, endUserID, sessionID) {
          var url = '' + this._config.basePath + SEARCH_FEEDBACK_PATH;
          var body = {
            input: {
              id: inputID,
              feedback_info: {
                event_type: 'search_click',
                search_id: searchID,
                end_user_id: endUserID,
                session_id: sessionID
              }
            }
          };
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, body, {
                headers: headers
              }).then(function (_ref) {
                var data = _ref.data;
    
                var d = clone(data);
                d.rawData = clone(data);
                resolve(d);
              }, reject);
            });
          });
        }
    
        /**
         * Get inputs status (number of uploaded, in process or failed inputs)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getStatus',
        value: function getStatus() {
          var url = '' + this._config.basePath + INPUTS_STATUS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  var data = clone(response.data);
                  data.rawData = clone(response.data);
                  resolve(data);
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }]);
    
      return Inputs;
    }();
    
    ;
    
    module.exports = Inputs;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIklucHV0cy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJJbnB1dCIsIkFQSSIsIkVSUk9SUyIsIk1BWF9CQVRDSF9TSVpFIiwicmVwbGFjZVZhcnMiLCJJTlBVVF9QQVRIIiwiSU5QVVRTX1BBVEgiLCJJTlBVVFNfU1RBVFVTX1BBVEgiLCJTRUFSQ0hfUEFUSCIsIlNFQVJDSF9GRUVEQkFDS19QQVRIIiwid3JhcFRva2VuIiwiZm9ybWF0SW5wdXQiLCJmb3JtYXRJbWFnZXNTZWFyY2giLCJmb3JtYXRDb25jZXB0c1NlYXJjaCIsImlzU3VjY2VzcyIsImNoZWNrVHlwZSIsImNsb25lIiwiSW5wdXRzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwiaW5wdXREYXRhIiwiaW5kZXgiLCJpbnB1dCIsInNjb3JlIiwibGVuZ3RoIiwib3B0aW9ucyIsInBhZ2UiLCJwZXJQYWdlIiwidXJsIiwiYmFzZVBhdGgiLCJoZWFkZXJzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXQiLCJwYXJhbXMiLCJwZXJfcGFnZSIsInRoZW4iLCJyZXNwb25zZSIsImRhdGEiLCJpbnB1dHMiLCJNQVhfSU5QVVRTIiwibWFwIiwicG9zdCIsImlkIiwidmFsIiwiZGVsZXRlIiwiX2RlbGV0ZUlucHV0cyIsImRlbGV0ZV9hbGwiLCJpZHMiLCJtZXRob2QiLCJhY3Rpb24iLCJ1cGRhdGUiLCJpbnB1dHNMaXN0IiwiQXJyYXkiLCJpc0FycmF5IiwicGF0Y2giLCJxdWVyaWVzIiwiZm9ybWF0dGVkQW5kcyIsInF1ZXJ5IiwiYW5kcyIsInBhZ2luYXRpb24iLCJjb25jYXQiLCJjb25jZXB0IiwiaW5wdXRJRCIsInNlYXJjaElEIiwiZW5kVXNlcklEIiwic2Vzc2lvbklEIiwiYm9keSIsImZlZWRiYWNrX2luZm8iLCJldmVudF90eXBlIiwic2VhcmNoX2lkIiwiZW5kX3VzZXJfaWQiLCJzZXNzaW9uX2lkIiwiZCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFw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QSxJQUFVOztBQUNsQixnQkFBTW1DLElBQUkzRCxNQUFNd0IsSUFBTixDQUFWO0FBQ0FtQyxjQUFFeEQsT0FBRixHQUFZSCxNQUFNd0IsSUFBTixDQUFaO0FBQ0FQLG9CQUFRMEMsQ0FBUjtBQUNELFdBTkQsRUFNR3pDLE1BTkg7QUFPRCxTQVJNLENBQVA7QUFTRCxPQVZNLENBQVA7QUFXRDs7QUFFRDs7Ozs7OztnQ0FJWTtBQUNWLFVBQUlMLFdBQVMsS0FBS1gsT0FBTCxDQUFhWSxRQUF0QixHQUFpQ3ZCLGtCQUFyQztBQUNBLGFBQU9HLFVBQVUsS0FBS1EsT0FBZixFQUF3QixVQUFDYSxPQUFELEVBQWE7QUFDMUMsZUFBTyxJQUFJQyxPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDcEMsZ0JBQU1xQyxHQUFOLENBQVVOLEdBQVYsRUFBZSxFQUFDRSxnQkFBRCxFQUFmLEVBQ0dPLElBREgsQ0FDUSxVQUFDQyxRQUFELEVBQWM7QUFDbEIsZ0JBQUl6QixVQUFVeUIsUUFBVixDQUFKLEVBQXlCO0FBQ3ZCLGtCQUFJQyxPQUFPeEIsTUFBTXVCLFNBQVNDLElBQWYsQ0FBWDtBQUNBQSxtQkFBS3JCLE9BQUwsR0FBZUgsTUFBTXVCLFNBQVNDLElBQWYsQ0FBZjtBQUNBUCxzQkFBUU8sSUFBUjtBQUNELGFBSkQsTUFJTztBQUNMTixxQkFBT0ssUUFBUDtBQUNEO0FBQ0YsV0FUSCxFQVNLTCxNQVRMO0FBVUQsU0FYTSxDQUFQO0FBWUQsT0FiTSxDQUFQO0FBY0Q7Ozs7OztBQUVIOztBQUVBMEMsT0FBT0MsT0FBUCxHQUFpQjVELE1BQWpCIiwiZmlsZSI6IklucHV0cy5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJyk7XG5sZXQgSW5wdXQgPSByZXF1aXJlKCcuL0lucHV0Jyk7XG5sZXQge0FQSSwgRVJST1JTLCBNQVhfQkFUQ0hfU0laRSwgcmVwbGFjZVZhcnN9ID0gcmVxdWlyZSgnLi9jb25zdGFudHMnKTtcbmxldCB7SU5QVVRfUEFUSCwgSU5QVVRTX1BBVEgsIElOUFVUU19TVEFUVVNfUEFUSCwgU0VBUkNIX1BBVEgsIFNFQVJDSF9GRUVEQkFDS19QQVRIfSA9IEFQSTtcbmxldCB7d3JhcFRva2VuLCBmb3JtYXRJbnB1dCwgZm9ybWF0SW1hZ2VzU2VhcmNoLCBmb3JtYXRDb25jZXB0c1NlYXJjaH0gPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5sZXQge2lzU3VjY2VzcywgY2hlY2tUeXBlLCBjbG9uZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb2xsZWN0aW9uIG9mIGlucHV0c1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIElucHV0cyB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIHJhd0RhdGEgPSBbXSkge1xuICAgIHRoaXMucmF3RGF0YSA9IHJhd0RhdGE7XG4gICAgcmF3RGF0YS5mb3JFYWNoKChpbnB1dERhdGEsIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5wdXREYXRhLmlucHV0ICYmIGlucHV0RGF0YS5zY29yZSkge1xuICAgICAgICBpbnB1dERhdGEuaW5wdXQuc2NvcmUgPSBpbnB1dERhdGEuc2NvcmU7XG4gICAgICAgIGlucHV0RGF0YSA9IGlucHV0RGF0YS5pbnB1dDtcbiAgICAgIH1cbiAgICAgIHRoaXNbaW5kZXhdID0gbmV3IElucHV0KHRoaXMuX2NvbmZpZywgaW5wdXREYXRhKTtcbiAgICB9KTtcbiAgICB0aGlzLmxlbmd0aCA9IHJhd0RhdGEubGVuZ3RoO1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBpbnB1dHMgaW4gYXBwXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICBvcHRpb25zICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICBvcHRpb25zLnBhZ2UgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtOdW1iZXJ9ICAgIG9wdGlvbnMucGVyUGFnZSAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGxpc3Qob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7SU5QVVRTX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgcGFnZTogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgcGVyX3BhZ2U6IG9wdGlvbnMucGVyUGFnZSxcbiAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IElucHV0cyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEuaW5wdXRzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiBpbnB1dCBvciBtdWx0aXBsZSBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgICBpbnB1dHMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENhbiBiZSBhIHNpbmdsZSBtZWRpYSBvYmplY3Qgb3IgYW4gYXJyYXkgb2YgbWVkaWEgb2JqZWN0cyAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdHxzdHJpbmd9ICAgICAgICAgIGlucHV0c1tdLmlucHV0ICAgICAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nLCBpcyBnaXZlbiwgdGhpcyBpcyBhc3N1bWVkIHRvIGJlIGFuIGltYWdlIHVybFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC4odXJsfGJhc2U2NCkgICAgICAgICAgIENhbiBiZSBhIHB1YmxpY2x5IGFjY2Vzc2libHkgdXJsIG9yIGJhc2U2NCBzdHJpbmcgcmVwcmVzZW50aW5nIGltYWdlIGJ5dGVzIChyZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuaWQgICAgICAgICAgICAgICAgICAgICBJRCBvZiBpbnB1dCAob3B0aW9uYWwpXG4gICAqICAgICBAcGFyYW0ge251bWJlcltdfSAgICAgICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNyb3AgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgY29udGFpbmluZyB0aGUgcGVyY2VudCB0byBiZSBjcm9wcGVkIGZyb20gdG9wLCBsZWZ0LCBib3R0b20gYW5kIHJpZ2h0IChvcHRpb25hbClcbiAgICogICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5hbGxvd0R1cGxpY2F0ZVVybCAgICAgICBXaGV0aGVyIHRvIGFsbG93IGR1cGxpY2F0ZSBVUkxcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQubWV0YWRhdGEgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXkgYW5kIHZhbHVlcyBwYWlyICh2YWx1ZSBjYW4gYmUgc3RyaW5nLCBhcnJheSBvciBvdGhlciBvYmplY3RzKSB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuZ2VvICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBsYXRpdHVkZSBhbmQgbG9uZ2l0dWRlIGNvb3JkaW5hdGVzIHRvIGFzc29jaWF0ZSB3aXRoIGFuIGlucHV0LiBDYW4gYmUgdXNlZCBpbiBzZWFyY2ggcXVlcnkgYXMgdGhlIHByb3hpbWl0eSBvZiBhbiBpbnB1dCB0byBhIHJlZmVyZW5jZSBwb2ludCAob3B0aW9uYWwpXG4gICAqICAgICAgIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuZ2VvLmxhdGl0dWRlICAgICAgICAgICArLy0gbGF0aXR1ZGUgdmFsIG9mIGdlb2RhdGFcbiAgICogICAgICAgQHBhcmFtIHtudW1iZXJ9ICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8ubG9uZ2l0dWRlICAgICAgICAgICsvLSBsb25naXR1ZGUgdmFsIG9mIGdlb2RhdGFcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICBBbiBhcnJheSBvZiBjb25jZXB0cyB0byBhdHRhY2ggdG8gbWVkaWEgb2JqZWN0IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQgICAgIElmIHN0cmluZywgaXMgZ2l2ZW4sIHRoaXMgaXMgYXNzdW1lZCB0byBiZSBjb25jZXB0IGlkIHdpdGggdmFsdWUgZXF1YWxzIHRydWVcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgICAgV2hldGhlciBvciBub3QgdGhlIGlucHV0IGlzIGEgcG9zaXRpdmUgKHRydWUpIG9yIG5lZ2F0aXZlIChmYWxzZSkgZXhhbXBsZSBvZiB0aGUgY29uY2VwdCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGNyZWF0ZShpbnB1dHMpIHtcbiAgICBpZiAoY2hlY2tUeXBlKC8oU3RyaW5nfE9iamVjdCkvLCBpbnB1dHMpKSB7XG4gICAgICBpbnB1dHMgPSBbaW5wdXRzXTtcbiAgICB9XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke0lOUFVUU19QQVRIfWA7XG4gICAgaWYgKGlucHV0cy5sZW5ndGggPiBNQVhfQkFUQ0hfU0laRSkge1xuICAgICAgdGhyb3cgRVJST1JTLk1BWF9JTlBVVFM7XG4gICAgfVxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IGRhdGEgPSB7XG4gICAgICAgIGlucHV0czogaW5wdXRzLm1hcChmb3JtYXRJbnB1dClcbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgZGF0YSwge2hlYWRlcnN9KVxuICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShuZXcgSW5wdXRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5pbnB1dHMpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBpbnB1dCBieSBpZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgaWQgIFRoZSBpbnB1dCBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0LCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIElucHV0IG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhJTlBVVF9QQVRILCBbaWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyBJbnB1dCh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEuaW5wdXQpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYW4gaW5wdXQgb3IgYSBsaXN0IG9mIGlucHV0cyBieSBpZCBvciBhbGwgaW5wdXRzIGlmIG5vIGlkIGlzIHBhc3NlZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gICAgaWQgICAgICAgICAgIFRoZSBpZCBvZiBpbnB1dCB0byBkZWxldGUgKG9wdGlvbmFsKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZGVsZXRlKGlkID0gbnVsbCkge1xuICAgIGxldCB2YWw7XG4gICAgLy8gZGVsZXRlIGFuIGlucHV0XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgaWQpKSB7XG4gICAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoSU5QVVRfUEFUSCwgW2lkXSl9YDtcbiAgICAgIHZhbCA9IHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5kZWxldGUodXJsLCB7aGVhZGVyc30pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbCA9IHRoaXMuX2RlbGV0ZUlucHV0cyhpZCk7XG4gICAgfVxuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBfZGVsZXRlSW5wdXRzKGlkID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtJTlBVVFNfUEFUSH1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IGRhdGEgPSBpZCA9PT0gbnVsbCA/IHtkZWxldGVfYWxsOiB0cnVlfSA6XG4gICAgICAgIHtpZHM6IGlkfTtcbiAgICAgIHJldHVybiBheGlvcyh7XG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnZGVsZXRlJyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgZGF0YVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY29uY2VwdHMgdG8gaW5wdXRzIGluIGJ1bGtcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBpbnB1dHMgICAgTGlzdCBvZiBjb25jZXB0cyB0byB1cGRhdGUgKG1heCBvZiAxMjggaW5wdXRzL2NhbGw7IHBhc3NpbmcgPiAxMjggd2lsbCB0aHJvdyBhbiBleGNlcHRpb24pXG4gICAqICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5pZCAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEByZXR1cm4ge1Byb21pc2UoSW5wdXRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIElucHV0cyBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBtZXJnZUNvbmNlcHRzKGlucHV0cykge1xuICAgIGlucHV0cy5hY3Rpb24gPSAnbWVyZ2UnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBjb25jZXB0cyB0byBpbnB1dHMgaW4gYnVsa1xuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGlucHV0cyAgICBMaXN0IG9mIGNvbmNlcHRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHRcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0cywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZGVsZXRlQ29uY2VwdHMoaW5wdXRzKSB7XG4gICAgaW5wdXRzLmFjdGlvbiA9ICdyZW1vdmUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0ZSBpbnB1dHMgaW4gYnVsa1xuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGlucHV0cyAgICBMaXN0IG9mIGNvbmNlcHRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHRcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0cywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgb3ZlcndyaXRlQ29uY2VwdHMoaW5wdXRzKSB7XG4gICAgaW5wdXRzLmFjdGlvbiA9ICdvdmVyd3JpdGUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgaW5wdXRzICAgIExpc3Qgb2YgaW5wdXRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQubWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXkgdmFsdWVzIHRvIGF0dGFjaCB0byB0aGUgaW5wdXQgKG9wdGlvbmFsKVxuICAgKiAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8gICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGxhdGl0dWRlIGFuZCBsb25naXR1ZGUgY29vcmRpbmF0ZXMgdG8gYXNzb2NpYXRlIHdpdGggYW4gaW5wdXQuIENhbiBiZSB1c2VkIGluIHNlYXJjaCBxdWVyeSBhcyB0aGUgcHJveGltaXR5IG9mIGFuIGlucHV0IHRvIGEgcmVmZXJlbmNlIHBvaW50IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtudW1iZXJ9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8ubGF0aXR1ZGUgICAgICAgICAgICAgICAgICsvLSBsYXRpdHVkZSB2YWwgb2YgZ2VvZGF0YVxuICAgKiAgICAgICBAcGFyYW0ge251bWJlcn0gICAgICAgICAgIGlucHV0c1tdLmlucHV0Lmdlby5sb25naXR1ZGUgICAgICAgICAgICAgICAgKy8tIGxvbmdpdHVkZSB2YWwgb2YgZ2VvZGF0YVxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93IChvcHRpb25hbCk6XG4gICAqICAgICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0XG4gICAqICAgICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgIFRoZSBjb25jZXB0IGlkIChyZXF1aXJlZClcbiAgICogICAgICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC52YWx1ZSAgICAgV2hldGhlciBvciBub3QgdGhlIGlucHV0IGlzIGEgcG9zaXRpdmUgKHRydWUpIG9yIG5lZ2F0aXZlIChmYWxzZSkgZXhhbXBsZSBvZiB0aGUgY29uY2VwdCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIHVwZGF0ZShpbnB1dHMpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7SU5QVVRTX1BBVEh9YDtcbiAgICBsZXQgaW5wdXRzTGlzdCA9IEFycmF5LmlzQXJyYXkoaW5wdXRzKSA/IGlucHV0cyA6IFtpbnB1dHNdO1xuICAgIGlmIChpbnB1dHNMaXN0Lmxlbmd0aCA+IE1BWF9CQVRDSF9TSVpFKSB7XG4gICAgICB0aHJvdyBFUlJPUlMuTUFYX0lOUFVUUztcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICBhY3Rpb246IGlucHV0cy5hY3Rpb24sXG4gICAgICBpbnB1dHM6IGlucHV0c0xpc3QubWFwKChpbnB1dCkgPT4gZm9ybWF0SW5wdXQoaW5wdXQsIGZhbHNlKSlcbiAgICB9O1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7aGVhZGVyc30pXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICByZXNvbHZlKG5ldyBJbnB1dHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmlucHV0cykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoIGZvciBpbnB1dHMgb3Igb3V0cHV0cyBiYXNlZCBvbiBjb25jZXB0cyBvciBpbWFnZXNcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICAgIHF1ZXJpZXMgICAgICAgICAgTGlzdCBvZiBhbGwgcHJlZGljdGlvbnMgdG8gbWF0Y2ggd2l0aFxuICAgKiAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uY29uY2VwdCAgICAgICAgICAgIEFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uY29uY2VwdC5pZCAgICAgICAgICBUaGUgY29uY2VwdCBpZFxuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIHF1ZXJpZXNbXS5jb25jZXB0LnR5cGUgICAgICAgIFNlYXJjaCBvdmVyICdpbnB1dCcgdG8gZ2V0IGlucHV0IG1hdGNoZXMgdG8gY3JpdGVyaWEgb3IgJ291dHB1dCcgdG8gZ2V0IGlucHV0cyB0aGF0IGFyZSB2aXN1YWxseSBzaW1pbGFyIHRvIHRoZSBjcml0ZXJpYSAoZGVmYXVsdDogJ291dHB1dCcpXG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmNvbmNlcHQubmFtZSAgICAgICAgVGhlIGNvbmNlcHQgbmFtZVxuICAgKiAgICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICAgIHF1ZXJpZXNbXS5jb25jZXB0LnZhbHVlICAgICAgIEluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0aGUgdGVybSBzaG91bGQgbWF0Y2ggd2l0aCB0aGUgcHJlZGljdGlvbiByZXR1cm5lZCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0ICAgICAgICAgICAgICBBbiBpbWFnZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LmlkICAgICAgICAgICAgVGhlIGlucHV0IGlkXG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LnR5cGUgICAgICAgICAgU2VhcmNoIG92ZXIgJ2lucHV0JyB0byBnZXQgaW5wdXQgbWF0Y2hlcyB0byBjcml0ZXJpYSBvciAnb3V0cHV0JyB0byBnZXQgaW5wdXRzIHRoYXQgYXJlIHZpc3VhbGx5IHNpbWlsYXIgdG8gdGhlIGNyaXRlcmlhIChkZWZhdWx0OiAnb3V0cHV0JylcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uaW5wdXQuKGJhc2U2NHx1cmwpICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqICAgICAgIEBwYXJhbSB7bnVtYmVyW119ICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LmNyb3AgICAgICAgICAgQW4gYXJyYXkgY29udGFpbmluZyB0aGUgcGVyY2VudCB0byBiZSBjcm9wcGVkIGZyb20gdG9wLCBsZWZ0LCBib3R0b20gYW5kIHJpZ2h0IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uaW5wdXQubWV0YWRhdGEgICAgICBBbiBvYmplY3Qgd2l0aCBrZXkgYW5kIHZhbHVlIHNwZWNpZmllZCBieSB1c2VyIHRvIHJlZmluZSBzZWFyY2ggd2l0aCAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICBvcHRpb25zICAgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OiAob3B0aW9uYWwpXG4gICAqICAgIEBwYXJhbSB7TnVtYmVyfSAgICAgICAgICAgICAgICAgIG9wdGlvbnMucGFnZSAgICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgICBAcGFyYW0ge051bWJlcn0gICAgICAgICAgICAgICAgICBvcHRpb25zLnBlclBhZ2UgICAgICAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIHNlYXJjaChxdWVyaWVzID0gW10sIG9wdGlvbnMgPSB7cGFnZTogMSwgcGVyUGFnZTogMjB9KSB7XG4gICAgbGV0IGZvcm1hdHRlZEFuZHMgPSBbXTtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7U0VBUkNIX1BBVEh9YDtcbiAgICBsZXQgZGF0YSA9IHtcbiAgICAgIHF1ZXJ5OiB7XG4gICAgICAgIGFuZHM6IFtdXG4gICAgICB9LFxuICAgICAgcGFnaW5hdGlvbjoge1xuICAgICAgICBwYWdlOiBvcHRpb25zLnBhZ2UsXG4gICAgICAgIHBlcl9wYWdlOiBvcHRpb25zLnBlclBhZ2VcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHF1ZXJpZXMpKSB7XG4gICAgICBxdWVyaWVzID0gW3F1ZXJpZXNdO1xuICAgIH1cbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyaWVzLmZvckVhY2goZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmlucHV0KSB7XG4gICAgICAgICAgZm9ybWF0dGVkQW5kcyA9IGZvcm1hdHRlZEFuZHMuY29uY2F0KGZvcm1hdEltYWdlc1NlYXJjaChxdWVyeS5pbnB1dCkpO1xuICAgICAgICB9IGVsc2UgaWYgKHF1ZXJ5LmNvbmNlcHQpIHtcbiAgICAgICAgICBmb3JtYXR0ZWRBbmRzID0gZm9ybWF0dGVkQW5kcy5jb25jYXQoZm9ybWF0Q29uY2VwdHNTZWFyY2gocXVlcnkuY29uY2VwdCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRhdGEucXVlcnkuYW5kcyA9IGZvcm1hdHRlZEFuZHM7XG4gICAgfVxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucG9zdCh1cmwsIGRhdGEsIHtoZWFkZXJzfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICAgIGRhdGEucmF3RGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBzZWFyY2hGZWVkYmFjayhpbnB1dElELCBzZWFyY2hJRCwgZW5kVXNlcklELCBzZXNzaW9uSUQpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7U0VBUkNIX0ZFRURCQUNLX1BBVEh9YDtcbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgaWQ6IGlucHV0SUQsXG4gICAgICAgIGZlZWRiYWNrX2luZm86IHtcbiAgICAgICAgICBldmVudF90eXBlOiAnc2VhcmNoX2NsaWNrJyxcbiAgICAgICAgICBzZWFyY2hfaWQ6IHNlYXJjaElELFxuICAgICAgICAgIGVuZF91c2VyX2lkOiBlbmRVc2VySUQsXG4gICAgICAgICAgc2Vzc2lvbl9pZDogc2Vzc2lvbklEXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCBoZWFkZXJzID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBib2R5LCB7XG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKCh7ZGF0YX0pID0+IHtcbiAgICAgICAgICBjb25zdCBkID0gY2xvbmUoZGF0YSk7XG4gICAgICAgICAgZC5yYXdEYXRhID0gY2xvbmUoZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShkKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBpbnB1dHMgc3RhdHVzIChudW1iZXIgb2YgdXBsb2FkZWQsIGluIHByb2Nlc3Mgb3IgZmFpbGVkIGlucHV0cylcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldFN0YXR1cygpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7SU5QVVRTX1NUQVRVU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRzO1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Inputs.js","/")
    },{"./Input":49,"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35}],51:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var ModelVersion = require('./ModelVersion');
    
    var _require = require('./helpers'),
        isSuccess = _require.isSuccess,
        checkType = _require.checkType,
        clone = _require.clone;
    
    var _require2 = require('./constants'),
        API = _require2.API,
        SYNC_TIMEOUT = _require2.SYNC_TIMEOUT,
        replaceVars = _require2.replaceVars,
        STATUS = _require2.STATUS,
        POLLTIME = _require2.POLLTIME;
    
    var MODEL_QUEUED_FOR_TRAINING = STATUS.MODEL_QUEUED_FOR_TRAINING,
        MODEL_TRAINING = STATUS.MODEL_TRAINING;
    
    var _require3 = require('./utils'),
        wrapToken = _require3.wrapToken,
        formatMediaPredict = _require3.formatMediaPredict,
        formatModel = _require3.formatModel,
        formatObjectForSnakeCase = _require3.formatObjectForSnakeCase;
    
    var MODEL_VERSIONS_PATH = API.MODEL_VERSIONS_PATH,
        MODEL_VERSION_PATH = API.MODEL_VERSION_PATH,
        MODELS_PATH = API.MODELS_PATH,
        MODEL_FEEDBACK_PATH = API.MODEL_FEEDBACK_PATH,
        MODEL_VERSION_FEEDBACK_PATH = API.MODEL_VERSION_FEEDBACK_PATH,
        PREDICT_PATH = API.PREDICT_PATH,
        VERSION_PREDICT_PATH = API.VERSION_PREDICT_PATH,
        MODEL_INPUTS_PATH = API.MODEL_INPUTS_PATH,
        MODEL_VERSION_OUTPUT_PATH = API.MODEL_VERSION_OUTPUT_PATH,
        MODEL_OUTPUT_PATH = API.MODEL_OUTPUT_PATH,
        MODEL_VERSION_INPUTS_PATH = API.MODEL_VERSION_INPUTS_PATH,
        MODEL_VERSION_METRICS_PATH = API.MODEL_VERSION_METRICS_PATH;
    
    /**
     * class representing a model
     * @class
     */
    
    var Model = function () {
      function Model(_config, data) {
        _classCallCheck(this, Model);
    
        this._config = _config;
        this.name = data.name;
        this.id = data.id;
        this.createdAt = data.created_at || data.createdAt;
        this.appId = data.app_id || data.appId;
        this.outputInfo = data.output_info || data.outputInfo;
        if (checkType(/(String)/, data.version)) {
          this.modelVersion = {};
          this.versionId = data.version;
        } else {
          if (data.model_version || data.modelVersion || data.version) {
            this.modelVersion = new ModelVersion(this._config, data.model_version || data.modelVersion || data.version);
          }
          this.versionId = (this.modelVersion || {}).id;
        }
        this.rawData = data;
      }
    
      /**
       * Merge concepts to a model
       * @param {object[]}      concepts    List of concept objects with id
       * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
       */
    
    
      _createClass(Model, [{
        key: 'mergeConcepts',
        value: function mergeConcepts() {
          var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    
          var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
          return this.update({ action: 'merge', concepts: conceptsArr });
        }
    
        /**
         * Remove concepts from a model
         * @param {object[]}      concepts    List of concept objects with id
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'deleteConcepts',
        value: function deleteConcepts() {
          var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    
          var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
          return this.update({ action: 'remove', concepts: conceptsArr });
        }
    
        /**
         * Overwrite concepts in a model
         * @param {object[]}      concepts    List of concept objects with id
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'overwriteConcepts',
        value: function overwriteConcepts() {
          var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    
          var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
          return this.update({ action: 'overwrite', concepts: conceptsArr });
        }
    
        /**
         * Start a model evaluation job
         * @return {Promise(ModelVersion, error)} A Promise that is fulfilled with a ModelVersion instance or rejected with an error
         */
    
      }, {
        key: 'runModelEval',
        value: function runModelEval() {
          var _this = this;
    
          var url = '' + this._config.basePath + replaceVars(MODEL_VERSION_METRICS_PATH, [this.id, this.versionId]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, {}, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new ModelVersion(_this._config, response.data.model_version));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Update a model's output config or concepts
         * @param {object}               model                                 An object with any of the following attrs:
         *   @param {string}               name                                  The new name of the model to update with
         *   @param {boolean}              conceptsMutuallyExclusive             Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
         *   @param {boolean}              closedEnvironment                     Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
         *   @param {object[]}             concepts                              An array of concept objects or string
         *     @param {object|string}        concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
         *       @param {string}             concepts[].concept.id                   The id of the concept to attach to the model
         *   @param {object[]}             action                                The action to perform on the given concepts. Possible values are 'merge', 'remove', or 'overwrite'. Default: 'merge'
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'update',
        value: function update(obj) {
          var _this2 = this;
    
          var url = '' + this._config.basePath + MODELS_PATH;
          var modelData = [obj];
          var data = { models: modelData.map(function (m) {
              return formatModel(Object.assign(m, { id: _this2.id }));
            }) };
          if (Array.isArray(obj.concepts)) {
            data['action'] = obj.action || 'merge';
          }
    
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.patch(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Model(_this2._config, response.data.models[0]));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Create a new model version
         * @param {boolean}       sync     If true, this returns after model has completely trained. If false, this immediately returns default api response.
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'train',
        value: function train(sync) {
          var _this3 = this;
    
          var url = '' + this._config.basePath + replaceVars(MODEL_VERSIONS_PATH, [this.id]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, null, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  // Training produces a new model version ID.
                  _this3.versionId = response.data.model.model_version.id;
    
                  if (sync) {
                    var timeStart = Date.now();
                    _this3._pollTrain.bind(_this3)(timeStart, resolve, reject);
                  } else {
                    resolve(new Model(_this3._config, response.data.model));
                  }
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }, {
        key: '_pollTrain',
        value: function _pollTrain(timeStart, resolve, reject) {
          var _this4 = this;
    
          clearTimeout(this.pollTimeout);
          if (Date.now() - timeStart >= SYNC_TIMEOUT) {
            return reject({
              status: 'Error',
              message: 'Sync call timed out'
            });
          }
          this.getOutputInfo().then(function (model) {
            var modelStatusCode = model.modelVersion.status.code.toString();
            if (modelStatusCode === MODEL_QUEUED_FOR_TRAINING || modelStatusCode === MODEL_TRAINING) {
              _this4.pollTimeout = setTimeout(function () {
                return _this4._pollTrain(timeStart, resolve, reject);
              }, POLLTIME);
            } else {
              resolve(model);
            }
          }, reject).catch(reject);
        }
    
        /**
         * Returns model ouputs according to inputs
         * @param {object[]|object|string}       inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
         *    @param {object}                      inputs[].image     Object with keys explained below:
         *       @param {string}                     inputs[].image.(url|base64)   Can be a publicly accessibly url or base64 string representing image bytes (required)
         *       @param {number[]}                   inputs[].image.crop           An array containing the percent to be cropped from top, left, bottom and right (optional)
         * @param {object|string} config An object with keys explained below. If a string is passed instead, it will be treated as the language (backwards compatibility)
         *   @param {string} config.language A string code representing the language to return results in (example: 'zh' for simplified Chinese, 'ru' for Russian, 'ja' for Japanese)
         *   @param {boolean} config.video indicates if the input should be processed as a video
         *   @param {object[]} config.selectConcepts An array of concepts to return. Each object in the array will have a form of {name: <CONCEPT_NAME>} or {id: CONCEPT_ID}
         *   @param {float} config.minValue The minimum confidence threshold that a result must meet. From 0.0 to 1.0
         *   @param {number} config.maxConcepts The maximum number of concepts to return
         * @param {boolean} isVideo  Deprecated: indicates if the input should be processed as a video (default false). Deprecated in favor of using config object
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'predict',
        value: function predict(inputs) {
          var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
          var isVideo = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    
          if (checkType(/String/, config)) {
            console.warn('passing the language as a string is deprecated, consider using the configuration object instead');
            config = {
              language: config
            };
          }
    
          if (isVideo) {
            console.warn('"isVideo" argument is deprecated, consider using the configuration object instead');
            config.video = isVideo;
          }
          var video = config.video || false;
          delete config.video;
          if (checkType(/(Object|String)/, inputs)) {
            inputs = [inputs];
          }
          var url = '' + this._config.basePath + (this.versionId ? replaceVars(VERSION_PREDICT_PATH, [this.id, this.versionId]) : replaceVars(PREDICT_PATH, [this.id]));
          return wrapToken(this._config, function (headers) {
            var params = { inputs: inputs.map(function (input) {
                return formatMediaPredict(input, video ? 'video' : 'image');
              }) };
            if (config && Object.getOwnPropertyNames(config).length > 0) {
              params['model'] = {
                output_info: {
                  output_config: formatObjectForSnakeCase(config)
                }
              };
            }
            return new Promise(function (resolve, reject) {
              axios.post(url, params, { headers: headers }).then(function (response) {
                var data = clone(response.data);
                data.rawData = clone(response.data);
                resolve(data);
              }, reject);
            });
          });
        }
    
        /**
         * Returns a version of the model specified by its id
         * @param {string}     versionId   The model's id
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getVersion',
        value: function getVersion(versionId) {
          // TODO(Rok) MEDIUM: The version ID isn't URI encoded, as opposed to the model ID. This should probably be
          //  consistent - i.e. the same in both cases.
          var url = '' + this._config.basePath + replaceVars(MODEL_VERSION_PATH, [this.id, versionId]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                var data = clone(response.data);
                data.rawData = clone(response.data);
                resolve(data);
              }, reject);
            });
          });
        }
    
        /**
         * Returns a list of versions of the model
         * @param {object}     options     Object with keys explained below: (optional)
         *   @param {number}     options.page        The page number (optional, default: 1)
         *   @param {number}     options.perPage     Number of images to return per page (optional, default: 20)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getVersions',
        value: function getVersions() {
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + replaceVars(MODEL_VERSIONS_PATH, [this.id]);
          return wrapToken(this._config, function (headers) {
            var data = {
              headers: headers,
              params: { 'per_page': options.perPage, 'page': options.page }
            };
            return new Promise(function (resolve, reject) {
              axios.get(url, data).then(function (response) {
                var data = clone(response.data);
                data.rawData = clone(response.data);
                resolve(data);
              }, reject);
            });
          });
        }
    
        /**
         * Returns all the model's output info
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'getOutputInfo',
        value: function getOutputInfo() {
          var _this5 = this;
    
          var url = '' + this._config.basePath + (this.versionId ? replaceVars(MODEL_VERSION_OUTPUT_PATH, [this.id, this.versionId]) : replaceVars(MODEL_OUTPUT_PATH, [this.id]));
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                resolve(new Model(_this5._config, response.data.model));
              }, reject);
            });
          });
        }
    
        /**
         * Returns all the model's inputs
         * @param {object}     options     Object with keys explained below: (optional)
         *   @param {number}     options.page        The page number (optional, default: 1)
         *   @param {number}     options.perPage     Number of images to return per page (optional, default: 20)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getInputs',
        value: function getInputs() {
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + (this.versionId ? replaceVars(MODEL_VERSION_INPUTS_PATH, [this.id, this.versionId]) : replaceVars(MODEL_INPUTS_PATH, [this.id]));
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, {
                params: { 'per_page': options.perPage, 'page': options.page },
                headers: headers
              }).then(function (response) {
                var data = clone(response.data);
                data.rawData = clone(response.data);
                resolve(data);
              }, reject);
            });
          });
        }
    
        /**
         *
         * @param {string} input A string pointing to an image resource. A string must be a url
         * @param {object} config A configuration object consisting of the following required keys
         *   @param {string} config.id The id of the feedback request
         *   @param {object} config.data The feedback data to be sent
         *   @param {object} config.info Meta data related to the feedback request
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'feedback',
        value: function feedback(input, _ref) {
          var id = _ref.id,
              data = _ref.data,
              info = _ref.info;
    
          var url = '' + this._config.basePath + (this.versionId ? replaceVars(MODEL_VERSION_FEEDBACK_PATH, [this.id, this.versionId]) : replaceVars(MODEL_FEEDBACK_PATH, [this.id]));
          var media = formatMediaPredict(input).data;
          info.eventType = 'annotation';
          var body = {
            input: {
              id: id,
              data: Object.assign(media, data),
              'feedback_info': formatObjectForSnakeCase(info)
            }
          };
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, body, {
                headers: headers
              }).then(function (_ref2) {
                var data = _ref2.data;
    
                var d = clone(data);
                d.rawData = clone(data);
                resolve(d);
              }, reject);
            });
          });
        }
      }]);
    
      return Model;
    }();
    
    module.exports = Model;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVsLmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIk1vZGVsVmVyc2lvbiIsImlzU3VjY2VzcyIsImNoZWNrVHlwZSIsImNsb25lIiwiQVBJIiwiU1lOQ19USU1FT1VUIiwicmVwbGFjZVZhcnMiLCJTVEFUVVMiLCJQT0xMVElNRSIsIk1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkciLCJNT0RFTF9UUkFJTklORyIsIndyYXBUb2tlbiIsImZvcm1hdE1lZGlhUHJlZGljdCIsImZvcm1hdE1vZGVsIiwiZm9ybWF0T2JqZWN0Rm9yU25ha2VDYXNlIiwiTU9ERUxfVkVSU0lPTlNfUEFUSCIsIk1PREVMX1ZFUlNJT05fUEFUSCIsIk1PREVMU19QQVRIIiwiTU9ERUxfRkVFREJBQ0tfUEFUSCIsIk1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSCIsIlBSRURJQ1RfUEFUSCIsIlZFUlNJT05fUFJFRElDVF9QQVRIIiwiTU9ERUxfSU5QVVRTX1BBVEgiLCJNT0RFTF9WRVJTSU9OX09VVFBVVF9QQVRIIiwiTU9ERUxfT1VUUFVUX1BBVEgiLCJNT0RFTF9WRVJTSU9OX0lOUFVUU19QQVRIIiwiTU9ERUxfVkVSU0lPTl9NRVRSSUNTX1BBVEgiLCJNb2RlbCIsIl9jb25maWciLCJkYXRhIiwibmFtZSIsImlkIiwiY3JlYXRlZEF0IiwiY3JlYXRlZF9hdCIsImFwcElkIiwiYXBwX2lkIiwib3V0cHV0SW5mbyIsIm91dHB1dF9pbmZvIiwidmVyc2lvbiIsIm1vZGVsVmVyc2lvbiIsInZlcnNpb25JZCIsIm1vZGVsX3ZlcnNpb24iLCJyYXdEYXRhIiwiY29uY2VwdHMiLCJjb25jZXB0c0FyciIsIkFycmF5IiwiaXNBcnJheSIsInVwZGF0ZSIsImFjdGlvbiIsInVybCIsImJhc2VQYXRoIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicG9zdCIsInRoZW4iLCJyZXNwb25zZSIsIm9iaiIsIm1vZGVsRGF0YSIsIm1vZGVscyIsIm1hcCIsIk9iamVjdCIsImFzc2lnbiIsIm0iLCJwYXRjaCIsInN5bmMiLCJtb2RlbCIsInRpbWVTdGFydCIsIkRhdGUiLCJub3ciLCJfcG9sbFRyYWluIiwiYmluZCIsImNsZWFyVGltZW91dCIsInBvbGxUaW1lb3V0Iiwic3RhdHVzIiwibWVzc2FnZSIsImdldE91dHB1dEluZm8iLCJtb2RlbFN0YXR1c0NvZGUiLCJjb2RlIiwidG9TdHJpbmciLCJzZXRUaW1lb3V0IiwiY2F0Y2giLCJpbnB1dHMiLCJjb25maWciLCJpc1ZpZGVvIiwiY29uc29sZSIsIndhcm4iLCJsYW5ndWFnZSIsInZpZGVvIiwicGFyYW1zIiwiaW5wdXQiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwibGVuZ3RoIiwib3V0cHV0X2NvbmZpZyIsImdldCIsIm9wdGlvbnMiLCJwYWdlIiwicGVyUGFnZSIsImluZm8iLCJtZWRpYSIsImV2ZW50VHlwZSIsImJvZHkiLCJkIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBSUEsUUFBUUMsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFJQyxlQUFlRCxRQUFRLGdCQUFSLENBQW5COztlQUNvQ0EsUUFBUSxXQUFSLEM7SUFBL0JFLFMsWUFBQUEsUztJQUFXQyxTLFlBQUFBLFM7SUFBV0MsSyxZQUFBQSxLOztnQkFPdkJKLFFBQVEsYUFBUixDO0lBTEZLLEcsYUFBQUEsRztJQUNBQyxZLGFBQUFBLFk7SUFDQUMsVyxhQUFBQSxXO0lBQ0FDLE0sYUFBQUEsTTtJQUNBQyxRLGFBQUFBLFE7O0lBRUdDLHlCLEdBQTZDRixNLENBQTdDRSx5QjtJQUEyQkMsYyxHQUFrQkgsTSxDQUFsQkcsYzs7Z0JBQzZDWCxRQUFRLFNBQVIsQztJQUF4RVksUyxhQUFBQSxTO0lBQVdDLGtCLGFBQUFBLGtCO0lBQW9CQyxXLGFBQUFBLFc7SUFBYUMsd0IsYUFBQUEsd0I7O0lBRS9DQyxtQixHQVlFWCxHLENBWkZXLG1CO0lBQ0FDLGtCLEdBV0VaLEcsQ0FYRlksa0I7SUFDQUMsVyxHQVVFYixH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T0FESCxHQUNhOUUsS0FEYiIsImZpbGUiOiJNb2RlbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJyk7XG5sZXQgTW9kZWxWZXJzaW9uID0gcmVxdWlyZSgnLi9Nb2RlbFZlcnNpb24nKTtcbmxldCB7aXNTdWNjZXNzLCBjaGVja1R5cGUsIGNsb25lfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IHtcbiAgQVBJLFxuICBTWU5DX1RJTUVPVVQsXG4gIHJlcGxhY2VWYXJzLFxuICBTVEFUVVMsXG4gIFBPTExUSU1FXG59ID0gcmVxdWlyZSgnLi9jb25zdGFudHMnKTtcbmxldCB7TU9ERUxfUVVFVUVEX0ZPUl9UUkFJTklORywgTU9ERUxfVFJBSU5JTkd9ID0gU1RBVFVTO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdE1lZGlhUHJlZGljdCwgZm9ybWF0TW9kZWwsIGZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZX0gPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5sZXQge1xuICBNT0RFTF9WRVJTSU9OU19QQVRILFxuICBNT0RFTF9WRVJTSU9OX1BBVEgsXG4gIE1PREVMU19QQVRILFxuICBNT0RFTF9GRUVEQkFDS19QQVRILFxuICBNT0RFTF9WRVJTSU9OX0ZFRURCQUNLX1BBVEgsXG4gIFBSRURJQ1RfUEFUSCxcbiAgVkVSU0lPTl9QUkVESUNUX1BBVEgsXG4gIE1PREVMX0lOUFVUU19QQVRILFxuICBNT0RFTF9WRVJTSU9OX09VVFBVVF9QQVRILFxuICBNT0RFTF9PVVRQVVRfUEFUSCxcbiAgTU9ERUxfVkVSU0lPTl9JTlBVVFNfUEFUSCxcbiAgTU9ERUxfVkVSU0lPTl9NRVRSSUNTX1BBVEhcbn0gPSBBUEk7XG5cbi8qKlxuICogY2xhc3MgcmVwcmVzZW50aW5nIGEgbW9kZWxcbiAqIEBjbGFzc1xuICovXG5jbGFzcyBNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIGRhdGEpIHtcbiAgICB0aGlzLl9jb25maWcgPSBfY29uZmlnO1xuICAgIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcbiAgICB0aGlzLmNyZWF0ZWRBdCA9IGRhdGEuY3JlYXRlZF9hdCB8fCBkYXRhLmNyZWF0ZWRBdDtcbiAgICB0aGlzLmFwcElkID0gZGF0YS5hcHBfaWQgfHwgZGF0YS5hcHBJZDtcbiAgICB0aGlzLm91dHB1dEluZm8gPSBkYXRhLm91dHB1dF9pbmZvIHx8IGRhdGEub3V0cHV0SW5mbztcbiAgICBpZiAoY2hlY2tUeXBlKC8oU3RyaW5nKS8sIGRhdGEudmVyc2lvbikpIHtcbiAgICAgIHRoaXMubW9kZWxWZXJzaW9uID0ge307XG4gICAgICB0aGlzLnZlcnNpb25JZCA9IGRhdGEudmVyc2lvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGRhdGEubW9kZWxfdmVyc2lvbiB8fCBkYXRhLm1vZGVsVmVyc2lvbiB8fCBkYXRhLnZlcnNpb24pIHtcbiAgICAgICAgdGhpcy5tb2RlbFZlcnNpb24gPSBuZXcgTW9kZWxWZXJzaW9uKHRoaXMuX2NvbmZpZywgZGF0YS5tb2RlbF92ZXJzaW9uIHx8IGRhdGEubW9kZWxWZXJzaW9uIHx8IGRhdGEudmVyc2lvbik7XG4gICAgICB9XG4gICAgICB0aGlzLnZlcnNpb25JZCA9ICh0aGlzLm1vZGVsVmVyc2lvbiB8fCB7fSkuaWQ7XG4gICAgfVxuICAgIHRoaXMucmF3RGF0YSA9IGRhdGE7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY29uY2VwdHMgdG8gYSBtb2RlbFxuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgIGNvbmNlcHRzICAgIExpc3Qgb2YgY29uY2VwdCBvYmplY3RzIHdpdGggaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShNb2RlbCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhIE1vZGVsIGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIG1lcmdlQ29uY2VwdHMoY29uY2VwdHMgPSBbXSkge1xuICAgIGxldCBjb25jZXB0c0FyciA9IEFycmF5LmlzQXJyYXkoY29uY2VwdHMpID8gY29uY2VwdHMgOiBbY29uY2VwdHNdO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZSh7YWN0aW9uOiAnbWVyZ2UnLCBjb25jZXB0czogY29uY2VwdHNBcnJ9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgY29uY2VwdHMgZnJvbSBhIG1vZGVsXG4gICAqIEBwYXJhbSB7b2JqZWN0W119ICAgICAgY29uY2VwdHMgICAgTGlzdCBvZiBjb25jZXB0IG9iamVjdHMgd2l0aCBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWwgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZGVsZXRlQ29uY2VwdHMoY29uY2VwdHMgPSBbXSkge1xuICAgIGxldCBjb25jZXB0c0FyciA9IEFycmF5LmlzQXJyYXkoY29uY2VwdHMpID8gY29uY2VwdHMgOiBbY29uY2VwdHNdO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZSh7YWN0aW9uOiAncmVtb3ZlJywgY29uY2VwdHM6IGNvbmNlcHRzQXJyfSk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcndyaXRlIGNvbmNlcHRzIGluIGEgbW9kZWxcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICBjb25jZXB0cyAgICBMaXN0IG9mIGNvbmNlcHQgb2JqZWN0cyB3aXRoIGlkXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBvdmVyd3JpdGVDb25jZXB0cyhjb25jZXB0cyA9IFtdKSB7XG4gICAgbGV0IGNvbmNlcHRzQXJyID0gQXJyYXkuaXNBcnJheShjb25jZXB0cykgPyBjb25jZXB0cyA6IFtjb25jZXB0c107XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKHthY3Rpb246ICdvdmVyd3JpdGUnLCBjb25jZXB0czogY29uY2VwdHNBcnJ9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIG1vZGVsIGV2YWx1YXRpb24gam9iXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWxWZXJzaW9uLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWxWZXJzaW9uIGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIHJ1bk1vZGVsRXZhbCgpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTl9NRVRSSUNTX1BBVEgsIFt0aGlzLmlkLCB0aGlzLnZlcnNpb25JZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwge30sIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWxWZXJzaW9uKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbF92ZXJzaW9uKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGEgbW9kZWwncyBvdXRwdXQgY29uZmlnIG9yIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgICAgIG1vZGVsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gb2JqZWN0IHdpdGggYW55IG9mIHRoZSBmb2xsb3dpbmcgYXR0cnM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgbmFtZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgbmV3IG5hbWUgb2YgdGhlIG1vZGVsIHRvIHVwZGF0ZSB3aXRoXG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgY29uY2VwdHNNdXR1YWxseUV4Y2x1c2l2ZSAgICAgICAgICAgICBEbyB5b3UgZXhwZWN0IHRvIHNlZSBtb3JlIHRoYW4gb25lIG9mIHRoZSBjb25jZXB0cyBpbiB0aGlzIG1vZGVsIGluIHRoZSBTQU1FIGltYWdlPyBTZXQgdG8gZmFsc2UgKGRlZmF1bHQpIGlmIHNvLiBPdGhlcndpc2UsIHNldCB0byB0cnVlLlxuICAgKiAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgIGNsb3NlZEVudmlyb25tZW50ICAgICAgICAgICAgICAgICAgICAgRG8geW91IGV4cGVjdCB0byBydW4gdGhlIHRyYWluZWQgbW9kZWwgb24gaW1hZ2VzIHRoYXQgZG8gbm90IGNvbnRhaW4gQU5ZIG9mIHRoZSBjb25jZXB0cyBpbiB0aGUgbW9kZWw/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICAgICAgY29uY2VwdHMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbiBhcnJheSBvZiBjb25jZXB0IG9iamVjdHMgb3Igc3RyaW5nXG4gICAqICAgICBAcGFyYW0ge29iamVjdHxzdHJpbmd9ICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQgICAgICAgICAgICAgICAgICAgIElmIHN0cmluZyBpcyBnaXZlbiwgdGhpcyBpcyBpbnRlcnByZXRlZCBhcyBjb25jZXB0IGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgY2xpZW50IGV4cGVjdHMgdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzXG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBjb25jZXB0IHRvIGF0dGFjaCB0byB0aGUgbW9kZWxcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBhY3Rpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBhY3Rpb24gdG8gcGVyZm9ybSBvbiB0aGUgZ2l2ZW4gY29uY2VwdHMuIFBvc3NpYmxlIHZhbHVlcyBhcmUgJ21lcmdlJywgJ3JlbW92ZScsIG9yICdvdmVyd3JpdGUnLiBEZWZhdWx0OiAnbWVyZ2UnXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB1cGRhdGUob2JqKSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke01PREVMU19QQVRIfWA7XG4gICAgbGV0IG1vZGVsRGF0YSA9IFtvYmpdO1xuICAgIGxldCBkYXRhID0ge21vZGVsczogbW9kZWxEYXRhLm1hcChtID0+IGZvcm1hdE1vZGVsKE9iamVjdC5hc3NpZ24obSwge2lkOiB0aGlzLmlkfSkpKX07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqLmNvbmNlcHRzKSkge1xuICAgICAgZGF0YVsnYWN0aW9uJ10gPSBvYmouYWN0aW9uIHx8ICdtZXJnZSc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wYXRjaCh1cmwsIGRhdGEsIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWwodGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLm1vZGVsc1swXSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBtb2RlbCB2ZXJzaW9uXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgc3luYyAgICAgSWYgdHJ1ZSwgdGhpcyByZXR1cm5zIGFmdGVyIG1vZGVsIGhhcyBjb21wbGV0ZWx5IHRyYWluZWQuIElmIGZhbHNlLCB0aGlzIGltbWVkaWF0ZWx5IHJldHVybnMgZGVmYXVsdCBhcGkgcmVzcG9uc2UuXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB0cmFpbihzeW5jKSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKE1PREVMX1ZFUlNJT05TX1BBVEgsIFt0aGlzLmlkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBudWxsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIC8vIFRyYWluaW5nIHByb2R1Y2VzIGEgbmV3IG1vZGVsIHZlcnNpb24gSUQuXG4gICAgICAgICAgICB0aGlzLnZlcnNpb25JZCA9IHJlc3BvbnNlLmRhdGEubW9kZWwubW9kZWxfdmVyc2lvbi5pZDtcblxuICAgICAgICAgICAgaWYgKHN5bmMpIHtcbiAgICAgICAgICAgICAgbGV0IHRpbWVTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgIHRoaXMuX3BvbGxUcmFpbi5iaW5kKHRoaXMpKHRpbWVTdGFydCwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgX3BvbGxUcmFpbih0aW1lU3RhcnQsIHJlc29sdmUsIHJlamVjdCkge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnBvbGxUaW1lb3V0KTtcbiAgICBpZiAoKERhdGUubm93KCkgLSB0aW1lU3RhcnQpID49IFNZTkNfVElNRU9VVCkge1xuICAgICAgcmV0dXJuIHJlamVjdCh7XG4gICAgICAgIHN0YXR1czogJ0Vycm9yJyxcbiAgICAgICAgbWVzc2FnZTogJ1N5bmMgY2FsbCB0aW1lZCBvdXQnXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5nZXRPdXRwdXRJbmZvKCkudGhlbigobW9kZWwpID0+IHtcbiAgICAgIGxldCBtb2RlbFN0YXR1c0NvZGUgPSBtb2RlbC5tb2RlbFZlcnNpb24uc3RhdHVzLmNvZGUudG9TdHJpbmcoKTtcbiAgICAgIGlmIChtb2RlbFN0YXR1c0NvZGUgPT09IE1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkcgfHwgbW9kZWxTdGF0dXNDb2RlID09PSBNT0RFTF9UUkFJTklORykge1xuICAgICAgICB0aGlzLnBvbGxUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl9wb2xsVHJhaW4odGltZVN0YXJ0LCByZXNvbHZlLCByZWplY3QpLCBQT0xMVElNRSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKG1vZGVsKTtcbiAgICAgIH1cbiAgICB9LCByZWplY3QpXG4gICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIG1vZGVsIG91cHV0cyBhY2NvcmRpbmcgdG8gaW5wdXRzXG4gICAqIEBwYXJhbSB7b2JqZWN0W118b2JqZWN0fHN0cmluZ30gICAgICAgaW5wdXRzICAgIEFuIGFycmF5IG9mIG9iamVjdHMvb2JqZWN0L3N0cmluZyBwb2ludGluZyB0byBhbiBpbWFnZSByZXNvdXJjZS4gQSBzdHJpbmcgY2FuIGVpdGhlciBiZSBhIHVybCBvciBiYXNlNjQgaW1hZ2UgYnl0ZXMuIE9iamVjdCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICAgICAgIGlucHV0c1tdLmltYWdlICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UuKHVybHxiYXNlNjQpICAgQ2FuIGJlIGEgcHVibGljbHkgYWNjZXNzaWJseSB1cmwgb3IgYmFzZTY0IHN0cmluZyByZXByZXNlbnRpbmcgaW1hZ2UgYnl0ZXMgKHJlcXVpcmVkKVxuICAgKiAgICAgICBAcGFyYW0ge251bWJlcltdfSAgICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbWFnZS5jcm9wICAgICAgICAgICBBbiBhcnJheSBjb250YWluaW5nIHRoZSBwZXJjZW50IHRvIGJlIGNyb3BwZWQgZnJvbSB0b3AsIGxlZnQsIGJvdHRvbSBhbmQgcmlnaHQgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0ge29iamVjdHxzdHJpbmd9IGNvbmZpZyBBbiBvYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdy4gSWYgYSBzdHJpbmcgaXMgcGFzc2VkIGluc3RlYWQsIGl0IHdpbGwgYmUgdHJlYXRlZCBhcyB0aGUgbGFuZ3VhZ2UgKGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5KVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSBjb25maWcubGFuZ3VhZ2UgQSBzdHJpbmcgY29kZSByZXByZXNlbnRpbmcgdGhlIGxhbmd1YWdlIHRvIHJldHVybiByZXN1bHRzIGluIChleGFtcGxlOiAnemgnIGZvciBzaW1wbGlmaWVkIENoaW5lc2UsICdydScgZm9yIFJ1c3NpYW4sICdqYScgZm9yIEphcGFuZXNlKVxuICAgKiAgIEBwYXJhbSB7Ym9vbGVhbn0gY29uZmlnLnZpZGVvIGluZGljYXRlcyBpZiB0aGUgaW5wdXQgc2hvdWxkIGJlIHByb2Nlc3NlZCBhcyBhIHZpZGVvXG4gICAqICAgQHBhcmFtIHtvYmplY3RbXX0gY29uZmlnLnNlbGVjdENvbmNlcHRzIEFuIGFycmF5IG9mIGNvbmNlcHRzIHRvIHJldHVybi4gRWFjaCBvYmplY3QgaW4gdGhlIGFycmF5IHdpbGwgaGF2ZSBhIGZvcm0gb2Yge25hbWU6IDxDT05DRVBUX05BTUU+fSBvciB7aWQ6IENPTkNFUFRfSUR9XG4gICAqICAgQHBhcmFtIHtmbG9hdH0gY29uZmlnLm1pblZhbHVlIFRoZSBtaW5pbXVtIGNvbmZpZGVuY2UgdGhyZXNob2xkIHRoYXQgYSByZXN1bHQgbXVzdCBtZWV0LiBGcm9tIDAuMCB0byAxLjBcbiAgICogICBAcGFyYW0ge251bWJlcn0gY29uZmlnLm1heENvbmNlcHRzIFRoZSBtYXhpbXVtIG51bWJlciBvZiBjb25jZXB0cyB0byByZXR1cm5cbiAgICogQHBhcmFtIHtib29sZWFufSBpc1ZpZGVvICBEZXByZWNhdGVkOiBpbmRpY2F0ZXMgaWYgdGhlIGlucHV0IHNob3VsZCBiZSBwcm9jZXNzZWQgYXMgYSB2aWRlbyAoZGVmYXVsdCBmYWxzZSkuIERlcHJlY2F0ZWQgaW4gZmF2b3Igb2YgdXNpbmcgY29uZmlnIG9iamVjdFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgcHJlZGljdChpbnB1dHMsIGNvbmZpZyA9IHt9LCBpc1ZpZGVvID0gZmFsc2UpIHtcbiAgICBpZiAoY2hlY2tUeXBlKC9TdHJpbmcvLCBjb25maWcpKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ3Bhc3NpbmcgdGhlIGxhbmd1YWdlIGFzIGEgc3RyaW5nIGlzIGRlcHJlY2F0ZWQsIGNvbnNpZGVyIHVzaW5nIHRoZSBjb25maWd1cmF0aW9uIG9iamVjdCBpbnN0ZWFkJyk7XG4gICAgICBjb25maWcgPSB7XG4gICAgICAgIGxhbmd1YWdlOiBjb25maWdcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKGlzVmlkZW8pIHtcbiAgICAgIGNvbnNvbGUud2FybignXCJpc1ZpZGVvXCIgYXJndW1lbnQgaXMgZGVwcmVjYXRlZCwgY29uc2lkZXIgdXNpbmcgdGhlIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGluc3RlYWQnKTtcbiAgICAgIGNvbmZpZy52aWRlbyA9IGlzVmlkZW87XG4gICAgfVxuICAgIGNvbnN0IHZpZGVvID0gY29uZmlnLnZpZGVvIHx8IGZhbHNlO1xuICAgIGRlbGV0ZSBjb25maWcudmlkZW87XG4gICAgaWYgKGNoZWNrVHlwZSgvKE9iamVjdHxTdHJpbmcpLywgaW5wdXRzKSkge1xuICAgICAgaW5wdXRzID0gW2lucHV0c107XG4gICAgfVxuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHt0aGlzLnZlcnNpb25JZCA/XG4gICAgICByZXBsYWNlVmFycyhWRVJTSU9OX1BSRURJQ1RfUEFUSCwgW3RoaXMuaWQsIHRoaXMudmVyc2lvbklkXSkgOlxuICAgICAgcmVwbGFjZVZhcnMoUFJFRElDVF9QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICBsZXQgcGFyYW1zID0ge2lucHV0czogaW5wdXRzLm1hcChpbnB1dCA9PiBmb3JtYXRNZWRpYVByZWRpY3QoaW5wdXQsIHZpZGVvID8gJ3ZpZGVvJyA6ICdpbWFnZScpKX07XG4gICAgICBpZiAoY29uZmlnICYmIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGNvbmZpZykubGVuZ3RoID4gMCkge1xuICAgICAgICBwYXJhbXNbJ21vZGVsJ10gPSB7XG4gICAgICAgICAgb3V0cHV0X2luZm86IHtcbiAgICAgICAgICAgIG91dHB1dF9jb25maWc6IGZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZShjb25maWcpXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucG9zdCh1cmwsIHBhcmFtcywge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgZGF0YS5yYXdEYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB2ZXJzaW9uIG9mIHRoZSBtb2RlbCBzcGVjaWZpZWQgYnkgaXRzIGlkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSAgICAgdmVyc2lvbklkICAgVGhlIG1vZGVsJ3MgaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldFZlcnNpb24odmVyc2lvbklkKSB7XG4gICAgLy8gVE9ETyhSb2spIE1FRElVTTogVGhlIHZlcnNpb24gSUQgaXNuJ3QgVVJJIGVuY29kZWQsIGFzIG9wcG9zZWQgdG8gdGhlIG1vZGVsIElELiBUaGlzIHNob3VsZCBwcm9iYWJseSBiZVxuICAgIC8vICBjb25zaXN0ZW50IC0gaS5lLiB0aGUgc2FtZSBpbiBib3RoIGNhc2VzLlxuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9WRVJTSU9OX1BBVEgsIFt0aGlzLmlkLCB2ZXJzaW9uSWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgZGF0YS5yYXdEYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBsaXN0IG9mIHZlcnNpb25zIG9mIHRoZSBtb2RlbFxuICAgKiBAcGFyYW0ge29iamVjdH0gICAgIG9wdGlvbnMgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OiAob3B0aW9uYWwpXG4gICAqICAgQHBhcmFtIHtudW1iZXJ9ICAgICBvcHRpb25zLnBhZ2UgICAgICAgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtudW1iZXJ9ICAgICBvcHRpb25zLnBlclBhZ2UgICAgIE51bWJlciBvZiBpbWFnZXMgdG8gcmV0dXJuIHBlciBwYWdlIChvcHRpb25hbCwgZGVmYXVsdDogMjApXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRWZXJzaW9ucyhvcHRpb25zID0ge3BhZ2U6IDEsIHBlclBhZ2U6IDIwfSkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9WRVJTSU9OU19QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICBsZXQgZGF0YSA9IHtcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgcGFyYW1zOiB7J3Blcl9wYWdlJzogb3B0aW9ucy5wZXJQYWdlLCAncGFnZSc6IG9wdGlvbnMucGFnZX0sXG4gICAgICB9O1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwgZGF0YSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgIGRhdGEucmF3RGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCB0aGUgbW9kZWwncyBvdXRwdXQgaW5mb1xuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWwgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0T3V0cHV0SW5mbygpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7dGhpcy52ZXJzaW9uSWQgP1xuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTl9PVVRQVVRfUEFUSCwgW3RoaXMuaWQsIHRoaXMudmVyc2lvbklkXSkgOlxuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfT1VUUFVUX1BBVEgsIFt0aGlzLmlkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICByZXNvbHZlKG5ldyBNb2RlbCh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWwpKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYWxsIHRoZSBtb2RlbCdzIGlucHV0c1xuICAgKiBAcGFyYW0ge29iamVjdH0gICAgIG9wdGlvbnMgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OiAob3B0aW9uYWwpXG4gICAqICAgQHBhcmFtIHtudW1iZXJ9ICAgICBvcHRpb25zLnBhZ2UgICAgICAgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtudW1iZXJ9ICAgICBvcHRpb25zLnBlclBhZ2UgICAgIE51bWJlciBvZiBpbWFnZXMgdG8gcmV0dXJuIHBlciBwYWdlIChvcHRpb25hbCwgZGVmYXVsdDogMjApXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRJbnB1dHMob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7dGhpcy52ZXJzaW9uSWQgP1xuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTl9JTlBVVFNfUEFUSCwgW3RoaXMuaWQsIHRoaXMudmVyc2lvbklkXSkgOlxuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfSU5QVVRTX1BBVEgsIFt0aGlzLmlkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtcbiAgICAgICAgICBwYXJhbXM6IHsncGVyX3BhZ2UnOiBvcHRpb25zLnBlclBhZ2UsICdwYWdlJzogb3B0aW9ucy5wYWdlfSxcbiAgICAgICAgICBoZWFkZXJzXG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgbGV0IGRhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlucHV0IEEgc3RyaW5nIHBvaW50aW5nIHRvIGFuIGltYWdlIHJlc291cmNlLiBBIHN0cmluZyBtdXN0IGJlIGEgdXJsXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgQSBjb25maWd1cmF0aW9uIG9iamVjdCBjb25zaXN0aW5nIG9mIHRoZSBmb2xsb3dpbmcgcmVxdWlyZWQga2V5c1xuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSBjb25maWcuaWQgVGhlIGlkIG9mIHRoZSBmZWVkYmFjayByZXF1ZXN0XG4gICAqICAgQHBhcmFtIHtvYmplY3R9IGNvbmZpZy5kYXRhIFRoZSBmZWVkYmFjayBkYXRhIHRvIGJlIHNlbnRcbiAgICogICBAcGFyYW0ge29iamVjdH0gY29uZmlnLmluZm8gTWV0YSBkYXRhIHJlbGF0ZWQgdG8gdGhlIGZlZWRiYWNrIHJlcXVlc3RcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGZlZWRiYWNrKGlucHV0LCB7aWQsIGRhdGEsIGluZm99KSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7dGhpcy52ZXJzaW9uSWQgP1xuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTl9GRUVEQkFDS19QQVRILCBbdGhpcy5pZCwgdGhpcy52ZXJzaW9uSWRdKSA6XG4gICAgICByZXBsYWNlVmFycyhNT0RFTF9GRUVEQkFDS19QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgY29uc3QgbWVkaWEgPSBmb3JtYXRNZWRpYVByZWRpY3QoaW5wdXQpLmRhdGE7XG4gICAgaW5mby5ldmVudFR5cGUgPSAnYW5ub3RhdGlvbic7XG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIGlkLFxuICAgICAgICBkYXRhOiBPYmplY3QuYXNzaWduKG1lZGlhLCBkYXRhKSxcbiAgICAgICAgJ2ZlZWRiYWNrX2luZm8nOiBmb3JtYXRPYmplY3RGb3JTbmFrZUNhc2UoaW5mbylcbiAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCBoZWFkZXJzID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBib2R5LCB7XG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKCh7ZGF0YX0pID0+IHtcbiAgICAgICAgICBjb25zdCBkID0gY2xvbmUoZGF0YSk7XG4gICAgICAgICAgZC5yYXdEYXRhID0gY2xvbmUoZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShkKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbm1vZHVsZVxuICAuZXhwb3J0cyA9IE1vZGVsO1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Model.js","/")
    },{"./ModelVersion":52,"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35}],52:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    /**
     * class representing a version of a model
     * @class
     */
    var ModelVersion = function ModelVersion(_config, data) {
      _classCallCheck(this, ModelVersion);
    
      this.id = data.id;
      this.created_at = this.createdAt = data.created_at || data.createdAt;
      this.status = data.status;
      this.active_concept_count = data.active_concept_count;
      this.metrics = data.metrics;
      this._config = _config;
      this.rawData = data;
    };
    
    ;
    
    module.exports = ModelVersion;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVsVmVyc2lvbi5qcyJdLCJuYW1lcyI6WyJNb2RlbFZlcnNpb24iLCJfY29uZmlnIiwiZGF0YSIsImlkIiwiY3JlYXRlZF9hdCIsImNyZWF0ZWRBdCIsInN0YXR1cyIsImFjdGl2ZV9jb25jZXB0X2NvdW50IiwibWV0cmljcyIsInJhd0RhdGEiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7SUFJTUEsWSxHQUNKLHNCQUFZQyxPQUFaLEVBQXFCQyxJQUFyQixFQUEyQjtBQUFBOztBQUN6QixPQUFLQyxFQUFMLEdBQVVELEtBQUtDLEVBQWY7QUFDQSxPQUFLQyxVQUFMLEdBQWtCLEtBQUtDLFNBQUwsR0FBaUJILEtBQUtFLFVBQUwsSUFBbUJGLEtBQUtHLFNBQTNEO0FBQ0EsT0FBS0MsTUFBTCxHQUFjSixLQUFLSSxNQUFuQjtBQUNBLE9BQUtDLG9CQUFMLEdBQTRCTCxLQUFLSyxvQkFBakM7QUFDQSxPQUFLQyxPQUFMLEdBQWVOLEtBQUtNLE9BQXBCO0FBQ0EsT0FBS1AsT0FBTCxHQUFlQSxPQUFmO0FBQ0EsT0FBS1EsT0FBTCxHQUFlUCxJQUFmO0FBQ0QsQzs7QUFFSDs7QUFFQVEsT0FBT0MsT0FBUCxHQUFpQlgsWUFBakIiLCJmaWxlIjoiTW9kZWxWZXJzaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSB2ZXJzaW9uIG9mIGEgbW9kZWxcbiAqIEBjbGFzc1xuICovXG5jbGFzcyBNb2RlbFZlcnNpb24ge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5jcmVhdGVkX2F0ID0gdGhpcy5jcmVhdGVkQXQgPSBkYXRhLmNyZWF0ZWRfYXQgfHwgZGF0YS5jcmVhdGVkQXQ7XG4gICAgdGhpcy5zdGF0dXMgPSBkYXRhLnN0YXR1cztcbiAgICB0aGlzLmFjdGl2ZV9jb25jZXB0X2NvdW50ID0gZGF0YS5hY3RpdmVfY29uY2VwdF9jb3VudDtcbiAgICB0aGlzLm1ldHJpY3MgPSBkYXRhLm1ldHJpY3M7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxWZXJzaW9uO1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ModelVersion.js","/")
    },{"buffer":30,"pBGvAp":35}],53:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var Promise = require('promise');
    var Model = require('./Model');
    var Concepts = require('./Concepts');
    
    var _require = require('./constants'),
        API = _require.API,
        ERRORS = _require.ERRORS,
        replaceVars = _require.replaceVars;
    
    var _require2 = require('./helpers'),
        isSuccess = _require2.isSuccess,
        checkType = _require2.checkType,
        clone = _require2.clone;
    
    var _require3 = require('./utils'),
        wrapToken = _require3.wrapToken,
        formatModel = _require3.formatModel;
    
    var MODELS_PATH = API.MODELS_PATH,
        MODEL_PATH = API.MODEL_PATH,
        MODEL_SEARCH_PATH = API.MODEL_SEARCH_PATH,
        MODEL_VERSION_PATH = API.MODEL_VERSION_PATH;
    
    /**
     * class representing a collection of models
     * @class
     */
    
    var Models = function () {
      function Models(_config) {
        var _this = this;
    
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Models);
    
        this._config = _config;
        this.rawData = rawData;
        rawData.forEach(function (modelData, index) {
          _this[index] = new Model(_this._config, modelData);
        });
        this.length = rawData.length;
      }
    
      /**
       * Returns a Model instance given model id or name. It will call search if name is given.
       * @param {string|object}    model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
       *   @param {string}           model.id          Model id
       *   @param {string}           model.name        Model name
       *   @param {string}           model.version     Model version
       *   @param {string}           model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
       * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
       */
    
    
      _createClass(Models, [{
        key: 'initModel',
        value: function initModel(model) {
          var _this2 = this;
    
          var data = {};
          var fn = void 0;
          if (checkType(/String/, model)) {
            data.id = model;
          } else {
            data = model;
          }
          if (data.id) {
            fn = function fn(resolve, reject) {
              resolve(new Model(_this2._config, data));
            };
          } else {
            fn = function fn(resolve, reject) {
              _this2.search(data.name, data.type).then(function (models) {
                if (data.version) {
                  resolve(models.rawData.filter(function (model) {
                    return model.modelVersion.id === data.version;
                  }));
                } else {
                  resolve(models[0]);
                }
              }, reject).catch(reject);
            };
          }
          return new Promise(fn);
        }
    
        /**
         * Calls predict given model info and inputs to predict on
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.language    Model language (only for Clarifai's public models)
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @param {object[]|object|string}   inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
         *    @param {object}                  inputs[].image     Object with keys explained below:
         *       @param {string}                 inputs[].image.(url|base64)  Can be a publicly accessibly url or base64 string representing image bytes (required)
         * @param {boolean} isVideo  indicates if the input should be processed as a video (default false)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'predict',
        value: function predict(model, inputs) {
          var _this3 = this;
    
          var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    
          if (checkType(/Boolean/, config)) {
            console.warn('"isVideo" argument is deprecated, consider using the configuration object instead');
            config = {
              video: config
            };
          }
          if (model.language) {
            config.language = model.language;
          }
          return new Promise(function (resolve, reject) {
            _this3.initModel(model).then(function (modelObj) {
              modelObj.predict(inputs, config).then(resolve, reject).catch(reject);
            }, reject);
          });
        }
    
        /**
         * Calls train on a model and creates a new model version given model info
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @param {boolean}                  sync        If true, this returns after model has completely trained. If false, this immediately returns default api response.
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'train',
        value: function train(model) {
          var _this4 = this;
    
          var sync = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    
          return new Promise(function (resolve, reject) {
            _this4.initModel(model).then(function (model) {
              model.train(sync).then(resolve, reject).catch(reject);
            }, reject);
          });
        }
    
        /**
         *
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @param {string} input A string pointing to an image resource. A string must be a url
         * @param {object} config A configuration object consisting of the following required keys
         *   @param {string} config.id The id of the feedback request
         *   @param {object} config.data The feedback data to be sent
         *   @param {object} config.info Meta data related to the feedback request
         */
    
      }, {
        key: 'feedback',
        value: function feedback(model, input, config) {
          var _this5 = this;
    
          return new Promise(function (resolve, reject) {
            _this5.initModel(model).then(function (model) {
              return model.feedback(input, config);
            }).then(function (d) {
              return resolve(d);
            }).catch(function (e) {
              return reject(e);
            });
          });
        }
    
        /**
         * Returns a version of the model specified by its id
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @param {string}     versionId   The model's id
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getVersion',
        value: function getVersion(model, versionId) {
          var _this6 = this;
    
          return new Promise(function (resolve, reject) {
            _this6.initModel(model).then(function (model) {
              model.getVersion(versionId).then(resolve, reject).catch(reject);
            }, reject);
          });
        }
    
        /**
         * Returns a list of versions of the model
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @param {object}                   options     Object with keys explained below: (optional)
         *   @param {number}                   options.page        The page number (optional, default: 1)
         *   @param {number}                   options.perPage     Number of images to return per page (optional, default: 20)
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'getVersions',
        value: function getVersions(model) {
          var _this7 = this;
    
          var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { page: 1, perPage: 20 };
    
          return new Promise(function (resolve, reject) {
            _this7.initModel(model).then(function (model) {
              model.getVersions(options).then(resolve, reject).catch(reject);
            }, reject);
          });
        }
    
        /**
         * Returns all the model's output info
         * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                   model.id          Model id
         *   @param {string}                   model.name        Model name
         *   @param {string}                   model.version     Model version
         *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
         */
    
      }, {
        key: 'getOutputInfo',
        value: function getOutputInfo(model) {
          var _this8 = this;
    
          return new Promise(function (resolve, reject) {
            _this8.initModel(model).then(function (model) {
              model.getOutputInfo().then(resolve, reject).catch(reject);
            }, reject);
          });
        }
    
        /**
         * Returns all the models
         * @param {Object}     options     Object with keys explained below: (optional)
         *   @param {Number}     options.page        The page number (optional, default: 1)
         *   @param {Number}     options.perPage     Number of images to return per page (optional, default: 20)
         * @return {Promise(Models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
         */
    
      }, {
        key: 'list',
        value: function list() {
          var _this9 = this;
    
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + MODELS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, {
                params: { 'per_page': options.perPage, 'page': options.page },
                headers: headers
              }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Models(_this9._config, response.data.models));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Create a model
         * @param {string|object}                  model                                  If string, it is assumed to be the model id. Otherwise, if object is given, it can have any of the following keys:
         *   @param {string}                         model.id                               Model id
         *   @param {string}                         model.name                             Model name
         * @param {object[]|string[]|Concepts[]}   conceptsData                           List of objects with ids, concept id strings or an instance of Concepts object
         * @param {Object}                         options                                Object with keys explained below:
         *   @param {boolean}                        options.conceptsMutuallyExclusive      Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
         *   @param {boolean}                        options.closedEnvironment              Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
         * @return {Promise(Model, error)} A Promise that is fulfilled with an instance of Model or rejected with an error
         */
    
      }, {
        key: 'create',
        value: function create(model) {
          var _this10 = this;
    
          var conceptsData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
          var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    
          var concepts = conceptsData instanceof Concepts ? conceptsData.toObject('id') : conceptsData.map(function (concept) {
            var val = concept;
            if (checkType(/String/, concept)) {
              val = { 'id': concept };
            }
            return val;
          });
          var modelObj = model;
          if (checkType(/String/, model)) {
            modelObj = { id: model, name: model };
          }
          if (modelObj.id === undefined) {
            throw ERRORS.paramsRequired('Model ID');
          }
          var url = '' + this._config.basePath + MODELS_PATH;
          var data = { model: modelObj };
          data['model']['output_info'] = {
            'data': {
              concepts: concepts
            },
            'output_config': {
              'concepts_mutually_exclusive': !!options.conceptsMutuallyExclusive,
              'closed_environment': !!options.closedEnvironment
            }
          };
    
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Model(_this10._config, response.data.model));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Returns a model specified by ID
         * @param {String}     id          The model's id
         * @return {Promise(Model, error)} A Promise that is fulfilled with an instance of Model or rejected with an error
         */
    
      }, {
        key: 'get',
        value: function get(id) {
          var _this11 = this;
    
          var url = '' + this._config.basePath + replaceVars(MODEL_PATH, [id]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Model(_this11._config, response.data.model));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Update a model's or a list of models' output config or concepts
         * @param {object|object[]}      models                                 Can be a single model object or list of model objects with the following attrs:
         *   @param {string}               models.id                                    The id of the model to apply changes to (Required)
         *   @param {string}               models.name                                  The new name of the model to update with
         *   @param {boolean}              models.conceptsMutuallyExclusive             Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
         *   @param {boolean}              models.closedEnvironment                     Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
         *   @param {object[]}             models.concepts                              An array of concept objects or string
         *     @param {object|string}        models.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
         *       @param {string}             models.concepts[].concept.id                   The id of the concept to attach to the model
         *   @param {object[]}             models.action                                The action to perform on the given concepts. Possible values are 'merge', 'remove', or 'overwrite'. Default: 'merge'
         * @return {Promise(Models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
         */
    
      }, {
        key: 'update',
        value: function update(models) {
          var _this12 = this;
    
          var url = '' + this._config.basePath + MODELS_PATH;
          var modelsList = Array.isArray(models) ? models : [models];
          var data = { models: modelsList.map(formatModel) };
          data['action'] = models.action || 'merge';
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.patch(url, data, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Models(_this12._config, response.data.models));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
    
        /**
         * Update model by merging concepts
         * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
         *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
         *   @param {object[]}             model.concepts                              An array of concept objects or string
         *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
         *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
         */
    
      }, {
        key: 'mergeConcepts',
        value: function mergeConcepts() {
          var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    
          model.action = 'merge';
          return this.update(model);
        }
    
        /**
         * Update model by removing concepts
         * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
         *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
         *   @param {object[]}             model.concepts                              An array of concept objects or string
         *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
         *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
         */
    
      }, {
        key: 'deleteConcepts',
        value: function deleteConcepts() {
          var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    
          model.action = 'remove';
          return this.update(model);
        }
    
        /**
         * Update model by overwriting concepts
         * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
         *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
         *   @param {object[]}             model.concepts                              An array of concept objects or string
         *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
         *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
         */
    
      }, {
        key: 'overwriteConcepts',
        value: function overwriteConcepts() {
          var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    
          model.action = 'overwrite';
          return this.update(model);
        }
    
        /**
         * Deletes all models (if no ids and versionId given) or a model (if given id) or a model version (if given id and verion id)
         * @param {String|String[]}      ids         Can be a single string or an array of strings representing the model ids
         * @param {String}               versionId   The model's version id
         * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
         */
    
      }, {
        key: 'delete',
        value: function _delete(ids) {
          var versionId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    
          var request = void 0,
              url = void 0,
              data = void 0;
          var id = ids;
    
          if (checkType(/String/, ids) || checkType(/Array/, ids) && ids.length === 1) {
            if (versionId) {
              url = '' + this._config.basePath + replaceVars(MODEL_VERSION_PATH, [id, versionId]);
            } else {
              url = '' + this._config.basePath + replaceVars(MODEL_PATH, [id]);
            }
            request = wrapToken(this._config, function (headers) {
              return new Promise(function (resolve, reject) {
                axios.delete(url, { headers: headers }).then(function (response) {
                  var data = clone(response.data);
                  data.rawData = clone(response.data);
                  resolve(data);
                }, reject);
              });
            });
          } else {
            if (!ids && !versionId) {
              url = '' + this._config.basePath + MODELS_PATH;
              data = { 'delete_all': true };
            } else if (!versionId && ids.length > 1) {
              url = '' + this._config.basePath + MODELS_PATH;
              data = { ids: ids };
            } else {
              throw ERRORS.INVALID_DELETE_ARGS;
            }
            request = wrapToken(this._config, function (headers) {
              return new Promise(function (resolve, reject) {
                axios({
                  method: 'delete',
                  url: url,
                  data: data,
                  headers: headers
                }).then(function (response) {
                  var data = clone(response.data);
                  data.rawData = clone(response.data);
                  resolve(data);
                }, reject);
              });
            });
          }
    
          return request;
        }
    
        /**
         * Search for models by name or type
         * @param {String}     name        The model name
         * @param {String}     type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
         * @return {Promise(models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
         */
    
      }, {
        key: 'search',
        value: function search(name) {
          var _this13 = this;
    
          var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    
          var url = '' + this._config.basePath + MODEL_SEARCH_PATH;
          return wrapToken(this._config, function (headers) {
            var params = {
              'model_query': {
                name: name,
                type: type
              }
            };
            return new Promise(function (resolve, reject) {
              axios.post(url, params, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Models(_this13._config, response.data.models));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }]);
    
      return Models;
    }();
    
    module.exports = Models;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVscy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJQcm9taXNlIiwiTW9kZWwiLCJDb25jZXB0cyIsIkFQSSIsIkVSUk9SUyIsInJlcGxhY2VWYXJzIiwiaXNTdWNjZXNzIiwiY2hlY2tUeXBlIiwiY2xvbmUiLCJ3cmFwVG9rZW4iLCJmb3JtYXRNb2RlbCIsIk1PREVMU19QQVRIIiwiTU9ERUxfUEFUSCIsIk1PREVMX1NFQVJDSF9QQVRIIiwiTU9ERUxfVkVSU0lPTl9QQVRIIiwiTW9kZWxzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwibW9kZWxEYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJtb2RlbCIsImRhdGEiLCJmbiIsImlkIiwicmVzb2x2ZSIsInJlamVjdCIsInNlYXJjaCIsIm5hbWUiLCJ0eXBlIiwidGhlbiIsIm1vZGVscyIsInZlcnNpb24iLCJmaWx0ZXIiLCJtb2RlbFZlcnNpb24iLCJjYXRjaCIsImlucHV0cyIsImNvbmZpZyIsImNvbnNvbGUiLCJ3YXJuIiwidmlkZW8iLCJsYW5ndWFnZSIsImluaXRNb2RlbCIsIm1vZGVsT2JqIiwicHJlZGljdCIsInN5bmMiLCJ0cmFpbiIsImlucHV0IiwiZmVlZGJhY2siLCJkIiwiZSIsInZlcnNpb25JZCIsImdldFZlcnNpb24iLCJvcHRpb25zIiwicGFnZSIsInBlclBhZ2UiLCJnZXRWZXJzaW9ucyIsImdldE91dHB1dEluZm8iLCJ1cmwiLCJiYXNlUGF0aCIsImhlYWRlcnMiLCJnZXQiLCJwYXJhbXMiLCJyZXNwb25zZSIsImNvbmNlcHRzRGF0YSIsImNvbmNlcHRzIiwidG9PYmplY3QiLCJtYXAiLCJjb25jZXB0IiwidmFsIiwidW5kZWZpbmVkIiwicGFyYW1zUmVxdWlyZWQiLCJjb25jZXB0c011dHVhbGx5RXhjbHVzaXZlIiwiY2xvc2VkRW52aXJvbm1lbnQiLCJwb3N0IiwibW9kZWxzTGlzdCIsIkFycmF5IiwiaXNBcnJheSIsImFjdGlvbiIsInBhdGNoIiwidXBkYXRlIiwiaWRzIiwicmVxdWVzdCIsImRlbGV0ZSIsIklOVkFMSURfREVMRVRFX0FSR1MiLCJtZXRob2QiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQUlDLFVBQVVELFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBSUUsUUFBUUYsUUFBUSxTQUFSLENBQVo7QUFDQSxJQUFJRyxXQUFXSCxRQUFRLFlBQVIsQ0FBZjs7ZUFDaUNBLFFBQVEsYUFBUixDO0lBQTVCSSxHLFlBQUFBLEc7SUFBS0MsTSxZQUFBQSxNO0lBQVFDLFcsWUFBQUEsVzs7Z0JBQ2tCTixRQUFRLFdBQVIsQztJQUEvQk8sUyxhQUFBQSxTO0lBQVdDLFMsYUFBQUEsUztJQUFXQyxLLGFBQUFBLEs7O2dCQUNJVCxRQUFRLFNBQVIsQztJQUExQlUsUyxhQUFBQSxTO0lBQVdDLFcsYUFBQUEsVzs7SUFDWEMsVyxHQUFrRVIsRyxDQUFsRVEsVztJQUFhQyxVLEdBQXFEVCxHLENBQXJEUyxVO0lBQVlDLGlCLEdBQXlDVixHLENBQXpDVSxpQjtJQUFtQkMsa0IsR0FBc0JYLEcsQ0FBdEJXLGtCOztBQUVqRDs7Ozs7SUFJTUMsTTtBQUNKLGtCQUFZQyxPQUFaLEVBQW1DO0FBQUE7O0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUNqQyxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLQyxPQUFMLEdBQWVBLE9BQWY7QUFDQUEsWUFBUUMsT0FBUixDQUFnQixVQUFDQyxTQUFELEVBQVlDLEtBQVosRUFBc0I7QUFDcEMsWUFBS0EsS0FBTCxJQUFjLElBQUluQixLQUFKLENBQVUsTUFBS2UsT0FBZixFQUF3QkcsU0FBeEIsQ0FBZDtBQUNELEtBRkQ7QUFHQSxTQUFLRSxNQUFMLEdBQWNKLFFBQVFJLE1BQXRCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7OEJBU1VDLEssRUFBTztBQUFBOztBQUNmLFVBQUlDLE9BQU8sRUFBWDtBQUNBLFVB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RCxFQUFhO0FBQzFDLFlBQUlFLFNBQVM7QUFDWCx5QkFBZTtBQUNibEMsc0JBRGE7QUFFYkM7QUFGYTtBQURKLFNBQWI7QUFNQSxlQUFPLElBQUk5QixPQUFKLENBQVksVUFBQzBCLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0QzdCLGdCQUFNNkUsSUFBTixDQUFXaEIsR0FBWCxFQUFnQkksTUFBaEIsRUFBd0IsRUFBQ0YsZ0JBQUQsRUFBeEIsRUFBbUM5QixJQUFuQyxDQUF3QyxVQUFDaUMsUUFBRCxFQUFjO0FBQ3BELGdCQUFJMUQsVUFBVTBELFFBQVYsQ0FBSixFQUF5QjtBQUN2QnRDLHNCQUFRLElBQUlYLE1BQUosQ0FBVyxRQUFLQyxPQUFoQixFQUF5QmdELFNBQVN6QyxJQUFULENBQWNTLE1BQXZDLENBQVI7QUFDRCxhQUZELE1BRU87QUFDTEwscUJBQU9xQyxRQUFQO0FBQ0Q7QUFDRixXQU5ELEVBTUdyQyxNQU5IO0FBT0QsU0FSTSxDQUFQO0FBU0QsT0FoQk0sQ0FBUDtBQWlCRDs7Ozs7O0FBR0g0RCxPQUFPQyxPQUFQLEdBQWlCekUsTUFBakIiLCJmaWxlIjoiTW9kZWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCBQcm9taXNlID0gcmVxdWlyZSgncHJvbWlzZScpO1xubGV0IE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xubGV0IENvbmNlcHRzID0gcmVxdWlyZSgnLi9Db25jZXB0cycpO1xubGV0IHtBUEksIEVSUk9SUywgcmVwbGFjZVZhcnN9ID0gcmVxdWlyZSgnLi9jb25zdGFudHMnKTtcbmxldCB7aXNTdWNjZXNzLCBjaGVja1R5cGUsIGNsb25lfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdE1vZGVsfSA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmxldCB7TU9ERUxTX1BBVEgsIE1PREVMX1BBVEgsIE1PREVMX1NFQVJDSF9QQVRILCBNT0RFTF9WRVJTSU9OX1BBVEh9ID0gQVBJO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIGNvbGxlY3Rpb24gb2YgbW9kZWxzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgTW9kZWxzIHtcbiAgY29uc3RydWN0b3IoX2NvbmZpZywgcmF3RGF0YSA9IFtdKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSByYXdEYXRhO1xuICAgIHJhd0RhdGEuZm9yRWFjaCgobW9kZWxEYXRhLCBpbmRleCkgPT4ge1xuICAgICAgdGhpc1tpbmRleF0gPSBuZXcgTW9kZWwodGhpcy5fY29uZmlnLCBtb2RlbERhdGEpO1xuICAgIH0pO1xuICAgIHRoaXMubGVuZ3RoID0gcmF3RGF0YS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIE1vZGVsIGluc3RhbmNlIGdpdmVuIG1vZGVsIGlkIG9yIG5hbWUuIEl0IHdpbGwgY2FsbCBzZWFyY2ggaWYgbmFtZSBpcyBnaXZlbi5cbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICBtb2RlbCAgICAgICBJZiBzdHJpbmcsIGl0IGlzIGFzc3VtZWQgdG8gYmUgbW9kZWwgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBpdCBjYW4gaGF2ZSBhbnkgb2YgdGhlIGZvbGxvd2luZyBrZXlzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLnZlcnNpb24gICAgIE1vZGVsIHZlcnNpb25cbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBpbml0TW9kZWwobW9kZWwpIHtcbiAgICBsZXQgZGF0YSA9IHt9O1xuICAgIGxldCBmbjtcbiAgICBpZiAoY2hlY2tUeXBlKC9TdHJpbmcvLCBtb2RlbCkpIHtcbiAgICAgIGRhdGEuaWQgPSBtb2RlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IG1vZGVsO1xuICAgIH1cbiAgICBpZiAoZGF0YS5pZCkge1xuICAgICAgZm4gPSAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgZGF0YSkpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm4gPSAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuc2VhcmNoKGRhdGEubmFtZSwgZGF0YS50eXBlKS50aGVuKChtb2RlbHMpID0+IHtcbiAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKSB7XG4gICAgICAgICAgICByZXNvbHZlKG1vZGVscy5yYXdEYXRhLmZpbHRlcigobW9kZWwpID0+IG1vZGVsLm1vZGVsVmVyc2lvbi5pZCA9PT0gZGF0YS52ZXJzaW9uKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc29sdmUobW9kZWxzWzBdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCkuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmbik7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgcHJlZGljdCBnaXZlbiBtb2RlbCBpbmZvIGFuZCBpbnB1dHMgdG8gcHJlZGljdCBvblxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmxhbmd1YWdlICAgIE1vZGVsIGxhbmd1YWdlIChvbmx5IGZvciBDbGFyaWZhaSdzIHB1YmxpYyBtb2RlbHMpXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEBwYXJhbSB7b2JqZWN0W118b2JqZWN0fHN0cmluZ30gICBpbnB1dHMgICAgQW4gYXJyYXkgb2Ygb2JqZWN0cy9vYmplY3Qvc3RyaW5nIHBvaW50aW5nIHRvIGFuIGltYWdlIHJlc291cmNlLiBBIHN0cmluZyBjYW4gZWl0aGVyIGJlIGEgdXJsIG9yIGJhc2U2NCBpbWFnZSBieXRlcy4gT2JqZWN0IGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbWFnZSAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6XG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UuKHVybHxiYXNlNjQpICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNWaWRlbyAgaW5kaWNhdGVzIGlmIHRoZSBpbnB1dCBzaG91bGQgYmUgcHJvY2Vzc2VkIGFzIGEgdmlkZW8gKGRlZmF1bHQgZmFsc2UpXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBwcmVkaWN0KG1vZGVsLCBpbnB1dHMsIGNvbmZpZyA9IHt9KSB7XG4gICAgaWYgKGNoZWNrVHlwZSgvQm9vbGVhbi8sIGNvbmZpZykpIHtcbiAgICAgIGNvbnNvbGUud2FybignXCJpc1ZpZGVvXCIgYXJndW1lbnQgaXMgZGVwcmVjYXRlZCwgY29uc2lkZXIgdXNpbmcgdGhlIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGluc3RlYWQnKTtcbiAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgdmlkZW86IGNvbmZpZ1xuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKG1vZGVsLmxhbmd1YWdlKSB7XG4gICAgICBjb25maWcubGFuZ3VhZ2UgPSBtb2RlbC5sYW5ndWFnZTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbE9iaikgPT4ge1xuICAgICAgICBtb2RlbE9iai5wcmVkaWN0KGlucHV0cywgY29uZmlnKVxuICAgICAgICAgIC50aGVuKHJlc29sdmUsIHJlamVjdClcbiAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH0sIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgdHJhaW4gb24gYSBtb2RlbCBhbmQgY3JlYXRlcyBhIG5ldyBtb2RlbCB2ZXJzaW9uIGdpdmVuIG1vZGVsIGluZm9cbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICAgICAgc3luYyAgICAgICAgSWYgdHJ1ZSwgdGhpcyByZXR1cm5zIGFmdGVyIG1vZGVsIGhhcyBjb21wbGV0ZWx5IHRyYWluZWQuIElmIGZhbHNlLCB0aGlzIGltbWVkaWF0ZWx5IHJldHVybnMgZGVmYXVsdCBhcGkgcmVzcG9uc2UuXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB0cmFpbihtb2RlbCwgc3luYyA9IGZhbHNlKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbCkgPT4ge1xuICAgICAgICBtb2RlbC50cmFpbihzeW5jKVxuICAgICAgICAgIC50aGVuKHJlc29sdmUsIHJlamVjdClcbiAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH0sIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXQgQSBzdHJpbmcgcG9pbnRpbmcgdG8gYW4gaW1hZ2UgcmVzb3VyY2UuIEEgc3RyaW5nIG11c3QgYmUgYSB1cmxcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZyBBIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGNvbnNpc3Rpbmcgb2YgdGhlIGZvbGxvd2luZyByZXF1aXJlZCBrZXlzXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5pZCBUaGUgaWQgb2YgdGhlIGZlZWRiYWNrIHJlcXVlc3RcbiAgICogICBAcGFyYW0ge29iamVjdH0gY29uZmlnLmRhdGEgVGhlIGZlZWRiYWNrIGRhdGEgdG8gYmUgc2VudFxuICAgKiAgIEBwYXJhbSB7b2JqZWN0fSBjb25maWcuaW5mbyBNZXRhIGRhdGEgcmVsYXRlZCB0byB0aGUgZmVlZGJhY2sgcmVxdWVzdFxuICAgKi9cbiAgZmVlZGJhY2sobW9kZWwsIGlucHV0LCBjb25maWcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5pbml0TW9kZWwobW9kZWwpXG4gICAgICAgIC50aGVuKG1vZGVsID0+IHtcbiAgICAgICAgICByZXR1cm4gbW9kZWwuZmVlZGJhY2soaW5wdXQsIGNvbmZpZyk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGQgPT4gcmVzb2x2ZShkKSlcbiAgICAgICAgLmNhdGNoKGUgPT4gcmVqZWN0KGUpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgdmVyc2lvbiBvZiB0aGUgbW9kZWwgc3BlY2lmaWVkIGJ5IGl0cyBpZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEBwYXJhbSB7c3RyaW5nfSAgICAgdmVyc2lvbklkICAgVGhlIG1vZGVsJ3MgaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldFZlcnNpb24obW9kZWwsIHZlcnNpb25JZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmluaXRNb2RlbChtb2RlbCkudGhlbigobW9kZWwpID0+IHtcbiAgICAgICAgbW9kZWwuZ2V0VmVyc2lvbih2ZXJzaW9uSWQpXG4gICAgICAgICAgLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbGlzdCBvZiB2ZXJzaW9ucyBvZiB0aGUgbW9kZWxcbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICAgb3B0aW9ucyAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6IChvcHRpb25hbClcbiAgICogICBAcGFyYW0ge251bWJlcn0gICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgICAgICAgICBvcHRpb25zLnBlclBhZ2UgICAgIE51bWJlciBvZiBpbWFnZXMgdG8gcmV0dXJuIHBlciBwYWdlIChvcHRpb25hbCwgZGVmYXVsdDogMjApXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRWZXJzaW9ucyhtb2RlbCwgb3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5pbml0TW9kZWwobW9kZWwpLnRoZW4oKG1vZGVsKSA9PiB7XG4gICAgICAgIG1vZGVsLmdldFZlcnNpb25zKG9wdGlvbnMpXG4gICAgICAgICAgLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCB0aGUgbW9kZWwncyBvdXRwdXQgaW5mb1xuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRPdXRwdXRJbmZvKG1vZGVsKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbCkgPT4ge1xuICAgICAgICBtb2RlbC5nZXRPdXRwdXRJbmZvKClcbiAgICAgICAgICAudGhlbihyZXNvbHZlLCByZWplY3QpXG4gICAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgICB9LCByZWplY3QpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYWxsIHRoZSBtb2RlbHNcbiAgICogQHBhcmFtIHtPYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVscywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBNb2RlbHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbGlzdChvcHRpb25zID0ge3BhZ2U6IDEsIHBlclBhZ2U6IDIwfSkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtNT0RFTFNfUEFUSH1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge1xuICAgICAgICAgIHBhcmFtczogeydwZXJfcGFnZSc6IG9wdGlvbnMucGVyUGFnZSwgJ3BhZ2UnOiBvcHRpb25zLnBhZ2V9LFxuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWxzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbHMpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBtb2RlbFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgICAgICAgbW9kZWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIHRoZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1vZGVsIG5hbWVcbiAgICogQHBhcmFtIHtvYmplY3RbXXxzdHJpbmdbXXxDb25jZXB0c1tdfSAgIGNvbmNlcHRzRGF0YSAgICAgICAgICAgICAgICAgICAgICAgICAgIExpc3Qgb2Ygb2JqZWN0cyB3aXRoIGlkcywgY29uY2VwdCBpZCBzdHJpbmdzIG9yIGFuIGluc3RhbmNlIG9mIENvbmNlcHRzIG9iamVjdFxuICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6XG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuY29uY2VwdHNNdXR1YWxseUV4Y2x1c2l2ZSAgICAgIERvIHlvdSBleHBlY3QgdG8gc2VlIG1vcmUgdGhhbiBvbmUgb2YgdGhlIGNvbmNlcHRzIGluIHRoaXMgbW9kZWwgaW4gdGhlIFNBTUUgaW1hZ2U/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuY2xvc2VkRW52aXJvbm1lbnQgICAgICAgICAgICAgIERvIHlvdSBleHBlY3QgdG8gcnVuIHRoZSB0cmFpbmVkIG1vZGVsIG9uIGltYWdlcyB0aGF0IGRvIG5vdCBjb250YWluIEFOWSBvZiB0aGUgY29uY2VwdHMgaW4gdGhlIG1vZGVsPyBTZXQgdG8gZmFsc2UgKGRlZmF1bHQpIGlmIHNvLiBPdGhlcndpc2UsIHNldCB0byB0cnVlLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVsIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGNyZWF0ZShtb2RlbCwgY29uY2VwdHNEYXRhID0gW10sIG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCBjb25jZXB0cyA9IGNvbmNlcHRzRGF0YSBpbnN0YW5jZW9mIENvbmNlcHRzID9cbiAgICAgIGNvbmNlcHRzRGF0YS50b09iamVjdCgnaWQnKSA6XG4gICAgICBjb25jZXB0c0RhdGEubWFwKChjb25jZXB0KSA9PiB7XG4gICAgICAgIGxldCB2YWwgPSBjb25jZXB0O1xuICAgICAgICBpZiAoY2hlY2tUeXBlKC9TdHJpbmcvLCBjb25jZXB0KSkge1xuICAgICAgICAgIHZhbCA9IHsnaWQnOiBjb25jZXB0fTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgfSk7XG4gICAgbGV0IG1vZGVsT2JqID0gbW9kZWw7XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgbW9kZWwpKSB7XG4gICAgICBtb2RlbE9iaiA9IHtpZDogbW9kZWwsIG5hbWU6IG1vZGVsfTtcbiAgICB9XG4gICAgaWYgKG1vZGVsT2JqLmlkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IEVSUk9SUy5wYXJhbXNSZXF1aXJlZCgnTW9kZWwgSUQnKTtcbiAgICB9XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke01PREVMU19QQVRIfWA7XG4gICAgbGV0IGRhdGEgPSB7bW9kZWw6IG1vZGVsT2JqfTtcbiAgICBkYXRhWydtb2RlbCddWydvdXRwdXRfaW5mbyddID0ge1xuICAgICAgJ2RhdGEnOiB7XG4gICAgICAgIGNvbmNlcHRzXG4gICAgICB9LFxuICAgICAgJ291dHB1dF9jb25maWcnOiB7XG4gICAgICAgICdjb25jZXB0c19tdXR1YWxseV9leGNsdXNpdmUnOiAhIW9wdGlvbnMuY29uY2VwdHNNdXR1YWxseUV4Y2x1c2l2ZSxcbiAgICAgICAgJ2Nsb3NlZF9lbnZpcm9ubWVudCc6ICEhb3B0aW9ucy5jbG9zZWRFbnZpcm9ubWVudFxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBkYXRhLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBtb2RlbCBzcGVjaWZpZWQgYnkgSURcbiAgICogQHBhcmFtIHtTdHJpbmd9ICAgICBpZCAgICAgICAgICBUaGUgbW9kZWwncyBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVsIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9QQVRILCBbaWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyBNb2RlbCh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWwpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYSBtb2RlbCdzIG9yIGEgbGlzdCBvZiBtb2RlbHMnIG91dHB1dCBjb25maWcgb3IgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgbW9kZWxzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVscy5pZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBpZCBvZiB0aGUgbW9kZWwgdG8gYXBwbHkgY2hhbmdlcyB0byAoUmVxdWlyZWQpXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgbW9kZWxzLm5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIG5ldyBuYW1lIG9mIHRoZSBtb2RlbCB0byB1cGRhdGUgd2l0aFxuICAgKiAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgIG1vZGVscy5jb25jZXB0c011dHVhbGx5RXhjbHVzaXZlICAgICAgICAgICAgIERvIHlvdSBleHBlY3QgdG8gc2VlIG1vcmUgdGhhbiBvbmUgb2YgdGhlIGNvbmNlcHRzIGluIHRoaXMgbW9kZWwgaW4gdGhlIFNBTUUgaW1hZ2U/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgbW9kZWxzLmNsb3NlZEVudmlyb25tZW50ICAgICAgICAgICAgICAgICAgICAgRG8geW91IGV4cGVjdCB0byBydW4gdGhlIHRyYWluZWQgbW9kZWwgb24gaW1hZ2VzIHRoYXQgZG8gbm90IGNvbnRhaW4gQU5ZIG9mIHRoZSBjb25jZXB0cyBpbiB0aGUgbW9kZWw/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICAgICAgbW9kZWxzLmNvbmNlcHRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgb2YgY29uY2VwdCBvYmplY3RzIG9yIHN0cmluZ1xuICAgKiAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgbW9kZWxzLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVscy5jb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBjb25jZXB0IHRvIGF0dGFjaCB0byB0aGUgbW9kZWxcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbHMuYWN0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgYWN0aW9uIHRvIHBlcmZvcm0gb24gdGhlIGdpdmVuIGNvbmNlcHRzLiBQb3NzaWJsZSB2YWx1ZXMgYXJlICdtZXJnZScsICdyZW1vdmUnLCBvciAnb3ZlcndyaXRlJy4gRGVmYXVsdDogJ21lcmdlJ1xuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVscywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBNb2RlbHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgdXBkYXRlKG1vZGVscykge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtNT0RFTFNfUEFUSH1gO1xuICAgIGxldCBtb2RlbHNMaXN0ID0gQXJyYXkuaXNBcnJheShtb2RlbHMpID8gbW9kZWxzIDogW21vZGVsc107XG4gICAgbGV0IGRhdGEgPSB7bW9kZWxzOiBtb2RlbHNMaXN0Lm1hcChmb3JtYXRNb2RlbCl9O1xuICAgIGRhdGFbJ2FjdGlvbiddID0gbW9kZWxzLmFjdGlvbiB8fCAnbWVyZ2UnO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVscyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWxzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IG1lcmdpbmcgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgbW9kZWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDYW4gYmUgYSBzaW5nbGUgbW9kZWwgb2JqZWN0IG9yIGxpc3Qgb2YgbW9kZWwgb2JqZWN0cyB3aXRoIHRoZSBmb2xsb3dpbmcgYXR0cnM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIG1vZGVsIHRvIGFwcGx5IGNoYW5nZXMgdG8gKFJlcXVpcmVkKVxuICAgKiAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgb2YgY29uY2VwdCBvYmplY3RzIG9yIHN0cmluZ1xuICAgKiAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgbW9kZWwuY29uY2VwdHNbXS5jb25jZXB0ICAgICAgICAgICAgICAgICAgICBJZiBzdHJpbmcgaXMgZ2l2ZW4sIHRoaXMgaXMgaW50ZXJwcmV0ZWQgYXMgY29uY2VwdCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGNsaWVudCBleHBlY3RzIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlc1xuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgbW9kZWwuY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgICAgICAgICAgICAgIFRoZSBpZCBvZiB0aGUgY29uY2VwdCB0byBhdHRhY2ggdG8gdGhlIG1vZGVsXG4gICAqL1xuICBtZXJnZUNvbmNlcHRzKG1vZGVsID0ge30pIHtcbiAgICBtb2RlbC5hY3Rpb24gPSAnbWVyZ2UnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IHJlbW92aW5nIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgICAgIG1vZGVsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBtb2RlbCB0byBhcHBseSBjaGFuZ2VzIHRvIChSZXF1aXJlZClcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFuIGFycmF5IG9mIGNvbmNlcHQgb2JqZWN0cyBvciBzdHJpbmdcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIGNvbmNlcHQgdG8gYXR0YWNoIHRvIHRoZSBtb2RlbFxuICAgKi9cbiAgZGVsZXRlQ29uY2VwdHMobW9kZWwgPSB7fSkge1xuICAgIG1vZGVsLmFjdGlvbiA9ICdyZW1vdmUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IG92ZXJ3cml0aW5nIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgICAgIG1vZGVsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBtb2RlbCB0byBhcHBseSBjaGFuZ2VzIHRvIChSZXF1aXJlZClcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFuIGFycmF5IG9mIGNvbmNlcHQgb2JqZWN0cyBvciBzdHJpbmdcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIGNvbmNlcHQgdG8gYXR0YWNoIHRvIHRoZSBtb2RlbFxuICAgKi9cbiAgb3ZlcndyaXRlQ29uY2VwdHMobW9kZWwgPSB7fSkge1xuICAgIG1vZGVsLmFjdGlvbiA9ICdvdmVyd3JpdGUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBhbGwgbW9kZWxzIChpZiBubyBpZHMgYW5kIHZlcnNpb25JZCBnaXZlbikgb3IgYSBtb2RlbCAoaWYgZ2l2ZW4gaWQpIG9yIGEgbW9kZWwgdmVyc2lvbiAoaWYgZ2l2ZW4gaWQgYW5kIHZlcmlvbiBpZClcbiAgICogQHBhcmFtIHtTdHJpbmd8U3RyaW5nW119ICAgICAgaWRzICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIHN0cmluZyBvciBhbiBhcnJheSBvZiBzdHJpbmdzIHJlcHJlc2VudGluZyB0aGUgbW9kZWwgaWRzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgIHZlcnNpb25JZCAgIFRoZSBtb2RlbCdzIHZlcnNpb24gaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGRlbGV0ZShpZHMsIHZlcnNpb25JZCA9IG51bGwpIHtcbiAgICBsZXQgcmVxdWVzdCwgdXJsLCBkYXRhO1xuICAgIGxldCBpZCA9IGlkcztcblxuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGlkcykgfHwgKGNoZWNrVHlwZSgvQXJyYXkvLCBpZHMpICYmIGlkcy5sZW5ndGggPT09IDEgKSkge1xuICAgICAgaWYgKHZlcnNpb25JZCkge1xuICAgICAgICB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9WRVJTSU9OX1BBVEgsIFtpZCwgdmVyc2lvbklkXSl9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKE1PREVMX1BBVEgsIFtpZF0pfWA7XG4gICAgICB9XG4gICAgICByZXF1ZXN0ID0gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBheGlvcy5kZWxldGUodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgZGF0YS5yYXdEYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgIH0sIHJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghaWRzICYmICF2ZXJzaW9uSWQpIHtcbiAgICAgICAgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7TU9ERUxTX1BBVEh9YDtcbiAgICAgICAgZGF0YSA9IHsnZGVsZXRlX2FsbCc6IHRydWV9O1xuICAgICAgfSBlbHNlIGlmICghdmVyc2lvbklkICYmIGlkcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke01PREVMU19QQVRIfWA7XG4gICAgICAgIGRhdGEgPSB7aWRzfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVSUk9SUy5JTlZBTElEX0RFTEVURV9BUkdTO1xuICAgICAgfVxuICAgICAgcmVxdWVzdCA9IHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgYXhpb3Moe1xuICAgICAgICAgICAgbWV0aG9kOiAnZGVsZXRlJyxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzXG4gICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggZm9yIG1vZGVscyBieSBuYW1lIG9yIHR5cGVcbiAgICogQHBhcmFtIHtTdHJpbmd9ICAgICBuYW1lICAgICAgICBUaGUgbW9kZWwgbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgIHR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UobW9kZWxzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVscyBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBzZWFyY2gobmFtZSwgdHlwZSA9IG51bGwpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7TU9ERUxfU0VBUkNIX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGxldCBwYXJhbXMgPSB7XG4gICAgICAgICdtb2RlbF9xdWVyeSc6IHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIHR5cGVcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBwYXJhbXMsIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWxzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbHMpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVscztcbiJdfQ==
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Models.js","/")
    },{"./Concepts":48,"./Model":51,"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35,"promise":36}],54:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    "use strict";
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    /**
     * Region / bounding box. Region points are percentages from the edge.
     * E.g. top of 0.2 means the cropped input will start 20% down from the original edge.
     * @class
     */
    var Region = function Region(_config, data) {
      _classCallCheck(this, Region);
    
      this.id = data.id;
      this.top = data.region_info.bounding_box.top_row;
      this.left = data.region_info.bounding_box.left_col;
      this.bottom = data.region_info.bounding_box.bottom_row;
      this.right = data.region_info.bounding_box.right_col;
    };
    
    module.exports = Region;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlJlZ2lvbi5qcyJdLCJuYW1lcyI6WyJSZWdpb24iLCJfY29uZmlnIiwiZGF0YSIsImlkIiwidG9wIiwicmVnaW9uX2luZm8iLCJib3VuZGluZ19ib3giLCJ0b3Bfcm93IiwibGVmdCIsImxlZnRfY29sIiwiYm90dG9tIiwiYm90dG9tX3JvdyIsInJpZ2h0IiwicmlnaHRfY29sIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7OztJQUtNQSxNLEdBQ0osZ0JBQVlDLE9BQVosRUFBcUJDLElBQXJCLEVBQTJCO0FBQUE7O0FBQ3pCLE9BQUtDLEVBQUwsR0FBVUQsS0FBS0MsRUFBZjtBQUNBLE9BQUtDLEdBQUwsR0FBV0YsS0FBS0csV0FBTCxDQUFpQkMsWUFBakIsQ0FBOEJDLE9BQXpDO0FBQ0EsT0FBS0MsSUFBTCxHQUFZTixLQUFLRyxXQUFMLENBQWlCQyxZQUFqQixDQUE4QkcsUUFBMUM7QUFDQSxPQUFLQyxNQUFMLEdBQWNSLEtBQUtHLFdBQUwsQ0FBaUJDLFlBQWpCLENBQThCSyxVQUE1QztBQUNBLE9BQUtDLEtBQUwsR0FBYVYsS0FBS0csV0FBTCxDQUFpQkMsWUFBakIsQ0FBOEJPLFNBQTNDO0FBQ0QsQzs7QUFHSEMsT0FBT0MsT0FBUCxHQUFpQmYsTUFBakIiLCJmaWxlIjoiUmVnaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWdpb24gLyBib3VuZGluZyBib3guIFJlZ2lvbiBwb2ludHMgYXJlIHBlcmNlbnRhZ2VzIGZyb20gdGhlIGVkZ2UuXG4gKiBFLmcuIHRvcCBvZiAwLjIgbWVhbnMgdGhlIGNyb3BwZWQgaW5wdXQgd2lsbCBzdGFydCAyMCUgZG93biBmcm9tIHRoZSBvcmlnaW5hbCBlZGdlLlxuICogQGNsYXNzXG4gKi9cbmNsYXNzIFJlZ2lvbiB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIGRhdGEpIHtcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcbiAgICB0aGlzLnRvcCA9IGRhdGEucmVnaW9uX2luZm8uYm91bmRpbmdfYm94LnRvcF9yb3c7XG4gICAgdGhpcy5sZWZ0ID0gZGF0YS5yZWdpb25faW5mby5ib3VuZGluZ19ib3gubGVmdF9jb2w7XG4gICAgdGhpcy5ib3R0b20gPSBkYXRhLnJlZ2lvbl9pbmZvLmJvdW5kaW5nX2JveC5ib3R0b21fcm93O1xuICAgIHRoaXMucmlnaHQgPSBkYXRhLnJlZ2lvbl9pbmZvLmJvdW5kaW5nX2JveC5yaWdodF9jb2w7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWdpb247XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Region.js","/")
    },{"buffer":30,"pBGvAp":35}],55:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var Region = require('./Region');
    
    /**
     * A collection of regions.
     * @class
     */
    
    var Regions = function () {
      function Regions(_config) {
        var _this = this;
    
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Regions);
    
        this._config = _config;
        this.rawData = rawData;
        rawData.forEach(function (regionData, index) {
          _this[index] = new Region(_this._config, regionData);
        });
        this.length = rawData.length;
      }
    
      _createClass(Regions, [{
        key: Symbol.iterator,
        value: function value() {
          var _this2 = this;
    
          var index = -1;
          return {
            next: function next() {
              return { value: _this2[++index], done: index >= _this2.length };
            }
          };
        }
      }]);
    
      return Regions;
    }();
    
    module.exports = Regions;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlJlZ2lvbnMuanMiXSwibmFtZXMiOlsiUmVnaW9uIiwicmVxdWlyZSIsIlJlZ2lvbnMiLCJfY29uZmlnIiwicmF3RGF0YSIsImZvckVhY2giLCJyZWdpb25EYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJTeW1ib2wiLCJpdGVyYXRvciIsIm5leHQiLCJ2YWx1ZSIsImRvbmUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxTQUFTQyxRQUFRLFVBQVIsQ0FBYjs7QUFFQTs7Ozs7SUFJTUMsTztBQUNKLG1CQUFZQyxPQUFaLEVBQW1DO0FBQUE7O0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUNqQyxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLQyxPQUFMLEdBQWVBLE9BQWY7QUFDQUEsWUFBUUMsT0FBUixDQUFnQixVQUFDQyxVQUFELEVBQWFDLEtBQWIsRUFBdUI7QUFDckMsWUFBS0EsS0FBTCxJQUFjLElBQUlQLE1BQUosQ0FBVyxNQUFLRyxPQUFoQixFQUF5QkcsVUFBekIsQ0FBZDtBQUNELEtBRkQ7QUFHQSxTQUFLRSxNQUFMLEdBQWNKLFFBQVFJLE1BQXRCO0FBQ0Q7OztTQUVBQyxPQUFPQyxROzRCQUFZO0FBQUE7O0FBQ2xCLFVBQUlILFFBQVEsQ0FBQyxDQUFiO0FBQ0EsYUFBTztBQUNMSSxjQUFNO0FBQUEsaUJBQU8sRUFBRUMsT0FBTyxPQUFLLEVBQUVMLEtBQVAsQ0FBVCxFQUF3Qk0sTUFBTU4sU0FBUyxPQUFLQyxNQUE1QyxFQUFQO0FBQUE7QUFERCxPQUFQO0FBR0Q7Ozs7OztBQUdITSxPQUFPQyxPQUFQLEdBQWlCYixPQUFqQiIsImZpbGUiOiJSZWdpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IFJlZ2lvbiA9IHJlcXVpcmUoJy4vUmVnaW9uJyk7XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHJlZ2lvbnMuXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgUmVnaW9ucyB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIHJhd0RhdGEgPSBbXSkge1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gICAgdGhpcy5yYXdEYXRhID0gcmF3RGF0YTtcbiAgICByYXdEYXRhLmZvckVhY2goKHJlZ2lvbkRhdGEsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzW2luZGV4XSA9IG5ldyBSZWdpb24odGhpcy5fY29uZmlnLCByZWdpb25EYXRhKTtcbiAgICB9KTtcbiAgICB0aGlzLmxlbmd0aCA9IHJhd0RhdGEubGVuZ3RoO1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgbGV0IGluZGV4ID0gLTE7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+ICh7IHZhbHVlOiB0aGlzWysraW5kZXhdLCBkb25lOiBpbmRleCA+PSB0aGlzLmxlbmd0aCB9KVxuICAgIH07XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVnaW9ucztcbiJdfQ==
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Regions.js","/")
    },{"./Region":54,"buffer":30,"pBGvAp":35}],56:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    var _utils = require('./utils');
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    
    var _require = require('./constants'),
        API = _require.API,
        replaceVars = _require.replaceVars;
    
    var WORKFLOWS_PATH = API.WORKFLOWS_PATH,
        WORKFLOW_PATH = API.WORKFLOW_PATH,
        WORKFLOW_RESULTS_PATH = API.WORKFLOW_RESULTS_PATH;
    
    var _require2 = require('./utils'),
        wrapToken = _require2.wrapToken,
        formatInput = _require2.formatInput;
    
    var _require3 = require('./helpers'),
        checkType = _require3.checkType;
    
    /**
     * class representing a workflow
     * @class
     */
    
    
    var Workflow = function () {
      function Workflow(_config) {
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Workflow);
    
        this._config = _config;
        this.rawData = rawData;
        this.id = rawData.id;
        this.createdAt = rawData.created_at || rawData.createdAt;
        this.appId = rawData.app_id || rawData.appId;
      }
    
      /**
       * @deprecated
       */
    
    
      _createClass(Workflow, [{
        key: 'create',
        value: function create(workflowId, config) {
          var url = '' + this._config.basePath + WORKFLOWS_PATH;
          var modelId = config.modelId;
          var modelVersionId = config.modelVersionId;
          var body = {
            workflows: [{
              id: workflowId,
              nodes: [{
                id: 'concepts',
                model: {
                  id: modelId,
                  model_version: {
                    id: modelVersionId
                  }
                }
              }]
            }]
          };
    
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, body, {
                headers: headers
              }).then(function (response) {
                var workflowId = response.data.workflows[0].id;
                resolve(workflowId);
              }, reject);
            });
          });
        }
    
        /**
         * @deprecated
         */
    
      }, {
        key: 'delete',
        value: function _delete(workflowId, config) {
          var url = '' + this._config.basePath + replaceVars(WORKFLOW_PATH, [workflowId]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.delete(url, {
                headers: headers
              }).then(function (response) {
                var data = response.data;
                resolve(data);
              }, reject);
            });
          });
        }
    
        /**
         * Returns workflow output according to inputs
         * @param {string}                   workflowId    Workflow id
         * @param {object[]|object|string}   inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
         *    @param {object}                  inputs[].image     Object with keys explained below:
         *       @param {string}                 inputs[].image.(url|base64)  Can be a publicly accessibly url or base64 string representing image bytes (required)
         * @param {object} config An object with keys explained below.
         *   @param {float} config.minValue The minimum confidence threshold that a result must meet. From 0.0 to 1.0
         *   @param {number} config.maxConcepts The maximum number of concepts to return
         */
    
      }, {
        key: 'predict',
        value: function predict(workflowId, inputs) {
          var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    
          var url = '' + this._config.basePath + replaceVars(WORKFLOW_RESULTS_PATH, [workflowId]);
          if (checkType(/(Object|String)/, inputs)) {
            inputs = [inputs];
          }
          return wrapToken(this._config, function (headers) {
            var params = {
              inputs: inputs.map(formatInput)
            };
            if (config && Object.getOwnPropertyNames(config).length > 0) {
              params['output_config'] = (0, _utils.formatObjectForSnakeCase)(config);
            }
            return new Promise(function (resolve, reject) {
              axios.post(url, params, {
                headers: headers
              }).then(function (response) {
                var data = response.data;
                resolve(data);
              }, reject);
            });
          });
        }
      }]);
    
      return Workflow;
    }();
    
    module.exports = Workflow;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIldvcmtmbG93LmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkFQSSIsInJlcGxhY2VWYXJzIiwiV09SS0ZMT1dTX1BBVEgiLCJXT1JLRkxPV19QQVRIIiwiV09SS0ZMT1dfUkVTVUxUU19QQVRIIiwid3JhcFRva2VuIiwiZm9ybWF0SW5wdXQiLCJjaGVja1R5cGUiLCJXb3JrZmxvdyIsIl9jb25maWciLCJyYXdEYXRhIiwiaWQiLCJjcmVhdGVkQXQiLCJjcmVhdGVkX2F0IiwiYXBwSWQiLCJhcHBfaWQiLCJ3b3JrZmxvd0lkIiwiY29uZmlnIiwidXJsIiwiYmFzZVBhdGgiLCJtb2RlbElkIiwibW9kZWxWZXJzaW9uSWQiLCJib2R5Iiwid29ya2Zsb3dzIiwibm9kZXMiLCJtb2RlbCIsIm1vZGVsX3ZlcnNpb24iLCJoZWFkZXJzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJwb3N0IiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsImRlbGV0ZSIsImlucHV0cyIsInBhcmFtcyIsIm1hcCIsIk9iamVjdCIsImdldE93blByb3BlcnR5TmFtZXMiLCJsZW5ndGgiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7QUFFQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjs7ZUFDeUJBLFFBQVEsYUFBUixDO0lBQXBCQyxHLFlBQUFBLEc7SUFBS0MsVyxZQUFBQSxXOztJQUNMQyxjLEdBQXdERixHLENBQXhERSxjO0lBQWdCQyxhLEdBQXdDSCxHLENBQXhDRyxhO0lBQWVDLHFCLEdBQXlCSixHLENBQXpCSSxxQjs7Z0JBQ0xMLFFBQVEsU0FBUixDO0lBQTFCTSxTLGFBQUFBLFM7SUFBV0MsVyxhQUFBQSxXOztnQkFDRVAsUUFBUSxXQUFSLEM7SUFBYlEsUyxhQUFBQSxTOztBQUVMOzs7Ozs7SUFJTUMsUTtBQUNKLG9CQUFZQyxPQUFaLEVBQWlDO0FBQUEsUUFBWkMsT0FBWSx1RUFBSixFQUFJOztBQUFBOztBQUMv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TUFBVixFQUFxQjtBQUN0Q2hDLGdCQUFNaUMsSUFBTixDQUFXYixHQUFYLEVBQWdCbUIsTUFBaEIsRUFBd0I7QUFDdEJWO0FBRHNCLFdBQXhCLEVBRUdLLElBRkgsQ0FFUSxVQUFDQyxRQUFELEVBQWM7QUFDcEIsZ0JBQU1DLE9BQU9ELFNBQVNDLElBQXRCO0FBQ0FMLG9CQUFRSyxJQUFSO0FBQ0QsV0FMRCxFQUtHSixNQUxIO0FBTUQsU0FQTSxDQUFQO0FBUUQsT0FmTSxDQUFQO0FBZ0JEOzs7Ozs7QUFHSFksT0FBT0MsT0FBUCxHQUFpQm5DLFFBQWpCIiwiZmlsZSI6IldvcmtmbG93LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtmb3JtYXRPYmplY3RGb3JTbmFrZUNhc2V9IGZyb20gJy4vdXRpbHMnO1xuXG5sZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IHtBUEksIHJlcGxhY2VWYXJzfSA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XG5sZXQge1dPUktGTE9XU19QQVRILCBXT1JLRkxPV19QQVRILCBXT1JLRkxPV19SRVNVTFRTX1BBVEh9ID0gQVBJO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdElucHV0fSA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmxldCB7Y2hlY2tUeXBlfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIHdvcmtmbG93XG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgV29ya2Zsb3cge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCByYXdEYXRhPVtdKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSByYXdEYXRhO1xuICAgIHRoaXMuaWQgPSByYXdEYXRhLmlkO1xuICAgIHRoaXMuY3JlYXRlZEF0ID0gcmF3RGF0YS5jcmVhdGVkX2F0IHx8IHJhd0RhdGEuY3JlYXRlZEF0O1xuICAgIHRoaXMuYXBwSWQgPSByYXdEYXRhLmFwcF9pZCB8fCByYXdEYXRhLmFwcElkO1xuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqL1xuICBjcmVhdGUod29ya2Zsb3dJZCwgY29uZmlnKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7V09SS0ZMT1dTX1BBVEh9YDtcbiAgICBjb25zdCBtb2RlbElkID0gY29uZmlnLm1vZGVsSWQ7XG4gICAgY29uc3QgbW9kZWxWZXJzaW9uSWQgPSBjb25maWcubW9kZWxWZXJzaW9uSWQ7XG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIHdvcmtmbG93czogW3tcbiAgICAgICAgaWQ6IHdvcmtmbG93SWQsXG4gICAgICAgIG5vZGVzOiBbe1xuICAgICAgICAgIGlkOiAnY29uY2VwdHMnLFxuICAgICAgICAgIG1vZGVsOiB7XG4gICAgICAgICAgICBpZDogbW9kZWxJZCxcbiAgICAgICAgICAgIG1vZGVsX3ZlcnNpb246IHtcbiAgICAgICAgICAgICAgaWQ6IG1vZGVsVmVyc2lvbklkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XVxuICAgICAgfV1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgYm9keSwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgY29uc3Qgd29ya2Zsb3dJZCA9IHJlc3BvbnNlLmRhdGEud29ya2Zsb3dzWzBdLmlkO1xuICAgICAgICAgIHJlc29sdmUod29ya2Zsb3dJZCk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKi9cbiAgZGVsZXRlKHdvcmtmbG93SWQsIGNvbmZpZykge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKFdPUktGTE9XX1BBVEgsIFt3b3JrZmxvd0lkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmRlbGV0ZSh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzXG4gICAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHdvcmtmbG93IG91dHB1dCBhY2NvcmRpbmcgdG8gaW5wdXRzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICB3b3JrZmxvd0lkICAgIFdvcmtmbG93IGlkXG4gICAqIEBwYXJhbSB7b2JqZWN0W118b2JqZWN0fHN0cmluZ30gICBpbnB1dHMgICAgQW4gYXJyYXkgb2Ygb2JqZWN0cy9vYmplY3Qvc3RyaW5nIHBvaW50aW5nIHRvIGFuIGltYWdlIHJlc291cmNlLiBBIHN0cmluZyBjYW4gZWl0aGVyIGJlIGEgdXJsIG9yIGJhc2U2NCBpbWFnZSBieXRlcy4gT2JqZWN0IGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbWFnZSAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6XG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UuKHVybHxiYXNlNjQpICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgQW4gb2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3cuXG4gICAqICAgQHBhcmFtIHtmbG9hdH0gY29uZmlnLm1pblZhbHVlIFRoZSBtaW5pbXVtIGNvbmZpZGVuY2UgdGhyZXNob2xkIHRoYXQgYSByZXN1bHQgbXVzdCBtZWV0LiBGcm9tIDAuMCB0byAxLjBcbiAgICogICBAcGFyYW0ge251bWJlcn0gY29uZmlnLm1heENvbmNlcHRzIFRoZSBtYXhpbXVtIG51bWJlciBvZiBjb25jZXB0cyB0byByZXR1cm5cbiAgICovXG4gIHByZWRpY3Qod29ya2Zsb3dJZCwgaW5wdXRzLCBjb25maWcgPSB7fSkge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKFdPUktGTE9XX1JFU1VMVFNfUEFUSCwgW3dvcmtmbG93SWRdKX1gO1xuICAgIGlmIChjaGVja1R5cGUoLyhPYmplY3R8U3RyaW5nKS8sIGlucHV0cykpIHtcbiAgICAgIGlucHV0cyA9IFtpbnB1dHNdO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgaW5wdXRzOiBpbnB1dHMubWFwKGZvcm1hdElucHV0KVxuICAgICAgfTtcbiAgICAgIGlmIChjb25maWcgJiYgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY29uZmlnKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHBhcmFtc1snb3V0cHV0X2NvbmZpZyddID0gZm9ybWF0T2JqZWN0Rm9yU25ha2VDYXNlKGNvbmZpZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgcGFyYW1zLCB7XG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdvcmtmbG93O1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Workflow.js","/")
    },{"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35}],57:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    var Workflow = require('./Workflow');
    
    var _require = require('./constants'),
        API = _require.API,
        replaceVars = _require.replaceVars;
    
    var WORKFLOWS_PATH = API.WORKFLOWS_PATH,
        WORKFLOW_PATH = API.WORKFLOW_PATH;
    
    var _require2 = require('./utils'),
        wrapToken = _require2.wrapToken;
    
    var _require3 = require('./helpers'),
        isSuccess = _require3.isSuccess;
    
    /**
     * class representing a collection of workflows
     * @class
     */
    
    
    var Workflows = function () {
      function Workflows(_config) {
        var _this = this;
    
        var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        _classCallCheck(this, Workflows);
    
        this._config = _config;
        this.rawData = rawData;
        rawData.forEach(function (workflowData, index) {
          _this[index] = new Workflow(_this._config, workflowData);
        });
        this.length = rawData.length;
      }
    
      /**
       * Get all workflows in app
       * @param {Object}    options  Object with keys explained below: (optional)
       *   @param {Number}    options.page  The page number (optional, default: 1)
       *   @param {Number}    options.perPage  Number of images to return per page (optional, default: 20)
       * @return {Promise(Workflows, error)} A Promise that is fulfilled with an instance of Workflows or rejected with an error
       */
    
    
      _createClass(Workflows, [{
        key: 'list',
        value: function list() {
          var _this2 = this;
    
          var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };
    
          var url = '' + this._config.basePath + WORKFLOWS_PATH;
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.get(url, {
                headers: headers,
                params: {
                  page: options.page,
                  per_page: options.perPage
                }
              }).then(function (response) {
                if (isSuccess(response)) {
                  resolve(new Workflows(_this2._config, response.data.workflows));
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }, {
        key: 'create',
        value: function create(workflowId, config) {
          var url = '' + this._config.basePath + WORKFLOWS_PATH;
          var modelId = config.modelId;
          var modelVersionId = config.modelVersionId;
          var body = {
            workflows: [{
              id: workflowId,
              nodes: [{
                id: 'concepts',
                model: {
                  id: modelId,
                  model_version: {
                    id: modelVersionId
                  }
                }
              }]
            }]
          };
    
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.post(url, body, {
                headers: headers
              }).then(function (response) {
                var workflowId = response.data.workflows[0].id;
                resolve(workflowId);
              }, reject);
            });
          });
        }
      }, {
        key: 'delete',
        value: function _delete(workflowId) {
          var url = '' + this._config.basePath + replaceVars(WORKFLOW_PATH, [workflowId]);
          return wrapToken(this._config, function (headers) {
            return new Promise(function (resolve, reject) {
              axios.delete(url, {
                headers: headers
              }).then(function (response) {
                var data = response.data;
                resolve(data);
              }, reject);
            });
          });
        }
      }]);
    
      return Workflows;
    }();
    
    ;
    
    module.exports = Workflows;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIldvcmtmbG93cy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJXb3JrZmxvdyIsIkFQSSIsInJlcGxhY2VWYXJzIiwiV09SS0ZMT1dTX1BBVEgiLCJXT1JLRkxPV19QQVRIIiwid3JhcFRva2VuIiwiaXNTdWNjZXNzIiwiV29ya2Zsb3dzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwid29ya2Zsb3dEYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJvcHRpb25zIiwicGFnZSIsInBlclBhZ2UiLCJ1cmwiLCJiYXNlUGF0aCIsImhlYWRlcnMiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImdldCIsInBhcmFtcyIsInBlcl9wYWdlIiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsIndvcmtmbG93cyIsIndvcmtmbG93SWQiLCJjb25maWciLCJtb2RlbElkIiwibW9kZWxWZXJzaW9uSWQiLCJib2R5IiwiaWQiLCJub2RlcyIsIm1vZGVsIiwibW9kZWxfdmVyc2lvbiIsInBvc3QiLCJkZWxldGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQUlDLFdBQVdELFFBQVEsWUFBUixDQUFmOztlQUN5QkEsUUFBUSxhQUFSLEM7SUFBcEJFLEcsWUFBQUEsRztJQUFLQyxXLFlBQUFBLFc7O0lBQ0xDLGMsR0FBa0NGLEcsQ0FBbENFLGM7SUFBZ0JDLGEsR0FBa0JILEcsQ0FBbEJHLGE7O2dCQUNGTCxRQUFRLFNBQVIsQztJQUFkTSxTLGFBQUFBLFM7O2dCQUNjTixRQUFRLFdBQVIsQztJQUFkTyxTLGFBQUFBLFM7O0FBRUw7Ozs7OztJQUlNQyxTO0FBQ0oscUJBQVlDLE9BQVosRUFBbUM7QUFBQTs7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pDLFNBQUtELE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtDLE9BQUwsR0FBZUEsT0FB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QU1ELFNBUE0sQ0FBUDtBQVFELE9BVE0sQ0FBUDtBQVVEOzs7Ozs7QUFFSDs7QUFFQW1CLE9BQU9DLE9BQVAsR0FBaUJuQyxTQUFqQiIsImZpbGUiOiJXb3JrZmxvd3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IFdvcmtmbG93ID0gcmVxdWlyZSgnLi9Xb3JrZmxvdycpO1xubGV0IHtBUEksIHJlcGxhY2VWYXJzfSA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XG5sZXQge1dPUktGTE9XU19QQVRILCBXT1JLRkxPV19QQVRILH0gPSBBUEk7XG5sZXQge3dyYXBUb2tlbix9ID0gcmVxdWlyZSgnLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIGNvbGxlY3Rpb24gb2Ygd29ya2Zsb3dzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgV29ya2Zsb3dzIHtcbiAgY29uc3RydWN0b3IoX2NvbmZpZywgcmF3RGF0YSA9IFtdKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSByYXdEYXRhO1xuICAgIHJhd0RhdGEuZm9yRWFjaCgod29ya2Zsb3dEYXRhLCBpbmRleCkgPT4ge1xuICAgICAgdGhpc1tpbmRleF0gPSBuZXcgV29ya2Zsb3codGhpcy5fY29uZmlnLCB3b3JrZmxvd0RhdGEpO1xuICAgIH0pO1xuICAgIHRoaXMubGVuZ3RoID0gcmF3RGF0YS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCB3b3JrZmxvd3MgaW4gYXBwXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICBvcHRpb25zICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICBvcHRpb25zLnBhZ2UgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtOdW1iZXJ9ICAgIG9wdGlvbnMucGVyUGFnZSAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShXb3JrZmxvd3MsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgV29ya2Zsb3dzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGxpc3Qob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7V09SS0ZMT1dTX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgcGFnZTogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgcGVyX3BhZ2U6IG9wdGlvbnMucGVyUGFnZSxcbiAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IFdvcmtmbG93cyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEud29ya2Zsb3dzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBjcmVhdGUod29ya2Zsb3dJZCwgY29uZmlnKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7V09SS0ZMT1dTX1BBVEh9YDtcbiAgICBjb25zdCBtb2RlbElkID0gY29uZmlnLm1vZGVsSWQ7XG4gICAgY29uc3QgbW9kZWxWZXJzaW9uSWQgPSBjb25maWcubW9kZWxWZXJzaW9uSWQ7XG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIHdvcmtmbG93czogW3tcbiAgICAgICAgaWQ6IHdvcmtmbG93SWQsXG4gICAgICAgIG5vZGVzOiBbe1xuICAgICAgICAgIGlkOiAnY29uY2VwdHMnLFxuICAgICAgICAgIG1vZGVsOiB7XG4gICAgICAgICAgICBpZDogbW9kZWxJZCxcbiAgICAgICAgICAgIG1vZGVsX3ZlcnNpb246IHtcbiAgICAgICAgICAgICAgaWQ6IG1vZGVsVmVyc2lvbklkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XVxuICAgICAgfV1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgYm9keSwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgY29uc3Qgd29ya2Zsb3dJZCA9IHJlc3BvbnNlLmRhdGEud29ya2Zsb3dzWzBdLmlkO1xuICAgICAgICAgIHJlc29sdmUod29ya2Zsb3dJZCk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh3b3JrZmxvd0lkKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoV09SS0ZMT1dfUEFUSCwgW3dvcmtmbG93SWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZGVsZXRlKHVybCwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gV29ya2Zsb3dzO1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Workflows.js","/")
    },{"./Workflow":56,"./constants":58,"./helpers":60,"./utils":63,"axios":4,"buffer":30,"pBGvAp":35}],58:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var MAX_BATCH_SIZE = 128;
    var GEO_LIMIT_TYPES = ['withinMiles', 'withinKilometers', 'withinRadians', 'withinDegrees'];
    var SYNC_TIMEOUT = 360000; // 6 minutes
    var MODEL_QUEUED_FOR_TRAINING = '21103';
    var MODEL_TRAINING = '21101';
    var POLLTIME = 2000;
    
    module.exports = {
      API: {
        TOKEN_PATH: '/token',
        MODELS_PATH: '/models',
        MODEL_PATH: '/models/$0',
        MODEL_VERSIONS_PATH: '/models/$0/versions',
        MODEL_VERSION_PATH: '/models/$0/versions/$1',
        MODEL_PATCH_PATH: '/models/$0/output_info/data/concepts',
        MODEL_OUTPUT_PATH: '/models/$0/output_info',
        MODEL_VERSION_OUTPUT_PATH: '/models/$0/versions/$1/output_info',
        MODEL_SEARCH_PATH: '/models/searches',
        MODEL_FEEDBACK_PATH: '/models/$0/feedback',
        MODEL_VERSION_FEEDBACK_PATH: '/models/$0/versions/$1/feedback',
        PREDICT_PATH: '/models/$0/outputs',
        VERSION_PREDICT_PATH: '/models/$0/versions/$1/outputs',
        CONCEPTS_PATH: '/concepts',
        CONCEPT_PATH: '/concepts/$0',
        CONCEPT_SEARCH_PATH: '/concepts/searches',
        MODEL_INPUTS_PATH: '/models/$0/inputs',
        MODEL_VERSION_INPUTS_PATH: '/models/$0/versions/$1/inputs',
        MODEL_VERSION_METRICS_PATH: '/models/$0/versions/$1/metrics',
        INPUTS_PATH: '/inputs',
        INPUT_PATH: '/inputs/$0',
        INPUTS_STATUS_PATH: '/inputs/status',
        SEARCH_PATH: '/searches',
        SEARCH_FEEDBACK_PATH: '/searches/feedback',
        WORKFLOWS_PATH: '/workflows',
        WORKFLOW_PATH: '/workflows/$0',
        WORKFLOW_RESULTS_PATH: '/workflows/$0/results'
      },
      ERRORS: {
        paramsRequired: function paramsRequired(param) {
          var paramList = Array.isArray(param) ? param : [param];
          return new Error('The following ' + (paramList.length > 1 ? 'params are' : 'param is') + ' required: ' + paramList.join(', '));
        },
        MAX_INPUTS: new Error('Number of inputs passed exceeded max of ' + MAX_BATCH_SIZE),
        INVALID_GEOLIMIT_TYPE: new Error('Incorrect geo_limit type. Value must be any of the following: ' + GEO_LIMIT_TYPES.join(', ')),
        INVALID_DELETE_ARGS: new Error('Wrong arguments passed. You can only delete all models (provide no arguments), delete select models (provide list of ids),\n    delete a single model (providing a single id) or delete a model version (provide a single id and version id)')
      },
      STATUS: {
        MODEL_QUEUED_FOR_TRAINING: MODEL_QUEUED_FOR_TRAINING,
        MODEL_TRAINING: MODEL_TRAINING
      },
      // var replacement must be given in order
      replaceVars: function replaceVars(path) {
        var vars = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    
        var newPath = path;
        vars.forEach(function (val, index) {
          if (index === 0) {
            val = encodeURIComponent(val);
          }
          newPath = newPath.replace(new RegExp('\\$' + index, 'g'), val);
        });
        return newPath;
      },
      getBasePath: function getBasePath() {
        var apiEndpoint = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'https://api.clarifai.com';
        var userId = arguments[1];
        var appId = arguments[2];
    
        if (!userId || !appId) {
          return apiEndpoint + '/v2';
        }
        return apiEndpoint + '/v2/users/' + userId + '/apps/' + appId;
      },
      GEO_LIMIT_TYPES: GEO_LIMIT_TYPES,
      MAX_BATCH_SIZE: MAX_BATCH_SIZE,
      SYNC_TIMEOUT: SYNC_TIMEOUT,
      POLLTIME: POLLTIME
    };
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnN0YW50cy5qcyJdLCJuYW1lcyI6WyJNQVhfQkFUQ0hfU0laRSIsIkdFT19MSU1JVF9UWVBFUyIsIlNZTkNfVElNRU9VVCIsIk1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkciLCJNT0RFTF9UUkFJTklORyIsIlBPTExUSU1FIiwibW9kdWxlIiwiZXhwb3J0cyIsIkFQSSIsIlRPS0VOX1BBVEgiLCJNT0RFTFNfUEFUSCIsIk1PREVMX1BBVEgiLCJNT0RFTF9WRVJTSU9OU19QQVRIIiwiTU9ERUxfVkVSU0lPTl9QQVRIIiwiTU9ERUxfUEFUQ0hfUEFUSCIsIk1PREVMX09VVFBVVF9QQVRIIiwiTU9ERUxfVkVSU0lPTl9PVVRQVVRfUEFUSCIsIk1PREVMX1NFQVJDSF9QQVRIIiwiTU9ERUxfRkVFREJBQ0tfUEFUSCIsIk1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSCIsIlBSRURJQ1RfUEFUSCIsIlZFUlNJT05fUFJFRElDVF9QQVRIIiwiQ09OQ0VQVFNfUEFUSCIsIkNPTkNFUFRfUEFUSCIsIkNPTkNFUFRfU0VBUkNIX1BBVEgiLCJNT0RFTF9JTlBVVFNfUEFUSCIsIk1PREVMX1ZFUlNJT05fSU5QVVRTX1BBVEgiLCJNT0RFTF9WRVJTSU9OX01FVFJJQ1NfUEFUSCIsIklOUFVUU19QQVRIIiwiSU5QVVRfUEFUSCIsIklOUFVUU19TVEFUVVNfUEFUSCIsIlNFQVJDSF9QQVRIIiwiU0VBUkNIX0ZFRURCQUNLX1BBVEgiLCJXT1JLRkxPV1NfUEFUSCIsIldPUktGTE9XX1BBVEgiLCJXT1JLRkxPV19SRVNVTFRTX1BBVEgiLCJFUlJPUlMiLCJwYXJhbXNSZXF1aXJlZCIsInBhcmFtIiwicGFyYW1MaXN0IiwiQXJyYXkiLCJpc0FycmF5IiwiRXJyb3IiLCJsZW5ndGgiLCJqb2luIiwiTUFYX0lOUFVUUyIsIklOVkFMSURfR0VPTElNSVRfVFlQRSIsIklOVkFMSURfREVMRVRFX0FSR1MiLCJTVEFUVVMiLCJyZXBsYWNlVmFycyIsInBhdGgiLCJ2YXJzIiwibmV3UGF0aCIsImZvckVhY2giLCJ2YWwiLCJpbmRleCIsImVuY29kZVVSSUNvbXBvbmVudCIsInJlcGxhY2UiLCJSZWdFeHAiLCJnZXRCYXNlUGF0aCIsImFwaUVuZHBvaW50IiwidXNlcklkIiwiYXBwSWQiXSwibWFwcGluZ3MiOiI7O0FBQUEsSUFBTUEsaUJBQWlCLEdBQXZCO0FBQ0EsSUFBTUMsa0JBQWtCLENBQUMsYUFBRCxFQUFnQixrQkFBaEIsRUFBb0MsZUFBcEMsRUFBcUQsZUFBckQsQ0FBeEI7QUFDQSxJQUFNQyxlQUFlLE1BQXJCLEMsQ0FBNkI7QUFDN0IsSUFBTUMsNEJBQTRCLE9BQWxDO0FBQ0EsSUFBTUMsaUJBQWlCLE9BQXZCO0FBQ0EsSUFBTUMsV0FBVyxJQUFqQjs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxPQUFLO0FBQ0hDLGdCQUFZLFFBRFQ7QUFFSEMsaUJBQWEsU0FGVjtBQUdIQyxnQkFBWSxZQUhUO0FBSUhDLHlCQUFxQixxQkFKbEI7QUFLSEMsd0JBQW9CLHdCQUxqQjtBQU1IQyxzQkFBa0Isc0NBTmY7QUFPSEMsdUJBQW1CLHdCQVBoQjtBQVFIQywrQkFBMkIsb0NBUnhCO0FBU0hDLHVCQUFtQixrQkFUaEI7QUFVSEMseUJBQXFCLHFCQVZsQjtBQVdIQyxpQ0FBNkIsaUNBWDFCO0FBWUhDLGtCQUFjLG9CQVpYO0FBYUhDLDBCQUFzQixnQ0FibkI7QUFjSEMsbUJBQWUsV0FkWjtBQWVIQyxrQkFBYyxjQWZYO0FBZ0JIQyx5QkFBcUIsb0JBaEJsQjtBQWlCSEMsdUJBQW1CLG1CQWpCaEI7QUFrQkhDLCtCQUEyQiwrQkFsQnhCO0FBbUJIQyxnQ0FBNEIsZ0NBbkJ6QjtBQW9CSEMsaUJBQWEsU0FwQlY7QUFxQkhDLGdCQUFZLFlBckJUO0FBc0JIQyx3QkFBb0IsZ0JBdEJqQjtBQXVCSEMsaUJBQWEsV0F2QlY7QUF3QkhDLDBCQUFzQixvQkF4Qm5CO0FBeUJIQyxvQkFBZ0IsWUF6QmI7QUEwQkhDLG1CQUFlLGVBMUJaO0FBMkJIQywyQkFBdUI7QUEzQnBCLEdBRFU7QUE4QmZDLFVBQVE7QUFDTkMsb0JBQWdCLHdCQUFDQyxLQUFELEVBQVc7QUFDekIsVUFBSUMsWUFBWUMsTUFBTUMsT0FBTixDQUFjSCxLQUFkLElBQXVCQSxLQUF2QixHQUErQixDQUFDQSxLQUFELENBQS9DO0FBQ0EsYUFBTyxJQUFJSSxLQUFKLHFCQUEyQkgsVUFBVUksTUFBVixHQUFtQixDQUFuQixHQUF1QixZQUF2QixHQUFzQyxVQUFqRSxvQkFBeUZKLFVBQVVLLElBQVYsQ0FBZSxJQUFmLENBQXpGLENBQVA7QUFDRCxLQUpLO0FBS05DLGdCQUFZLElBQUlILEtBQUosOENBQXFEMUMsY0FBckQsQ0FMTjtBQU1OOEMsMkJBQXVCLElBQUlKLEtBQUosb0VBQTJFekMsZ0JBQWdCMkMsSUFBaEIsQ0FBcUIsSUFBckIsQ0FBM0UsQ0FOakI7QUFPTkcseUJBQXFCLElBQUlMLEtBQUo7QUFQZixHQTlCTztBQXdDZk0sVUFBUTtBQUNON0Msd0RBRE07QUFFTkM7QUFGTSxHQXhDTztBQTRDZjtBQUNBNkMsZUFBYSxxQkFBQ0MsSUFBRCxFQUFxQjtBQUFBLFFBQWRDLElBQWMsdUVBQVAsRUFBTzs7QUFDaEMsUUFBSUMsVUFBVUYsSUFBZDtBQUNBQyxTQUFLRSxPQUFMLENBQWEsVUFBQ0MsR0FBRCxFQUFNQyxLQUFOLEVBQWdCO0FBQzNCLFVBQUlBLFVBQVUsQ0FBZCxFQUFpQjtBQUNmRCxjQUFNRSxtQkFBbUJGLEdBQW5CLENBQU47QUFDRDtBQUNERixnQkFBVUEsUUFBUUssT0FBUixDQUFnQixJQUFJQyxNQUFKLFNBQWlCSCxLQUFqQixFQUEwQixHQUExQixDQUFoQixFQUFnREQsR0FBaEQsQ0FBVjtBQUNELEtBTEQ7QUFNQSxXQUFPRixPQUFQO0FBQ0QsR0F0RGM7QUF1RGZPLGVBQWEsdUJBQTZEO0FBQUEsUUFBNURDLFdBQTRELHVFQUE5QywwQkFBOEM7QUFBQSxRQUFsQkMsTUFBa0I7QUFBQSxRQUFWQyxLQUFVOztBQUN4RSxRQUFHLENBQUNELE1BQUQsSUFBVyxDQUFDQyxLQUFmLEVBQXNCO0FBQ3BCLGFBQVVGLFdBQVY7QUFDRDtBQUNELFdBQVVBLFdBQVYsa0JBQWtDQyxNQUFsQyxjQUFpREMsS0FBakQ7QUFDRCxHQTVEYztBQTZEZjdELGtDQTdEZTtBQThEZkQsZ0NBOURlO0FBK0RmRSw0QkEvRGU7QUFnRWZHO0FBaEVlLENBQWpCIiwiZmlsZSI6ImNvbnN0YW50cy5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IE1BWF9CQVRDSF9TSVpFID0gMTI4O1xuY29uc3QgR0VPX0xJTUlUX1RZUEVTID0gWyd3aXRoaW5NaWxlcycsICd3aXRoaW5LaWxvbWV0ZXJzJywgJ3dpdGhpblJhZGlhbnMnLCAnd2l0aGluRGVncmVlcyddO1xuY29uc3QgU1lOQ19USU1FT1VUID0gMzYwMDAwOyAvLyA2IG1pbnV0ZXNcbmNvbnN0IE1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkcgPSAnMjExMDMnO1xuY29uc3QgTU9ERUxfVFJBSU5JTkcgPSAnMjExMDEnO1xuY29uc3QgUE9MTFRJTUUgPSAyMDAwO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgQVBJOiB7XG4gICAgVE9LRU5fUEFUSDogJy90b2tlbicsXG4gICAgTU9ERUxTX1BBVEg6ICcvbW9kZWxzJyxcbiAgICBNT0RFTF9QQVRIOiAnL21vZGVscy8kMCcsXG4gICAgTU9ERUxfVkVSU0lPTlNfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMnLFxuICAgIE1PREVMX1ZFUlNJT05fUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEnLFxuICAgIE1PREVMX1BBVENIX1BBVEg6ICcvbW9kZWxzLyQwL291dHB1dF9pbmZvL2RhdGEvY29uY2VwdHMnLFxuICAgIE1PREVMX09VVFBVVF9QQVRIOiAnL21vZGVscy8kMC9vdXRwdXRfaW5mbycsXG4gICAgTU9ERUxfVkVSU0lPTl9PVVRQVVRfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvb3V0cHV0X2luZm8nLFxuICAgIE1PREVMX1NFQVJDSF9QQVRIOiAnL21vZGVscy9zZWFyY2hlcycsXG4gICAgTU9ERUxfRkVFREJBQ0tfUEFUSDogJy9tb2RlbHMvJDAvZmVlZGJhY2snLFxuICAgIE1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvZmVlZGJhY2snLFxuICAgIFBSRURJQ1RfUEFUSDogJy9tb2RlbHMvJDAvb3V0cHV0cycsXG4gICAgVkVSU0lPTl9QUkVESUNUX1BBVEg6ICcvbW9kZWxzLyQwL3ZlcnNpb25zLyQxL291dHB1dHMnLFxuICAgIENPTkNFUFRTX1BBVEg6ICcvY29uY2VwdHMnLFxuICAgIENPTkNFUFRfUEFUSDogJy9jb25jZXB0cy8kMCcsXG4gICAgQ09OQ0VQVF9TRUFSQ0hfUEFUSDogJy9jb25jZXB0cy9zZWFyY2hlcycsXG4gICAgTU9ERUxfSU5QVVRTX1BBVEg6ICcvbW9kZWxzLyQwL2lucHV0cycsXG4gICAgTU9ERUxfVkVSU0lPTl9JTlBVVFNfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvaW5wdXRzJyxcbiAgICBNT0RFTF9WRVJTSU9OX01FVFJJQ1NfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvbWV0cmljcycsXG4gICAgSU5QVVRTX1BBVEg6ICcvaW5wdXRzJyxcbiAgICBJTlBVVF9QQVRIOiAnL2lucHV0cy8kMCcsXG4gICAgSU5QVVRTX1NUQVRVU19QQVRIOiAnL2lucHV0cy9zdGF0dXMnLFxuICAgIFNFQVJDSF9QQVRIOiAnL3NlYXJjaGVzJyxcbiAgICBTRUFSQ0hfRkVFREJBQ0tfUEFUSDogJy9zZWFyY2hlcy9mZWVkYmFjaycsXG4gICAgV09SS0ZMT1dTX1BBVEg6ICcvd29ya2Zsb3dzJyxcbiAgICBXT1JLRkxPV19QQVRIOiAnL3dvcmtmbG93cy8kMCcsXG4gICAgV09SS0ZMT1dfUkVTVUxUU19QQVRIOiAnL3dvcmtmbG93cy8kMC9yZXN1bHRzJ1xuICB9LFxuICBFUlJPUlM6IHtcbiAgICBwYXJhbXNSZXF1aXJlZDogKHBhcmFtKSA9PiB7XG4gICAgICBsZXQgcGFyYW1MaXN0ID0gQXJyYXkuaXNBcnJheShwYXJhbSkgPyBwYXJhbSA6IFtwYXJhbV07XG4gICAgICByZXR1cm4gbmV3IEVycm9yKGBUaGUgZm9sbG93aW5nICR7cGFyYW1MaXN0Lmxlbmd0aCA+IDEgPyAncGFyYW1zIGFyZScgOiAncGFyYW0gaXMnfSByZXF1aXJlZDogJHtwYXJhbUxpc3Quam9pbignLCAnKX1gKTtcbiAgICB9LFxuICAgIE1BWF9JTlBVVFM6IG5ldyBFcnJvcihgTnVtYmVyIG9mIGlucHV0cyBwYXNzZWQgZXhjZWVkZWQgbWF4IG9mICR7TUFYX0JBVENIX1NJWkV9YCksXG4gICAgSU5WQUxJRF9HRU9MSU1JVF9UWVBFOiBuZXcgRXJyb3IoYEluY29ycmVjdCBnZW9fbGltaXQgdHlwZS4gVmFsdWUgbXVzdCBiZSBhbnkgb2YgdGhlIGZvbGxvd2luZzogJHtHRU9fTElNSVRfVFlQRVMuam9pbignLCAnKX1gKSxcbiAgICBJTlZBTElEX0RFTEVURV9BUkdTOiBuZXcgRXJyb3IoYFdyb25nIGFyZ3VtZW50cyBwYXNzZWQuIFlvdSBjYW4gb25seSBkZWxldGUgYWxsIG1vZGVscyAocHJvdmlkZSBubyBhcmd1bWVudHMpLCBkZWxldGUgc2VsZWN0IG1vZGVscyAocHJvdmlkZSBsaXN0IG9mIGlkcyksXG4gICAgZGVsZXRlIGEgc2luZ2xlIG1vZGVsIChwcm92aWRpbmcgYSBzaW5nbGUgaWQpIG9yIGRlbGV0ZSBhIG1vZGVsIHZlcnNpb24gKHByb3ZpZGUgYSBzaW5nbGUgaWQgYW5kIHZlcnNpb24gaWQpYClcbiAgfSxcbiAgU1RBVFVTOiB7XG4gICAgTU9ERUxfUVVFVUVEX0ZPUl9UUkFJTklORyxcbiAgICBNT0RFTF9UUkFJTklOR1xuICB9LFxuICAvLyB2YXIgcmVwbGFjZW1lbnQgbXVzdCBiZSBnaXZlbiBpbiBvcmRlclxuICByZXBsYWNlVmFyczogKHBhdGgsIHZhcnMgPSBbXSkgPT4ge1xuICAgIGxldCBuZXdQYXRoID0gcGF0aDtcbiAgICB2YXJzLmZvckVhY2goKHZhbCwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICB2YWwgPSBlbmNvZGVVUklDb21wb25lbnQodmFsKTtcbiAgICAgIH1cbiAgICAgIG5ld1BhdGggPSBuZXdQYXRoLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxcXCQke2luZGV4fWAsICdnJyksIHZhbCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld1BhdGg7XG4gIH0sXG4gIGdldEJhc2VQYXRoOiAoYXBpRW5kcG9pbnQgPSAnaHR0cHM6Ly9hcGkuY2xhcmlmYWkuY29tJywgdXNlcklkLCBhcHBJZCkgPT4ge1xuICAgIGlmKCF1c2VySWQgfHwgIWFwcElkKSB7XG4gICAgICByZXR1cm4gYCR7YXBpRW5kcG9pbnR9L3YyYDtcbiAgICB9XG4gICAgcmV0dXJuIGAke2FwaUVuZHBvaW50fS92Mi91c2Vycy8ke3VzZXJJZH0vYXBwcy8ke2FwcElkfWA7XG4gIH0sXG4gIEdFT19MSU1JVF9UWVBFUyxcbiAgTUFYX0JBVENIX1NJWkUsXG4gIFNZTkNfVElNRU9VVCxcbiAgUE9MTFRJTUVcbn07XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/constants.js","/")
    },{"buffer":30,"pBGvAp":35}],59:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var App = require('./App');
    
    var _require = require('./../package.json'),
        version = _require.version;
    
    module.exports = global.Clarifai = {
      version: version,
      App: App,
      GENERAL_MODEL: 'aaa03c23b3724a16a56b629203edc62c',
      FOOD_MODEL: 'bd367be194cf45149e75f01d59f77ba7',
      TRAVEL_MODEL: 'eee28c313d69466f836ab83287a54ed9',
      NSFW_MODEL: 'e9576d86d2004ed1a38ba0cf39ecb4b1',
      WEDDINGS_MODEL: 'c386b7a870114f4a87477c0824499348',
      WEDDING_MODEL: 'c386b7a870114f4a87477c0824499348',
      COLOR_MODEL: 'eeed0b6733a644cea07cf4c60f87ebb7',
      CLUSTER_MODEL: 'cccbe437d6e54e2bb911c6aa292fb072',
      FACE_DETECT_MODEL: 'a403429f2ddf4b49b307e318f00e528b',
      FOCUS_MODEL: 'c2cf7cecd8a6427da375b9f35fcd2381',
      LOGO_MODEL: 'c443119bf2ed4da98487520d01a0b1e3',
      DEMOGRAPHICS_MODEL: 'c0c0ac362b03416da06ab3fa36fb58e3',
      GENERAL_EMBED_MODEL: 'bbb5f41425b8468d9b7a554ff10f8581',
      FACE_EMBED_MODEL: 'd02b4508df58432fbb84e800597b8959',
      APPAREL_MODEL: 'e0be3b9d6a454f0493ac3a30784001ff',
      MODERATION_MODEL: 'd16f390eb32cad478c7ae150069bd2c6',
      TEXTURES_AND_PATTERNS: 'fbefb47f9fdb410e8ce14f24f54b47ff',
      LANDSCAPE_QUALITY: 'bec14810deb94c40a05f1f0eb3c91403',
      PORTRAIT_QUALITY: 'de9bd05cfdbf4534af151beb2a5d0953',
      CELEBRITY_MODEL: 'e466caa0619f444ab97497640cefc4dc'
    };
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZha2VfNDYxZjIyMTYuanMiXSwibmFtZXMiOlsiQXBwIiwicmVxdWlyZSIsInZlcnNpb24iLCJtb2R1bGUiLCJleHBvcnRzIiwiZ2xvYmFsIiwiQ2xhcmlmYWkiLCJHRU5FUkFMX01PREVMIiwiRk9PRF9NT0RFTCIsIlRSQVZFTF9NT0RFTCIsIk5TRldfTU9ERUwiLCJXRURESU5HU19NT0RFTCIsIldFRERJTkdfTU9ERUwiLCJDT0xPUl9NT0RFTCIsIkNMVVNURVJfTU9ERUwiLCJGQUNFX0RFVEVDVF9NT0RFTCIsIkZPQ1VTX01PREVMIiwiTE9HT19NT0RFTCIsIkRFTU9HUkFQSElDU19NT0RFTCIsIkdFTkVSQUxfRU1CRURfTU9ERUwiLCJGQUNFX0VNQkVEX01PREVMIiwiQVBQQVJFTF9NT0RFTCIsIk1PREVSQVRJT05fTU9ERUwiLCJURVhUVVJFU19BTkRfUEFUVEVSTlMiLCJMQU5EU0NBUEVfUVVBTElUWSIsIlBPUlRSQUlUX1FVQUxJVFkiLCJDRUxFQlJJVFlfTU9ERUwiXSwibWFwcGluZ3MiOiI7O0FBQUEsSUFBSUEsTUFBTUMsUUFBUSxPQUFSLENBQVY7O2VBQ2dCQSxRQUFRLG1CQUFSLEM7SUFBWEMsTyxZQUFBQSxPOztBQUVMQyxPQUFPQyxPQUFQLEdBQWlCQyxPQUFPQyxRQUFQLEdBQWtCO0FBQ2pDSixrQkFEaUM7QUFFakNGLFVBRmlDO0FBR2pDTyxpQkFBZSxrQ0FIa0I7QUFJakNDLGNBQVksa0NBSnFCO0FBS2pDQyxnQkFBYyxrQ0FMbUI7QUFNakNDLGNBQVksa0NBTnFCO0FBT2pDQyxrQkFBZ0Isa0NBUGlCO0FBUWpDQyxpQkFBZSxrQ0FSa0I7QUFTakNDLGVBQWEsa0NBVG9CO0FBVWpDQyxpQkFBZSxrQ0FWa0I7QUFXakNDLHFCQUFtQixrQ0FYYztBQVlqQ0MsZUFBYSxrQ0Fab0I7QUFhakNDLGNBQVksa0NBYnFCO0FBY2pDQyxzQkFBb0Isa0NBZGE7QUFlakNDLHVCQUFxQixrQ0FmWTtBQWdCakNDLG9CQUFrQixrQ0FoQmU7QUFpQmpDQyxpQkFBZSxrQ0FqQmtCO0FBa0JqQ0Msb0JBQWtCLGtDQWxCZTtBQW1CakNDLHlCQUF1QixrQ0FuQlU7QUFvQmpDQyxxQkFBbUIsa0NBcEJjO0FBcUJqQ0Msb0JBQWtCLGtDQXJCZTtBQXNCakNDLG1CQUFpQjtBQXRCZ0IsQ0FBbkMiLCJmaWxlIjoiZmFrZV80NjFmMjIxNi5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBBcHAgPSByZXF1aXJlKCcuL0FwcCcpO1xubGV0IHt2ZXJzaW9ufSA9IHJlcXVpcmUoJy4vLi4vcGFja2FnZS5qc29uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2xvYmFsLkNsYXJpZmFpID0ge1xuICB2ZXJzaW9uLFxuICBBcHAsXG4gIEdFTkVSQUxfTU9ERUw6ICdhYWEwM2MyM2IzNzI0YTE2YTU2YjYyOTIwM2VkYzYyYycsXG4gIEZPT0RfTU9ERUw6ICdiZDM2N2JlMTk0Y2Y0NTE0OWU3NWYwMWQ1OWY3N2JhNycsXG4gIFRSQVZFTF9NT0RFTDogJ2VlZTI4YzMxM2Q2OTQ2NmY4MzZhYjgzMjg3YTU0ZWQ5JyxcbiAgTlNGV19NT0RFTDogJ2U5NTc2ZDg2ZDIwMDRlZDFhMzhiYTBjZjM5ZWNiNGIxJyxcbiAgV0VERElOR1NfTU9ERUw6ICdjMzg2YjdhODcwMTE0ZjRhODc0NzdjMDgyNDQ5OTM0OCcsXG4gIFdFRERJTkdfTU9ERUw6ICdjMzg2YjdhODcwMTE0ZjRhODc0NzdjMDgyNDQ5OTM0OCcsXG4gIENPTE9SX01PREVMOiAnZWVlZDBiNjczM2E2NDRjZWEwN2NmNGM2MGY4N2ViYjcnLFxuICBDTFVTVEVSX01PREVMOiAnY2NjYmU0MzdkNmU1NGUyYmI5MTFjNmFhMjkyZmIwNzInLFxuICBGQUNFX0RFVEVDVF9NT0RFTDogJ2E0MDM0MjlmMmRkZjRiNDliMzA3ZTMxOGYwMGU1MjhiJyxcbiAgRk9DVVNfTU9ERUw6ICdjMmNmN2NlY2Q4YTY0MjdkYTM3NWI5ZjM1ZmNkMjM4MScsXG4gIExPR09fTU9ERUw6ICdjNDQzMTE5YmYyZWQ0ZGE5ODQ4NzUyMGQwMWEwYjFlMycsXG4gIERFTU9HUkFQSElDU19NT0RFTDogJ2MwYzBhYzM2MmIwMzQxNmRhMDZhYjNmYTM2ZmI1OGUzJyxcbiAgR0VORVJBTF9FTUJFRF9NT0RFTDogJ2JiYjVmNDE0MjViODQ2OGQ5YjdhNTU0ZmYxMGY4NTgxJyxcbiAgRkFDRV9FTUJFRF9NT0RFTDogJ2QwMmI0NTA4ZGY1ODQzMmZiYjg0ZTgwMDU5N2I4OTU5JyxcbiAgQVBQQVJFTF9NT0RFTDogJ2UwYmUzYjlkNmE0NTRmMDQ5M2FjM2EzMDc4NDAwMWZmJyxcbiAgTU9ERVJBVElPTl9NT0RFTDogJ2QxNmYzOTBlYjMyY2FkNDc4YzdhZTE1MDA2OWJkMmM2JyxcbiAgVEVYVFVSRVNfQU5EX1BBVFRFUk5TOiAnZmJlZmI0N2Y5ZmRiNDEwZThjZTE0ZjI0ZjU0YjQ3ZmYnLFxuICBMQU5EU0NBUEVfUVVBTElUWTogJ2JlYzE0ODEwZGViOTRjNDBhMDVmMWYwZWIzYzkxNDAzJyxcbiAgUE9SVFJBSVRfUVVBTElUWTogJ2RlOWJkMDVjZmRiZjQ1MzRhZjE1MWJlYjJhNWQwOTUzJyxcbiAgQ0VMRUJSSVRZX01PREVMOiAnZTQ2NmNhYTA2MTlmNDQ0YWI5NzQ5NzY0MGNlZmM0ZGMnXG59O1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_461f2216.js","/")
    },{"./../package.json":45,"./App":46,"buffer":30,"pBGvAp":35}],60:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var SUCCESS_CODES = [200, 201];
    
    module.exports = {
      isSuccess: function isSuccess(response) {
        return SUCCESS_CODES.indexOf(response.status) > -1;
      },
      deleteEmpty: function deleteEmpty(obj) {
        var strict = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    
        Object.keys(obj).forEach(function (key) {
          if (obj[key] === null || obj[key] === undefined || strict === true && (obj[key] === '' || obj[key].length === 0 || Object.keys(obj[key]).length === 0)) {
            delete obj[key];
          }
        });
      },
      clone: function clone(obj) {
        var keys = Object.keys(obj);
        var copy = {};
        keys.forEach(function (k) {
          copy[k] = obj[k];
        });
        return copy;
      },
      checkType: function checkType(regex, val) {
        if (regex instanceof RegExp === false) {
          regex = new RegExp(regex);
        }
        return regex.test(Object.prototype.toString.call(val));
      }
    };
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImhlbHBlcnMuanMiXSwibmFtZXMiOlsiU1VDQ0VTU19DT0RFUyIsIm1vZHVsZSIsImV4cG9ydHMiLCJpc1N1Y2Nlc3MiLCJyZXNwb25zZSIsImluZGV4T2YiLCJzdGF0dXMiLCJkZWxldGVFbXB0eSIsIm9iaiIsInN0cmljdCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwidW5kZWZpbmVkIiwibGVuZ3RoIiwiY2xvbmUiLCJjb3B5IiwiayIsImNoZWNrVHlwZSIsInJlZ2V4IiwidmFsIiwiUmVnRXhwIiwidGVzdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxJQUFNQSxnQkFBZ0IsQ0FBQyxHQUFELEVBQU0sR0FBTixDQUF0Qjs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxhQUFXLG1CQUFDQyxRQUFELEVBQWM7QUFDdkIsV0FBT0osY0FBY0ssT0FBZCxDQUFzQkQsU0FBU0UsTUFBL0IsSUFBeUMsQ0FBQyxDQUFqRDtBQUNELEdBSGM7QUFJZkMsZUFBYSxxQkFBQ0MsR0FBRCxFQUF5QjtBQUFBLFFBQW5CQyxNQUFtQix1RUFBVixLQUFVOztBQUNwQ0MsV0FBT0MsSUFBUCxDQUFZSCxHQUFaLEVBQWlCSSxPQUFqQixDQUF5QixVQUFDQyxHQUFELEVBQVM7QUFDaEMsVUFBSUwsSUFBSUssR0FBSixNQUFhLElBQWIsSUFDRkwsSUFBSUssR0FBSixNQUFhQyxTQURYLElBRUZMLFdBQVcsSUFBWCxLQUNBRCxJQUFJSyxHQUFKLE1BQWEsRUFBYixJQUNBTCxJQUFJSyxHQUFKLEVBQVNFLE1BQVQsS0FBb0IsQ0FEcEIsSUFFQUwsT0FBT0MsSUFBUCxDQUFZSCxJQUFJSyxHQUFKLENBQVosRUFBc0JFLE1BQXRCLEtBQWlDLENBSGpDLENBRkYsRUFLdUM7QUFDckMsZUFBT1AsSUFBSUssR0FBSixDQUFQO0FBQ0Q7QUFDRixLQVREO0FBVUQsR0FmYztBQWdCZkcsU0FBTyxlQUFDUixHQUFELEVBQVM7QUFDZCxRQUFJRyxPQUFPRCxPQUFPQyxJQUFQLENBQVlILEdBQVosQ0FBWDtBQUNBLFFBQUlTLE9BQU8sRUFBWDtBQUNBTixTQUFLQyxPQUFMLENBQWEsVUFBQ00sQ0FBRCxFQUFPO0FBQ2xCRCxXQUFLQyxDQUFMLElBQVVWLElBQUlVLENBQUosQ0FBVjtBQUNELEtBRkQ7QUFHQSxXQUFPRCxJQUFQO0FBQ0QsR0F2QmM7QUF3QmZFLGFBQVcsbUJBQUNDLEtBQUQsRUFBUUMsR0FBUixFQUFnQjtBQUN6QixRQUFLRCxpQkFBaUJFLE1BQWxCLEtBQThCLEtBQWxDLEVBQXlDO0FBQ3ZDRixjQUFRLElBQUlFLE1BQUosQ0FBV0YsS0FBWCxDQUFSO0FBQ0Q7QUFDRCxXQUFPQSxNQUFNRyxJQUFOLENBQVdiLE9BQU9jLFNBQVAsQ0FBaUJDLFFBQWpCLENBQTBCQyxJQUExQixDQUErQkwsR0FBL0IsQ0FBWCxDQUFQO0FBQ0Q7QUE3QmMsQ0FBakIiLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFNVQ0NFU1NfQ09ERVMgPSBbMjAwLCAyMDFdO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdWNjZXNzOiAocmVzcG9uc2UpID0+IHtcbiAgICByZXR1cm4gU1VDQ0VTU19DT0RFUy5pbmRleE9mKHJlc3BvbnNlLnN0YXR1cykgPiAtMTtcbiAgfSxcbiAgZGVsZXRlRW1wdHk6IChvYmosIHN0cmljdCA9IGZhbHNlKSA9PiB7XG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmIChvYmpba2V5XSA9PT0gbnVsbCB8fFxuICAgICAgICBvYmpba2V5XSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHN0cmljdCA9PT0gdHJ1ZSAmJiAoXG4gICAgICAgIG9ialtrZXldID09PSAnJyB8fFxuICAgICAgICBvYmpba2V5XS5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgT2JqZWN0LmtleXMob2JqW2tleV0pLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgICAgZGVsZXRlIG9ialtrZXldO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBjbG9uZTogKG9iaikgPT4ge1xuICAgIGxldCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICBsZXQgY29weSA9IHt9O1xuICAgIGtleXMuZm9yRWFjaCgoaykgPT4ge1xuICAgICAgY29weVtrXSA9IG9ialtrXTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29weTtcbiAgfSxcbiAgY2hlY2tUeXBlOiAocmVnZXgsIHZhbCkgPT4ge1xuICAgIGlmICgocmVnZXggaW5zdGFuY2VvZiBSZWdFeHApID09PSBmYWxzZSkge1xuICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlZ2V4LnRlc3QoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbCkpO1xuICB9XG59O1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/helpers.js","/")
    },{"buffer":30,"pBGvAp":35}],61:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var axios = require('axios');
    
    var _require = require('../utils'),
        wrapToken = _require.wrapToken;
    
    var _require2 = require('../helpers'),
        isSuccess = _require2.isSuccess,
        clone = _require2.clone;
    
    var BASE_URL = 'https://api.clarifai-moderation.com';
    
    var Moderation = function () {
      function Moderation(_config) {
        _classCallCheck(this, Moderation);
    
        this._config = _config;
      }
    
      _createClass(Moderation, [{
        key: 'predict',
        value: function predict(modelID, imageURL) {
          return wrapToken(this._config, function (headers) {
            var url = BASE_URL + '/v2/models/' + modelID + '/outputs';
            var params = {
              inputs: [{
                data: {
                  image: {
                    url: imageURL
                  }
                }
              }]
            };
    
            return new Promise(function (resolve, reject) {
              return axios.post(url, params, { headers: headers }).then(function (response) {
                if (isSuccess(response)) {
                  var data = clone(response.data);
                  resolve(data);
                } else {
                  reject(response);
                }
              }, reject);
            });
          });
        }
      }, {
        key: 'getModerationStatus',
        value: function getModerationStatus(imageID) {
          return wrapToken(this._config, function (headers) {
            var url = BASE_URL + '/v2/inputs/' + imageID + '/outputs';
            return new Promise(function (resolve, reject) {
              return axios.get(url, { headers: headers }).then(function (response) {
                var data = clone(response.data);
                resolve(data);
              }, reject);
            });
          });
        }
      }]);
    
      return Moderation;
    }();
    
    module.exports = Moderation;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVyYXRpb24uanMiXSwibmFtZXMiOlsiYXhpb3MiLCJyZXF1aXJlIiwid3JhcFRva2VuIiwiaXNTdWNjZXNzIiwiY2xvbmUiLCJCQVNFX1VSTCIsIk1vZGVyYXRpb24iLCJfY29uZmlnIiwibW9kZWxJRCIsImltYWdlVVJMIiwiaGVhZGVycyIsInVybCIsInBhcmFtcyIsImlucHV0cyIsImRhdGEiLCJpbWFnZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicG9zdCIsInRoZW4iLCJyZXNwb25zZSIsImltYWdlSUQiLCJnZXQiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjs7ZUFDa0JBLFFBQVEsVUFBUixDO0lBQWJDLFMsWUFBQUEsUzs7Z0JBQ29CRCxRQUFRLFlBQVIsQztJQUFwQkUsUyxhQUFBQSxTO0lBQVdDLEssYUFBQUEsSzs7QUFFaEIsSUFBSUMsV0FBVyxxQ0FBZjs7SUFFTUMsVTtBQUVKLHNCQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFNBQUtBLE9BQUwsR0FBZUEsT0FBZjtBQUVEOzs7OzRCQUVPQyxPLEVBQVNDLFEsRUFBVTtBQUN6QixhQUFPUCxVQUFVLEtBQUtLLE9BQWYsRUFBd0IsVUFBQ0csT0FBRCxFQUFhO0FBQzFDLFlBQUlDLE1BQVNOLFFBQVQsbUJBQStCRyxPQUEvQixhQUFKO0FBQ0EsWUFBSUksU0FBUztBQUNYQyxrQkFBUSxDQUNOO0FBQ0VDLGtCQUFNO0FBQ0pDLHFCQUFPO0FBQ0xKLHFCQUFLRjtBQURBO0FBREg7QUFEUixXQURNO0FBREcsU0FBYjs7QUFZQSxlQUFPLElBQUlPLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsaUJBQU9sQixNQUFNbUIsSUFBTixDQUFXUixHQUFYLEVBQWdCQyxNQUFoQixFQUF3QixFQUFDRixnQkFBRCxFQUF4QixFQUFtQ1UsSUFBbkMsQ0FBd0MsVUFBQ0MsUUFBRCxFQUFjO0FBQzNELGdCQUFJbEIsVUFBVWtCLFFBQVYsQ0FBSixFQUF5QjtBQUN2QixrQkFBSVAsT0FBT1YsTUFBTWlCLFNBQVNQLElBQWYsQ0FBWDtBQUNBRyxzQkFBUUgsSUFBUjtBQUNELGFBSEQsTUFHTztBQUNMSSxxQkFBT0csUUFBUDtBQUNEO0FBQ0YsV0FQTSxFQU9KSCxNQVBJLENBQVA7QUFRRCxTQVRNLENBQVA7QUFVRCxPQXhCTSxDQUFQO0FBeUJEOzs7d0NBRW1CSSxPLEVBQVM7QUFDM0IsYUFBT3BCLFVBQVUsS0FBS0ssT0FBZixFQUF3QixVQUFDRyxPQUFELEVBQWE7QUFDMUMsWUFBSUMsTUFBU04sUUFBVCxtQkFBK0JpQixPQUEvQixhQUFKO0FBQ0EsZUFBTyxJQUFJTixPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDLGlCQUFPbEIsTUFBTXVCLEdBQU4sQ0FBVVosR0FBVixFQUFlLEVBQUNELGdCQUFELEVBQWYsRUFBMEJVLElBQTFCLENBQStCLFVBQUNDLFFBQUQsRUFBYztBQUNsRCxnQkFBSVAsT0FBT1YsTUFBTWlCLFNBQVNQLElBQWYsQ0FBWDtBQUNBRyxvQkFBUUgsSUFBUjtBQUNELFdBSE0sRUFHSkksTUFISSxDQUFQO0FBS0QsU0FOTSxDQUFQO0FBT0QsT0FUTSxDQUFQO0FBVUQ7Ozs7OztBQUdITSxPQUFPQyxPQUFQLEdBQWlCbkIsVUFBakIiLCJmaWxlIjoiTW9kZXJhdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJyk7XG5sZXQge3dyYXBUb2tlbn0gPSByZXF1aXJlKCcuLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsIGNsb25lfSA9IHJlcXVpcmUoJy4uL2hlbHBlcnMnKTtcblxubGV0IEJBU0VfVVJMID0gJ2h0dHBzOi8vYXBpLmNsYXJpZmFpLW1vZGVyYXRpb24uY29tJztcblxuY2xhc3MgTW9kZXJhdGlvbiB7XG5cbiAgY29uc3RydWN0b3IoX2NvbmZpZykge1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG5cbiAgfVxuXG4gIHByZWRpY3QobW9kZWxJRCwgaW1hZ2VVUkwpIHtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGxldCB1cmwgPSBgJHtCQVNFX1VSTH0vdjIvbW9kZWxzLyR7bW9kZWxJRH0vb3V0cHV0c2A7XG4gICAgICBsZXQgcGFyYW1zID0ge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGltYWdlOiB7XG4gICAgICAgICAgICAgICAgdXJsOiBpbWFnZVVSTFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gYXhpb3MucG9zdCh1cmwsIHBhcmFtcywge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldE1vZGVyYXRpb25TdGF0dXMoaW1hZ2VJRCkge1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IHVybCA9IGAke0JBU0VfVVJMfS92Mi9pbnB1dHMvJHtpbWFnZUlEfS9vdXRwdXRzYDtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgbGV0IGRhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVyYXRpb247XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/solutions/Moderation.js","/solutions")
    },{"../helpers":60,"../utils":63,"axios":4,"buffer":30,"pBGvAp":35}],62:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var Moderation = require('./Moderation');
    
    var Solutions = function Solutions(_config) {
      _classCallCheck(this, Solutions);
    
      this.moderation = new Moderation(_config);
    };
    
    module.exports = Solutions;
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlNvbHV0aW9ucy5qcyJdLCJuYW1lcyI6WyJNb2RlcmF0aW9uIiwicmVxdWlyZSIsIlNvbHV0aW9ucyIsIl9jb25maWciLCJtb2RlcmF0aW9uIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLElBQUlBLGFBQWFDLFFBQVEsY0FBUixDQUFqQjs7SUFFTUMsUyxHQUVKLG1CQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLE9BQUtDLFVBQUwsR0FBa0IsSUFBSUosVUFBSixDQUFlRyxPQUFmLENBQWxCO0FBQ0QsQzs7QUFHSEUsT0FBT0MsT0FBUCxHQUFpQkosU0FBakIiLCJmaWxlIjoiU29sdXRpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IE1vZGVyYXRpb24gPSByZXF1aXJlKCcuL01vZGVyYXRpb24nKTtcblxuY2xhc3MgU29sdXRpb25zIHtcblxuICBjb25zdHJ1Y3RvcihfY29uZmlnKSB7XG4gICAgdGhpcy5tb2RlcmF0aW9uID0gbmV3IE1vZGVyYXRpb24oX2NvbmZpZyk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTb2x1dGlvbnM7XG4iXX0=
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/solutions/Solutions.js","/solutions")
    },{"./Moderation":61,"buffer":30,"pBGvAp":35}],63:[function(require,module,exports){
    (function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
    'use strict';
    
    function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    
    var Promise = require('promise');
    var validUrl = require('valid-url');
    
    var _require = require('./constants'),
        GEO_LIMIT_TYPES = _require.GEO_LIMIT_TYPES,
        ERRORS = _require.ERRORS;
    
    var _require2 = require('./helpers'),
        checkType = _require2.checkType,
        clone = _require2.clone;
    
    var _require3 = require('./../package.json'),
        VERSION = _require3.version;
    
    module.exports = {
      wrapToken: function wrapToken(_config, requestFn) {
        return new Promise(function (resolve, reject) {
          if (_config.apiKey) {
            var headers = {
              Authorization: 'Key ' + _config.apiKey,
              'X-Clarifai-Client': 'js:' + VERSION
            };
            return requestFn(headers).then(resolve, reject);
          }
          if (_config.sessionToken) {
            var _headers = {
              'X-Clarifai-Session-Token': _config.sessionToken,
              'X-Clarifai-Client': 'js:' + VERSION
            };
            return requestFn(_headers).then(resolve, reject);
          }
          _config.token().then(function (token) {
            var headers = {
              Authorization: 'Bearer ' + token.accessToken,
              'X-Clarifai-Client': 'js:' + VERSION
            };
            requestFn(headers).then(resolve, reject);
          }, reject);
        });
      },
      formatModel: function formatModel() {
        var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    
        var formatted = {};
        if (data.id === null || data.id === undefined) {
          throw ERRORS.paramsRequired('Model ID');
        }
        formatted.id = data.id;
        if (data.name) {
          formatted.name = data.name;
        }
        formatted.output_info = {};
        if (data.conceptsMutuallyExclusive !== undefined) {
          formatted.output_info.output_config = formatted.output_info.output_config || {};
          formatted.output_info.output_config.concepts_mutually_exclusive = !!data.conceptsMutuallyExclusive;
        }
        if (data.closedEnvironment !== undefined) {
          formatted.output_info.output_config = formatted.output_info.output_config || {};
          formatted.output_info.output_config.closed_environment = !!data.closedEnvironment;
        }
        if (data.concepts) {
          formatted.output_info.data = {
            concepts: data.concepts.map(module.exports.formatConcept)
          };
        }
        return formatted;
      },
      formatInput: function formatInput(data, includeImage) {
        var input = checkType(/String/, data) ? { url: data } : data;
        var formatted = {
          id: input.id || null,
          data: {}
        };
        if (input.concepts) {
          formatted.data.concepts = input.concepts;
        }
        if (input.metadata) {
          formatted.data.metadata = input.metadata;
        }
        if (input.geo) {
          formatted.data.geo = { geo_point: input.geo };
        }
        if (input.regions) {
          formatted.data.regions = input.regions;
        }
        if (includeImage !== false) {
          formatted.data.image = {
            url: input.url,
            base64: input.base64,
            crop: input.crop
          };
          if (data.allowDuplicateUrl) {
            formatted.data.image.allow_duplicate_url = true;
          }
        }
        return formatted;
      },
      formatMediaPredict: function formatMediaPredict(data) {
        var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'image';
    
        var media = void 0;
        if (checkType(/String/, data)) {
          if (validUrl.isWebUri(data)) {
            media = {
              url: data
            };
          } else {
            media = {
              base64: data
            };
          }
        } else {
          media = Object.assign({}, data);
        }
    
        // Users can specify their own id to distinguish batch results
        var id = void 0;
        if (media.id) {
          id = media.id;
          delete media.id;
        }
    
        var object = {
          data: _defineProperty({}, type, media)
        };
    
        if (id) {
          object.id = id;
        }
    
        return object;
      },
      formatImagesSearch: function formatImagesSearch(image) {
        var imageQuery = void 0;
        var input = { input: { data: {} } };
        var formatted = [];
        if (checkType(/String/, image)) {
          imageQuery = { url: image };
        } else {
          imageQuery = image.url || image.base64 ? {
            image: {
              url: image.url,
              base64: image.base64,
              crop: image.crop
            }
          } : {};
        }
    
        input.input.data = imageQuery;
        if (image.id) {
          input.input.id = image.id;
          input.input.data = { image: {} };
          if (image.crop) {
            input.input.data.image.crop = image.crop;
          }
        }
        if (image.metadata !== undefined) {
          input.input.data.metadata = image.metadata;
        }
        if (image.geo !== undefined) {
          if (checkType(/Array/, image.geo)) {
            input.input.data.geo = {
              geo_box: image.geo.map(function (p) {
                return { geo_point: p };
              })
            };
          } else if (checkType(/Object/, image.geo)) {
            if (GEO_LIMIT_TYPES.indexOf(image.geo.type) === -1) {
              throw ERRORS.INVALID_GEOLIMIT_TYPE;
            }
            input.input.data.geo = {
              geo_point: {
                latitude: image.geo.latitude,
                longitude: image.geo.longitude
              },
              geo_limit: {
                type: image.geo.type,
                value: image.geo.value
              }
            };
          }
        }
        if (image.type !== 'input' && input.input.data.image) {
          if (input.input.data.metadata || input.input.data.geo) {
            var dataCopy = { input: { data: clone(input.input.data) } };
            var imageCopy = { input: { data: clone(input.input.data) } };
            delete dataCopy.input.data.image;
            delete imageCopy.input.data.metadata;
            delete imageCopy.input.data.geo;
            input = [{ output: imageCopy }, dataCopy];
          } else {
            input = [{ output: input }];
          }
        }
        formatted = formatted.concat(input);
        return formatted;
      },
      formatConcept: function formatConcept(concept) {
        var formatted = concept;
        if (checkType(/String/, concept)) {
          formatted = {
            id: concept
          };
        }
        return formatted;
      },
      formatConceptsSearch: function formatConceptsSearch(query) {
        if (checkType(/String/, query)) {
          query = { id: query };
        }
        var v = {};
        var type = query.type === 'input' ? 'input' : 'output';
        delete query.type;
        v[type] = {
          data: {
            concepts: [query]
          }
        };
        return v;
      },
      formatObjectForSnakeCase: function formatObjectForSnakeCase(obj) {
        return Object.keys(obj).reduce(function (o, k) {
          o[k.replace(/([A-Z])/g, function (r) {
            return '_' + r.toLowerCase();
          })] = obj[k];
          return o;
        }, {});
      }
    };
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInV0aWxzLmpzIl0sIm5hbWVzIjpbIlByb21pc2UiLCJyZXF1aXJlIiwidmFsaWRVcmwiLCJHRU9fTElNSVRfVFlQRVMiLCJFUlJPUlMiLCJjaGVja1R5cGUiLCJjbG9uZSIsIlZFUlNJT04iLCJ2ZXJzaW9uIiwibW9kdWxlIiwiZXhwb3J0cyIsIndyYXBUb2tlbiIsIl9jb25maWciLCJyZXF1ZXN0Rm4iLCJyZXNvbHZlIiwicmVqZWN0IiwiYXBpS2V5IiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJ0aGVuIiwic2Vzc2lvblRva2VuIiwidG9rZW4iLCJhY2Nlc3NUb2tlbiIsImZvcm1hdE1vZGVsIiwiZGF0YSIsImZvcm1hdHRlZCIsImlkIiwidW5kZWZpbmVkIiwicGFyYW1zUmVxdWlyZWQiLCJuYW1lIiwib3V0cHV0X2luZm8iLCJjb25jZXB0c011dHVhbGx5RXhjbHVzaXZlIiwib3V0cHV0X2NvbmZpZyIsImNvbmNlcHRzX211dHVhbGx5X2V4Y2x1c2l2ZSIsImNsb3NlZEVudmlyb25tZW50IiwiY2xvc2VkX2Vudmlyb25tZW50IiwiY29uY2VwdHMiLCJtYXAiLCJmb3JtYXRDb25jZXB0IiwiZm9ybWF0SW5wdXQiLCJpbmNsdWRlSW1hZ2UiLCJpbnB1dCIsInVybCIsIm1ldGFkYXRhIiwiZ2VvIiwiZ2VvX3BvaW50IiwicmVnaW9ucyIsImltYWdlIiwiYmFzZTY0IiwiY3JvcCIsImFsbG93RHVwbGljYXRlVXJsIiwiYWxsb3dfZHVwbGljYXRlX3VybCIsImZvcm1hdE1lZGlhUHJlZGljdCIsInR5cGUiLCJtZWRpYSIsImlzV2ViVXJpIiwiT2JqZWN0IiwiYXNzaWduIiwib2JqZWN0IiwiZm9ybWF0SW1hZ2VzU2VhcmNoIiwiaW1hZ2VRdWVyeSIsImdlb19ib3giLCJwIiwiaW5kZXhPZiIsIklOVkFMSURfR0VPTElNSVRfVFlQRSIsImxhdGl0dWRlIiwibG9uZ2l0dWRlIiwiZ2VvX2xpbWl0IiwidmFsdWUiLCJkYXRhQ29weSIsImltYWdlQ29weSIsIm91dHB1dCIsImNvbmNhdCIsImNvbmNlcHQiLCJmb3JtYXRDb25jZXB0c1NlYXJjaCIsInF1ZXJ5IiwidiIsImZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZSIsIm9iaiIsImtleXMiLCJyZWR1Y2UiLCJvIiwiayIsInJlcGxhY2UiLCJyIiwidG9Mb3dlckNhc2UiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxJQUFJQSxVQUFVQyxRQUFRLFNBQVIsQ0FBZDtBQUNBLElBQUlDLFdBQVdELFFBQVEsV0FBUixDQUFmOztlQUNnQ0EsUUFBUSxhQUFSLEM7SUFBM0JFLGUsWUFBQUEsZTtJQUFpQkMsTSxZQUFBQSxNOztnQkFDR0gsUUFBUSxXQUFSLEM7SUFBcEJJLFMsYUFBQUEsUztJQUFXQyxLLGFBQUFBLEs7O2dCQUNTTCxRQUFRLG1CQUFSLEM7SUFBWE0sTyxhQUFUQyxPOztBQUVMQyxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLGFBQVcsbUJBQUNDLE9BQUQsRUFBVUMsU0FBVixFQUF3QjtBQUNqQyxXQUFPLElBQUliLE9BQUosQ0FBWSxVQUFDYyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsVUFBSUgsUUFBUUksTUFBWixFQUFvQjtBQUNsQixZQUFJQyxVQUFVO0FBQ1pDLGtDQUFzQk4sUUFBUUksTUFEbEI7QUFFWix1Q0FBMkJUO0FBRmYsU0FBZDtBQUlBLGVBQU9NLFVBQVVJLE9BQVYsRUFBbUJFLElBQW5CLENBQXdCTCxPQUF4QixFQUFpQ0MsTUFBakMsQ0FBUDtBQUNEO0FBQ0QsVUFBSUgsUUFBUVEsWUFBWixFQUEwQjtBQUN4QixZQUFJSCxXQUFVO0FBQ1osc0NBQTRCTCxRQUFRUSxZQUR4QjtBQUVaLHVDQUEyQmI7QUFGZixTQUFkO0FBSUEsZUFBT00sVUFBVUksUUFBVixFQUFtQkUsSUFBbkIsQ0FBd0JMLE9BQXhCLEVBQWlDQyxNQUFqQyxDQUFQO0FBQ0Q7QUFDREgsY0FBUVMsS0FBUixHQUFnQkYsSUFBaEIsQ0FBcUIsVUFBQ0UsS0FBRCxFQUFXO0FBQzlCLFlBQUlKLFVBQVU7QUFDWkMscUNB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O0FBSUQ7QUF0TmMsQ0FBakIiLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgUHJvbWlzZSA9IHJlcXVpcmUoJ3Byb21pc2UnKTtcbmxldCB2YWxpZFVybCA9IHJlcXVpcmUoJ3ZhbGlkLXVybCcpO1xubGV0IHtHRU9fTElNSVRfVFlQRVMsIEVSUk9SU30gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtjaGVja1R5cGUsIGNsb25lfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IHt2ZXJzaW9uOiBWRVJTSU9OfSA9IHJlcXVpcmUoJy4vLi4vcGFja2FnZS5qc29uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3cmFwVG9rZW46IChfY29uZmlnLCByZXF1ZXN0Rm4pID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKF9jb25maWcuYXBpS2V5KSB7XG4gICAgICAgIGxldCBoZWFkZXJzID0ge1xuICAgICAgICAgIEF1dGhvcml6YXRpb246IGBLZXkgJHtfY29uZmlnLmFwaUtleX1gLFxuICAgICAgICAgICdYLUNsYXJpZmFpLUNsaWVudCc6IGBqczoke1ZFUlNJT059YFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcmVxdWVzdEZuKGhlYWRlcnMpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH1cbiAgICAgIGlmIChfY29uZmlnLnNlc3Npb25Ub2tlbikge1xuICAgICAgICBsZXQgaGVhZGVycyA9IHtcbiAgICAgICAgICAnWC1DbGFyaWZhaS1TZXNzaW9uLVRva2VuJzogX2NvbmZpZy5zZXNzaW9uVG9rZW4sXG4gICAgICAgICAgJ1gtQ2xhcmlmYWktQ2xpZW50JzogYGpzOiR7VkVSU0lPTn1gXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiByZXF1ZXN0Rm4oaGVhZGVycykudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuICAgICAgX2NvbmZpZy50b2tlbigpLnRoZW4oKHRva2VuKSA9PiB7XG4gICAgICAgIGxldCBoZWFkZXJzID0ge1xuICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbi5hY2Nlc3NUb2tlbn1gLFxuICAgICAgICAgICdYLUNsYXJpZmFpLUNsaWVudCc6IGBqczoke1ZFUlNJT059YFxuICAgICAgICB9O1xuICAgICAgICByZXF1ZXN0Rm4oaGVhZGVycykudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfSxcbiAgZm9ybWF0TW9kZWw6IChkYXRhID0ge30pID0+IHtcbiAgICBsZXQgZm9ybWF0dGVkID0ge307XG4gICAgaWYgKGRhdGEuaWQgPT09IG51bGwgfHwgZGF0YS5pZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBFUlJPUlMucGFyYW1zUmVxdWlyZWQoJ01vZGVsIElEJyk7XG4gICAgfVxuICAgIGZvcm1hdHRlZC5pZCA9IGRhdGEuaWQ7XG4gICAgaWYgKGRhdGEubmFtZSkge1xuICAgICAgZm9ybWF0dGVkLm5hbWUgPSBkYXRhLm5hbWU7XG4gICAgfVxuICAgIGZvcm1hdHRlZC5vdXRwdXRfaW5mbyA9IHt9O1xuICAgIGlmIChkYXRhLmNvbmNlcHRzTXV0dWFsbHlFeGNsdXNpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLm91dHB1dF9jb25maWcgPSBmb3JtYXR0ZWQub3V0cHV0X2luZm8ub3V0cHV0X2NvbmZpZyB8fCB7fTtcbiAgICAgIGZvcm1hdHRlZC5vdXRwdXRfaW5mby5vdXRwdXRfY29uZmlnLmNvbmNlcHRzX211dHVhbGx5X2V4Y2x1c2l2ZSA9ICEhZGF0YS5jb25jZXB0c011dHVhbGx5RXhjbHVzaXZlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5jbG9zZWRFbnZpcm9ubWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBmb3JtYXR0ZWQub3V0cHV0X2luZm8ub3V0cHV0X2NvbmZpZyA9IGZvcm1hdHRlZC5vdXRwdXRfaW5mby5vdXRwdXRfY29uZmlnIHx8IHt9O1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLm91dHB1dF9jb25maWcuY2xvc2VkX2Vudmlyb25tZW50ID0gISFkYXRhLmNsb3NlZEVudmlyb25tZW50O1xuICAgIH1cbiAgICBpZiAoZGF0YS5jb25jZXB0cykge1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLmRhdGEgPSB7XG4gICAgICAgIGNvbmNlcHRzOiBkYXRhLmNvbmNlcHRzLm1hcChtb2R1bGUuZXhwb3J0cy5mb3JtYXRDb25jZXB0KVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZvcm1hdHRlZDtcbiAgfSxcbiAgZm9ybWF0SW5wdXQ6IChkYXRhLCBpbmNsdWRlSW1hZ2UpID0+IHtcbiAgICBsZXQgaW5wdXQgPSBjaGVja1R5cGUoL1N0cmluZy8sIGRhdGEpID9cbiAgICAgIHt1cmw6IGRhdGF9IDpcbiAgICAgIGRhdGE7XG4gICAgbGV0IGZvcm1hdHRlZCA9IHtcbiAgICAgIGlkOiBpbnB1dC5pZCB8fCBudWxsLFxuICAgICAgZGF0YToge31cbiAgICB9O1xuICAgIGlmIChpbnB1dC5jb25jZXB0cykge1xuICAgICAgZm9ybWF0dGVkLmRhdGEuY29uY2VwdHMgPSBpbnB1dC5jb25jZXB0cztcbiAgICB9XG4gICAgaWYgKGlucHV0Lm1ldGFkYXRhKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5tZXRhZGF0YSA9IGlucHV0Lm1ldGFkYXRhO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuZ2VvKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5nZW8gPSB7Z2VvX3BvaW50OiBpbnB1dC5nZW99O1xuICAgIH1cbiAgICBpZiAoaW5wdXQucmVnaW9ucykge1xuICAgICAgZm9ybWF0dGVkLmRhdGEucmVnaW9ucyA9IGlucHV0LnJlZ2lvbnM7XG4gICAgfVxuICAgIGlmIChpbmNsdWRlSW1hZ2UgIT09IGZhbHNlKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5pbWFnZSA9IHtcbiAgICAgICAgdXJsOiBpbnB1dC51cmwsXG4gICAgICAgIGJhc2U2NDogaW5wdXQuYmFzZTY0LFxuICAgICAgICBjcm9wOiBpbnB1dC5jcm9wXG4gICAgICB9O1xuICAgICAgaWYgKGRhdGEuYWxsb3dEdXBsaWNhdGVVcmwpIHtcbiAgICAgICAgZm9ybWF0dGVkLmRhdGEuaW1hZ2UuYWxsb3dfZHVwbGljYXRlX3VybCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmb3JtYXR0ZWQ7XG4gIH0sXG4gIGZvcm1hdE1lZGlhUHJlZGljdDogKGRhdGEsIHR5cGUgPSAnaW1hZ2UnKSA9PiB7XG4gICAgbGV0IG1lZGlhO1xuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGRhdGEpKSB7XG4gICAgICBpZiAodmFsaWRVcmwuaXNXZWJVcmkoZGF0YSkpIHtcbiAgICAgICAgbWVkaWEgPSB7XG4gICAgICAgICAgdXJsOiBkYXRhXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZWRpYSA9IHtcbiAgICAgICAgICBiYXNlNjQ6IGRhdGFcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbWVkaWEgPSBPYmplY3QuYXNzaWduKHt9LCBkYXRhKTtcbiAgICB9XG5cbiAgICAvLyBVc2VycyBjYW4gc3BlY2lmeSB0aGVpciBvd24gaWQgdG8gZGlzdGluZ3Vpc2ggYmF0Y2ggcmVzdWx0c1xuICAgIGxldCBpZDtcbiAgICBpZiAobWVkaWEuaWQpIHtcbiAgICAgIGlkID0gbWVkaWEuaWQ7XG4gICAgICBkZWxldGUgbWVkaWEuaWQ7XG4gICAgfVxuXG4gICAgbGV0IG9iamVjdCA9IHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgW3R5cGVdOiBtZWRpYVxuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoaWQpIHtcbiAgICAgIG9iamVjdC5pZCA9IGlkO1xuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG4gIH0sXG4gIGZvcm1hdEltYWdlc1NlYXJjaDogKGltYWdlKSA9PiB7XG4gICAgbGV0IGltYWdlUXVlcnk7XG4gICAgbGV0IGlucHV0ID0ge2lucHV0OiB7ZGF0YToge319fTtcbiAgICBsZXQgZm9ybWF0dGVkID0gW107XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgaW1hZ2UpKSB7XG4gICAgICBpbWFnZVF1ZXJ5ID0ge3VybDogaW1hZ2V9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbWFnZVF1ZXJ5ID0gKGltYWdlLnVybCB8fCBpbWFnZS5iYXNlNjQpID8ge1xuICAgICAgICBpbWFnZToge1xuICAgICAgICAgIHVybDogaW1hZ2UudXJsLFxuICAgICAgICAgIGJhc2U2NDogaW1hZ2UuYmFzZTY0LFxuICAgICAgICAgIGNyb3A6IGltYWdlLmNyb3BcbiAgICAgICAgfVxuICAgICAgfSA6IHt9O1xuICAgIH1cblxuICAgIGlucHV0LmlucHV0LmRhdGEgPSBpbWFnZVF1ZXJ5O1xuICAgIGlmIChpbWFnZS5pZCkge1xuICAgICAgaW5wdXQuaW5wdXQuaWQgPSBpbWFnZS5pZDtcbiAgICAgIGlucHV0LmlucHV0LmRhdGEgPSB7aW1hZ2U6IHt9fTtcbiAgICAgIGlmKGltYWdlLmNyb3ApIHtcbiAgICAgICAgaW5wdXQuaW5wdXQuZGF0YS5pbWFnZS5jcm9wID0gaW1hZ2UuY3JvcDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGltYWdlLm1ldGFkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlucHV0LmlucHV0LmRhdGEubWV0YWRhdGEgPSBpbWFnZS5tZXRhZGF0YTtcbiAgICB9XG4gICAgaWYgKGltYWdlLmdlbyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2hlY2tUeXBlKC9BcnJheS8sIGltYWdlLmdlbykpIHtcbiAgICAgICAgaW5wdXQuaW5wdXQuZGF0YS5nZW8gPSB7XG4gICAgICAgICAgZ2VvX2JveDogaW1hZ2UuZ2VvLm1hcChwID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7Z2VvX3BvaW50OiBwfTtcbiAgICAgICAgICB9KVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmIChjaGVja1R5cGUoL09iamVjdC8sIGltYWdlLmdlbykpIHtcbiAgICAgICAgaWYgKEdFT19MSU1JVF9UWVBFUy5pbmRleE9mKGltYWdlLmdlby50eXBlKSA9PT0gLTEpIHtcbiAgICAgICAgICB0aHJvdyBFUlJPUlMuSU5WQUxJRF9HRU9MSU1JVF9UWVBFO1xuICAgICAgICB9XG4gICAgICAgIGlucHV0LmlucHV0LmRhdGEuZ2VvID0ge1xuICAgICAgICAgIGdlb19wb2ludDoge1xuICAgICAgICAgICAgbGF0aXR1ZGU6IGltYWdlLmdlby5sYXRpdHVkZSxcbiAgICAgICAgICAgIGxvbmdpdHVkZTogaW1hZ2UuZ2VvLmxvbmdpdHVkZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgZ2VvX2xpbWl0OiB7XG4gICAgICAgICAgICB0eXBlOiBpbWFnZS5nZW8udHlwZSxcbiAgICAgICAgICAgIHZhbHVlOiBpbWFnZS5nZW8udmFsdWVcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpbWFnZS50eXBlICE9PSAnaW5wdXQnICYmIGlucHV0LmlucHV0LmRhdGEuaW1hZ2UpIHtcbiAgICAgIGlmIChpbnB1dC5pbnB1dC5kYXRhLm1ldGFkYXRhIHx8IGlucHV0LmlucHV0LmRhdGEuZ2VvKSB7XG4gICAgICAgIGxldCBkYXRhQ29weSA9IHtpbnB1dDoge2RhdGE6IGNsb25lKGlucHV0LmlucHV0LmRhdGEpfX07XG4gICAgICAgIGxldCBpbWFnZUNvcHkgPSB7aW5wdXQ6IHtkYXRhOiBjbG9uZShpbnB1dC5pbnB1dC5kYXRhKX19O1xuICAgICAgICBkZWxldGUgZGF0YUNvcHkuaW5wdXQuZGF0YS5pbWFnZTtcbiAgICAgICAgZGVsZXRlIGltYWdlQ29weS5pbnB1dC5kYXRhLm1ldGFkYXRhO1xuICAgICAgICBkZWxldGUgaW1hZ2VDb3B5LmlucHV0LmRhdGEuZ2VvO1xuICAgICAgICBpbnB1dCA9IFtcbiAgICAgICAgICB7b3V0cHV0OiBpbWFnZUNvcHl9LFxuICAgICAgICAgIGRhdGFDb3B5XG4gICAgICAgIF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnB1dCA9IFt7b3V0cHV0OiBpbnB1dH1dO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3JtYXR0ZWQgPSBmb3JtYXR0ZWQuY29uY2F0KGlucHV0KTtcbiAgICByZXR1cm4gZm9ybWF0dGVkO1xuICB9LFxuICBmb3JtYXRDb25jZXB0OiAoY29uY2VwdCkgPT4ge1xuICAgIGxldCBmb3JtYXR0ZWQgPSBjb25jZXB0O1xuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGNvbmNlcHQpKSB7XG4gICAgICBmb3JtYXR0ZWQgPSB7XG4gICAgICAgIGlkOiBjb25jZXB0XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gZm9ybWF0dGVkO1xuICB9LFxuICBmb3JtYXRDb25jZXB0c1NlYXJjaDogKHF1ZXJ5KSA9PiB7XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgcXVlcnkpKSB7XG4gICAgICBxdWVyeSA9IHtpZDogcXVlcnl9O1xuICAgIH1cbiAgICBsZXQgdiA9IHt9O1xuICAgIGxldCB0eXBlID0gcXVlcnkudHlwZSA9PT0gJ2lucHV0JyA/ICdpbnB1dCcgOiAnb3V0cHV0JztcbiAgICBkZWxldGUgcXVlcnkudHlwZTtcbiAgICB2W3R5cGVdID0ge1xuICAgICAgZGF0YToge1xuICAgICAgICBjb25jZXB0czogW3F1ZXJ5XVxuICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHY7XG4gIH0sXG4gIGZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZShvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5yZWR1Y2UoKG8sIGspID0+IHtcbiAgICAgIG9bay5yZXBsYWNlKC8oW0EtWl0pL2csIHIgPT4gJ18nK3IudG9Mb3dlckNhc2UoKSldID0gb2JqW2tdO1xuICAgICAgcmV0dXJuIG87XG4gICAgfSwge30pO1xuICB9XG59O1xuIl19
    }).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/utils.js","/")
    },{"./../package.json":45,"./constants":58,"./helpers":60,"buffer":30,"pBGvAp":35,"promise":36,"valid-url":44}]},{},[59])