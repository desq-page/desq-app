import {spawn} from 'node:child_process';
import WebSocket from 'ws';

// Wait on the actual async fixture, not headless Chrome's virtual-clock idle
// heuristic (which can finish before PDF worker/MessageChannel work completes).
export async function runBrowserFixture(chrome,url,profile) {
  const child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--no-first-run','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe']});
  let socket;
  const pending=new Map();let sequence=0;let loaded;
  try {
    const endpoint=await new Promise((resolve,reject)=>{
      let buffer='';const timer=setTimeout(()=>reject(Error('Chrome debugging startup timed out.')),15000);
      child.stderr.on('data',chunk=>{buffer+=chunk;const match=buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Chrome exited (${code}) before starting.`));});
    });
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
    socket.on('message',bytes=>{const message=JSON.parse(String(bytes));if(message.method==='Page.loadEventFired')loaded?.();if(!pending.has(message.id))return;const request=pending.get(message.id);pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(Error(JSON.stringify(message.error))):request.resolve(message.result);});
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
      const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},50000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},sessionId);
    const loadEvent=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture page did not load.')),15000);loaded=()=>{clearTimeout(timer);resolve();};});
    await send('Page.navigate',{url},sessionId);await loadEvent;
    const result=await send('Runtime.evaluate',{expression:`new Promise(resolve => {const started=Date.now();function check(){if(document.getElementById('result')||Date.now()-started>40000)resolve(document.documentElement.outerHTML);else setTimeout(check,50);}check();})`,awaitPromise:true,returnByValue:true},sessionId);
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  } finally {
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser fixture closed.'));}
    socket?.close();child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,3000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  }
}
