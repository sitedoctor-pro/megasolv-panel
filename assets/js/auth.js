(()=>{
'use strict';
const db=window.MegaDB;
const $=(s,c=document)=>c.querySelector(s);
async function requireAdmin(){const s=await db.getAdminSession();if(!s){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()||'index.html'));return null}document.body.classList.remove('auth-guard');const email=s.user?.email||'';document.querySelectorAll('[data-admin-email]').forEach(e=>e.textContent=email);return s}
function safeNext(){const n=new URLSearchParams(location.search).get('next')||'index.html';return ['index.html','orders.html','reviews.html'].includes(n)?n:'index.html'}
async function initLogin(){const form=$('#loginForm');if(!form)return;const existing=await db.getAdminSession();if(existing){location.replace(safeNext());return}document.body.classList.remove('auth-guard');const status=$('#loginStatus');form.addEventListener('submit',async e=>{e.preventDefault();const btn=$('#loginSubmit');status.textContent='';status.className='login-status';btn.disabled=true;btn.textContent='Connexion…';try{await db.signIn(form.email.value.trim(),form.password.value);location.replace(safeNext())}catch(err){status.textContent=err.message||'Connexion impossible.';status.classList.add('error');btn.disabled=false;btn.textContent='Se connecter'}})}
async function initLogout(){document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;await db.signOut();location.replace('login.html')}))}
window.AdminAuth={requireAdmin,initLogin,initLogout};
document.addEventListener('DOMContentLoaded',()=>{if(document.body.dataset.page==='login')initLogin();});
})();