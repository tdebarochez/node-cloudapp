var sys = require('sys'),
    crypto = require("crypto");

var nc_counter = 0;

function decodeDigest (str) {
  var hash = {};
  str.split(',').forEach(function (chunk) {
    var pair = chunk.split('=');
    if (pair.length > 1) {
      var part1 = pair.shift().replace(/^(\s+|Digest\s+)/, '');
      hash[part1] = pair.join('=').replace(/^"|"$/g, '');
    }
  });
  return hash;
}
function encodeDigest (hash) {
  var pairs = [];
  var exceptions = ['charset', 'algorithm', 'qop', 'nc'];
  for (var k in hash) {
    if (exceptions.indexOf(k) > -1) {
      pairs.push(k+'='+hash[k]);
    } else {
      pairs.push(k+'="'+hash[k]+'"');
    }
  }
  return 'Digest ' + pairs.join(', ');
}
exports.processing = function (str, params) {
  var res = decodeDigest(str);
  var cnonce = +new Date;
  var nc = String(++nc_counter);
  while (nc.length < 8) nc = '0' + nc;
  var crypter = crypto.createHash("md5")
    .update(params.username+':')
    .update(res.realm+':')
    .update(params.password);
  var ha1 = crypter.digest('hex');
  var ha2 = crypto.createHash("md5")
    .update(params.method + ':'+params.uri).digest('hex');
  var response = crypto.createHash("md5").update([ha1, res.nonce, nc, cnonce, res.qop, ha2].join(':')).digest('hex');
  var ret = {"username": params.username,
             "realm": res.realm,
             "nonce": res.nonce,
             "uri": params.uri,
             "qop": res.qop,
             "nc": nc,
             "cnonce": cnonce,
             "response": response};
  if ("opaque" in res) {
    ret.opaque = res.opaque;
  }
  return encodeDigest(ret);
};

