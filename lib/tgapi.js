var request = require('request');
var EventEmitter = require('events').EventEmitter;
var util = require('util')

function TelegramAPI (token) {
    EventEmitter.call(this);
    this.pollingEnabled = false;
    
    this.token = token;
    
    this.lastOffset = null;
    this.pollCount = 0;
    
    this.pollingTimeout = null;
    this.pollingTimeoutId = null;
    
    this.currentPollRequest = null;
    
    this.debug();
}
util.inherits(TelegramAPI, EventEmitter);

TelegramAPI.prototype.debug = function () {
    function log() {
        console.log('polling at: ' + self.lastOffset + ', count: ' + self.pollCount)
    }
    var self = this;
    log();
    setInterval(log, 10 * 60 * 1000)
}
TelegramAPI.prototype.startPolling = function (timeout) {
    timeout = timeout == null ? 40 : timeout;
    
    this.pollingTimeout = timeout * 1000 + 20000;
    
    var self = this;
    
    if (this.pollingEnabled) return false;
    this.pollingEnabled = true;
    
    function checkTimeout () {
        if (self.pollingEnabled) {
            console.error('request failed to response, restart polling...')
            try {
                self.currentPollRequest.removeAllListeners();
                self.currentPollRequest.on('error', function () {});
                self.currentPollRequest.abort();
                // restart polling...
            } catch (err) {
                console.error(err)
            }
            self.lastOffset = null;
            self.pollingEnabled = false;
            self.startPolling(timeout)
        }
    }
    
    clearTimeout(this.pollingTimeoutId);
    this.pollingTimeoutId = setTimeout(checkTimeout, this.pollingTimeout);
    this.currentPollRequest = this._poll(timeout, null, function handle(err, response, body) {
        self.pollCount++;
        // console.log(err, response ? response.statusCode : null, body)
        var i;
        if (err || response.statusCode !== 200) {
            self.lastOffset = null;
            self.emit('error', err || new Error('unexpect response code: ' + response.statusCode + ' ' + body));
        } else {
            try {
                body = JSON.parse(body)
            } catch (err) {
                self.lastOffset = null;
                self.emit('error', err);
            }
            if (body.ok !== true || !Array.isArray(body.result)) {
                self.lastOffset = null;
                self.emit('error', new Error('bad response format: ' + body));
            } else {
                body.result.forEach(function (update) {
                    if (update.update_id >= self.lastOffset) {
                        self.lastOffset = update.update_id
                    }
                    
                    for (var type in update) {
                        self.emit(type, update[type])
                    }
                })
            }
        }
        
        if (self.pollingEnabled) {
            // console.log('current offset: ' + self.lastOffset)
            clearTimeout(self.pollingTimeoutId);
            self.pollingTimeoutId = setTimeout(checkTimeout, self.pollingTimeout);
            self.currentPollRequest = self._poll(timeout, self.lastOffset + 1, handle);
        }
    })
}
TelegramAPI.prototype._poll = function _poll (timeout, offset, cb) {
    var param = {
        timeout: timeout
    }
    if (offset != null) {
        param.offset = offset
    }
    return request.get({url:'https://api.telegram.org/bot' + this.token + '/getUpdates', qs:param}, cb)
}

TelegramAPI.prototype._invoke = function _invoke(apiName, params, cb, multiPart) {
    cb = cb || function () {};
    var targetURL = 'https://api.telegram.org/bot' + this.token + '/' + apiName;
    
    var requestData = {
        url: targetURL,
        timeout: 15000 // 15 sec
    };
    if (!multiPart || !params) {
        params = params || {};
        requestData.form = params;
    } else {
        params = params || {};
        requestData.formData = params;
    }
    
    requestData.timeout = 10000;
    
    request.post(requestData, function (err, response, body) {
        // console.log(response);
        if (err || response.statusCode !== 200) {
            return cb(err || new Error('unexpect response code: ' + response.statusCode + ' ' + body));
        }
        try {
            body = JSON.parse(body)
        } catch (e) {
            return cb(e)
        }
        if (body.ok !== true) {
            return cb (new Error('respense in not ok'))
        }
        cb(null, body.result);
    });
}

TelegramAPI.prototype.getMe = function getMe(cb) {
    return this._invoke('getMe', null , cb);
}

TelegramAPI.prototype.answerInlineQuery = function answerInlineQuery(id, results, cb) {
    if ('string' !== typeof results) {
        results = JSON.stringify(results)
    }
    return this._invoke('answerInlineQuery', {
        inline_query_id: id,
        results: results
    } , cb);
}

TelegramAPI.prototype.sendMessage = function sendMessage(chat_id, text, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.text = text;
    return this._invoke('sendMessage', datas , cb);
}

TelegramAPI.prototype.sendPhoto = function sendPhoto(chat_id, photo, datas, cb) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.photo = photo;
    return this._invoke('sendPhoto', datas , cb, true);
}

TelegramAPI.prototype.sendDocument = function sendDocument(chat_id, document, datas, cb) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.document = document;
    return this._invoke('sendDocument', datas , cb, true);
}

TelegramAPI.prototype.getFile = function getFile(file_id, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.file_id = file_id;
    return this._invoke('getFile', datas , cb);
}

TelegramAPI.prototype.getFileContent = function getFileContent(path, cb) { 
    var requestSettings = {
        method: 'GET',
        url: 'https://api.telegram.org/file/bot' + this.token + '/' + path.replace(/^\//, ''),
        encoding: null
    };
    request(requestSettings, function (err, response, body) {
        cb(err, response, body);
    })
}

TelegramAPI.prototype.editMessageCaption = function editMessageCaption(chat_id, message_id, caption, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.message_id = message_id;
    datas.caption = caption;
    return this._invoke('editMessageCaption', datas , cb);
}

TelegramAPI.prototype.editMessageCaptionInline = function editMessageCaptionInline(inline_message_id, caption, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.inline_message_id = inline_message_id;
    datas.caption = caption;
    return this._invoke('editMessageCaption', datas , cb);
}

TelegramAPI.prototype.editMessageReplyMarkup = function editMessageReplyMarkup(chat_id, message_id, reply_markup, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.message_id = message_id;
    datas.reply_markup = reply_markup;
    return this._invoke('editMessageReplyMarkup', datas , cb);
}

TelegramAPI.prototype.editMessageReplyMarkupInline = function editMessageReplyMarkupInline(inline_message_id, reply_markup, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.inline_message_id = inline_message_id;
    datas.reply_markup = reply_markup;
    return this._invoke('editMessageReplyMarkup', datas , cb);
}

TelegramAPI.prototype.deleteMessage = function deleteMessage(chat_id, message_id, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.chat_id = chat_id;
    datas.message_id = message_id;
    return this._invoke('deleteMessage', datas , cb);
}

TelegramAPI.prototype.answerCallbackQuery = function answerCallbackQuery(callback_query_id, cb, datas) {
    datas = typeof datas === "object" ? datas : {};
    datas.callback_query_id = callback_query_id;
    return this._invoke('answerCallbackQuery', datas , cb);
}

module.exports = TelegramAPI