# Cache
A wrapper for redis



# Cache

```javascript
var cache = require('cache');

cache.configureWith({
  host: 'localhost',
  port: '6379'
});


var owner = 'myFileFunction';
var cacheKey = { foo: 'bar' };
var data = { my: 'data', goes: 'here' };
var cacheDuration = 10;

cache.storeObject(owner, cacheKey, data, cacheDuration);

cache.findObject(owner, cacheKey, function(err, data) {
  console.log('Cache found', err, data);
});
```
