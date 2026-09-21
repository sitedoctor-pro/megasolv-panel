const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const db=window.MegaDB;

function money(v){return new Intl.NumberFormat('fr-MA',{maximumFractionDigits:2}).format(Number(v||0))+' MAD'}
function fmtDate(v,withTime=true){if(!v)return '—';const d=new Date(v);return new Intl.DateTimeFormat('fr-MA',withTime?{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'}).format(d)}
function initials(n=''){return n.trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?'}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const labels={new:'Nouveau',confirmed:'Confirmé',processing:'En préparation',shipped:'Expédié',delivered:'Livré',cancelled:'Annulé',returned:'Retourné',pending:'En attente',approved:'Approuvé',rejected:'Rejeté'};
function statusLabel(s){return labels[s]||s}
function cssStatus(s){return s==='shipped'?'shipping':s}
function toast(msg,type='ok'){
  let st=$('.toast-stack');if(!st){st=document.createElement('div');st.className='toast-stack';document.body.append(st)}
  const t=document.createElement('div');t.className='toast '+(type==='error'?'error':type==='info'?'info':'');
  t.innerHTML=`<span class="toast-mark"></span><span>${escapeHtml(msg)}</span>`;st.append(t);
  setTimeout(()=>{t.classList.add('leaving');setTimeout(()=>t.remove(),220)},3200);
}
function setLoading(el,on){if(el)el.classList.toggle('is-loading',on)}
function debounce(fn,wait=450){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait)}}
function safeFilePart(v=''){return String(v||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'backup'}
function downloadJSON(data,filename){
  const json=JSON.stringify(data,null,2);
  const blob=new Blob([json],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
  return true;
}
async function fetchAllAdmin(resource,{select='*',order='created_at.asc',pageSize=1000}={}){
  const rows=[];let offset=0;
  while(true){
    const q=`${resource}?select=${encodeURIComponent(select)}${order?`&order=${encodeURIComponent(order)}`:''}&limit=${pageSize}&offset=${offset}`;
    const {data}=await db.adminRest(q);
    const batch=Array.isArray(data)?data:[];rows.push(...batch);
    if(batch.length<pageSize)break;
    offset+=batch.length;
    if(offset>1000000)throw new Error('Backup trop volumineux. Export interrompu par sécurité.');
  }
  return rows;
}
function setBadge(kind,value){document.querySelectorAll(`[data-nav-badge="${kind}"]`).forEach(el=>{const n=Number(value||0);el.textContent=n;el.classList.toggle('is-zero',n===0)})}
function flashLive(){document.querySelectorAll('.kpi-card,.panel').forEach(el=>{el.classList.remove('live-flash');void el.offsetWidth;el.classList.add('live-flash')})}

function countFromRange(response){
  const raw=response?.headers?.get('content-range')||'';
  const total=raw.split('/')[1];
  return total&&total!=='*'?Number(total)||0:0;
}
async function exactAdminCount(resource,filter=''){
  const q=`${resource}?select=id&limit=1${filter?`&${filter}`:''}`;
  const {response}=await db.adminRest(q,{headers:{Prefer:'count=exact'}});
  return countFromRange(response);
}
async function loadNavCounts(){
  try{
    const [totalOrders,totalReviews]=await Promise.all([
      exactAdminCount('orders'),
      exactAdminCount('reviews')
    ]);
    setBadge('orders',totalOrders);
    setBadge('reviews',totalReviews);
    return {orders:totalOrders,reviews:totalReviews};
  }catch(e){
    if(e?.code==='AUTH_REQUIRED')return null;
    console.warn('Navigation counters:',e);
    return null;
  }
}

function initShell(){
  const sidebar=$('.sidebar'),scrim=$('.menu-scrim'),toggle=$('.mobile-toggle');
  const close=()=>{sidebar?.classList.remove('open');scrim?.classList.remove('show');toggle?.setAttribute('aria-expanded','false')};
  toggle?.addEventListener('click',()=>{const o=sidebar.classList.toggle('open');scrim.classList.toggle('show',o);toggle.setAttribute('aria-expanded',String(o))});
  scrim?.addEventListener('click',close);$$('.side-link').forEach(a=>a.addEventListener('click',close));
  $('.notif-btn')?.addEventListener('click',()=>toast('Les données sont synchronisées automatiquement.','info'));
  AdminAuth.initLogout();
  loadNavCounts();
}

function lineChart(data,labelsArr){
  const svg=$('#lineChart');if(!svg)return;
  const W=760,H=280,p={l:42,r:20,t:20,b:34};data=data.length?data:[0,0];labelsArr=labelsArr.length?labelsArr:['',''];
  const max=Math.max(1,...data)*1.15,X=i=>p.l+i*(W-p.l-p.r)/(Math.max(1,data.length-1)),Y=v=>p.t+(max-v)/max*(H-p.t-p.b);
  let html='<defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EB040F" stop-opacity=".20"/><stop offset="1" stop-color="#EB040F" stop-opacity="0"/></linearGradient></defs>';
  for(let i=0;i<5;i++){const y=p.t+i*(H-p.t-p.b)/4;html+=`<line class="chart-grid-line" x1="${p.l}" x2="${W-p.r}" y1="${y}" y2="${y}"/>`}
  const pts=data.map((v,i)=>[X(i),Y(v)]),line=pts.map((q,i)=>(i?'L':'M')+q[0]+' '+q[1]).join(' '),area=`M ${pts[0][0]} ${H-p.b} ${pts.map(q=>'L '+q[0]+' '+q[1]).join(' ')} L ${pts.at(-1)[0]} ${H-p.b} Z`;
  html+=`<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>`;
  pts.forEach((q,i)=>{if(i===pts.length-1||i%Math.ceil(data.length/7)===0)html+=`<circle class="chart-dot" cx="${q[0]}" cy="${q[1]}" r="4"/>`});
  labelsArr.forEach((l,i)=>{if(i===0||i===labelsArr.length-1||i%Math.ceil(labelsArr.length/6)===0)html+=`<text class="chart-label" x="${X(i)}" y="${H-8}" text-anchor="middle">${escapeHtml(l)}</text>`});
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=html;
}

let analyticsDays=7;
async function rpcAnalytics(days){const {data}=await db.adminRpc('admin_dashboard',{p_days:days});return data}
function renderAnalytics(d){
  $('#kpiPageViews').textContent=new Intl.NumberFormat('fr-MA').format(d.page_views||0);
  $('#kpiVisitors').textContent=new Intl.NumberFormat('fr-MA').format(d.visitors||0);
  $('#kpiOrdersToday').textContent=d.orders_today||0;
  $('#kpiRevenueToday').textContent=new Intl.NumberFormat('fr-MA').format(d.revenue_today||0);
  $('#kpiSessionsSub').textContent=`${new Intl.NumberFormat('fr-MA').format(d.sessions||0)} sessions`;
  $('#kpiPagesPerSession').textContent=`${(d.sessions?((d.page_views||0)/d.sessions):0).toFixed(1).replace('.',',')} page(s) / session`;
  $('#kpiOrdersSub').textContent=`${d.active_orders_today||0} confirmées / en cours`;
  const deliveredToday=Number(d.delivered_orders_today||0);
  $('#kpiRevenueSub').textContent=`${deliveredToday} livrée(s) · panier moyen ${deliveredToday?Math.round((d.revenue_today||0)/deliveredToday):0} MAD`;
  const daily=d.daily||[];lineChart(daily.map(x=>Number(x.page_views||0)),daily.map(x=>new Intl.DateTimeFormat('fr-MA',{day:'numeric',month:'short'}).format(new Date(x.day+'T12:00:00'))));
  const src=d.traffic_sources||[],sourceTotalRaw=src.reduce((a,x)=>a+Number(x.sessions||0),0),total=sourceTotalRaw||1,order=['Google / SEO','Direct','Social','Autres'],sourceKeys=['google','direct','social','other'],map=Object.fromEntries(src.map(x=>[x.source,Number(x.sessions||0)])),counts=order.map(k=>map[k]||0),pct=counts.map(v=>Math.round(v*100/total));
  const donut=$('.donut');if(donut)donut.style.background=`conic-gradient(var(--red) 0 ${pct[0]}%,#1B1D20 ${pct[0]}% ${pct[0]+pct[1]}%,#BFC2C7 ${pct[0]+pct[1]}% ${pct[0]+pct[1]+pct[2]}%,#F1B6B9 ${pct[0]+pct[1]+pct[2]}% 100%)`;
  $('#sourceTotal').textContent=new Intl.NumberFormat('fr-MA').format(sourceTotalRaw);
  sourceKeys.forEach((key,i)=>{const el=$(`[data-source="${key}"]`);if(el){el.innerHTML=`<span class="source-pct">${pct[i]||0}%</span><span class="source-exact">${new Intl.NumberFormat('fr-MA').format(counts[i]||0)}</span>`;el.title=`${pct[i]||0}% · ${counts[i]||0} session(s)`;}});
  const tb=$('#recentOrdersBody');if(tb)tb.innerHTML=(d.recent_orders||[]).length?(d.recent_orders||[]).map(o=>`<tr><td data-label="Commande"><span class="order-id">${escapeHtml(o.order_number)}</span><div class="table-sub">${fmtDate(o.created_at)}</div></td><td data-label="Client">${escapeHtml(o.customer_name)}</td><td data-label="Ville">${escapeHtml(o.city)}</td><td data-label="Total" class="table-main">${money(o.total_amount)}</td><td data-label="Statut"><span class="status ${cssStatus(o.status)}">${statusLabel(o.status)}</span></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-state"><strong>Aucune commande</strong><span>Les nouvelles commandes apparaîtront ici.</span></div></td></tr>`;
  const tp=$('#topPagesList');if(tp)tp.innerHTML=(d.top_pages||[]).length?(d.top_pages||[]).map((x,i)=>`<div class="mini-row"><div class="mini-rank">${String(i+1).padStart(2,'0')}</div><div class="mini-copy"><strong>${escapeHtml(x.page_path)}</strong><span>${escapeHtml(x.language||'')}</span></div><div class="mini-value"><strong>${new Intl.NumberFormat('fr-MA').format(x.page_views||0)}</strong><span>vues</span></div></div>`).join(''):`<div class="empty-state"><strong>Aucune page vue</strong><span>Les statistiques commenceront dès les premières visites.</span></div>`;
  updateLastSync();
}
async function loadAnalytics(days=analyticsDays,{silent=false}={}){analyticsDays=days;if(!silent)setLoading($('.content'),true);try{renderAnalytics(await rpcAnalytics(days))}catch(e){toast(e.message||'Impossible de charger les analytics.','error')}finally{if(!silent)setLoading($('.content'),false)}}
async function backupAndCleanAnalytics(){
  const btn=$('#cleanAnalytics');if(!btn)return;
  const original=btn.innerHTML;btn.disabled=true;btn.innerHTML='Préparation du backup JSON…';
  try{
    const [sessions,pageViews,events]=await Promise.all([
      fetchAllAdmin('analytics_sessions'),
      fetchAllAdmin('page_views'),
      fetchAllAdmin('analytics_events')
    ]);
    const totalRows=sessions.length+pageViews.length+events.length;
    if(totalRows===0){toast('Aucune donnée Analytics à nettoyer.','info');return}
    const exportedAt=new Date().toISOString();
    const backup={
      format:'MEGASOLV Analytics Backup',version:1,exported_at:exportedAt,
      counts:{analytics_sessions:sessions.length,page_views:pageViews.length,analytics_events:events.length,total:totalRows},
      analytics_sessions:sessions,page_views:pageViews,analytics_events:events
    };
    downloadJSON(backup,`megasolv-analytics-backup-${exportedAt.replace(/[:.]/g,'-')}.json`);
    const ok=window.confirm(`Backup JSON téléchargé (${totalRows} ligne(s)).\n\nConfirmer la suppression DÉFINITIVE des données Analytics ?\n\nLes commandes et les avis ne seront pas supprimés.`);
    if(!ok){toast('Nettoyage annulé. Le backup JSON reste téléchargé.','info');return}
    btn.innerHTML='Suppression en cours…';
    await db.adminRest('analytics_events?id=not.is.null',{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    await db.adminRest('page_views?id=not.is.null',{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    await db.adminRest('analytics_sessions?id=not.is.null',{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    toast(`${totalRows} donnée(s) Analytics supprimée(s). Backup JSON conservé.`);
    await loadAnalytics(analyticsDays,{silent:true});
  }catch(e){toast(e.message||'Impossible de nettoyer les Analytics.','error')}
  finally{btn.disabled=false;btn.innerHTML=original}
}
function initAnalytics(){if(document.body.dataset.page!=='analytics')return;loadAnalytics(7);$$('[data-period]').forEach(b=>b.addEventListener('click',()=>{$$('[data-period]').forEach(x=>x.classList.toggle('active',x===b));loadAnalytics(+b.dataset.period)}));$('#cleanAnalytics')?.addEventListener('click',backupAndCleanAnalytics)}

let orders=[];
function orderRow(o){return `<tr><td data-label="Commande"><button class="order-id action-link" data-open-order="${o.id}">${escapeHtml(o.order_number)}</button><div class="table-sub">${fmtDate(o.created_at)}</div></td><td data-label="Client"><div class="customer"><div class="customer-avatar">${initials(o.customer_name)}</div><div><div class="table-main">${escapeHtml(o.customer_name)}</div><div class="table-sub">${escapeHtml(o.phone)}</div></div></div></td><td data-label="Ville">${escapeHtml(o.city)}</td><td data-label="Produit">${o.quantity} × ${money(o.unit_price)}</td><td data-label="Total" class="table-main">${money(o.total_amount)}</td><td data-label="Statut"><span class="status ${cssStatus(o.status)}">${statusLabel(o.status)}</span></td><td data-label="Détails" class="text-right mobile-table-action"><button class="action-btn" aria-label="Voir la commande" data-open-order="${o.id}"><img class="icon" src="assets/icons/more.svg" alt=""></button></td></tr>`}
function filteredOrders(){const v=($('#orderSearch')?.value||'').trim().toLowerCase(),st=$('#statusFilter')?.value||'all';return orders.filter(o=>(!v||[o.order_number,o.customer_name,o.phone,o.city].join(' ').toLowerCase().includes(v))&&(st==='all'||o.status===st))}
function renderOrders(){
  const tb=$('#ordersBody');if(!tb)return;const rows=filteredOrders();
  tb.innerHTML=rows.length?rows.map(orderRow).join(''):`<tr><td colspan="7"><div class="empty-state"><strong>Aucune commande trouvée</strong><span>Essayez un autre filtre.</span></div></td></tr>`;
  $$('[data-open-order]').forEach(b=>b.addEventListener('click',()=>openOrder(b.dataset.openOrder)));
  const counts={all:orders.length,new:0,confirmed:0,shipped:0,delivered:0};orders.forEach(o=>{if(counts[o.status]!=null)counts[o.status]++});Object.entries(counts).forEach(([k,v])=>{const el=$(`[data-order-count="${k}"]`);if(el)el.textContent=v});updateLastSync();
}
async function loadOrders({silent=false}={}){try{if(!silent)setLoading($('#ordersBody')?.closest('.panel'),true);const {data}=await db.adminRest('orders?select=*&order=created_at.desc&limit=500');orders=Array.isArray(data)?data:[];renderOrders()}catch(e){if(e.code!=='AUTH_REQUIRED')toast(e.message,'error')}finally{if(!silent)setLoading($('#ordersBody')?.closest('.panel'),false)}}
function openOrder(id){const o=orders.find(x=>x.id===id),d=$('#orderDrawer'),s=$('#drawerScrim');if(!o||!d)return;$('#drawerOrderId').textContent=o.order_number;$('#drawerCustomer').textContent=o.customer_name;$('#drawerPhone').textContent=o.phone;$('#drawerCity').textContent=o.city;$('#drawerDate').textContent=fmtDate(o.created_at);$('#drawerAddress').textContent=o.address||'—';$('#drawerProduct').textContent='Medical Back Support';$('#drawerQty').textContent=o.quantity;$('#drawerTotal').textContent=money(o.total_amount);const sel=$('#drawerStatus');sel.value=o.status;sel.dataset.id=o.id;const del=$('#deleteOrder');if(del)del.dataset.id=o.id;d.classList.add('open');s.classList.add('show')}
function closeDrawer(){$('#orderDrawer')?.classList.remove('open');$('#drawerScrim')?.classList.remove('show')}
async function updateOrderStatus(id,status){try{await db.adminRest(`orders?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{status},headers:{'Prefer':'return=minimal'}});const o=orders.find(x=>x.id===id);if(o)o.status=status;renderOrders();loadNavCounts();toast('Statut mis à jour.')}catch(e){toast(e.message,'error')}}
async function deleteOrderSafely(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  const btn=$('#deleteOrder'),original=btn?.innerHTML||'';if(btn){btn.disabled=true;btn.innerHTML='Backup JSON…'}
  try{
    const exportedAt=new Date().toISOString();
    downloadJSON({format:'MEGASOLV Order Backup',version:1,exported_at:exportedAt,order:o},`megasolv-commande-${safeFilePart(o.order_number||o.id)}-${exportedAt.slice(0,10)}.json`);
    const ok=window.confirm(`Backup JSON de ${o.order_number||'la commande'} téléchargé.\n\nConfirmer la suppression DÉFINITIVE de cette commande ?`);
    if(!ok){toast('Suppression annulée. Le backup JSON reste téléchargé.','info');return}
    if(btn)btn.innerHTML='Suppression…';
    await db.adminRest(`orders?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    orders=orders.filter(x=>x.id!==id);closeDrawer();renderOrders();loadNavCounts();toast('Commande supprimée. Backup JSON conservé.');
  }catch(e){toast(e.message||'Impossible de supprimer la commande.','error')}
  finally{if(btn){btn.disabled=false;btn.innerHTML=original}}
}
function exportCSV(){const rows=filteredOrders(),head=['Commande','Date','Client','Téléphone','Ville','Adresse','Quantité','Total MAD','Statut'];const csv=[head,...rows.map(o=>[o.order_number,o.created_at,o.customer_name,o.phone,o.city,o.address||'',o.quantity,o.total_amount,statusLabel(o.status)])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`megasolv-commandes-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast(`${rows.length} commande(s) exportée(s).`)}
function initOrders(){if(document.body.dataset.page!=='orders')return;loadOrders();$('#orderSearch')?.addEventListener('input',renderOrders);$('#statusFilter')?.addEventListener('change',renderOrders);$('#exportCsv')?.addEventListener('click',exportCSV);$('#drawerClose')?.addEventListener('click',closeDrawer);$('#drawerScrim')?.addEventListener('click',closeDrawer);$('#drawerStatus')?.addEventListener('change',e=>updateOrderStatus(e.target.dataset.id,e.target.value));$('#deleteOrder')?.addEventListener('click',e=>deleteOrderSafely(e.currentTarget.dataset.id))}

let reviews=[];
function reviewCard(r){return `<article class="review-card"><div class="review-top"><div class="review-avatar">${initials(r.customer_name)}</div><div class="review-meta"><strong>${escapeHtml(r.customer_name)}</strong><span>${fmtDate(r.created_at,false)}${r.verified_purchase?' · Achat vérifié':''}</span></div><span class="status ${r.status}">${statusLabel(r.status)}</span></div><div class="stars" aria-label="${r.rating} étoiles">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p class="review-text">${escapeHtml(r.review_text)}</p><div class="review-actions">${r.status!=='approved'?`<button class="btn btn-sm btn-success" data-review-action="approved" data-id="${r.id}"><img class="icon" src="assets/icons/check.svg" alt="">Approuver</button>`:''}${r.status!=='rejected'?`<button class="btn btn-sm btn-danger-soft" data-review-action="rejected" data-id="${r.id}"><img class="icon" src="assets/icons/x.svg" alt="">Rejeter</button>`:''}<button class="btn btn-sm btn-neutral" data-review-action="delete" data-id="${r.id}"><img class="icon" src="assets/icons/trash.svg" alt="">Supprimer</button></div></article>`}
function filteredReviews(){const v=($('#reviewSearch')?.value||'').trim().toLowerCase(),st=$('#reviewFilter')?.value||'all';return reviews.filter(r=>(!v||[r.customer_name,r.review_text].join(' ').toLowerCase().includes(v))&&(st==='all'||r.status===st))}
function renderReviews(){
  const g=$('#reviewsGrid');if(!g)return;const rows=filteredReviews();g.innerHTML=rows.length?rows.map(reviewCard).join(''):`<div class="panel empty-state"><strong>Aucun avis</strong><span>Aucun résultat pour ce filtre.</span></div>`;
  $$('[data-review-action]').forEach(b=>b.addEventListener('click',()=>reviewAction(b.dataset.id,b.dataset.reviewAction)));
  const approved=reviews.filter(r=>r.status==='approved'),avg=approved.length?approved.reduce((a,r)=>a+Number(r.rating),0)/approved.length:0;$('#avgRating').textContent=approved.length?avg.toFixed(1):'—';$('#pendingCount').textContent=reviews.filter(r=>r.status==='pending').length;$('#approvedCount').textContent=approved.length;$('#rejectedCount').textContent=reviews.filter(r=>r.status==='rejected').length;updateLastSync();
}
async function loadReviews({silent=false}={}){try{if(!silent)setLoading($('#reviewsGrid'),true);const {data}=await db.adminRest('reviews?select=*&order=created_at.desc&limit=500');reviews=Array.isArray(data)?data:[];renderReviews()}catch(e){toast(e.message,'error')}finally{if(!silent)setLoading($('#reviewsGrid'),false)}}
async function reviewAction(id,action){try{if(action==='delete')await db.adminRest(`reviews?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Prefer':'return=minimal'}});else await db.adminRest(`reviews?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{status:action,approved_at:action==='approved'?new Date().toISOString():null},headers:{'Prefer':'return=minimal'}});toast(action==='delete'?'Avis supprimé.':action==='approved'?'Avis approuvé.':'Avis rejeté.');await loadReviews({silent:true});loadNavCounts()}catch(e){toast(e.message,'error')}}
function initReviews(){if(document.body.dataset.page!=='reviews')return;loadReviews();$('#reviewSearch')?.addEventListener('input',renderReviews);$('#reviewFilter')?.addEventListener('change',renderReviews)}

// Realtime synchronization ----------------------------------------------------
let realtimeController=null,fallbackPoll=null,realtimeSubscribed=false,lastSyncAt=null;
function updateLastSync(){lastSyncAt=new Date();const el=$('[data-last-sync]');if(el)el.textContent='Mis à jour '+new Intl.DateTimeFormat('fr-MA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(lastSyncAt)}
function setRealtimeUI(state,detail=''){
  const el=$('#realtimeStatus');if(!el)return;el.dataset.state=state.toLowerCase();const label=el.querySelector('[data-realtime-label]');
  const map={CONNECTING:'Connexion live…',SUBSCRIBED:'Temps réel',RECONNECTING:'Reconnexion…',ERROR:'Mode secours',CLOSED:'Mode secours',AUTH_REQUIRED:'Session expirée'};
  if(label)label.textContent=map[state]||state;
  el.title=detail?`${map[state]||state} — ${detail}`:(map[state]||state);
  if(state==='SUBSCRIBED'){realtimeSubscribed=true;stopFallback();updateLastSync()}else if(['ERROR','CLOSED','RECONNECTING'].includes(state)){realtimeSubscribed=false;startFallback()}
  if(state==='AUTH_REQUIRED')location.replace('login.html');
}
async function refreshCurrentPage({silent=true}={}){
  const page=document.body.dataset.page;
  if(page==='analytics')return loadAnalytics(analyticsDays,{silent});
  if(page==='orders')return loadOrders({silent});
  if(page==='reviews')return loadReviews({silent});
}
const realtimeRefresh=debounce(()=>{refreshCurrentPage({silent:true});flashLive()},350);
function handleRealtimeChange(change){
  if(change.event==='INSERT'&&change.table==='orders')toast('Nouvelle commande reçue.','info');
  if(change.event==='INSERT'&&change.table==='reviews')toast('Nouvel avis en attente.','info');
  if(change.table==='orders'||change.table==='reviews')loadNavCounts();
  realtimeRefresh();
}
function startFallback(){if(fallbackPoll)return;fallbackPoll=setInterval(()=>{refreshCurrentPage({silent:true});loadNavCounts()},20000)}
function stopFallback(){if(fallbackPoll){clearInterval(fallbackPoll);fallbackPoll=null}}
function initRealtime(){
  realtimeController=db.subscribeAdminRealtime({
    tables:['analytics_sessions','page_views','analytics_events','orders','reviews'],
    onChange:handleRealtimeChange,
    onStatus:setRealtimeUI
  });
  $('#realtimeStatus')?.addEventListener('click',()=>{refreshCurrentPage({silent:true});if(!realtimeSubscribed)realtimeController?.reconnect?.();toast('Synchronisation demandée.','info')});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshCurrentPage({silent:true});loadNavCounts()}});
  window.addEventListener('beforeunload',()=>realtimeController?.close?.());
  setTimeout(()=>{if(!realtimeSubscribed)startFallback()},9000);
}

async function boot(){
  const s=await AdminAuth.requireAdmin();if(!s)return;
  const cd=$('#currentDate');if(cd)cd.textContent=new Intl.DateTimeFormat('fr-MA',{day:'numeric',month:'long',year:'numeric'}).format(new Date());
  initShell();initAnalytics();initOrders();initReviews();initRealtime();
}
document.addEventListener('DOMContentLoaded',boot);
