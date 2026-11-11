const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {driveSource,cleanCatalogue,selectMovies}=require('./dist/media/backup-core.js');
const catalogue=JSON.parse(fs.readFileSync('dist/media/backup-movies.json','utf8'));
const report=JSON.parse(fs.readFileSync('integrations/dominum-movies/import-report.json','utf8'));
const movies=cleanCatalogue(catalogue.entries);
assert.equal(movies.length,161,'Every imported movie must have a valid source');
assert.equal(movies.length,report.sourceRows);
assert.equal(new Set(movies.map(movie=>movie.id)).size,movies.length);
assert.equal(movies.filter(movie=>movie.sources[0].kind==='folder').length,7);
assert.equal(movies.filter(movie=>movie.sources[0].embedURL).length,154);
for(const row of catalogue.entries){
 const source=driveSource(row.url);
 const movie=movies.find(movie=>movie.sources.some(item=>item.id===source.id));
 assert.ok(movie,'Dropped movie: '+row.title);
 assert.equal(movie.title,row.title);
 assert.equal(movie.year,row.year);
 if(source.kind==='file'){
  assert.equal(new URL(source.embedURL).pathname,new URL(source.url).pathname.replace('/view','/preview'));
  const download=new URL(source.downloadURL);assert.equal(download.origin,'https://drive.usercontent.google.com');assert.equal(download.pathname,'/uc');assert.equal(download.searchParams.get('export'),'download');assert.equal(download.searchParams.get('id'),source.id);
 }else{assert.equal(source.embedURL,null,'Folders must open in the browser');assert.equal(source.downloadURL,null,'Folders use their original Drive page for downloads')}
}
const protectedMovie=movies.find(movie=>movie.title==='Diary of a Wimpy Kid: Dog Days');
for(const field of ['url','embedURL','downloadURL'])assert.equal(new URL(protectedMovie.sources[0][field]).searchParams.get('resourcekey'),'0-TgoMzBEyMorySYhDqB9uGA');
for(const value of ['javascript:alert(1)','https://drive.google.com.evil.test/file/d/1234567890/view','https://drive.google.com@evil.test/file/d/1234567890/view','http://drive.google.com/file/d/1234567890/view','https://user:pass@drive.google.com/file/d/1234567890/view','https://drive.google.com/file/d/1234567890/edit','https://drive.google.com/file/d/short/view'])assert.equal(driveSource(value),null);
const original=movies.map(movie=>movie.id);
assert.equal(selectMovies(movies,'spider man').length,10);
assert.equal(selectMovies(movies,'spider man','2023').length,1);
assert.equal(selectMovies(movies,'zzzz-no-movie').length,0);
assert.ok(selectMovies(movies,'','2024').every(movie=>movie.year==='2024'));
const newest=selectMovies(movies,'','','newest');
assert.ok(newest.every((movie,index)=>index===0||Number(newest[index-1].year)>=Number(movie.year)));
assert.deepEqual(movies.map(movie=>movie.id),original,'Sorting must not mutate the catalogue');
const copy={...catalogue.entries[0],url:'https://drive.google.com/file/d/alternate_source_12345/view'};
const grouped=cleanCatalogue([...catalogue.entries,catalogue.entries[0],copy]);
assert.equal(grouped.length,movies.length,'Repeated import must not create duplicate cards');
assert.equal(grouped[0].sources.length,2,'Distinct sources for the same title remain available in metadata');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('dist/media/backup-movies.js','utf8'),context);
assert.equal(JSON.stringify(context.window.OrbitMovieCatalogue),JSON.stringify(catalogue),'Browser and JSON catalogues must match');
console.log('PASS: all 161 backup movies, 154 previews, 7 folders, Drive resource keys, URL boundaries, duplicate imports, search and sorting');
