var TelegramAPI = require("./tgapi");
var Board = require("./board");
var drawBoard = require("./drawboard");
var Game = require("./game");
var InlineKeyboard = require("./inline_keyboard");

var Temp = require('temp');
var fs = require('fs');
Temp.track();

var KEYBOARD_STATUS = {
  first: 0,
  second: 1,
  final: 2
}

var api = new TelegramAPI(require("../config").token);
var inlineKeyboard = new InlineKeyboard(Date.now().toString(16));
api.on('callback_query', inlineKeyboard.trigger.bind(inlineKeyboard));

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

function makeEventFactory(event) {
  return function(text) {
    return {
      text: text,
      callback_data: inlineKeyboard.createData(event, [].slice.call(arguments, 1))
    };
  }
}

function createAlphabetKeyboard() {
  var action = makeEventFactory('action');
  var move = makeEventFactory('move');
  return [
    [
      action('Claim black', 'claim_black'), 
      action('Claim white', 'claim_white'),
      // action('Mode', 'toggle_mode'),
      action('Exit', 'exit')
    ],
    'ABCDEFGH'.split('').map(function (char) {
      return move(char, char)
    }),
    'JKLMNOPQ'.split('').map(function (char) {
      return move(char, char)
    }),
    [
      move('R', 'R'),
      move('S', 'S'),
      move('T', 'T'),
      move('Resign', 'resign'),
      move('Auto', 'auto'),
      move('Pass', 'pass')
    ]
  ];
}

function createNumberKeyboard() {
  var action = makeEventFactory('action');
  var move = makeEventFactory('move');
  return [
    [
      action('Claim black', 'claim_black'), 
      action('Claim white', 'claim_white'),
      // action('Mode', 'toggle_mode'),
      action('Exit', 'exit')
    ],
    '1|2|3|4|5|6|7|8'.split('|').map(function (char) {
      return move(char, char)
    }),
    '9|10|11|12|13|14|15|16'.split('|').map(function (char) {
      return move(char, char)
    }),
    [
      move('17', '17'),
      move('18', '18'),
      move('19', '19'),
      move('←', 'backspace'),
      move('Resign', 'resign'),
      move('Auto', 'auto'),
      move('Pass', 'pass')
    ]
  ];
}

function createConfigKeyBoard(currentRow, currentMode, currentLevel, deleteOldMessage) {
  var setting = makeEventFactory('setting');
  
  var rowOptions = [
    setting('< Decrease size', 'decrease_size'),
    setting(currentRow + "", '_')
  ];
  
  if (currentRow < 19) {
    rowOptions.push(setting('Increase size >', 'increase_size'));
  }
  
  var modeOptions = [
    setting('Black mode ' + (currentMode === 'black' ? '(O)': '( )'), 'black_mode'),
    setting('2P mode ' + (currentMode === '2p' ? '(O)': '( )'), '2p_mode'),
    setting('White mode ' + (currentMode === 'white' ? '(O)': '( )'), 'white_mode')
  ]
  
  var levelOptions = [
    setting(currentLevel + "", '_')
  ]
  
  if (currentLevel > 1) {
    levelOptions.unshift(setting('< Decrease level', 'decrease_level'))
  }
  
  if (currentLevel < 10) {
    levelOptions.push(setting('Increase level >', 'increase_level'))
  }
  
  var deleteOldMessageOptions = [
    setting('Automatically delete old message' + (deleteOldMessage ? '[V]': '[ ]'), 'toggle_auto_delete')
  ]
  
  return [modeOptions, rowOptions, levelOptions, deleteOldMessageOptions];
}

function buildArguments(obj) {
  return Object.keys(obj).map(function (key) {
    return ['--' + key, obj[key]]
  }).reduce(function (prev, curr) {
    return prev.concat(curr);
  }, [])
}

api.on('error', function(err) {
  console.error(err.stack ? err.stack : err);
})

api.getMe(function (data) {
  console.log(data);
  api.startPolling(40)
})

