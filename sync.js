/* Encrypted cross-device sync. The AES key stays in the URL fragment and never reaches the storage API. */
(()=>{
const API='https://superjsonblob.com/api/jsonBlob';
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
let id,key,ready=false,last='';
async function encrypt(obj){let iv=crypto.getRandomValues(new Uint8Array(12)),plain=new TextEncoder().encode(JSON.stringify({updated:Date.now(),data:obj})),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);return {iv:b64u(iv),cipher:b64u(cipher)}}
async function decrypt(blob){let bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64u(blob.iv)},key,unb64u(blob.cipher));return JSON.parse(new TextDecoder().decode(bytes))}
async function put(obj){if(!ready)return;let value=await encrypt(obj);await fetch(`${API}/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});last=JSON.stringify(obj);status('已加密同步')}
function status(t){let el=document.getElementById('syncState');if(!el){el=document.createElement('div');el.id='syncState';el.style='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:8;padding:6px 11px;border-radius:10px;background:#52745e;color:white;font:12px sans-serif;box-shadow:0 2px 8px #0002';document.body.appendChild(el)}el.textContent=t;el.style.opacity='1';clearTimeout(status.timer);status.timer=setTimeout(()=>el.style.opacity='.7',2500)}
async function init(){try{
let cfg=location.hash.match(/^#sync=([\w-]+)\.([\w-]+)$/);
if(cfg){id=cfg[1];key=await crypto.subtle.importKey('raw',unb64u(cfg[2]),'AES-GCM',false,['encrypt','decrypt']);let r=await fetch(`${API}/${id}`);if(!r.ok)throw Error('云端记录暂不可用');let box=await r.json();let remote=await decrypt(box);let local=JSON.parse(localStorage.getItem('taildiary')||'null');if(remote.data){window.tailApplyCloud(remote.data);last=JSON.stringify(remote.data);if(local&&JSON.stringify(local)!==last)status('已连接同步：云端记录已载入')}ready=true;status('跨设备加密同步已连接')
}else{
key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);let raw=new Uint8Array(await crypto.subtle.exportKey('raw',key)),token=b64u(raw);let local=JSON.parse(localStorage.getItem('taildiary')||'null')||{pets:{Chris:{name:'Chris',sex:'公',birthday:'2022-04-12',vaccine:'疫苗齐全',color:'奶油白',weight:12.4,emoji:'🐕'},'六千':{name:'六千',sex:'母',birthday:'2023-08-06',vaccine:'疫苗齐全',color:'浅棕色',weight:8.6,emoji:'🐶'}},records:[],reminders:[]};let box=await encrypt(local);let r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(box)});if(!r.ok)throw Error('云端初始化失败');let meta=await r.json();id=meta.id;history.replaceState(null,'',location.pathname+location.search+'#sync='+id+'.'+token);ready=true;last=JSON.stringify(local);status('已建立加密同步，请在所有设备使用本页完整网址')
}
window.tailSyncWrite=obj=>{let s=JSON.stringify(obj);if(ready&&s!==last){clearTimeout(window.tailSyncTimer);window.tailSyncTimer=setTimeout(()=>put(obj).catch(()=>status('同步失败，将在下次操作重试')),700)}};
setInterval(async()=>{if(!ready)return;try{let r=await fetch(`${API}/${id}`);if(!r.ok)return;let cloud=await decrypt(await r.json()),s=JSON.stringify(cloud.data),local=JSON.stringify(JSON.parse(localStorage.getItem('taildiary')||'null'));if(s!==last&&s!==local){window.tailApplyCloud(cloud.data);last=s;status('已载入其他设备的最新记录')}}catch{}},5000)
}catch(e){console.warn('sync unavailable',e);status('云同步暂不可用，当前记录仍保存在本机')}}
init();
})();
