import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=fileURLToPath(new URL('../',import.meta.url));
// Report locations only. Never print matched credentials in test output.
const patterns=[
 ['Google API key',/AIza[A-Za-z0-9_-]{30,}/g],
 ['Google OAuth secret',/GOCSPX-[A-Za-z0-9_-]{15,}/g],
 ['AWS access key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}/g],
 ['OpenAI key',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{25,}/g],
 ['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g],
 ['Hugging Face token',/\bhf_[A-Za-z0-9]{25,}/g],
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['database password URL',/(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s"'/:]+:[^\s"'@]+@/g],
];
function inspect(name,bytes,findings) {
 if(bytes.subarray(0,8000).includes(0))return;
 const text=bytes.toString('utf8');
 for(const [kind,pattern] of patterns){pattern.lastIndex=0;let match;while((match=pattern.exec(text))){
   const line=text.slice(0,match.index).split('\n').length;
   findings.push(`${name}:${line}: ${kind}`);
 }}
}
function inspectArchive(name,bytes,findings) {
 const tar=gunzipSync(bytes);
 for(let offset=0;offset+512<=tar.length;){
  const header=tar.subarray(offset,offset+512);
  if(header.every(value=>value===0))break;
  const size=parseInt(header.subarray(124,136).toString().replace(/\0/g,'').trim()||'0',8);
  assert.ok(Number.isFinite(size),`Invalid archive header: ${name}`);
  const member=header.subarray(0,100).toString().replace(/\0.*$/s,'');
  const type=header[156];
  if(type===0 || type===48 || type===55) {
    const bytes=tar.subarray(offset+512,offset+512+size);
    inspect(`${name}!${member}`,bytes,findings);
    if(member.endsWith('.map')) assert.equal(Boolean(JSON.parse(bytes.toString()).sourcesContent), false, `${name}!${member}: release map embeds original sources`);
  }
  offset+=512+Math.ceil(size/512)*512;
 }
}
test('source and release archives contain no recognizable embedded credentials',()=>{
 const files=new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean));
 const packages=join(root,'packages');
 if(existsSync(packages))for(const name of readdirSync(packages))if(name.endsWith('.tgz'))files.add('packages/'+name);
 const findings=[];
 for(const name of files){
  const file=join(root,name);if(!existsSync(file))continue;
  const bytes=readFileSync(file);
  if(name.endsWith('.tgz'))inspectArchive(name,bytes,findings);else inspect(name,bytes,findings);
 }
 assert.deepEqual(findings,[],`Remove embedded credentials before committing:\n${findings.join('\n')}`);
});
