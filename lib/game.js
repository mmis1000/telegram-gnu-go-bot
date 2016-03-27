/**
 * Game Module
 * @module telegram-go/game
 */

var Board = require("./board");
var Q = require("q");
var util = require("util")
var EventEmitter = require("events").EventEmitter;
/**
 * class to handle a game all actions, and control for win, fail, resign.
 * 
 * @constructor
 * @param {Object} options - optional option to override the game setting
 */
function Game (options) {
  options = ('object' === typeof options && null != options) ? options : {};
  this.currentSide = "black";
  this.passCount = 0;
  this.winner = null;
  this.estimate_score = null;
  this.gameEnded = false;
  this.processing = false;
  this.sgfPath = null;
  var key;
  for (key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }
  this.board = options.board || new Board();
  this.board.on('game_end', function (self) {
    self.emit('game_end', self.winner. self.estimate_score);
  })
  this.board.on('exit', function(code) {
    this.exitCode = code;
    this.emit('exit', this);
  }.bind(this))
  this.board.on('rpl', function(res) {
    this.emit('rpl', res);
    this.emit('rpl_' + res.action, res);
  }.bind(this))
  if (!this.sgfPath) {
    this.showBoard()
    .then(function (res) {
      this.emit('game_start', res, this)
    }.bind(this))
    .catch(function (err) {
      console.error(err);
      this.exit();
    }.bind(this))
  } else {
    this.board.invoke('loadsgf', [this.sgfPath])
    .then(function (res) {
      this.currentSide = res.responseText.toLowerCase();
      
      this.showBoard()
      .then(function (res) {
        this.emit('game_start', res, this)
      }.bind(this))
      .catch(function (err) {
        console.error(err);
        this.exit();
      }.bind(this))
    }.bind(this))
    .catch(function (err) {
      console.error(err.stack ? err.stack : err.toString());
      this.exit()
    }.bind(this))
  }
}
util.inherits(Game, EventEmitter);

/**
 * action as a player on side {side} with action {action}
 * 
 * @param {string} side - side you would like to act
 * @param {string} action - action you would like to perform <br> action could be following : <br> A1 - T19, pass, resign, auto
 * @returns {Promise}
 */
Game.prototype.action = function action(side, action) {
  var defered;
  if (this.processing) {
    defered = Q.defer();
    defered.reject(new Error('the engine is processing'))
    return defered.promise;
  }
  if (this.gameEnded) {
    defered = Q.defer();
    defered.reject(new Error('this game has been ended'))
    return defered.promise;
  }
  if (!action.match(/^(?:[a-z][0-9]+|pass|auto|resign)$/i)) {
    defered = Q.defer();
    defered.reject(new Error('invalid action: ' + action))
    return defered.promise;
  }
  if (!side.match(/^(?:black|white)$/i)) {
    defered = Q.defer();
    defered.reject(new Error('invalid side: ' + side))
    return defered.promise;
  }
  if (side !== this.currentSide) {
    defered = Q.defer();
    defered.reject(new Error('it\'s not ' + side + '\'s turn'))
    return defered.promise;
  }
  defered = Q.defer();
  this.processing = true;
  if (action.match(/resign/i)) {
    this.winner = side.match(/black/i) ? 'white' : 'black';
    this.board.invoke('estimate_score')
    .then(function (res) {
      this.estimate_score = res.responseText;
      return this.board.showBoard()
    }.bind(this))
    .then(function (res) {
      this.gameEnded = true;
      this.lastMove = 'resign';
      res.lastMove = 'resign';
      
      this.currentSide =  this.currentSide.match(/black/i) ? 'white' : 'black';
      this.emit('side_change', this.currentSide, res, this);
      
      defered.resolve(res);
      this.processing = false;
      this.emit('game_end', this);
    }.bind(this))
    .catch(function (err) {
      this.processing = false;
      defered.reject(err);
    }.bind(this))
  } else if (action.match(/^(?:pass|[a-z][0-9]+)$/i)) {
    this.board.move(side, action)
    .then(function (res) {
      this.lastMove = res.params[1].toUpperCase();
      if (this.lastMove === 'PASS') {
        this.passCount++;
      }
      return this.board.invoke('estimate_score')
    }.bind(this))
    .then(function (res) {
      this.estimate_score = res.responseText;
      return this.board.showBoard()
    }.bind(this))
    .then(function (res) {
      res.lastMove = this.lastMove;
      this.processing = false;
      if (this.passCount >= 2) {
        this.gameEnded = true;
      }
      this.currentSide = side.match(/black/i) ? 'white' : 'black';
      this.emit('side_change', this.currentSide, res, this);
      defered.resolve(res);
      if (this.passCount >= 2) {
        var parsedScore = parseScore(this.estimate_score)
        
        if (parsedScore > 0) {
          this.winner = 'white'
        } else if (parsedScore < 0) {
          this.winner = 'black'
        } else {
          this.winner = 'none'
        }
        this.emit('game_end', this);
      }
    }.bind(this))
    .catch(function (err) {
      this.processing = false;
      defered.reject(err);
    }.bind(this))
  } else if (action.match(/auto/i)) {
    this.board.compute(side)
    .then (function (res) {
      this.lastMove = res.responseText;
      if (this.lastMove === 'PASS') {
        this.passCount++;
      }
      if (this.lastMove === 'resign') {
        this.passCount += 2;
      }
      return this.board.invoke('estimate_score')
    }.bind(this))
    .then(function (res) {
      this.estimate_score = res.responseText;
      return this.board.showBoard()
    }.bind(this))
    .then(function (res) {
      res.lastMove = this.lastMove;
      this.processing = false;
      if (this.passCount >= 2) {
        this.gameEnded = true;
      }
      this.currentSide = side.match(/black/i) ? 'white' : 'black';
      this.emit('side_change', this.currentSide, res, this);
      defered.resolve(res);
      if (this.gameEnded) {
        
        var parsedScore = parseScore(this.estimate_score)
        
        if (res.lastMove === "resign") {
          this.winner = side.match(/black/i) ? 'white' : 'black';
        } else if (parsedScore < 0) {
          this.winner = 'black'
        } else if (parsedScore > 0) {
          this.winner = 'white'
        } else {
          this.winner = 'none'
        }
        this.emit('game_end', this);
      }
    }.bind(this))
    .catch(function (err) {
      this.processing = false;
      defered.reject(err);
    }.bind(this))
  }
  return defered.promise
}

