// Regenerate release metadata so stale build-folder copies cannot replay migrations.
// Run after the build and before the Sites source/package workflow.
import {copyFileSync,cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
if(!existsSync(join(root,'dist/server/index.js')))throw Error('Build the app before preparing a release.');
const migrations=join(root,'drizzle');
const journal=JSON.parse(readFileSync(join(migrations,'meta/_journal.json'),'utf8'));
const expected=journal.entries.map(entry=>entry.tag+'.sql').sort();
const actual=readdirSync(migrations).filter(name=>name.endsWith('.sql')&&!name.startsWith('._')).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Migration files do not match the journal. Preserve applied history and resolve duplicate source files before publishing.');
for(const name of readdirSync(join(root,'dist/server'))){
 if(name.startsWith('.dev.vars')||name.startsWith('.env'))throw Error('Remove local environment files from the release build.');
}
const metadata=join(root,'dist/.openai');
rmSync(metadata,{recursive:true,force:true});
mkdirSync(metadata,{recursive:true});
copyFileSync(join(root,'.openai/hosting.json'),join(metadata,'hosting.json'));
cpSync(migrations,join(metadata,'drizzle'),{recursive:true});
console.log(`Release metadata refreshed: ${expected.length} original migrations, no stale copies.`);
