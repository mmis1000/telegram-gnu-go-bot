var Canvas = require("canvas");

/**
 * draw board to canvas
 * 
 * @param {BoardStatus} board : board to draw
 */
var ENG_LIST = 'ABCDEFGHJKLMNOPQRST'.split('');
function drawBoard(board, slotWidth) {
  slotWidth = slotWidth || 20;
  
  var row = board.board[0].length;
  var col = board.board.length;
  var Canvas = require('canvas')
  , Image = Canvas.Image
  , canvas = new Canvas(slotWidth * (col + 2), slotWidth * (row + 2))
  , ctx = canvas.getContext('2d');
  var i, j;
  ctx.fillStyle = "black"
  ctx.strokeStyle = "black";
  for (i = 0; i < col; i++) {
    ctx.beginPath();
    ctx.moveTo(slotWidth * (1.5 + i), slotWidth * 1.5);
    ctx.lineTo(slotWidth * (1.5 + i), slotWidth * (1.5 + row - 1));
    ctx.stroke();
  }
  for (i = 0; i < row; i++) {
    ctx.beginPath();
    ctx.moveTo(slotWidth * 1.5, slotWidth * (1.5 + i));
    ctx.lineTo(slotWidth * (1.5 + col - 1), slotWidth * (1.5 + i));
    ctx.stroke();
  }
  
  ctx.lineWidth = 3;
  
  ctx.beginPath();
  ctx.moveTo(slotWidth * 1.5, slotWidth * (4.5));
  ctx.lineTo(slotWidth * (1.5 + col - 1), slotWidth * (4.5));
  ctx.stroke();
  if (row >= 13 && row % 2 === 1) {
    ctx.beginPath();
    ctx.moveTo(slotWidth * 1.5, slotWidth * (1.5 + (row - 1) / 2));
    ctx.lineTo(slotWidth * (1.5 + col - 1), slotWidth * (1.5 + (row - 1) / 2));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(slotWidth * 1.5, slotWidth * (1.5 + (row - 1) - 3));
  ctx.lineTo(slotWidth * (1.5 + col - 1), slotWidth * (1.5 + (row - 1) - 3));
  ctx.stroke();
  
  
  ctx.beginPath();
  ctx.moveTo(slotWidth * (4.5), slotWidth * 1.5);
  ctx.lineTo(slotWidth * (4.5), slotWidth * (1.5 + col - 1));
  ctx.stroke();
  
  if (col >= 13 && col % 2 === 1) {
    ctx.beginPath();
    ctx.moveTo(slotWidth * (1.5 + (row - 1) / 2), slotWidth * 1.5);
    ctx.lineTo(slotWidth * (1.5 + (row - 1) / 2), slotWidth * (1.5 + col - 1));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(slotWidth * (1.5 + (row - 1) - 3), slotWidth * 1.5);
  ctx.lineTo(slotWidth * (1.5 + (row - 1) - 3), slotWidth * (1.5 + col - 1));
  ctx.stroke();
  
  board.board.forEach(function (line, row) {
    line.forEach(function (slot, col) {
      if (slot === "O") {
        drawCircle(ctx, slotWidth * (col + 1.5), slotWidth * (row + 1.5), slotWidth / 2.5, "white", "black")
      }
      if (slot === "X") {
        drawCircle(ctx, slotWidth * (col + 1.5), slotWidth * (row + 1.5), slotWidth / 2.5, "black", "black")
      }
    })
  })
  
  for (i = 0; i < row; i++) {
    text (ctx, 0.5 * slotWidth, (row + 0.5  - i) * slotWidth, '' + (i + 1), slotWidth * 0.8, 'black')
  }
  
  for (i = 0; i < col; i++) {
    text (ctx, (1.5  + i) * slotWidth, 0.5 * slotWidth, ENG_LIST[i], slotWidth * 0.8, 'black')
  }
  
  
  
  return canvas.toBuffer();
}
function text (ctx, x, y, text, size, fillStyle) {
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"
  ctx.fillStyle = fillStyle;
  ctx.font = size + "px Arial";
  ctx.fillText(text, x, y);
}
function drawCircle (ctx, x, y, radius, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

module.exports = drawBoard;