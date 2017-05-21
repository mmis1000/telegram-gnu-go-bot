var EventEmitter = require("events").EventEmitter;
var util = require("util");

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function InlineKeyboard(identifier) {
    this.identifier = identifier;
    this.separator = "|"
    EventEmitter.call(this);
}

util.inherits(InlineKeyboard, EventEmitter);

InlineKeyboard.prototype.trigger = function trigger(query) {
    if (!query.data) return;
    if (query.data.slice(0, this.identifier.length + this.separator.length) 
        !== this.identifier + this.separator) return;
    
    var data = query.data.slice(this.identifier.length + this.separator.length);
    var args = data.split(new RegExp(escapeRegExp(this.separator), 'g'))
    
    if (!args[0]) return;
    
    this.emit(args[0], args, query);
}

InlineKeyboard.prototype.createData = function createData(event, args) {
    return [this.identifier].concat([event]).concat(args).join(this.separator);
}

module.exports = InlineKeyboard;