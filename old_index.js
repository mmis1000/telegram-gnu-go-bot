var TelegramAPI = require("./lib/tgapi");
var Board = require("./lib/board");
var drawBoard = require("./lib/drawboard");

var Temp = require('temp');
var fs = require('fs');
Temp.track();

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
  
  if (sess.waitSGF && message.document) {
    // load sgf data as a game
    sess.isRunning = true;
    console.log('got sgf file');
    sess.waitSGF = false;
    api.getFile(message.document.file_id, function (err, res) {
      if (err) {
        sess.isRunning = false;
        return api.sendMessage(message.chat.id, 'error duting load SGF')
      }
      api.getFileContent(res.file_path, function (err, res, body) {
        if (err) {
          sess.isRunning = false;
          return api.sendMessage(message.chat.id, 'error duting load SGF')
        }
        Temp.open({suffix: '.sgf'}, function(err, info) {
          if (err) {
            sess.isRunning = false;
            return api.sendMessage(message.chat.id, 'error duting load SGF')
          } else {
            fs.write(info.fd, body, 0, body.length, function () {});
            fs.close(info.fd, function(err) {
              sess.isRunning = false;
              if (err) {
                return api.sendMessage(message.chat.id, 'error duting load SGF')
              }
              // info.path
              console.log('temp file at ', info.path)
              sess.board = new Board(['--infile', info.path].concat(sess.loadParams));
              sess.board.on('rpl', function (obj) {
                console.log(obj)
              })
              sess.board.on('error', function (err) {
                api.sendMessage(message.chat.id, err.stack ? err.stack : err.toString)
              })
              sess.board.on('exit', function (code) {
                if (!sess.board) {
                  return;
                }
                sess.passCount = 0;
                sess.isRunning = false;
                sess.board.destroy();
                delete sess.board;
                if (code != 0) {
                  api.sendMessage(message.chat.id, 'bot exit unexpectedly with code ' + code);
                }
              });
              api.sendMessage(message.chat.id, 'game continuing...')
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
            });
          }
        });
      })
    })
  }
  if (!text) return;
  if (text.match(/^\/load(@|$|\s)/)) {
    if (sess.board) {
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
    if (sess.board) {
      return api.sendMessage(message.chat.id, 'please exit current game')
    }
    var params = text
      .replace(/^\/new(@[^\s]+)?\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/, '')
      .split(/\s/g)
      .filter(function (i) {return !!i});
    
    sess.board = new Board(params)
    sess.board.on('rpl', function (obj) {
      console.log(obj)
    });
    sess.board.on('error', function (err) {
      api.sendMessage(message.chat.id, err.stack ? err.stack : err.toString)
    });
    sess.board.on('exit', function (code) {
      if (!sess.board) {
        return;
      }
      sess.passCount = 0;
      sess.isRunning = false;
      sess.board.destroy();
      delete sess.board;
      if (code != 0) {
        api.sendMessage(message.chat.id, 'bot exit unexpectedly with code ' + code);
      }
    });
    api.sendMessage(message.chat.id, 'game start');
    
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
    if (sess.isRunning || sess.passCount >= 2) {
      return api.sendMessage(message.chat.id, 'please wait for current action to be finished');
    }
    sess.isRunning = true;
    if (position === "auto") {
      temp = sess.board.compute('black')
    } else {
      temp = sess.board.move('black', position)
    }
    if (position === 'pass') {
      sess.passCount = sess.passCount || 0;
      sess.passCount += 1;
    } else {
      sess.passCount = 0;
    }
    temp.then(function () {
      return sess.board.compute('white');
    })
    .then(function (status) {
      
      if (status.responseText === 'PASS') {
        sess.passCount = sess.passCount || 0;
        sess.passCount += 1;
      } else {
        sess.passCount = 0;
      }
      if (sess.passCount >= 2) {
        var err = new Error('game ended')
        err.type = 'end_game';
        throw err;
      }
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
      if (status.type !== "end_game") {
        sess.isRunning = false;
        api.sendMessage(message.chat.id, 'error: ' + status.responseText);
      } else {
        sess.board.invoke('final_score')
        .then(function (status) {
          if (!sess.board) {return}
          api.sendMessage(message.chat.id, 'game ended: ' + status.responseText);
          return sess.board.invoke('printsgf');
        })
        .then(function (res) {
          
          api.sendDocument(message.chat.id, {
            value: res.responseText,
            options: {
              filename: message.chat.id + '_' + Date.now() + '.sgf',
              contentType: 'text/plain'
            }
          })
          /*
          api.sendMessage(
            message.chat.id, 
            '```\r\n===begin sgf data===\r\n' + res.responseText + '\r\n===end sgf data===\r\n```', 
            null, 
            {
              parse_mode: 'Markdown'      
            }
          );*/
          sess.passCount = 0;
          sess.isRunning = false;
          sess.board.destroy();
          delete sess.board;
        })
      }
    })
  }
  if (text.match(/^\/export(@|$)/)) {
    if (!sess.board) {
      return api.sendMessage(message.chat.id, 'curruntly no game is playing')
    }
    sess.board.invoke('printsgf')
    .then(function (res) {
      
      api.sendDocument(message.chat.id, {
        value: res.responseText,
        options: {
          filename: message.chat.id + '_' + Date.now() + '.sgf',
          contentType: 'text/plain'
        }
      })
      /*
      api.sendMessage(
        message.chat.id, 
        '```\r\n===begin sgf data===\r\n' + res.responseText + '\r\n===end sgf data===\r\n```', 
        null, 
        {
          parse_mode: 'Markdown'      
        }
      );*/
    })
  }
  if (text.match(/^\/exit(@|$)/)) {
    if (!sess.board) {
      sess.passCount = 0;
      sess.isRunning = false;
      return api.sendMessage(message.chat.id, 'curruntly no game is playing')
    }
    sess.isRunning = true;
    sess.board.invoke('printsgf')
    .then(function (res) {
      if (!sess.board) {
        return
      }
      api.sendMessage(
        message.chat.id, 
        'game quited');
      api.sendDocument(message.chat.id, {
        value: res.responseText,
        options: {
          filename: message.chat.id + '_' + Date.now() + '.sgf',
          contentType: 'text/plain'
        }
      })
      sess.passCount = 0;
      sess.isRunning = false;
      sess.board.destroy();
      delete sess.board;
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