import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const cache=new Map();
function moduleUrl(path){
 path=resolve(path);if(cache.has(path))return cache.get(path);
 let code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/from ['"]([.][^'"]+)['"]/g,(_,specifier)=>`from '${moduleUrl(resolve(dirname(path),specifier.endsWith('.ts')?specifier:specifier+'.ts'))}'`);
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(path,url);return url;
}
export const load=path=>import(moduleUrl(path));
