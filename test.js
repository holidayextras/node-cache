var cache = require('./index.js');
var assert = require('assert');
var async = require('async');

cache._client = { };
cache._advancedCaching = true;
cache._generateCacheKey = function(a, b) { return b; };

module.exports = {
  'test': function(done) {
    var tmp = { };
    cache._client.set = function(key, data, callback) {
      console.log("SET'ing", key, '=>', data);
      tmp[key] = data;
      callback();
    };
    cache._client.mget = function(keys, callback) {
      var values = keys.map(function(a) { return tmp[a] || null; });
      console.log("MGET'ing", keys, values);
      callback(null, values);
    };
    cache._client.expire = function(cacheKey, duration) { };

    console.log("Requesting 9 Objects at once 0,0,0,1,1,1,2,2,2");
    [0,0,0,1,1,1,2,2,2].forEach(function(i, j) {
      cache.findObject('test', i, function(err, data) {
        console.log('( Thread',j,') Finding', i, '=>', err || data);
        if (!data) {
          console.log('( Thread',j,') Going to data source...');
          setTimeout(function() {
            cache.storeObject('test', i, 'data'+i);
          }, 100);
        }
      });
    });

    setTimeout(done, 1800)
  }
};

var Mocha = require('mocha');
var mocha = new Mocha({ ui: 'exports', reporter: 'list' });

var origin = module.filename;
mocha.addFile(origin);

mocha.run(function(failures){
  process.exit(failures? 1 : 0);
});
