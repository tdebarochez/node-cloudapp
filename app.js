var sys = require('sys'),
cloud = require('./lib/cloudapp');

var types = ['all', 'image', 'bookmark', 'text', 'archive', 'audio', 'video', 'unknown'];

process.argv.shift();
process.argv.shift();

cloud.setCredentials(process.argv.shift(), process.argv.shift());

switch (process.argv[0]) {
  case 'list':
    var params = {'page': Number(process.argv[1]) || 1,
                  'per_page': Number(process.argv[2]) || 10,
                  'type': types.indexOf(process.argv[3]) != -1 ? process.argv[3] : 'all',
                  'deleted': process.argv[4] == 'true' ? 'true' : 'false'};
    if (params.type == 'all') {
      delete params.type;
    }
    cloud.getItems(params, console.log);
  break;
  case 'push':
    cloud.addFile(process.argv[1], console.log);
  break;
  case 'bookmark':
    cloud.getInfos(process.argv[1], console.log, process.argv[2]);    
  break;
  case 'info':
    cloud.getInfos(process.argv[1], console.log);
  break;
  case 'help':
    switch (process.argv[1]) {
      case 'list':
        sys.puts('list your files');
        sys.puts('params :');
        sys.puts('  - page (1) : page number starting at 1');
        sys.puts('  - limit (10) : define the number of item per page');
        sys.puts('  - type (all) : type of file (all, image, bookmark,');
        sys.puts('                 text, archive, audio, video, or unknown)');
        sys.puts('  - deleted (true) : show deleted items');
      break;
      case 'push':
        sys.puts('upload file named filename');
        sys.puts('params :');
        sys.puts('  - filename : relative file name');
      break;
      case 'info':

      break;
      case 'bookmark':
        sys.puts('save defined bookmark');
        sys.puts('params :');
        sys.puts('  - link : bookmark\'s url');
        sys.puts('  - name (link) : name, ie: website name');
      break;
      case 'info':
        sys.puts('display informations about one of your files');
        sys.puts('params :');
        sys.puts('  - slug : file\'s unique id');
      break;
    }
  default:
    sys.puts('usage : node app.js username password action [options]...');
    sys.puts('actions :');
    sys.puts('  - list [page] [limit] [type] [deleted] : list your files');
    sys.puts('  - push filename : upload a file');
    sys.puts('  - bookmark link [name] : save a bookmark');
    sys.puts('  - info slug : retrieve some information about a file');
    sys.puts('  - help command : display some help about the command');
}