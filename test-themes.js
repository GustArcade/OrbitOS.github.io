const assert=require('node:assert/strict');
const {themes,get,has,validAccent,contrast,onAccent}=require('./dist/themes-core.js');
assert.equal(themes.length,33);
assert.equal(new Set(themes.map(t=>t.id)).size,33);
assert.equal(get('reactive').pattern,'reactive');
assert.equal(get('invalid').id,'galaxy');
assert.equal(has(null),false);
assert.ok(themes.filter(t=>t.tone==='light').length>=8);
for(const t of themes){
 assert.ok(validAccent(t.accent)&&validAccent(t.secondary),t.name+' valid colours');
 for(const background of [t.bg,t.panel]){
  assert.ok(contrast(t.text,background)>=7,t.name+' text contrast');
  assert.ok(contrast(t.muted,background)>=4.5,t.name+' small-text contrast');
 }
 assert.ok(contrast(t.accent,onAccent(t.accent))>=4.5,t.name+' button contrast');
}
for(const value of ['#aBc123','#000000','#ffffff'])assert.equal(validAccent(value),true);
for(const value of [null,{},'#fff','red','url(https://example.com)','var(--x)','#000000;display:none'])assert.equal(validAccent(value),false);
assert.ok(contrast('#000000','#ffffff')>20);
console.log('PASS: 33 unique palettes including Reactive Aurora, original-theme compatibility, text contrast, adaptive button contrast and safe custom colours');
