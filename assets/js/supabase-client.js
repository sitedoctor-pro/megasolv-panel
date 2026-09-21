(()=>{
'use strict';
const URL='https://yarrynilnisfvjctuswl.supabase.co';
const KEY='sb_publishable_2X5M7UnsM929CZjGSdLNtQ_-Y2a74lX';
const SESSION_KEY='megasolv_admin_session_v1';
const jsonHeaders=()=>({'apikey':KEY,'Content-Type':'application/json','Accept':'application/json'});
const readJson=async r=>{const t=await r.text();if(!t)return null;try{return JSON.parse(t)}catch{return t}};
async function api(path,{method='GET',body,token,headers={},keepalive=false}={}){
  const h={...jsonHeaders(),...headers};
  if(token) h.Authorization=`Bearer ${token}`;
  const r=await fetch(URL+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),keepalive});
  const data=await readJson(r);
  if(!r.ok){const e=new Error((data&&data.msg)||(data&&data.message)||(data&&data.error_description)||(data&&data.error)||(data&&data.code)||`HTTP ${r.status}`);e.status=r.status;e.data=data;e.code=data&&data.code;throw e}
  return {data,response:r};
}
function parseJwt(token){try{const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(escape(atob(p.padEnd(Math.ceil(p.length/4)*4,'=')))))}catch{return {}}}
function loadSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s){if(s)sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));else sessionStorage.removeItem(SESSION_KEY)}
function roleFromSession(s){return s?.user?.app_metadata?.role||parseJwt(s?.access_token||'')?.app_metadata?.role||''}
async function refreshSession(s){
  if(!s?.refresh_token)return null;
  try{const {data}=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});saveSession(data);return data}catch{saveSession(null);return null}
}
async function getAdminSession(){
  let s=loadSession();if(!s)return null;
  const exp=parseJwt(s.access_token)?.exp||0;
  if(exp-Date.now()/1000<90)s=await refreshSession(s);
  if(!s||roleFromSession(s)!=='admin'){saveSession(null);return null}
  return s;
}
async function signIn(email,password){
  try{
    const {data}=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    if(roleFromSession(data)!=='admin'){saveSession(null);throw new Error('Ce compte existe, mais il n’est pas autorisé à accéder au dashboard.');}
    saveSession(data);return data;
  }catch(err){
    const code=err?.code||err?.data?.code||'';
    if(code==='invalid_credentials') throw Object.assign(new Error('E-mail ou mot de passe incorrect. Vérifiez aussi que le compte existe dans Supabase Auth.'),{code,status:err.status,data:err.data});
    if(code==='email_provider_disabled') throw Object.assign(new Error('La connexion E-mail/Mot de passe est désactivée dans Supabase Auth > Sign In / Providers > Email.'),{code,status:err.status,data:err.data});
    if(code==='email_not_confirmed') throw Object.assign(new Error('Cet e-mail n’est pas encore confirmé dans Supabase Auth.'),{code,status:err.status,data:err.data});
    throw err;
  }
}
async function signOut(){const s=loadSession();try{if(s?.access_token)await api('/auth/v1/logout',{method:'POST',token:s.access_token})}catch{}saveSession(null)}
function anonRest(path,opts={}){return api('/rest/v1/'+path,opts)}
function anonRpc(name,body={},opts={}){return anonRest('rpc/'+name,{method:'POST',body,...opts})}
async function adminRest(path,opts={}){const s=await getAdminSession();if(!s)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});return api('/rest/v1/'+path,{...opts,token:s.access_token})}
async function adminRpc(name,body={}){return adminRest('rpc/'+name,{method:'POST',body})}
function uuid(){return (crypto.randomUUID?crypto.randomUUID():('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})))}

// Lightweight native Supabase Realtime client (Phoenix protocol v1.0.0).
// It uses the current admin JWT, so Realtime Postgres Changes remain protected by RLS.
function subscribeAdminRealtime({tables=[],onChange=()=>{},onStatus=()=>{}}={}){
  const wanted=[...new Set(tables.filter(Boolean))];
  let socket=null,heartbeat=null,reconnectTimer=null,tokenTimer=null;
  let intentionalClose=false,retry=0,ref=0,joinRef=null,lastToken='';
  const topic=`realtime:megasolv-admin-${uuid().slice(0,8)}`;
  const backoff=[1000,2000,5000,10000];
  const wsUrl=URL.replace(/^http/i,'ws')+`/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`;
  const emitStatus=(state,detail='')=>{try{onStatus(state,detail)}catch{}};
  const send=(eventTopic,event,payload={},jr=joinRef)=>{
    if(!socket||socket.readyState!==WebSocket.OPEN)return false;
    const r=String(++ref);
    socket.send(JSON.stringify({topic:eventTopic,event,payload,ref:r,join_ref:jr}));
    return true;
  };
  const clearSocketTimers=()=>{if(heartbeat){clearInterval(heartbeat);heartbeat=null}if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}};
  const scheduleReconnect=()=>{
    if(intentionalClose)return;
    clearSocketTimers();
    const delay=backoff[Math.min(retry++,backoff.length-1)];
    emitStatus('RECONNECTING',`${Math.round(delay/1000)}s`);
    reconnectTimer=setTimeout(connect,delay);
  };
  const refreshRealtimeToken=async()=>{
    const s=await getAdminSession();
    if(!s){emitStatus('AUTH_REQUIRED');close();return}
    if(s.access_token!==lastToken){lastToken=s.access_token;send(topic,'access_token',{access_token:lastToken})}
  };
  const connect=async()=>{
    clearSocketTimers();
    const session=await getAdminSession();
    if(!session){emitStatus('AUTH_REQUIRED');return}
    lastToken=session.access_token;
    emitStatus('CONNECTING');
    try{socket=new WebSocket(wsUrl)}catch(e){emitStatus('ERROR',e?.message||'WebSocket');scheduleReconnect();return}
    socket.onopen=()=>{
      retry=0;
      joinRef=String(++ref);
      const payload={
        config:{
          broadcast:{ack:false,self:false},
          presence:{enabled:false},
          postgres_changes:wanted.map(table=>({event:'*',schema:'public',table})),
          private:false
        },
        access_token:lastToken
      };
      socket.send(JSON.stringify({topic,event:'phx_join',payload,ref:joinRef,join_ref:joinRef}));
      heartbeat=setInterval(()=>send('phoenix','heartbeat',{},null),25000);
    };
    socket.onmessage=ev=>{
      let msg;try{msg=JSON.parse(ev.data)}catch{return}
      const event=msg?.event,payload=msg?.payload||{};
      if(event==='phx_reply'&&msg.topic===topic&&String(msg.ref)===String(joinRef)){
        if(payload.status==='ok'){emitStatus('SUBSCRIBED');return}
        emitStatus('ERROR',payload?.response?.reason||payload?.response?.error||'Subscription refusée');return;
      }
      if(event==='system'){
        if(payload.status==='ok'&&payload.extension==='postgres_changes')emitStatus('SUBSCRIBED');
        else if(payload.status==='error'||payload.status==='timeout')emitStatus('ERROR',payload.message||payload.status);
        return;
      }
      if(event==='postgres_changes'){
        const data=payload.data||payload;
        try{onChange({table:data.table,event:data.type||data.event,record:data.record||{},oldRecord:data.old_record||{},commitTimestamp:data.commit_timestamp||null,raw:data})}catch{}
        return;
      }
      if(event==='phx_error'){emitStatus('ERROR','Realtime channel error');scheduleReconnect()}
    };
    socket.onerror=()=>emitStatus('ERROR','WebSocket');
    socket.onclose=()=>{socket=null;if(!intentionalClose)scheduleReconnect();else emitStatus('CLOSED')};
  };
  const close=()=>{
    intentionalClose=true;clearSocketTimers();if(tokenTimer){clearInterval(tokenTimer);tokenTimer=null}
    try{if(socket&&socket.readyState===WebSocket.OPEN)send(topic,'phx_leave',{})}catch{}
    try{socket?.close()}catch{}socket=null;
  };
  connect();
  tokenTimer=setInterval(refreshRealtimeToken,240000);
  return {close,reconnect:()=>{intentionalClose=false;retry=0;try{socket?.close()}catch{}connect()},get state(){return socket?.readyState??WebSocket.CLOSED}};
}

window.MegaDB={URL,KEY,api,anonRest,anonRpc,adminRest,adminRpc,signIn,signOut,getAdminSession,loadSession,saveSession,roleFromSession,uuid,subscribeAdminRealtime};
})();
