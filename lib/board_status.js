/**
 * Represents a board status.
 * @constructor
 * 
 * @param {string} text - board status from gnu go protocol
 * or just not load and use {@link BoardStatus#load} to load later
 */
function BoardStatus (text) {
  this.board = null
  this.captured = null;
  if (text) {
    this.load(text)
  }
}

/**
 * Load the gnugo data
 * 
 * @param {string} text - board status from gnu go protocol
 */
BoardStatus.prototype.load = function load(text) {
  var temp = text.replace(/^[\s\r\n]+|[\r\n\s]+$/g, '').split(/\n/g);
  var captured = {};
  temp = temp.slice(1, temp.length - 1);
  var result = temp.map(function (line) {
    var temp = /\d+\s((?:[OX+.]\s)+)\d+(?:\s+(WHITE|BLACK).+(\d+))?/.exec(line)
    if (temp[2]) {
      captured[temp[2]] = temp[3];
    }
    return temp[1].match(/[OX+.]/g).map(function (text) {
      if (text === '+') return '.';
      return text;
    });
  })
  var valid = result.reduce(function (status, current) {
    if (status.prevLength === null) {
      status.prevLength = current.length;
    }
    status.valid = status.valid && status.prevLength === current.length
    status.valid = status.valid && current.filter(function (i) {
      return ['O', 'X', '.'].indexOf(i) < 0
    }).length === 0;
    return status;
  }, {prevLength: null, valid: true}).valid
  if (valid) {
    this.board = result;
    this.captured = captured;
  } else {
    throw new Error('bad board status');
  }
}

module.exports = BoardStatus;