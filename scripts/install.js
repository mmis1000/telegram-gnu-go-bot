var child_process = require('child_process');
var request = require('request');
var fs = require("fs")
var temp = require('temp');
var path = require('path');

console.log("\r\n---getting gnugo file---")

var binDirPath = path.resolve(__dirname, '../bin');
try {
  var info = fs.statSync(path.resolve(binDirPath, 'gnugo'));
  if (info.isFile()) {
    console.log("  existed, ignoring...")
    console.log("---       done       ---")
    process.exit(0)
  }
} catch (e) {
  // nuzz
}

temp.track();

request({
  encoding: null,
  url: 'http://ftp.gnu.org/gnu/gnugo/gnugo-3.8.tar.gz'
}, function(err, res, body) {
  if (err) {
    console.log(err);
    return process.exit(1);
  }
  temp.mkdir('gnugo-temp', function(err, dirPath) {
    if (err) {
      console.log(err);
      return process.exit(1);
    }
    var filePath = path.resolve(dirPath, 'gnugo.tar.gz')
    // console.log(filePath, body, path.resolve(dirPath, 'gnugo-3.8'))
    fs.writeFileSync(filePath, body);
    console.log("  retrieved, unzipping...")
    child_process.execFileSync('tar', ['-zxf', filePath], {
      cwd: dirPath
    });
    console.log("  configure...")
    child_process.execFileSync('./configure', {
      cwd: path.resolve(dirPath, 'gnugo-3.8')
    });
    console.log("  making...")
    child_process.execFileSync('make', {
      cwd: path.resolve(dirPath, 'gnugo-3.8')
    });
    try {
      fs.mkdirSync(binDirPath);
    } catch (e) {}
    console.log("  saving file...")
    child_process.execFileSync('cp', [
      path.resolve(dirPath, 'gnugo-3.8', 'interface', 'gnugo'), 
      path.resolve(binDirPath, 'gnugo')
    ]);
    console.log("---       done       ---")
  })
})