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
    var boundary = '------NodeJS' + (new Buffer(String(+new Date))).toString('base64');
    headers['content-type'] += '; boundary=' + boundary;
    var content = '';
    var post_fields = [];
    for (var key in body) {
      var buffer_length = boundary.length + 10;
      buffer_length += key.length + 39;
      if (body[key] instanceof UploadedFile) {
        buffer_length += body[key].getFilename().length + 15;
        buffer_length += body[key].getMimetype().length + 14;
      }
      buffer_length += body[key].length;
      var buffer = new Buffer(buffer_length*1);
      var pos = buffer.write("--" + boundary + "\r\n", 0);
      pos += buffer.write('Content-Disposition: form-data; name="' + key + '"', pos);
      if (body[key] instanceof UploadedFile) {
        pos += buffer.write('; filename="' + body[key].getFilename() + '"\r\n', pos);
        pos += buffer.write('Content-Type: ' + body[key].getMimetype(), pos);
        pos += buffer.write('\r\n\r\n', pos);
        body[key].data.copy(buffer, pos);                                        
        pos += body[key].data.length;
      }
      else {
        pos += buffer.write('\r\n\r\n', pos);
        pos += buffer.write(body[key], pos);
      }
      pos += buffer.write("\r\n", pos);
      post_fields.push(buffer);
    }
    post_fields.push(new Buffer("--" + boundary + "--"));
    headers['content-length'] = 0;
    post_fields.forEach(function (buf) {
      headers['content-length'] += buf.length;
    });
  }
  else {
    body = typeof body == 'string' ? body : JSON.stringify(body) || '';
    headers['content-length'] = body.length;
  }  
  
  if (url.host in cookies) {
    headers['set-cookie'] = cookies[url.host];
  }
  if (url.host + pathname in auth_digest) {
    headers.authorization = auth_digest[url.host + pathname];
  }
  var request = http.createClient(80, url.host).request(method, pathname + (url.search || ''), headers);
  if (headers['content-length'] > 0) {
    if (post_fields instanceof Array) {
      post_fields.forEach(function (buf) {
        request.write(buf, 'binary');
      });
    }
    else {
      request.write(body);
    }
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
  require('fs').readFile(filename , function (err, data) {
    if (err) throw err;
    this.data = data;
    this.length = data.length;
    require('child_process')
      .exec('file -i ' + filename, function (err, stdout, stderr) {
        this.mimetype = stdout.split(' ')[1];
        cb();
      }.bind(this));
  }.bind(this));
}
UploadedFile.prototype.toString = function (type) {
  type = type || null;
  return this.data.toString(type);
};
UploadedFile.prototype.getFilename = function () {
  return require('path').basename(this.filename);
}
UploadedFile.prototype.getMimetype = function () {
  return this.mimetype == 'regular' ? 'text/plain' : this.mimetype;
};

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
