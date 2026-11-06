const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['homePage.h','fingerPage.h','userPage.h','loginPage.h','wifiPage.h','Index.html']) {
  const source=fs.readFileSync(file,'utf8');
  const scripts=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  if(scripts.length===0) throw Error(`${file}: không tìm thấy JavaScript`);
  for(const script of scripts) new vm.Script(script[1],{filename:file});
}
console.log('Embedded page JavaScript syntax passed');
