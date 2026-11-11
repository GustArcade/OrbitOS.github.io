const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
for(const file of ['cloud-games.js','ghostcloud-games.js'])vm.runInNewContext(fs.readFileSync('dist/'+file,'utf8'),context);
assert.equal(context.window.ORBIT_CLOUD_GAMES.length,0,'Remove all first-provider cloud entries');
assert.equal(context.window.ORBIT_GHOST_CLOUD_GAMES.length,0,'Remove all imported-provider cloud entries');
const sw=fs.readFileSync('dist/sw.js','utf8');
assert.ok(!/['"]\.\/(?:cloud[^'"]*|ghostcloud-games[^'"]*)['"]/.test(sw),'The offline shell must not preload cloud catalogues or launchers');
console.log('PASS: both published cloud catalogues are empty and cloud games/launchers are excluded from the offline shell');
