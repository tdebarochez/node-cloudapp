var http = require('http'),
    digest = require('./md5-digest'),
    querystring = require('querystring');

var auth_digest = {};
var auth_failed = {};
var cookies = {};
var username = '';
var password = '';

var makeCloudRequest = function (url, cb, method, body, h) {
  cb = cb || function () {};
  method = method || 'GET';
  var url = require('url').parse(url);
  var pathname = url.pathname || '/';
  var headers = {'host': url.host,
                 'user-agent': 'Node Cloudapp client',
                 'cache-control': 'max-age=0',
                 'accept': '*/*'};
  h = h || {'accept': 'application/json',
            'content-type': 'application/json'};
  for (var k in h) {
    headers[k] = h[k];
  }
  if (headers['content-type'] == 'multipart/form-data') {
    var boundary = '------NodeBoundary' + String(+new Date);
    headers['content-type'] += '; boundary=' + boundary;
    var content = '';
    for (var key in body) {
      content += "--" + boundary + "\r\n";
      content += 'Content-Disposition: form-data; name="' + key + '"';
      if (body[key] instanceof UploadedFile) {
        content += '; filename="' + body[key].getFilename() + '"\r\n'
        content += 'Content-Type: application/octet-stream';
      }
      content += '\r\n\r\n';
      content += body[key] + "\r\n";
    }
    content += "--" + boundary + "--";
    body = content;
  }
  else {
    body = typeof body == 'string' ? body : JSON.stringify(body) || '';
  }  
  headers['content-length'] = body.length;
  
  if (url.host in cookies) {
    headers['set-cookie'] = cookies[url.host];
  }
  if (url.host + pathname in auth_digest) {
    headers.authorization = auth_digest[url.host + pathname];
  }
  var request = http.createClient(80, url.host).request(method, pathname + (url.search || ''), headers);
  if (headers['content-length'] > 0) {
    request.write(body);
  }
  request.end();
  request.on('response', function (response) {
    if ("set-cookie" in response.headers) {
      cookies[url.host] = response.headers['set-cookie'];
    }
    if (response.statusCode == 401 && auth_failed[url.host + pathname] !== true) {
      auth_failed[url.host + pathname] = true;
      var hash = {'username': username, 'password': password, 'uri': pathname+ (url.search || ''), 'method': method};
      auth_digest[url.host + pathname] = digest.processing(response.headers['www-authenticate'], hash);
      makeCloudRequest (url.href, cb, method, body);
    }
    else if (String(response.statusCode).match(/^3\d\d$/) && "location" in response.headers) {
      if (response.statusCode == 303) {
        makeCloudRequest (response.headers.location, cb);
      }
      else {
        makeCloudRequest (response.headers.location, cb, method, body);
      }
    }
    else {
      response.setEncoding('utf8');
      var pos = 0;
      var datas = new Buffer(8192);
      response.on('data', function (chunk) {
        pos += (new Buffer(chunk, 'utf8')).copy(datas, pos, 0);
      });
      response.on('end', function () {
        if (String(response.statusCode).match(/^2\d\d$/)) {
          try {
            cb(JSON.parse(datas.toString('utf8', 0, pos)));
          }
          catch (e) {
            console.error(datas.toString('utf8', 0, pos));
          }
        }
        else {
          console.error(datas.toString('utf8', 0, pos));
        }
      });
    }
  });
};

function UploadedFile (filename, cb) {
  this.filename = filename;
  require('fs').readFile(filename, 'binary', function (err, data) {
    if (err) throw err;
    this.data =  data;
    cb();
  }.bind(this));
}
UploadedFile.prototype.toString = function () {
  return (new Buffer(this.data, 'binary')).toString('utf8');
};
UploadedFile.prototype.getFilename = function () {
  return require('path').basename(this.filename);
}

exports.getInfos = function(slug, cb) {
  makeCloudRequest('http://cl.ly/' + slug, cb, 'GET');
};

exports.setCredentials = function (login, pass) {
  username = login;
  password = pass;
  auth_failed = {};
}

exports.getItems = function(params, cb) {
  params = querystring.stringify(params || {});
  makeCloudRequest('http://my.cl.ly/items?' + params, cb);
};

exports.addBookmark = function(url, cb, name) {
  name = name || url;
  var params = {"item": {"name": name, "redirect_url": url}};
  makeCloudRequest('http://my.cl.ly/items', cb, 'POST', params);
};

exports.addFile = function (filename, cb) {
  makeCloudRequest('http://my.cl.ly/items/new', function (res) {
    var file = new UploadedFile(filename, function () {
      res.params.file = file;
       makeCloudRequest(res.url+'/', cb, 'POST', res.params, {"content-type": "multipart/form-data"});
    });
  }, 'GET');
};

exports.remove = function(slug, cb) {
  makeCloudRequest('http://my.cl.ly/' + slug, cb, 'DELETE');
};