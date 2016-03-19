var child_process = require("child_process");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var Q = require("q");
var BoardStatus = require("./board_status")
/**
 * Represents a wrapper of gnugo process
 * @constructor
 * 
 * @param {Array} params : parameter that will be send to gnugo command line
 */
function Board (params) {
  params = params || [];
  this.process = child_process.spawn(path.resolve(__dirname, '../bin/gnugo'), ['--mode', 'gtp'].concat(params), {stdio: 'pipe'});
  this.process.on('error', function (err) {
    console.error(err)
    this.emit(err)
  }.bind(this));
  this.process.stdin.on('error', function (err) {
    console.error(err)
    this.emit(err)
  }.bind(this));
  this.process.on('SIGPIPE', function () {this.emit('error', new Error('epipe'))}.bind(this))
  // this.process.stdout.pipe(process.stdout);
  /* this.process.stderr.pipe(process.stderr);
  process.stdin.pipe(this.process.stdin);1*/
  this.process.on('close', function () {
      this.process.kill('SIGTERM')
      console.log('bot exited')
      this.emit('exit')
  }.bind(this))
  this.buffer = null;
  this.process.stdout.setEncoding('utf8');
  this.process.stdout.on('data', function (data) {
    if (this.buffer === null) {
      this.buffer = data
    } else {
      this.buffer += data
    };
    var temp;
    if (temp = this.buffer.match(/[=?](?:.|[\r\n])*?\n\n/g)) {
      // console.log(temp);
      temp.forEach(function (line) {
        this.emit('raw', line);
      }.bind(this))
      this.buffer = this.buffer.replace(/=(?:.|[\r\n])*?\n\n/g, '');
    }
  }.bind(this))
  this.on('raw', this.onRawEvent.bind(this));
  
  this.on('before_rpl', function (obj) {
    if (obj.action === "showboard") {
      obj.board = new BoardStatus(obj.responseText);
    }
  })
  
  this.boardEventListeners = {};
  this.eventId = 0;
  
  console.log('spawning')
}
util.inherits(Board, EventEmitter);

/**
 * method to invoke gnugo command
 * 
 * @param {string} action - action to perform
 * @param {Array} params - array of arguments in type {@link String} or null
 * @param {Function} cb - node style call back of function or null
 */
Board.prototype.invoke = function (action, params, cb) {
  var defered = Q.defer();
  if ('function' === typeof params) {
    cb = params;
    params = [];
  }
  if (!params) {
    params = [];
  }
  if (!cb) {
    cb = function () {};
  }
  
  defered.promise.nodeify(cb);
  
  this.boardEventListeners[this.eventId] = {
    action: action,
    params: params,
    defered: defered
  }
  this.process.stdin.write(this.eventId + ' ' + action + ' ' + params.join(' ') + '\r\n');
  this.process.on('error', function (err) {
    console.log(err);
  })
  this.eventId++;
  
  return defered.promise
}

Board.prototype.onRawEvent = function (text) {
  // console.log(text)
  var temp = (/([?=])(\d*)(?:\s((?:.|[\r\n])*))?$/).exec(text);
  var id = parseInt(temp[2]);
  if (isNaN(id)) {
    id = null;
  }
  var isError = temp[1] === '?'
  var responseText = temp[3];
  responseText = responseText.replace(/^(?:\s*\n)+|[\s\n]+$/g, '')
  if (id !== null && this.boardEventListeners[id]) {
    var eventProperty =  this.boardEventListeners[id];
    delete this.boardEventListeners[id];
    var eventType = eventProperty.action;
    var resultObj = {
        action: eventProperty.action,
        success: !isError,
        responseText: responseText,
        id: id,
        params: eventProperty.params
      };
    this.emit('before_rpl', resultObj);
    this.emit('rpl_' + eventType, resultObj);
    this.emit('rpl', resultObj)
    if (!isError) {
      eventProperty.defered.resolve(resultObj)
    } else {
      eventProperty.defered.reject(resultObj)
    }
  }
}

/**
 * method to move the go
 * 
 * @param {string} side - side to move
 * @param {string} move - target to move
 * @param {Function} cb - node style call back of {@link Function} or null
 */
Board.prototype.move = function (side, move, cb) {
  return this.invoke('play', [side, move], cb)
  // this.process.stdin.write(num + ' play ' + side + ' ' + move + '\r\n')
}

/**
 * method to auto move the go
 * 
 * @param {string} side - side to move
 * @param {Function} cb - node style call back of {@link Function} or null
 */
Board.prototype.compute = function (side, cb) {
  return this.invoke('genmove', [side], cb)
  // this.process.stdin.write(num + ' genmove ' + side + '\r\n')
}

/**
 * method to get board status
 * 
 * @param {Function} cb - node style call back of {@link Function} or null
 */
Board.prototype.showBoard = function (cb) {
  return this.invoke('showboard', [], cb)
  // this.process.stdin.write(num + ' showboard' + '\r\n')
}

/**
 * method to quit game, alias of invoke(quit)
 * callback of this method will never be fired
 * 
 * @param {Function} cb - node style call back of {@link Function} or null
 */
Board.prototype.destroy = function (cb) {
  return this.invoke('quit', [], cb)
  // this.process.stdin.write(num + ' showboard' + '\r\n')
}
module.exports = Board;