api.on('message', function (message) {
  var sess = getSession(message.chat.id);
  var text = message.text;
  var board;
  sess.params = sess.params || {
    boardsize: 19,
    level: 5
  };
  sess.mode = sess.mode || 'black';
  sess.users = sess.users || {};
  sess.keyboardStatus = sess.keyboardStatus || KEYBOARD_STATUS.first;
  sess.boardMessage = sess.boardMessage || null;
  sess.deleteOldMessage = sess.deleteOldMessage || true;
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
              
              board = new Board(buildArguments(sess.params).concat(sess.loadParams));
              sess.game = startGame(sess, board, message, sess.side, {'sgfPath': info.path});
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
    
    sess.boardSize = 19;
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
  
  if (text.match(/^\/new(@|$|\s)/)) {
    if (sess.game) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    var params = text
      .replace(/^\/new(@[^\s]+)?\s*/, '')
      .replace(/[^a-zA-Z0-9\-"']/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/, '')
      .split(/\s/g)
      .filter(function (i) {return !!i});
    board = new Board(buildArguments(sess.params).concat(params));
    sess.game = startGame(sess, board, message, sess.side);
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
  Or with some addition gnugo parameter.
  For example:
    \`/new --level 1 --boardsize 13\`
To continue a game
  Type \`/load\`
  or with some addition arguments
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
  
  if (text.match(/^\/(setting)(@|$|\s)/)) {
    api.sendMessage(message.chat.id, 'setting', null, {
      reply_markup: JSON.stringify({inline_keyboard: createConfigKeyBoard(sess.params.boardsize, sess.mode, sess.params.level, sess.deleteOldMessage)})
    })
  }
})

inlineKeyboard.on('move', function (args, query) {
  var chat_id = query.message.chat.id;
  var session = getSession(chat_id);
  if (session.isRunning) return;
  
  if (!session.game) {
    return api.answerCallbackQuery(query.id, null, {
      text: 'there is currently no game running'
    })
  }
  
  if (!session.users[query.from.id]) {
    session.users[query.from.id] = {};
  }
  
  if (session.mode !== '2p') {
    session.users[query.from.id].faction = session.mode;
  }
  
  if (!session.users[query.from.id].faction) {
    return api.answerCallbackQuery(query.id, null, {
      text: 'you must join either a faction to play with this bot'
    })
  }
  
  if (session.side !== session.users[query.from.id].faction) {
    return api.answerCallbackQuery(query.id, null, {
      text: 'It\'s not your turn.'
    })
  }
  
  if (args[1].match(/^[A-Z]$/) && session.keyboardStatus === KEYBOARD_STATUS.first) {
    session.move = args[1]
    session.keyboardStatus = KEYBOARD_STATUS.second;
    
    api.editMessageCaption(
      session.boardMessage.chat.id, 
      session.boardMessage.message_id,
      session.boardMessage.caption + '\r\n' + "input: " + args[1],
      null,
      {
        reply_markup: JSON.stringify({inline_keyboard: createNumberKeyboard()})
      }
    );
  }
  
  if (args[1] === 'backspace') {
    session.keyboardStatus = KEYBOARD_STATUS.first;
    api.editMessageCaption(
      session.boardMessage.chat.id, 
      session.boardMessage.message_id,
      session.boardMessage.caption + '\r\n' + "input cleared",
      null,
      {
        reply_markup: JSON.stringify({inline_keyboard: createAlphabetKeyboard()})
      }
    );
  }
  
  if (args[1].match(/^(pass|auto|resign)$/) ||
    (args[1].match(/^\d+$/) && session.keyboardStatus === KEYBOARD_STATUS.second)) {
      
    session.move += args[1];
    session.keyboardStatus = KEYBOARD_STATUS.final;
    
    if (args[1].match(/^(pass|auto|resign)$/)) {
      session.move = args[1];
    }
    
    session.game.action(session.users[query.from.id].faction, session.move)
    .then(function () {
      session.keyboardStatus = KEYBOARD_STATUS.first;
    })
    .catch(function (err) {
      session.keyboardStatus = KEYBOARD_STATUS.first;
      console.log(err.stack)
      
      api.editMessageCaption(
        session.boardMessage.chat.id, 
        session.boardMessage.message_id,
        session.boardMessage.caption + '\r\n' + err.toString(),
        null,
        {
          reply_markup: JSON.stringify({inline_keyboard: createAlphabetKeyboard()})
        }
      );
    });
  }
  
  return api.answerCallbackQuery(query.id, null, {
    text: 'Choosed ' + args[1] + '.'
  })
})

inlineKeyboard.on('action', function (args, query) {
  var chat_id = query.message.chat.id;
  var msg_id = query.message.message_id;
  var session = getSession(chat_id);
  console.log(args)
  
  if (!session.users[query.from.id]) {
    session.users[query.from.id] = {};
  }
  
  switch (args[1]) {
    case "exit":
      if (!session.game) {
        return api.answerCallbackQuery(query.id, null, {
          text: 'there is currently no game running'
        })
      } else {
        return session.game.endGame()
        .then(function () {
          return api.answerCallbackQuery(query.id, null, {
            text: 'Game exited'
          })
        })
        .catch(function(err) {
          api.editMessageCaption(
            session.boardMessage.chat.id, 
            session.boardMessage.message_id,
            session.boardMessage.caption + '\r\n' + err.toString()
          );
        })
      }
      break;
    case "claim_black":
      if (session.game && session.users[query.from.id].faction) {
        return api.answerCallbackQuery(query.id, null, {
          text: 'You can\'t change faction during a game'
        })
      } else if (session.mode !== '2p') {
        return api.answerCallbackQuery(query.id, null, {
          text: 'You can claim faction in 2p mode only'
        })
      } else {
        session.users[query.from.id].faction = 'black';
        return api.answerCallbackQuery(query.id, null, {
          text: 'Your faction has been changed to black'
        })
      }
      break;
    case "claim_white":
      if (session.game && session.users[query.from.id].faction) {
        return api.answerCallbackQuery(query.id, null, {
          text: 'You can\'t change faction during a game'
        })
      } else if (session.mode !== '2p') {
        return api.answerCallbackQuery(query.id, null, {
          text: 'You can claim faction in 2p mode only'
        })
      } else {
        session.users[query.from.id].faction = 'white'
        return api.answerCallbackQuery(query.id, null, {
          text: 'Your faction has been changed to white'
        })
      }
      break;
  }
})

inlineKeyboard.on('setting', function (args, query) {
  var chat_id = query.message.chat.id;
  var msg_id = query.message.message_id;
  var session = getSession(chat_id);
  console.log(args)
  switch(args[1]) {
    case "increase_size":
      if (session.params.boardsize < 19) session.params.boardsize++;
      break;
    case "decrease_size":
      if (session.params.boardsize > 0) session.params.boardsize--;
      break;
    case "increase_level":
      if (session.params.level < 10) session.params.level++;
      break;
    case "decrease_level":
      if (session.params.level > 1) session.params.level--;
      break;
    case "black_mode":
      session.mode = "black";
      break;
    case "2p_mode":
      session.mode = "2p";
      break;
    case "white_mode":
      session.mode = "white";
      break;
    case "toggle_auto_delete":
      session.deleteOldMessage = !session.deleteOldMessage;
      break;
  }
  
  api.editMessageReplyMarkup(chat_id, msg_id, JSON.stringify({
    inline_keyboard: createConfigKeyBoard(session.params.boardsize, session.mode, session.params.level, session.deleteOldMessage)
  }))
})

function startGame (session, board, message, selfSide, options) {
  options = options == null ? {} : ('object' != typeof options) ? {} : options;
  options.board = board;
  session.keyboardStatus = KEYBOARD_STATUS.first;
  var game = new Game(options)
  
  if (session.mode === "white") {
    game.on('side_change', function (side) {
      if (side === "black") {
        game.action("black", "auto");
      }
    })
  }
  
  if (session.mode === "black") {
    game.on('side_change', function (side) {
      if (side === "white") {
        game.action("white", "auto");
      }
    })
  }
  game.on('side_change', function (side, res, game) {
    session.side = side;
    if (session.mode !== '2p' && session.mode !== side) return;
    
    var textMessage = 'Last action of ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove +
      ' \r\nEstimate score: ' + game.estimate_score;
    // api.sendMessage(message.chat.id, 'last action of: ' + (side === 'white' ? 'black' : 'white') + ' is ' + game.lastMove);
  
    var buffer = drawBoard(res.board, null, game.lastMoves.slice(-2));
    // console.log(buffer);
    api.sendPhoto(message.chat.id, {
      value:  buffer,
      options: {
        filename: 'go.png',
        contentType: 'image/png'
      }
    }, {
      caption: textMessage,
      reply_markup: JSON.stringify({inline_keyboard: createAlphabetKeyboard()})
    }, function (err, data) {
      if (err) console.log(err, data)
      if (session.deleteOldMessage) {
        api.deleteMessage(session.boardMessage.chat.id, session.boardMessage.message_id, function (err, data) {
          if (err) console.log(err, data)
        })
      }
      session.boardMessage = data;
    });
  })
  game.on('game_end', function (game) {
    api.sendMessage(
      message.chat.id, 
      'Reseted all users\' factions.\r\n' +
        'game ended, winner is ' + game.winner + ', \r\n' + 
        'score is ' + game.estimate_score, 
      null, 
      {
        reply_markup: JSON.stringify({
          hide_keyboard: true
        })
      }
    );
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
    // api.sendMessage(message.chat.id, 'reseted all users\' factions');
    
    delete session.game;
  })
  
  game.on('game_start', function(res, game) {
    session.side = game.currentSide;
    if (session.mode !== '2p' && session.mode !== game.currentSide) {
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
      caption: 'Game start, this is ' + game.currentSide + '\'s turn. \r\nNow place the stone with command. eg. /D4 \r\nor use custom keyboard /enable_keyboard',
      reply_markup: JSON.stringify({inline_keyboard: createAlphabetKeyboard()})
    }, function (err, data) {
      if (err) console.log(err, data)
      session.boardMessage = data;
    });
  })
  return game;
}