/**
 * show the game board
 *
 * @returns {Promise}
 */
Game.prototype.showBoard = function () {
  var defered;
  defered = Q.defer();
  this.board.invoke('showboard')
  .then(function (res) {
    defered.resolve(res);
  }.bind(this))
  .catch(function (res) {
    defered.reject(res);
  }.bind(this))
  return defered.promise;
}

Game.prototype.endGame = function endGame() {
  var defered;
  if (this.processing) {
    defered = Q.defer();
    defered.reject(new Error('the engine is processing'))
    return defered.promise;
  }
  defered = Q.defer()
  this.processing = true;
  this.board.invoke('estimate_score')
  .then(function (res) {
    this.gameEnded = true;
    this.estimate_score = res.responseText;
    var parsedScore = parseScore(this.estimate_score)
    if (parsedScore < 0) {
      this.winner = 'black'
    } else if (parsedScore > 0) {
      this.winner = 'white'
    } else {
      this.winner = 'none'
    }
    this.processing = false;
    defered.resolve(res);
    this.emit('game_end', this);
  }.bind(this))
  .catch(function (err) {
    this.processing = false;
    defered.reject(err);
  }.bind(this));
  return defered.promise;
}

/**
 * exports the game data
 *
 * @returns {Promise}
 */
Game.prototype.export = function () {
  var defered;
  if (this.processing) {
    defered = Q.defer();
    defered.reject(new Error('the engine is processing'))
    return defered.promise;
  }
  defered = Q.defer();
  
  this.processing = true;
  this.board.invoke('printsgf')
  .then(function (res) {
    this.processing = false;
    defered.resolve(res);
  }.bind(this))
  .catch(function (res) {
    this.processing = false;
    defered.reject(res);
  }.bind(this))
  return defered.promise;
}

/**
 * quit the entire game, this instance will no longer usable after calling this method
 *
 * @returns {Promise}
 */
Game.prototype.exit = function () {
  var defered;
  if (this.processing) {
    defered = Q.defer();
    defered.reject(new Error('the engine is processing'))
    return defered.promise;
  }
  defered = Q.defer();
  
  this.processing = true;
  this.board.invoke('quit')
  .then(function (res) {
    this.processing = false;
    defered.resolve(res);
  }.bind(this))
  .catch(function (res) {
    this.processing = false;
    defered.reject(res);
  }.bind(this))
}

function parseScore (estimate_score) {
  var parsedScore = estimate_score.match(/[+-]\d+\.\d+/i)[0];
  parsedScore = parseInt(parsedScore);
  if (isNaN(parsedScore)) {
    parsedScore = 0
  }
  if (estimate_score.match(/^b/i)) {
    parsedScore = -parsedScore;
  }
  return parsedScore
}

// make a graceful shutdown when session timeout
Game.prototype.destroy = Game.prototype.endGame;

module.exports = Game;