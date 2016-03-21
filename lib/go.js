var TelegramAPI = require("./tgapi");
var Board = require("./board");
var drawBoard = require("./drawboard");
var Game = require("./game");

var Temp = require('temp');
var fs = require('fs');
Temp.track();

var api = new TelegramAPI(require("../config").token);

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
  var board;
  
  sess.user2p = sess.user2p || 'bot';
  sess.side = sess.side || 'black';
  if (sess.isRunning) return;
  if (sess.waitSGF && message.document) {
    // load sgf data as a game
    sess.isRunning = true;
    console.log('got sgf file');
    sess.waitSGF = false;
    api.getFile(message.document.file_id, function (err, res) {
      if (err) {
        sess.isRunning = false;
        return api.sendMessage(message.chat.id, 'error during load SGF')
      }
      api.getFileContent(res.file_path, function (err, res, body) {
        if (err) {
          sess.isRunning = false;
          return api.sendMessage(message.chat.id, 'error during load SGF')
        }
        Temp.open({suffix: '.sgf'}, function(err, info) {
          if (err) {
            sess.isRunning = false;
            return api.sendMessage(message.chat.id, 'error during load SGF')
          } else {
            fs.write(info.fd, body, 0, body.length, function () {});
            fs.close(info.fd, function(err) {
              if (err) {
                sess.isRunning = false;
                return api.sendMessage(message.chat.id, 'error during load SGF')
              }
              sess.isRunning = false;
              if (sess.game) {
                return api.sendMessage(message.chat.id, 'please exit current game')
              }
              board = new Board(['--infile', info.path].concat(sess.loadParams));
              sess.game = startGame(sess, board, message, 'black');
            });
          }
        });
      })
    })
  }
  if (!text) return;
  if (text.match(/^\/load(@|$|\s)/)) {
    if (sess.game) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    
    var params = text
      .replace(/^\/load(@[^\s]+)?\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/, '')
      .split(/\s/g)
      .filter(function (i) {return !!i});
    
    sess.loadParams = params
    sess.waitSGF = true;
    api.sendMessage(message.chat.id, 'now send me the sgf file', null, {
      reply_to_message_id: message.message_id,
      reply_markup: JSON.stringify({
        force_reply: true,
        selective: true
      })
    })
  }
  if (text.match(/^\/cancel(@|$|\s)/)) {
    sess.waitSGF = false;
    api.sendMessage(message.chat.id, 'keyboard closed', null, {
      reply_to_message_id: message.message_id,
      reply_markup: JSON.stringify({
        hide_keyboard: true,
        selective: true
      })
    })
  }
  if (text.match(/^\/new(@|$|\s)/)) {
    if (sess.game) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    var params = text
      .replace(/^\/new(@[^\s]+)?\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/, '')
      .split(/\s/g)
      .filter(function (i) {return !!i});
    board = new Board(params)
    sess.game = startGame(sess, board, message, 'black');
  }
  if (text.match(/^\/([A-Z]\d+|pass|auto|resign)(@|$)/)) {
    if (!sess.game) {
      return api.sendMessage(message.chat.id, 'no game is running')
    }
    var position = /^\/([A-Z]\d+|pass|auto|resign)(@|$)/.exec(text)[1];
    sess.game.action(sess.side, position).catch(function (err) {
      console.log(err.stack)
      api.sendMessage(message.chat.id, 'error ' + err.toString());
    });
  }
  if (text.match(/^\/export(@|$)/)) {
    if (!sess.game) {
      return api.sendMessage(message.chat.id, 'no game is running')
    }
    sess.game.export()
    .then(function (res) {
      api.sendDocument(message.chat.id, {
        value: res.responseText,
        options: {
          filename: message.chat.id + '_' + Date.now() + '.sgf',
          contentType: 'text/plain'
        }
      })
    })
    .catch(function (err) {
      api.sendMessage(message.chat.id, 'error ' + err.toString());
    });
  }
  
  if (text.match(/^\/exit(@|$)/)) {
    if (!sess.game) {
      return api.sendMessage(message.chat.id, 'no game is running')
    }
    sess.game.endGame()
    .catch(function(err) {
      api.sendMessage(message.chat.id, 'error ' + err.toString());
    })
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
To continue a game
  Type \`/load\`
  or with some arguments
  \`/load --level 1\`
  then send the sgf file to the bot as document
To save a game
  Type \`/export\`
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

function startGame (session, board, message, selfSide) {
  var game = new Game({
    board: board
  })
  if (session.user1p === "bot") {
    game.on('side_change', function (side) {
      if (side === "black") {
        game.action("black", "auto");
      }
    })
    if (game.currentSide === "black") {
      game.action("auto");
    }
  }
  if (session.user2p === "bot") {
    game.on('side_change', function (side) {
      if (side === "white") {
        game.action("white", "auto");
      }
    })
  }
  game.on('side_change', function (side, res, game) {
    if (selfSide !== side) return;
    var textMessage = 'Last action of ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove +
      ' \r\nEstimate score: ' + game.estimate_score;
    // api.sendMessage(message.chat.id, 'last action of: ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove);
  
    var buffer = drawBoard(res.board);
    // console.log(buffer);
    api.sendPhoto(message.chat.id, {
      value:  buffer,
      options: {
        filename: 'go.png',
        contentType: 'image/png'
      }
    }, {
      caption: textMessage
    }, function (err, data) {
      console.log(err, data)
    });
  })
  game.on('game_end', function (game) {
    api.sendMessage(message.chat.id, 'game ended, winner is ' + game.winner + ', score is ' + game.estimate_score);
    game.export()
    .then(function () {
      game.exit();
    })
    .catch(function (err) {
      api.sendMessage(message.chat.id, 'error save board :' + err);
    });
  })
  game.on('rpl_printsgf', function (res) {
    if (game.gameEnded) {
      api.sendDocument(message.chat.id, {
        value: res.responseText,
        options: {
          filename: message.chat.id + '_' + Date.now() + '.sgf',
          contentType: 'text/plain'
        }
      })
    }
  })
  game.on('exit', function (code) {
    if (game.exitCode !== 0) {
      api.sendMessage(message.chat.id, 'game exit unexpectedly with code ' + game.exitCode);
    }
    delete session.game;
  })
  game.showBoard()
  .then(function (res) {
    var buffer = drawBoard(res.board);
    // console.log(buffer);
    api.sendPhoto(message.chat.id, {
      value:  buffer,
      options: {
        filename: 'go.png',
        contentType: 'image/png'
      }
    }, {
      caption: 'Game start, now place the stone with command. eg. /D4'
    }, function (err, data) {
      console.log(err, data)
    });
  })
  .catch(function (err) {
    api.sendMessage(message.chat.id, 'error during show the board : ' + err);
  })
  return game;
}
