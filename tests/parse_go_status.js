var expect = function (text, shouldHaveError, postCheck) {
  var hasError = false;
  var board = new BoardStatus;
  postCheck = postCheck || function () {};
  try {
    board.load(text)
    postCheck(board);
  } catch (e) {
    hasError = true
  }
  console.assert(shouldHaveError === hasError, '');
}
var BoardStatus = require('../lib/board_status');
var test0 = `
   A B C D E F G H J K L M N O P Q R S T
19 . . . . . . . . . . . . . . . . . . . 19
18 . . . . . . . . . . . . . . O . . . . 18
17 . O X X . . . . X . . . . . . . O . . 17
16 . . O + X . . . . + . . . . X + . . . 16
15 . O . . . . . . . . . . . . . . X . . 15
14 . . . O . . . . . . . . . . . . . . . 14
13 . . . . . . . . . . . . . . . . . . . 13
12 . . . . . . . . . . . . . . . . . . . 12
11 . . . . . . . . . . . . . . . . . . . 11     WHITE (O) has captured 5 stones
10 . . . + . . . . . + . . . . . + . . . 10     BLACK (X) has captured 0 stones
 9 . . X . . . . . . . . . . . . . X . . 9
 8 . . . . . . . . . . . . . . . . . . . 8
 7 . . . . . . . . . . . . . . . . . . . 7
 6 . . X . . . . . . . . . . . . . X . . 6
 5 . . . . . . . . . . . . . . . . . . . 5
 4 . X . O . . . . . + . . . . . O . X . 4
 3 . O O . . O . X . . . X . O . . O O . 3
 2 . . . . . . . . . . . . . . . . . . . 2
 1 . . . . . . . . . . . . . . . . . . . 1
   A B C D E F G H J K L M N O P Q R S T
`
var test1 = `
   A B C D E F G H J K L M N O P Q R S T
19 . . . . . . . . . . . . . . . . . . 19
18 . . . . . . . . . . . . . . O . . . . 18
17 . O X X . . . . X . . . . . . . O . . 17
16 . . O + X . . . . + . . . . X + . . . 16
15 . O . . . . . . . . . . . . . . X . . 15
14 . . . O . . . . . . . . . . . . . . . 14
13 . . . . . . . . . . . . . . . . . . . 13
12 . . . . . . . . . . . . . . . . . . . 12
11 . . . . . . . . . . . . . . . . . . . 11     WHITE (O) has captured 5 stones
10 . . . + . . . . . + . . . . . + . . . 10     BLACK (X) has captured 0 stones
 9 . . X . . . . . . . . . . . . . X . . 9
 8 . . . . . . . . . . . . . . . . . . . 8
 7 . . . . . . . . . . . . . . . . . . . 7
 6 . . X . . . . . . . . . . . . . X . . 6
 5 . . . . . . . . . . . . . . . . . . . 5
 4 . X . O . . . . . + . . . . . O . X . 4
 3 . O O . . O . X . . . X . O . . O O . 3
 2 . . . . . . . . . . . . . . . . . . . 2
 1 . . . . . . . . . . . . . . . . . . . 1
   A B C D E F G H J K L M N O P Q R S T
`
var test2 = `
   A B C D E F G H J K L M N O P Q R S T
19 * . . . . . . . . . . . . . . . . . . 19
18 . . . . . . . . . . . . . . O . . . . 18
17 . O X X . . . . X . . . . . . . O . . 17
16 . . O + X . . . . + . . . . X + . . . 16
15 . O . . . . . . . . . . . . . . X . . 15
14 . . . O . . . . . . . . . . . . . . . 14
13 . . . . . . . . . . . . . . . . . . . 13
12 . . . . . . . . . . . . . . . . . . . 12
11 . . . . . . . . . . . . . . . . . . . 11     WHITE (O) has captured 5 stones
10 . . . + . . . . . + . . . . . + . . . 10     BLACK (X) has captured 0 stones
 9 . . X . . . . . . . . . . . . . X . . 9
 8 . . . . . . . . . . . . . . . . . . . 8
 7 . . . . . . . . . . . . . . . . . . . 7
 6 . . X . . . . . . . . . . . . . X . . 6
 5 . . . . . . . . . . . . . . . . . . . 5
 4 . X . O . . . . . + . . . . . O . X . 4
 3 . O O . . O . X . . . X . O . . O O . 3
 2 . . . . . . . . . . . . . . . . . . . 2
 1 . . . . . . . . . . . . . . . . . . . 1
   A B C D E F G H J K L M N O P Q R S T
`
expect(test0, false, function (status) {
  console.assert(status.captured.WHITE === "5")
  console.assert(status.captured.BLACK === "0")
  console.assert(status.board[0][0] === ".")
  console.assert(status.board[2][1] === "O")
  console.assert(status.board[2][2] === "X")
});
expect(test1, true);
expect(test2, true);

console.log('all test passed')