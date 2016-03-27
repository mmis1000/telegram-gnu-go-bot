var TelegramAPI = require("./tgapi");
var Board = require("./board");
var drawBoard = require("./drawboard");
var Game = require("./game");

var Temp = require('temp');
var fs = require('fs');
Temp.track();

var KEYBOARD_STATUS = {
  faction: -1,
  first: 0,
  second: 1,
  final: 2
}

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
    if (Date.now() - sessionPool[key]._lastAccess > seesionTimeout) {
      delete sessionPool[key];
      for (var key2 in value) {
        if (value[key2] != null && 'object' === typeof value[key2] && value[key2].destroy) {
          value[key2].destroy();
        }
      }
    }
  }
}, 100 * 1000)
api.on('error', function(err) {
  console.error(err.stack ? err.stack : err);
})
api.getMe(function (data) {
  api.startPolling(40)
})
api.on('message', function (message) {
  var sess = getSession(message.chat.id);
  var text = message.text;
  var board;
  
  sess.white = sess.white || 'bot';
  sess.black = sess.black || '*';
  sess.defaultSide = sess.defaultSide || 'black';
  
  sess.users = sess.users || {};
  sess.userKeyboardStatus = sess.userKeyboardStatus || {};
  
  sess.withBot = true;
  
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
              board = new Board(sess.loadParams);
              sess.game = startGame(sess, board, message, sess.side, {'sgfPath': info.path});
            });
          }
        });
      })
    })
  }
  if (!text) return;
  
  if (text.match(/^\/claim(@.+)?\s(black|white)$/)) {
    if (sess.userKeyboardStatus[message.from.id] &&
      sess.userKeyboardStatus[message.from.id].enabled &&
      sess.userKeyboardStatus[message.from.id].mode === KEYBOARD_STATUS.faction) {
      sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.first;
      showFirstKeyBoard();
    }
    if (sess.game && sess.users[message.from.id]) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    sess.users[message.from.id] = sess.users[message.from.id] || {};
    if (text.match(/^\/claim(@.+)?\s(black)$/)) {
      sess.users[message.from.id].side = "black"
      return api.sendMessage(message.chat.id, 'setted current user to black')
    } else {
      sess.users[message.from.id].side = "white"
      return api.sendMessage(message.chat.id, 'setted current user to white')
    }
  }
  if (text.match(/^\/mode(@.+)?\s(black|white|2p)$/)) {
    if (sess.game) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    if (text.match(/^\/mode(@.+)?\sblack$/)) {
      sess.white = 'bot';
      sess.black = '*';
      sess.defaultSide = 'black';
      return api.sendMessage(message.chat.id, 'setted the mode to black')
    } else if (text.match(/^\/mode(@.+)?\swhite$/)) {
      sess.white = '*';
      sess.black = 'bot';
      sess.defaultSide = 'white';
      return api.sendMessage(message.chat.id, 'setted the mode to white')
    } else  {
      sess.white = '*';
      sess.black = '*';
      sess.defaultSide = 'black';
      return api.sendMessage(message.chat.id, 'setted the mode to 2p')
    }
  }
  
  function showFactionSelection () {
    api.sendMessage(message.chat.id, 'Please select your faction', null, {
      reply_to_message_id: message.message_id,
      reply_markup: JSON.stringify({
        keyboard: [
          ['/claim black','/claim white', '/cancel']
        ],
        resize_keyboard: true,
        selective: true
      })
    })
  }
  function showFirstKeyBoard () {
    api.sendMessage(message.chat.id, 'Showing keyboard', null, {
      reply_to_message_id: message.message_id,
      reply_markup: JSON.stringify({
        keyboard: [
          'ABCDEFGHJK'.split(''),
          'LMNOPQRST'.split(''),
          ['/resign', '/auto', '/pass', '/cancel']
        ],
        resize_keyboard: true,
        selective: true
      })
    })
  }
  function showSecondKeyBoard () {
    api.sendMessage(message.chat.id, 'Now send the second text', null, {
      reply_to_message_id: message.message_id,
      reply_markup: JSON.stringify({
        keyboard: [
          '1|2|3|4|5|6|7|8|9|10'.split('|'),
          '11|12|13|14|15|16|17|18|19'.split('|'),
          ['/cancel']
        ],
        resize_keyboard: true,
        selective: true
      })
    })
  }
  
  if (text.match(/^\/enable_keyboard(@|$|\s)/)) {
    sess.userKeyboardStatus[message.from.id] = sess.userKeyboardStatus[message.from.id] || {};
    sess.userKeyboardStatus[message.from.id].enabled = true;
    sess.userKeyboardStatus[message.from.id].cache = {};
    if (!sess.users[message.from.id] &&
      sess.white !== 'bot' && sess.black !== 'bot') {
      sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.faction;
      showFactionSelection();
    } else {
      sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.first;
      showFirstKeyBoard();
    }
  }
  if (text.match(/^[A-T]$/) && 
    sess.userKeyboardStatus[message.from.id] &&
    sess.userKeyboardStatus[message.from.id].enabled === true &&
    sess.userKeyboardStatus[message.from.id].mode === KEYBOARD_STATUS.first
  ) {
    sess.userKeyboardStatus[message.from.id].cache = {
      first: /^([A-T])$/.exec(text)[1]
    };
    sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.second;
    showSecondKeyBoard();
  }
  if (text.match(/^[1-9]\d*$/) && 
    sess.userKeyboardStatus[message.from.id] &&
    sess.userKeyboardStatus[message.from.id].enabled === true &&
    sess.userKeyboardStatus[message.from.id].mode === KEYBOARD_STATUS.second
  ) {
    sess.userKeyboardStatus[message.from.id].cache.second = /^([1-9]\d*)$/.exec(text)[1];
    sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.final;
  }
  
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
    sess.userKeyboardStatus[message.from.id] = {};
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
    sess.game = startGame(sess, board, message, sess.side);
  }
  if (text.match(/^\/([A-Z]\d+|pass|auto|resign)(@|$)/) || (
    sess.userKeyboardStatus[message.from.id] && 
    sess.userKeyboardStatus[message.from.id].mode === KEYBOARD_STATUS.final
  )) {
    if (sess.userKeyboardStatus[message.from.id] && 
      sess.userKeyboardStatus[message.from.id].mode === KEYBOARD_STATUS.final) {
      var position = sess.userKeyboardStatus[message.from.id].cache.first +
        sess.userKeyboardStatus[message.from.id].cache.second;
    } else {
      var position = /^\/([A-Z]\d+|pass|auto|resign)(@|$)/.exec(text)[1];
    }
    if (sess.userKeyboardStatus[message.from.id] && 
      sess.userKeyboardStatus[message.from.id].enabled) {
      if (sess.userKeyboardStatus[message.from.id].mode !== KEYBOARD_STATUS.first) {
        sess.userKeyboardStatus[message.from.id].mode = KEYBOARD_STATUS.first;
        showFirstKeyBoard();
      }
      sess.userKeyboardStatus[message.from.id].cache = {};
    }
    
    if (sess.white !== 'bot' && sess.black !== 'bot' && !sess.users[message.from.id]) {
      return api.sendMessage(message.chat.id, 'please claim your faction before you join this game', null, {
        reply_to_message_id: message.message_id
      });
    }
    var side = sess.users[message.from.id] ? sess.users[message.from.id].side : sess.defaultSide;
    if (!sess.game) {
      return api.sendMessage(message.chat.id, 'no game is running');
    }
    if (sess[side] === 'bot') {
      side = side === 'white' ? 'black' : 'white';
      // return api.sendMessage(message.chat.id, side + ' is controled by bot, you are not allowed to do this!!!')
    }
    sess.game.action(side, position).catch(function (err) {
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
  if (text.match(/^\/(help|start)(@|$|\s)/)) {
    return api.sendMessage(message.chat.id, `
Hello, I am gnu go bot.
I can play go with you.
To set game mode
  Type \`/mode white|black|2p\`
To clain which side you like to play
  Type \`/claim white|black\`
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
To show custom keyboard
  Type \`/enable_keyboard\`
To save a game
  Type \`/export\`
To place the stones
  Type \`/A1\` - \`/T19\`
To pass
  Type \`/pass\`
To auto
  Type \`/auto\`
To resign
  Type \`/resign\`
To quit
  type \`/exit\`

To rate this bot
[Rate me please](https://telegram.me/storebot?start=gnu_go_bot) 

Mmis1000. 2016, Released under MIT License
[Source codes](https://github.com/mmis1000/telegram-gnu-go-bot)
    `, null, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })
  }
})

