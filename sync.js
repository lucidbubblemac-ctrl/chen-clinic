/* Chen clinic: login, end-to-end encryption and sync.
   The password never leaves the device in plain form:
   - auth password  = PBKDF2(password, "chen-clinic-auth:"+email)  -> sent to Supabase Auth
   - data key       = PBKDF2(password, random salt stored with the row) -> AES-GCM, stays on device
   Supabase only ever stores ciphertext. */
(function(){
"use strict";
var CFG=window.CHEN_CFG||{};
var app=window.__app;
var sb=null;
try{sb=window.supabase.createClient(CFG.url,CFG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"chen-auth"}});}catch(e){}
var enc=new TextEncoder(),dec=new TextDecoder();
var ITER_AUTH=210000,ITER_KEY=310000;
var KEY_DB="chen-keys",META="chen-sync-meta";

function b64(buf){var b=new Uint8Array(buf),s="";for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
function unb64(str){var s=atob(str),b=new Uint8Array(s.length);for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;}
function hex(buf){return Array.from(new Uint8Array(buf)).map(function(x){return x.toString(16).padStart(2,"0");}).join("");}
function pbkdf2Bits(pw,salt,iter){return crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveBits"]).then(function(k){return crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:iter,hash:"SHA-256"},k,256);});}
function authPassword(email,pw){return pbkdf2Bits(pw,enc.encode("chen-clinic-auth:"+email.toLowerCase()),ITER_AUTH).then(hex);}
function dataKey(pw,salt){return crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveKey"]).then(function(k){return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:ITER_KEY,hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);});}
function encrypt(key,obj){var iv=crypto.getRandomValues(new Uint8Array(12));return crypto.subtle.encrypt({name:"AES-GCM",iv:iv},key,enc.encode(JSON.stringify(obj))).then(function(ct){return{iv:b64(iv),data:b64(ct)};});}
function decrypt(key,row){return crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(row.iv)},key,unb64(row.data)).then(function(pt){return JSON.parse(dec.decode(pt));});}

/* non-extractable key kept in IndexedDB */
function idb(){return new Promise(function(res,rej){var r=indexedDB.open(KEY_DB,1);r.onupgradeneeded=function(){r.result.createObjectStore("k");};r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
function keyGet(uid){return idb().then(function(db){return new Promise(function(res){var t=db.transaction("k").objectStore("k").get(uid);t.onsuccess=function(){res(t.result||null);};t.onerror=function(){res(null);};});}).catch(function(){return null;});}
function keyPut(uid,key){return idb().then(function(db){return new Promise(function(res){var t=db.transaction("k","readwrite");t.objectStore("k").put(key,uid);t.oncomplete=function(){res();};t.onerror=function(){res();};});}).catch(function(){});}
function keyClear(){return new Promise(function(res){try{var r=indexedDB.deleteDatabase(KEY_DB);r.onsuccess=r.onerror=r.onblocked=function(){res();};}catch(e){res();}});}

function meta(){try{return JSON.parse(localStorage.getItem(META)||"{}");}catch(e){return{};}}
function setMeta(m){try{localStorage.setItem(META,JSON.stringify(m));}catch(e){}}

/* ---------- merge ---------- */
var COLS=["patients","sessions","expenses"];
function merge(a,b){
  var out={settings:null,deleted:{}};
  var del=Object.assign({},a.deleted||{});
  Object.keys(b.deleted||{}).forEach(function(id){del[id]=Math.max(del[id]||0,b.deleted[id]);});
  var cutoff=Date.now()-200*864e5;
  Object.keys(del).forEach(function(id){if(del[id]>cutoff)out.deleted[id]=del[id];});
  COLS.forEach(function(k){
    var m={};
    (a[k]||[]).forEach(function(it){m[it.id]=it;});
    (b[k]||[]).forEach(function(it){var o=m[it.id];if(!o||(it.u||0)>(o.u||0))m[it.id]=it;});
    out[k]=Object.keys(m).map(function(id){return m[id];}).filter(function(it){return!(del[it.id]&&del[it.id]>=(it.u||0));});
  });
  var aU=a.settingsU||0,bU=b.settingsU||0;
  var base=bU>aU?b.settings:a.settings;
  out.settings=Object.assign({},base||{});
  out.settings.pinHash=(a.settings||{}).pinHash||"";
  out.settings.lastBackup=(a.settings||{}).lastBackup||0;
  out.settingsU=Math.max(aU,bU);
  out.demo=false;
  return out;
}
function payload(S){var st=Object.assign({},S.settings);delete st.pinHash;delete st.lastBackup;return{v:2,settings:st,settingsU:S.settingsU||0,patients:S.patients,sessions:S.sessions,expenses:S.expenses,deleted:S.deleted||{}};}

/* ---------- sync engine ---------- */
var key=null,uid=null,salt=null,timer=null,busy=false,again=false,changedByRemote=false;
var sync={state:"local"};
window.__sync=sync;
var LBL={ok:["מסונכרן","var(--ok)"],syncing:["מסנכרן...","var(--warn)"],pending:["ממתין לסנכרון","var(--warn)"],offline:["אין חיבור, נשמר במכשיר","var(--ink-3)"],error:["שגיאת סנכרון","var(--bad)"]};
function setState(st){sync.state=st;var l=LBL[st];if(!l)return;document.querySelectorAll(".syncb").forEach(function(b){b.style.color=l[1];b.innerHTML='<i style="background:'+l[1]+'"></i>'+l[0];});}
function markDirty(){var m=meta();m.dirtyAt=Date.now();setMeta(m);}
function fetchRow(){return sb.from("vault").select("salt,iv,data,rev").eq("user_id",uid).maybeSingle().then(function(r){if(r.error)throw r.error;return r.data;});}
function applyRemote(row){
  return decrypt(key,row).then(function(remote){
    var S=app.getState();if(app.stamp())markDirty();
    var merged=merge(S,remote);
    changedByRemote=true;
    app.replaceState(merged);
    var m=meta();m.rev=row.rev;setMeta(m);
  });
}
function run(){
  if(!key||!uid)return Promise.resolve();
  if(busy){again=true;return Promise.resolve();}
  if(!navigator.onLine){setState("offline");return Promise.resolve();}
  busy=true;setState("syncing");
  var tries=0,t0=Date.now();changedByRemote=false;
  function attempt(){
    tries++;
    return fetchRow().then(function(row){
      var m=meta();
      var pre=row&&row.rev!==m.rev?applyRemote(row):Promise.resolve();
      return pre.then(function(){
        if(app.stamp())markDirty();
        var S=app.getState();
        return encrypt(key,payload(S)).then(function(c){
          if(!row){
            return sb.from("vault").insert({user_id:uid,salt:salt,iv:c.iv,data:c.data,rev:1}).select("rev").then(function(r){if(r.error)throw r.error;var mm=meta();mm.rev=1;setMeta(mm);});
          }
          var cur=meta().rev;
          if(!meta().dirtyAt){return;}
          return sb.from("vault").update({iv:c.iv,data:c.data,rev:cur+1,updated_at:new Date().toISOString()}).eq("user_id",uid).eq("rev",cur).select("rev").then(function(r){
            if(r.error)throw r.error;
            if(!r.data||!r.data.length){if(tries<4)return attempt();throw new Error("conflict");}
            var mm=meta();mm.rev=r.data[0].rev;setMeta(mm);
          });
        });
      });
    });
  }
  return attempt().then(function(){
    var mm=meta();if(mm.dirtyAt&&mm.dirtyAt<=t0)delete mm.dirtyAt;setMeta(mm);
    app.saveLocal();busy=false;setState(mm.dirtyAt?"pending":"ok");if(changedByRemote)app.render();
    if(again){again=false;run();}
  },function(e){
    busy=false;console.warn("sync",e&&e.message);
    setState(navigator.onLine?"error":"offline");
    if(again){again=false;setTimeout(run,3000);}
  });
}
sync.soon=function(){markDirty();if(!key)return;setState("pending");clearTimeout(timer);timer=setTimeout(run,1200);};
sync.now=run;
sync.logout=function(){
  var box=document.createElement("div");
  box.className="scrim";box.setAttribute("dir","rtl");
  box.innerHTML='<div class="sheet"><h3>התנתקות מהמכשיר</h3><p style="color:var(--ink-2)">המידע נשאר שמור ומוצפן בענן. כדי להיכנס שוב צריך את המייל והסיסמה.</p><div class="foot"><button class="btn danger" id="lo_y">התנתקות</button><button class="btn ghost" id="lo_n">ביטול</button></div></div>';
  document.querySelectorAll(".scrim").forEach(function(x){x.remove();});
  document.body.appendChild(box);
  box.querySelector("#lo_n").onclick=function(){box.remove();};
  box.querySelector("#lo_y").onclick=function(){
    run().finally(function(){
      sb.auth.signOut().finally(function(){keyClear().then(function(){try{localStorage.removeItem("chen-clinic-v2");localStorage.removeItem(META);}catch(e){}location.reload();});});
    });
  };
};
setInterval(function(){if(key&&document.visibilityState==="visible")run();},60000);
document.addEventListener("visibilitychange",function(){if(key&&document.visibilityState==="visible")run();});
window.addEventListener("online",function(){if(key)run();});

/* ---------- login screen ---------- */
var gate=null;
function showGate(mode,msg){
  if(!gate){gate=document.createElement("div");gate.className="lock gate";gate.setAttribute("dir","rtl");document.body.appendChild(gate);}
  var email=(meta().email||CFG.email||"");
  var esc=app.esc;
  var h='<h1>הקליניקה של חן</h1>';
  if(mode==="login"||mode==="signup"){
    h+='<form id="lg" class="gatef"><div class="f"><label for="lg_e">מייל</label><input id="lg_e" type="email" autocomplete="username" required value="'+esc(email)+'" dir="ltr"></div>';
    h+='<div class="f"><label for="lg_p">סיסמה</label><input id="lg_p" type="password" autocomplete="'+(mode==="signup"?"new-password":"current-password")+'" required minlength="8" dir="ltr"></div>';
    if(mode==="signup")h+='<div class="f"><label for="lg_p2">הסיסמה שוב</label><input id="lg_p2" type="password" autocomplete="new-password" required minlength="8" dir="ltr"></div><div class="warnbox" style="background:var(--sun-soft);color:var(--ink)">הסיסמה מצפינה את המידע. אם היא תישכח אין דרך לשחזר אותה, גם לא לנו. כדאי לשמור אותה במקום בטוח.</div>';
    if(msg)h+='<div class="warnbox">'+esc(msg)+"</div>";
    h+='<button class="btn block" type="submit" id="lg_b">'+(mode==="signup"?"יצירת חשבון":"כניסה")+'</button>';
    h+='<button class="link" type="button" id="lg_sw" style="margin-top:14px">'+(mode==="signup"?"כבר יש לי חשבון":"כניסה ראשונה? יצירת חשבון")+"</button></form>";
  }else if(mode==="busy"){h+='<p style="color:var(--ink-2)">'+esc(msg||"רגע...")+"</p>";}
  gate.innerHTML=h;
  var f=gate.querySelector("#lg");if(!f)return;
  gate.querySelector("#lg_sw").onclick=function(){showGate(mode==="signup"?"login":"signup");};
  f.addEventListener("submit",function(e){e.preventDefault();
    var em=f.querySelector("#lg_e").value.trim().toLowerCase(),pw=f.querySelector("#lg_p").value;
    if(mode==="signup"&&pw!==f.querySelector("#lg_p2").value){showGate(mode,"הסיסמאות לא זהות");return;}
    if(pw.length<8){showGate(mode,"סיסמה של 8 תווים לפחות");return;}
    showGate("busy","מתחברת בצורה מאובטחת...");
    authPassword(em,pw).then(function(ap){
      var p=mode==="signup"?sb.auth.signUp({email:em,password:ap}):sb.auth.signInWithPassword({email:em,password:ap});
      return p.then(function(r){
        if(r.error)throw r.error;
        if(!r.data.session)throw new Error("confirm");
        var m=meta();m.email=em;setMeta(m);
        return unlockData(r.data.session.user.id,pw,mode==="signup");
      });
    }).catch(function(err){
      var t=(err&&err.message)||"";
      var msg=/Invalid login/i.test(t)?"מייל או סיסמה לא נכונים":/already registered/i.test(t)?"החשבון כבר קיים. אפשר להיכנס":/confirm/i.test(t)?"צריך לאשר את המייל. בדקי את תיבת הדואר":/not allowed|Signups/i.test(t)?"ההרשמה סגורה. אפשר רק להיכנס":/decrypt|OperationError/i.test(t)?"הסיסמה לא פותחת את המידע":!navigator.onLine?"אין חיבור לאינטרנט":"לא הצלחתי להתחבר: "+t;
      showGate(mode,msg);
    });
  });
  setTimeout(function(){var i=gate.querySelector(email?"#lg_p":"#lg_e");if(i)i.focus();},50);
}
function hideGate(){if(gate){gate.remove();gate=null;}}

function unlockData(userId,pw,isNew){
  uid=userId;
  return fetchRow().then(function(row){
    if(row){
      salt=row.salt;
      return dataKey(pw,unb64(row.salt)).then(function(k){
        return decrypt(k,row).then(function(){key=k;return keyPut(uid,k);},function(){throw new Error("decrypt");});
      }).then(function(){return applyRemote(row);});
    }
    var sv=crypto.getRandomValues(new Uint8Array(16));salt=b64(sv);markDirty();
    return dataKey(pw,sv).then(function(k){key=k;return keyPut(uid,k);});
  }).then(function(){
    var m=meta();m.uid=uid;m.salt=salt;setMeta(m);
    hideGate();app.start();return run();
  });
}

/* ---------- boot ---------- */
function boot(){
  if(!sb||!window.crypto||!crypto.subtle){showGate("busy","הדפדפן הזה לא תומך בהצפנה. נסי Safari או Chrome מעודכנים.");return;}
  var m=meta();
  sb.auth.getSession().then(function(r){
    var s=r.data&&r.data.session;
    if(!s){showGate(m.email?"login":"signup");return;}
    uid=s.user.id;
    if(m.uid&&m.uid!==uid){try{localStorage.removeItem("chen-clinic-v2");}catch(e){}}
    return keyGet(uid).then(function(k){
      if(!k){showGate("login","כדי לפתוח את המידע במכשיר הזה צריך להקליד סיסמה");return;}
      key=k;salt=m.salt;
      app.start();run();
    });
  }).catch(function(){
    // offline with a cached session: open local data read/write, sync later
    if(m.uid){uid=m.uid;keyGet(uid).then(function(k){if(k){key=k;salt=m.salt;app.start();setState("offline");}else showGate("login");});}
    else showGate("login");
  });
}
boot();
})();
