var TelegramAPI = require("./lib/tgapi");
var Board = require("./lib/board");
var drawBoard = require("./lib/drawboard");

var api = new TelegramAPI(require("./config").token);

var sessionPool = {};
var seesionTimeout = 3600 * 1000;
function getSession (id) {
  if (!sessionPool[id]) {
    sessionPool[id] = {
      _lastAccess: Date.now()
    }
  }
  sessionPool[id]._lastAccess = Date.now();
  return sessionPool[id]
}
setInterval(function () {
  var key, value;
  for (key in sessionPool) {
    value = sessionPool[key];
    if (Date.now() - sessionPool._lastAccess > seesionTimeout) {
      delete sessionPool[key];
      for (var key2 in value) {
        if (value[key2] != null && 'object' === typeof value[key2] && value[key2].destroy) {
          value[key2].destroy();
        }
      }
    }
  }
}, 100 * 1000)

api.getMe(function (data) {
  api.startPolling(40)
})
api.on('message', function (message) {
  var sess = getSession(message.chat.id);
  var text = message.text;
  if (!text) return;
  if (text.match(/^\/new(@|$|\s)/)) {
    if (sess.board) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    var params = text
      .replace(/^\/new(@[^\s])?\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/, '')
      .split(/\s/g)
      .filter(function (i) {return !!i});
    
    sess.board = new Board(params)
    sess.board.on('rpl', function (obj) {
      console.log(obj)
    })
    sess.board.on('error', function (err) {
      api.sendMessage(message.chat.id, err)
    })
    api.sendMessage(message.chat.id, 'game start')
    sess.board.showBoard()
    .then(function (obj) {
      var buffer = drawBoard(obj.board);
      // console.log(buffer);
      api.sendPhoto(message.chat.id, {
        value:  buffer,
        options: {
          filename: 'go.png',
          contentType: 'image/png'
        }
      }, {}, function (data) {
        console.log(data)
      });
    })
    .catch(function (err) {
      console.log(err);
    })
  }
  if (text.match(/^\/([A-Z]\d+|pass|auto)(@|$)/)) {
    if (!sess.board) {
      return api.sendMessage(message.chat.id, 'curruntly no game is playing')
    }
    var position = /^\/([A-Z]\d+|pass|auto)(@|$)/.exec(text)[1];
    var temp;
    var white_last_action = null;
    var estimate_score = null
    if (sess.isRunning) {
      return api.sendMessage(message.chat.id, 'please wait for current action to be finished');
    }
    sess.isRunning = true;
    if (position === "auto") {
      temp = sess.board.compute('black')
    } else {
      temp = sess.board.move('black', position)
    }
    temp.then(function () {
      return sess.board.compute('white');
    })
    .then(function (status) {
      white_last_action = status.responseText
      // api.sendMessage(message.chat.id, 'last action of white: ' + status.responseText);
      return sess.board.invoke('estimate_score')
    })
    .then(function (status) {
      estimate_score = status.responseText;
      api.sendMessage(message.chat.id, 'last action of white: ' + white_last_action + '\nestimate score: ' + estimate_score);
      return sess.board.showBoard()
    })
    .then(function (obj) {
      console.log(obj.responseText)
      var buffer = drawBoard(obj.board);
      // console.log(buffer);
      api.sendPhoto(message.chat.id, {
        value:  buffer,
        options: {
          filename: 'go.png',
          contentType: 'image/png'
        }
      }, {}, function (data) {
        console.log(data)
      });
      sess.isRunning = false;
    })
    .catch(function (status) {
      sess.isRunning = false;
      api.sendMessage(message.chat.id, 'error: ' + status.responseText);
    })
  }
  
  if (text.match(/^\/exit(@|$)/)) {
    if (!sess.board) {
      return api.sendMessage(message.chat.id, 'curruntly no game is playing')
    }
    sess.board.destroy();
    delete sess.board;
    return api.sendMessage(message.chat.id, 'game quited')
  }
  if (text.match(/^\/help(@|$|\s)/)) {
    return api.sendMessage(message.chat.id, `
Hello, I am gnu go bot.
I can play go with you.
To start a game.
Type \`/new\`
Or with some gnugo parameter.
For example:
  \`/new --level 1 --boardsize 13\`
To place the stones
  Type \`/A1\` - \`/T19\`
To pass
  Type \`/pass\`
To auto
  Type \`/auto\`
To quit
  type \`/exit\`
    `, null, {
      parse_mode: 'Markdown'
    })
  }
})