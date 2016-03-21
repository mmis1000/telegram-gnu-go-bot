/**
 * draw Board Module
 * @module telegram-go/draw-board
 */

var Canvas = require("canvas");

var ENG_LIST = 'ABCDEFGHJKLMNOPQRST'.split('');

/**
 * draw board to canvas
 * 
 * @param {module:telegram-go/board-status~BoardStatus} board - board to draw
 * @returns {Canvas}
 */

module.exports = function drawBoard(board, slotWidth, highlights) {
  slotWidth = slotWidth || (board.board.length >= 10 ? 20 : 200 / board.board.length);
  highlights = highlights || [];
  var row = board.board[0].length;
  var col = board.board.length;
  var Canvas = require('canvas')
  , Image = Canvas.Image
  , canvas = new Canvas(slotWidth * (col + 2), slotWidth * (row + 2))
  , ctx = canvas.getContext('2d');
  ctx.lineCap="round";
  ctx.lineJoin="round";
  
  ctx.fillStyle = '#FAEBB4'
  ctx.fillRect(0, 0, slotWidth * (col + 2), slotWidth * (row + 2))
  
  
  function drawHorizontal(num, width) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(slotWidth * 1.5, slotWidth * (1.5 + num));
    ctx.lineTo(slotWidth * (1.5 + col - 1), slotWidth * (1.5 + num));
    ctx.stroke();
  }
  
  function drawVertical(num, width) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(slotWidth * (1.5 + num), slotWidth * 1.5);
    ctx.lineTo(slotWidth * (1.5 + num), slotWidth * (1.5 + col - 1));
    ctx.stroke();
  }
  var i, j;
  
  ctx.fillStyle = "black"
  ctx.strokeStyle = "black";
  for (i = 0; i < col; i++) {
    drawVertical(i, 1)
  }
  for (i = 0; i < row; i++) {
    drawHorizontal(i, 1)
  }
  
  drawHorizontal(0, 5)
  drawHorizontal((row - 1), 5)
  if (row >= 13) {
    drawHorizontal(3, 3)
    drawHorizontal((row - 1) - 3, 3)
  } else if (row >= 7) {
    drawHorizontal(2, 3)
    drawHorizontal((row - 1) - 2, 3)
  }
  if (row >= 13 && row % 2 === 1) {
    drawHorizontal((row - 1) / 2, 3)
  }
  
  drawVertical(0, 5)
  drawVertical((col - 1), 5)
  if (col >= 13) {
    drawVertical(3, 3)
    drawVertical((col - 1) -3, 3)
  } else if (col >= 7) {
    drawVertical(2, 3)
    drawVertical((col - 1) -2, 3)
  }
  if (col >= 13 && col % 2 === 1) {
    drawVertical((col - 1) / 2, 3)
  }
  
  function drawDot(x, y, size, color) {
    drawCircle(ctx, slotWidth * (x + 1.5), slotWidth * (y + 1.5), size, color, "black")
  }
  function drawText(x, y, textToDraw, size,  color) {
    text(ctx, (1.5 + x) * slotWidth, (1.5 + y) * slotWidth, textToDraw, size, color)
  }
  
  if (row >= 13) {
    drawDot(3, 3, slotWidth / 8, 'black')
    drawDot(3, (row - 1) / 2, slotWidth / 8, 'black')
    drawDot(3, (row - 1) - 3, slotWidth / 8, 'black')
    if (row % 2 === 1) {
      drawDot((row - 1) / 2, 3, slotWidth / 8, 'black')
      drawDot((row - 1) / 2, (row - 1) / 2, slotWidth / 8, 'black')
      drawDot((row - 1) / 2, (row - 1) - 3, slotWidth / 8, 'black')
    }
    drawDot((row - 1) - 3, 3, slotWidth / 8, 'black')
    drawDot((row - 1) - 3, (row - 1) / 2, slotWidth / 8, 'black')
    drawDot((row - 1) - 3, (row - 1) - 3, slotWidth / 8, 'black')
  } else if (row >= 7) {
    drawDot(2, 2, slotWidth / 8, 'black')
    drawDot(2, (row - 1) - 2, slotWidth / 8, 'black')
    drawDot((row - 1) - 2, 2, slotWidth / 8, 'black')
    drawDot((row - 1) - 2, (row - 1) - 2, slotWidth / 8, 'black')
  }
  
  board.board.forEach(function (line, row) {
    line.forEach(function (slot, col) {
      if (slot === "O") {
        drawDot(col, row, slotWidth / 2.5, 'white')
        // drawCircle(ctx, slotWidth * (col + 1.5), slotWidth * (row + 1.5), slotWidth / 2.5, "white", "black")
      }
      if (slot === "X") {
        drawDot(col, row, slotWidth / 2.5, 'black')
        // drawCircle(ctx, slotWidth * (col + 1.5), slotWidth * (row + 1.5), slotWidth / 2.5, "black", "black")
      }
    })
  })
  
  for (i = 0; i < row; i++) {
    drawText(-1, row -1 - i, i + 1, slotWidth * 0.8, 'black')
    drawText(row, row -1 - i, i + 1, slotWidth * 0.8, 'black')
    // text (ctx, 0.5 * slotWidth, (row + 0.5  - i) * slotWidth, '' + (i + 1), slotWidth * 0.8, 'black')
  }
  
  for (i = 0; i < col; i++) {
    drawText(i, -1, ENG_LIST[i], 'black')
    drawText(i, col, ENG_LIST[i], 'black')
    // text (ctx, (1.5  + i) * slotWidth, 0.5 * slotWidth, ENG_LIST[i], slotWidth * 0.8, 'black')
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
