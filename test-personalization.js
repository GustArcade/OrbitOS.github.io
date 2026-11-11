const assert=require('node:assert/strict');
const {cursors,cursor}=require('./dist/personalization-core.js');
assert.deepEqual(cursors,['system','glass','neon','crosshair']);
for(const value of cursors)assert.equal(cursor(value),value);
for(const value of ['url(bad)','webos',null,{},'Glass'])assert.equal(cursor(value),'system');
console.log('PASS: all four cursor choices retained and invalid stored cursors fall back safely');