function startGame (session, board, message, selfSide, options) {
  options = options == null ? {} : ('object' != typeof options) ? {} : options;
  options.board = board;
  var game = new Game(options)
  if (session.black === "bot") {
    game.on('side_change', function (side) {
      if (side === "black") {
        game.action("black", "auto");
      }
    })
  }
  if (session.white === "bot") {
    game.on('side_change', function (side) {
      if (side === "white") {
        game.action("white", "auto");
      }
    })
  }
  game.on('side_change', function (side, res, game) {
    if (session[side] === 'bot') return;
    var textMessage = 'Last action of ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove +
      ' \r\nEstimate score: ' + game.estimate_score;
    // api.sendMessage(message.chat.id, 'last action of: ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove);
  
    var buffer = drawBoard(res.board, null, [game.lastMove]);
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
    api.sendMessage(message.chat.id, 'game ended, winner is ' + game.winner + ', score is ' + game.estimate_score, null, {
      reply_markup: JSON.stringify({
        hide_keyboard: true
      })
    });
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
    
    session.users = {};
    api.sendMessage(message.chat.id, 'reseted all users\' sides');
    
    delete session.game;
  })
  
  game.on('game_start', function(res, game) {
    if (session[game.currentSide] === 'bot') {
      game.action(game.currentSide, "auto");
    }
    
    var buffer = drawBoard(res.board);
    // console.log(buffer);
    api.sendPhoto(message.chat.id, {
      value:  buffer,
      options: {
        filename: 'go.png',
        contentType: 'image/png'
      }
    }, {
      caption: 'Game start, this is ' + game.currentSide + '\'s turn. \r\nNow place the stone with command. eg. /D4 \r\nor use custom keyboard /enable_keyboard'
    }, function (err, data) {
      console.log(err, data)
    });
  })
  /*
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
  */
  return game;
}
