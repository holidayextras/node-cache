var redis = require('redis');
var dns = require('dns');
var crypto = require('crypto');

var fs = require('fs');
var topLevelModule = module;
while (topLevelModule.parent) topLevelModule = topLevelModule.parent;
var path = topLevelModule.filename.split('/');
path.pop();
var projectName = path.pop();
if (process.env.NODE_ENV != 'local' && process.env.NODE_ENV != 'development') projectName = path.pop();


var cache = { };
module.exports = cache;


cache.configureWith = function(config) {
  var options = {
    retry_max_delay: 20,
    connect_timeout: 50
  };
  this._client = redis.createClient(config.port, config.host, options);
  if (config.password) this._client.auth(config.password);
  this._BATCHTIMEOUT = config.batchTimeout || 5;
};

cache.storeObject = function(owner, key, data, ttl) {
  var self = this;

  var cacheKey = this._generateCacheKey(owner, key);
  var cacheDuration = ttl || (2 * 60 * 60);
  var cacheDurationAdjustment = ((cacheDuration/10)*Math.random());
  cacheDuration = Math.floor((cacheDuration - (cacheDuration/20)) + cacheDurationAdjustment);

  self._processSetQueue(cacheKey, data);

  self._client.set(cacheKey, JSON.stringify(data), function(err, result) {
    if (!err) {
      self._client.expire(cacheKey, cacheDuration);
    }
  });
};

cache.findObject = function(owner, key, callback) {
  this._get(this._generateCacheKey(owner, key), function(err, response) {
    if (err || !response) return callback('Couldnt find object');

    try {
      var cacheResult = JSON.parse(response);
      process.nextTick(function() { callback(null, cacheResult); });
    } catch(e) {
      return callback('Couldnt find object');
    }
  });
};

cache._generateCacheKey = function(owner, key) {
  if (!owner || !key) return null;

  var cacheKeyObject = JSON.stringify( this._sortObjectByKey( key ));
  return [ projectName, 'v' + (process.env.VERSION || '?'), owner, this._hash( cacheKeyObject ) ].join(':');
};

cache._sortObjectByKey = function ( obj ) {
  if ( ! ( obj instanceof Object )) return obj;
  var keys = Object.keys( obj );
  keys.sort( );
  var sorted = { };
  for ( var i = 0; i < keys.length; i ++ ) {
    sorted[ keys[ i ]] = obj[ keys[ i ]];
  }
  return sorted;
};


cache._getQueue = [ ];
cache._getTimer = null;
cache._get = function(key, callback) {
  var self = this;

  for (var i=0; i<self._getQueue.length; i++) {
    var item = self._getQueue[i];
    if (item.key == key) {
      item.callback.push(callback);
      return;
    }
  };

  self._getQueue.push({
    key: key,
    callback: [ callback ]
  });

  if (!self._getTimer) {
    self._getTimer = setTimeout(function() { self._processGetQueue(); }, this._BATCHTIMEOUT);
  }
};

cache._processGetQueue = function() {
  var self = this;
  var getQueue = self._getQueue;
  self._getQueue = [ ];
  self._getTimer = null;
  self._client.mget(getQueue.map(function(item) { return item.key; }), function(err, keys) {
    getQueue.forEach(function(item) {
      var result = null;
      var queueIndex = getQueue.indexOf(item);
      if (keys && (queueIndex < keys.length)) result = keys[queueIndex];
      if (result || !self._advancedCaching) {
        item.callback.forEach(function(callback) {
          process.nextTick(function() { callback(err, result); });
        });
        return;
      }

      item.whatEver = setTimeout(function() {
        self._processSetQueue(item.key, null);
      }, 250);
      self._setQueue.push(item);
      process.nextTick(item.callback.shift());
    });
  });
};

cache._advancedCaching = false;
cache._setQueue = [ ];
cache._processSetQueue = function(cacheKey, data) {
  var self = this;
  self._setQueue.forEach(function(item, i) {
    if (item.key == cacheKey) {
      clearTimeout(item.whatEver);
      item.callback.forEach(function(callback) {
        process.nextTick(function() { callback(null, data ? JSON.stringify(data) : null); });
      });
      self._setQueue.splice(i, 1);
    }
  });
};

cache._hash = function(request) {
  var hmac = crypto.createHmac('sha512', 'qwertyuioplkjhgdsazxcvbnm');
  hmac.update(request);
  return hmac.digest('hex');
};
