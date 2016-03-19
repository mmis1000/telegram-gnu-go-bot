var path = require("path")
var Board = require(path.resolve(__dirname, "../lib/board.js"));
var Q = require("q")
var b = new Board();

Q()
.then(function (res) {
  var currentId = 0;
  var passCount = 0;
  var defered = Q.defer();
  function doNext() {
    b.compute(currentId % 2 ? "white" : "black")
    .then(function (res) {
      if (res.responseText === "PASS") {
        passCount++;
      } else {
        passCount = 0;
      }
      return res
    })
    .then(function() {
      return b.showBoard();
    })
    .then(function() {
      if (passCount === 2) {
        defered.resolve(true)
      } else {
        doNext();
      }
    })
    .catch(function (error) {
      defered.reject(error);
    })
    currentId++;
  }
  doNext();
  return defered.promise;
})
.then(function() {
  return b.invoke('estimate_score')
})
.then(function() {
  return b.invoke('final_score')
})
.then(function(ev) {
  console.log('wow, very final, such final');
  console.log(ev)
  return b.invoke('quit')
})
b.on('rpl', function (ev) {
  console.log(ev.action, ev.params.join(''), ev.id)
  console.log(ev.responseText);
})
