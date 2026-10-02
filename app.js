
(function(){
"use strict";
document.documentElement.lang="he";
document.documentElement.dir="rtl";

/* ---------- storage ---------- */
var KEY="chen-clinic-v2";
var storageOk=true;
function blank(){return{v:1,settings:{name:"חן",price:300,dur:45,dayStart:8,dayEnd:20,chargeNoShow:false,employer:"",pinHash:"",lastBackup:0},patients:[],sessions:[],expenses:[],demo:false};}
var S;
try{var raw=localStorage.getItem(KEY);S=raw?JSON.parse(raw):null;}catch(e){storageOk=false;S=null;}
var firstRun=!S;
if(!S){S=blank();}
S.settings=Object.assign(blank().settings,S.settings||{});
S.patients=S.patients||[];S.sessions=S.sessions||[];S.expenses=S.expenses||[];
S.deleted=S.deleted||{};
var COLS=["patients","sessions","expenses"];
var H=null;
function snapKey(o){var c=Object.assign({},o);delete c.u;return JSON.stringify(c);}
function setKey(st){var c=Object.assign({},st);delete c.pinHash;delete c.lastBackup;return JSON.stringify(c);}
function initH(){H={settings:setKey(S.settings)};COLS.forEach(function(k){H[k]={};S[k].forEach(function(it){H[k][it.id]=snapKey(it);});});}
function stamp(){
  if(!H)initH();
  var now=Date.now(),changed=false;
  COLS.forEach(function(k){
    var seen={};
    S[k].forEach(function(it){seen[it.id]=1;var j=snapKey(it);if(H[k][it.id]!==j){it.u=now;H[k][it.id]=j;changed=true;}});
    Object.keys(H[k]).forEach(function(id){if(!seen[id]){S.deleted[id]=now;delete H[k][id];changed=true;}});
  });
  var sk=setKey(S.settings);if(H.settings!==sk){S.settingsU=now;H.settings=sk;changed=true;}
  return changed;
}
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){storageOk=false;}}
function save(){var c=stamp();saveLocal();if(c&&window.__sync)window.__sync.soon();}

var UI={tab:"today",sel:ymd(new Date()),pid:null,month:ymd(new Date()).slice(0,7),filter:"active",q:"",unlocked:false,cv:"day"};
try{var cv0=localStorage.getItem("chen-cv");if(cv0)UI.cv=cv0;}catch(e){}
try{var t=sessionStorage.getItem("chen-tab");if(t)UI.tab=t;}catch(e){}

/* ---------- helpers ---------- */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function pad(n){return(n<10?"0":"")+n;}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function pd(s){var a=s.split("-");return new Date(+a[0],+a[1]-1,+a[2]);}
function addDays(s,n){var d=pd(s);d.setDate(d.getDate()+n);return ymd(d);}
function toMin(t){var a=t.split(":");return(+a[0])*60+(+a[1]);}
function fromMin(m){return pad(Math.floor(m/60))+":"+pad(m%60);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function money(n){return"₪"+Math.round(n||0).toLocaleString("he-IL");}
var DAYS=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
var DAYS_S=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
var MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
function niceDate(s){var d=pd(s);return"יום "+DAYS[d.getDay()]+", "+d.getDate()+" ב"+MONTHS[d.getMonth()];}
function shortDate(s){var d=pd(s);return d.getDate()+"."+(d.getMonth()+1);}
function monthName(m){var a=m.split("-");return MONTHS[+a[1]-1]+" "+a[0];}
function today(){return ymd(new Date());}
function nowMin(){var d=new Date();return d.getHours()*60+d.getMinutes();}
var COLORS=["#23675A","#D0703C","#4A6FB5","#B5487A","#7A62C4","#3C8FA8","#9A7B1E","#5E8A3A"];
function sc(s){return {done:"#17864F",noshow:"#D93025",cancel:"#9AA0A6"}[s&&s.status]||"#F08C00";}
function pc(p){return (S.settings.oneColor!==false)?"#17864F":(p&&p.color)||"#999";}
function futureOf(s){var wd=pd(s.date).getDay();return S.sessions.filter(function(o){return o.id!==s.id&&o.pid===s.pid&&o.date>s.date&&o.status==="scheduled"&&((s.series&&o.series===s.series)||(pd(o.date).getDay()===wd&&o.time===s.time));});}
function P(id){for(var i=0;i<S.patients.length;i++)if(S.patients[i].id===id)return S.patients[i];return null;}
function SS(id){for(var i=0;i<S.sessions.length;i++)if(S.sessions[i].id===id)return S.sessions[i];return null;}
function initials(n){n=(n||"?").trim();var p=n.split(/\s+/);return(p[0][0]||"")+(p[1]?p[1][0]:"");}
function age(b){if(!b)return"";var d=pd(b),n=new Date();var m=(n.getFullYear()-d.getFullYear())*12+n.getMonth()-d.getMonth();if(n.getDate()<d.getDate())m--;if(m<0)return"";var y=Math.floor(m/12),r=m%12;return"גיל "+y+(r?" ו-"+r+" ח׳":"");}
function billable(s){return s.status==="done"||((s.status==="noshow"||s.status==="cancel")&&s.charge);}
function sortS(a,b){return(a.date+a.time)<(b.date+b.time)?-1:1;}
function sessionsOn(d){return S.sessions.filter(function(s){return s.date===d;}).sort(sortS);}
function owed(pid){return S.sessions.filter(function(s){return(!pid||s.pid===pid)&&billable(s)&&!s.paid;}).reduce(function(a,s){return a+(+s.price||0);},0);}
function clashes(s){var a=toMin(s.time),b=a+(+s.dur||45);return S.sessions.some(function(o){if(o.id===s.id||o.date!==s.date||o.status==="cancel")return false;var c=toMin(o.time),d=c+(+o.dur||45);return a<d&&c<b;});}
function nextSession(pid){var t=today(),n=nowMin();return S.sessions.filter(function(s){return s.pid===pid&&s.status==="scheduled"&&(s.date>t||(s.date===t&&toMin(s.time)>=n));}).sort(sortS)[0];}
function waPhone(p){var d=(p||"").replace(/\D/g,"");if(d.indexOf("0")===0)d="972"+d.slice(1);return d;}
var STATUS={scheduled:["מתוכנן","p-sched"],done:["בוצע","p-done"],cancel:["בוטל","p-cancel"],noshow:["לא הגיע","p-noshow"]};
function statusPill(s){var x=STATUS[s.status]||STATUS.scheduled;return'<span class="pill '+x[1]+'">'+x[0]+"</span>";}
function payPill(s){if(!billable(s))return"";return s.paid?'<span class="pill p-paid">שולם</span>':'<span class="pill p-owe">'+money(s.price)+" לגבייה</span>";}

/* ---------- icons ---------- */
var I={
home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
kids:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M16 14.3c2.9-.4 5 1.8 5 4.7"/></svg>',
wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/></svg>',
gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
search:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
};

/* ---------- demo data ---------- */
function seedDemo(){
  var t=today(),kids=[
    ["נועם לוי","2019-03-12","דנה לוי","050-1234567","טיפול באומנות פרטני","דרך המעסיק",250,"ביטוי רגשי דרך ציור, התמודדות עם תסכול"],
    ["מאיה כהן","2018-11-02","רועי כהן","052-7654321","טיפול באומנות פרטני","דרך המעסיק",250,"הסתגלות למסגרת חדשה, עבודה בחימר"],
    ["איתי מזרחי","2020-06-21","לימור מזרחי","054-2223344","טיפול באומנות פרטני","פרטי",320,"ויסות רגשי, משחק סימבולי"],
    ["שירה אברהם","2017-09-30","מיכל אברהם","053-9988776","טיפול באומנות פרטני","דרך המעסיק",250,"דימוי עצמי, עבודה בקולאז׳"],
    ["יונתן פרץ","2019-12-08","אבי פרץ","058-4567890","הדרכת הורים","פרטי",300,"כלים להורים סביב גבולות בבית"]
  ];
  var times=["14:00","15:00","16:00","17:00","16:00"],wd=[0,1,2,3,1];
  kids.forEach(function(k,i){
    var p={id:uid()+i,name:k[0],birth:k[1],parent:k[2],phone:k[3],type:k[4],payer:k[5],price:k[6],goals:k[7],status:"active",color:COLORS[i%COLORS.length],notes:[{id:uid(),date:addDays(t,-14),text:"פגישת היכרות. ההורים מדווחים על שיפור בבית."}],created:Date.now(),demo:true};
    S.patients.push(p);
    var d0=pd(t);d0.setDate(d0.getDate()-d0.getDay()+wd[i]-28);
    var series=uid();
    for(var w=0;w<8;w++){
      var d=ymd(new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()+w*7));
      var past=d<t;
      var st=past?"done":"scheduled";
      if(past&&i===2&&w===1)st="noshow";
      if(past&&i===4&&w===2)st="cancel";
      S.sessions.push({id:uid()+i+w,pid:p.id,date:d,time:times[i],dur:45,price:p.price,status:st,charge:st==="noshow",paid:past&&!(i===1&&w>=2)&&!(i===3&&w===3),method:"ביט",note:past&&st==="done"&&w%2?"עבדנו על "+k[7].split(",")[0]+". שיתוף פעולה טוב.":"",series:series,demo:true});
    }
  });
  S.expenses.push({id:uid(),date:t.slice(0,7)+"-01",label:"שכירות חדר טיפולים",amount:1800,demo:true});
  S.expenses.push({id:uid(),date:t.slice(0,7)+"-05",label:"חומרים ומשחקים",amount:240,demo:true});
  S.demo=true;
}
/* no demo seeding in the synced version */
if(false){S.patients=S.patients.filter(function(p){return!p.demo;});S.sessions=S.sessions.filter(function(x){return!x.demo;});S.expenses=S.expenses.filter(function(x){return!x.demo;});seedDemo();S.demoV=2;save();}

/* ---------- render ---------- */
var app=document.getElementById("app"),tabs=document.getElementById("tabs");
function render(){
  try{sessionStorage.setItem("chen-tab",UI.tab);}catch(e){}
  var h="";
  if(UI.tab==="today")h=vToday();
  else if(UI.tab==="cal")h=vCal();
  else if(UI.tab==="kids")h=UI.pid?vPatient(P(UI.pid)):vPatients();
  else if(UI.tab==="money")h=vMoney();
  app.innerHTML=h;
  tabs.innerHTML='<div class="in">'+[["today","היום",I.home],["cal","יומן",I.cal],["kids","מטופלים",I.kids],["money","כספים",I.wallet]].map(function(x){return'<button data-act="nav" data-v="'+x[0]+'" class="'+(UI.tab===x[0]?"on":"")+'" aria-label="'+x[1]+'">'+x[2]+"<span>"+x[1]+"</span></button>";}).join("")+"</div>";
  var fab=document.getElementById("fab");
  if(!fab){fab=document.createElement("button");fab.id="fab";fab.className="fab";fab.setAttribute("aria-label","טיפול חדש");fab.innerHTML=I.plus;document.body.appendChild(fab);}
  fab.dataset.act=(UI.tab==="kids"&&!UI.pid)?"new-patient":"new-session";
  fab.setAttribute("aria-label",fab.dataset.act==="new-patient"?"מטופל חדש":"טיפול חדש");
  if(UI.tab==="cal"){var tl=document.querySelector(".timeline");var nl=document.querySelector(".nowline");if(nl&&!render._scrolled){nl.scrollIntoView({block:"center"});render._scrolled=true;}}
}
function syncBadge(){var st=window.__sync?window.__sync.state:"local";var m={ok:["מסונכרן","var(--ok)"],syncing:["מסנכרן...","var(--warn)"],pending:["ממתין לסנכרון","var(--warn)"],offline:["אין חיבור, נשמר במכשיר","var(--ink-3)"],error:["שגיאת סנכרון","var(--bad)"],local:["",""]}[st]||["",""];return m[0]?'<span class="syncb" style="color:'+m[1]+'"><i style="background:'+m[1]+'"></i>'+m[0]+"</span>":"";}
function top(title,sub){return'<header class="top"><div><h1>'+title+'</h1>'+(sub?'<div class="sub">'+sub+" "+syncBadge()+"</div>":'<div class="sub">'+syncBadge()+"</div>")+'</div><button class="icon-btn" data-act="settings" aria-label="הגדרות">'+I.gear+"</button></header>";}

function sRow(s,opts){
  opts=opts||{};var p=P(s.pid)||{name:"(נמחק)",color:"#999"};
  var acts="";
  if(opts.quick&&s.status==="scheduled")acts='<div class="actions"><span class="mini ok" data-act="st" data-id="'+s.id+'" data-v="done">בוצע ✓</span></div>';
  else if(opts.quick&&billable(s)&&!s.paid)acts='<div class="actions"><span class="mini acc" data-act="paid" data-id="'+s.id+'">סמני שולם</span></div>';
  return'<button class="row" data-act="edit-session" data-id="'+s.id+'"><div class="time num">'+s.time+(opts.date?"<small>"+shortDate(s.date)+"</small>":"<small>"+s.dur+" דק׳</small>")+'</div><span class="dot" style="background:'+sc(s)+'"></span><div class="grow"><div class="t">'+esc(p.name)+'</div><div class="m">'+statusPill(s)+" "+payPill(s)+(s.note?" · "+esc(s.note):"")+"</div></div>"+acts+"</button>";
}

function vToday(){
  var t=today(),d=new Date(),hr=d.getHours();
  var greet=hr<12?"בוקר טוב":hr<17?"צהריים טובים":"ערב טוב";
  var list=sessionsOn(t);
  var ws=addDays(t,-d.getDay()),we=addDays(ws,6);
  var week=S.sessions.filter(function(s){return s.date>=ws&&s.date<=we&&s.status!=="cancel";});
  var weekInc=S.sessions.filter(function(s){return s.date>=ws&&s.date<=we&&(billable(s)||s.status==="scheduled");}).reduce(function(a,s){return a+(+s.price||0);},0);
  var stale=S.sessions.filter(function(s){return s.status==="scheduled"&&(s.date<t||(s.date===t&&toMin(s.time)+(+s.dur)<nowMin()));}).sort(sortS);
  var debt={};S.sessions.forEach(function(s){if(billable(s)&&!s.paid){debt[s.pid]=(debt[s.pid]||0)+(+s.price||0);}});
  var debtors=Object.keys(debt).map(function(k){return[k,debt[k]];}).sort(function(a,b){return b[1]-a[1];});
  var tom=sessionsOn(addDays(t,1)).filter(function(s){return s.status==="scheduled";});
  var h=top(greet+", "+esc(S.settings.name),niceDate(t));
  if(!storageOk)h+='<div class="banner bad">הדפדפן חוסם שמירה. נתונים לא יישמרו עד שתאפשרי אחסון אתרים.</div>';
  if(S.demo)h+='<div class="banner"><span>אלה נתוני דוגמה כדי לראות איך זה עובד.</span><button class="mini" data-act="clear-demo">התחילי נקי</button></div>';
  var lb=S.settings.lastBackup;
  if(!S.demo&&S.patients.length&&(!lb||Date.now()-lb>30*864e5))h+='<div class="banner"><span>לא נשמר גיבוי '+(lb?"כבר "+Math.floor((Date.now()-lb)/864e5)+" ימים":"עדיין")+'.</span><button class="mini" data-act="backup">גיבוי עכשיו</button></div>';
  h+='<section class="stats"><div class="stat hl"><b class="num">'+list.filter(function(s){return s.status!=="cancel";}).length+'</b><span>טיפולים היום</span></div><div class="stat"><b class="num">'+week.length+'</b><span>השבוע</span></div><div class="stat"><b class="num">'+money(owed())+'</b><span>פתוח לגבייה</span></div></section>';
  h+='<section><h2>הלו״ז של היום <small class="num">'+money(list.filter(function(s){return s.status!=="cancel";}).reduce(function(a,s){return a+(+s.price||0);},0))+"</small></h2>";
  h+=list.length?'<div class="list">'+list.map(function(s){return sRow(s,{quick:true});}).join("")+"</div>":'<div class="empty">אין טיפולים היום. <button class="link" data-act="new-session">קביעת טיפול</button></div>';
  h+="</section>";
  if(stale.length){h+='<section><h2>לעדכן סטטוס <small>'+stale.length+" טיפולים שעברו</small></h2><div class=\"list\">"+stale.slice(0,6).map(function(s){var p=P(s.pid)||{name:"",color:"#999"};return'<div class="row"><div class="time num">'+s.time+"<small>"+shortDate(s.date)+'</small></div><span class="dot" style="background:'+sc(s)+'"></span><div class="grow"><div class="t">'+esc(p.name)+'</div></div><div class="actions"><button class="mini ok" data-act="st" data-id="'+s.id+'" data-v="done">בוצע</button><button class="mini bad" data-act="st" data-id="'+s.id+'" data-v="noshow">לא הגיע</button></div></div>';}).join("")+"</div></section>";}
  if(tom.length){h+='<section><h2>מחר <small>תזכורות להורים</small></h2><div class="list">'+tom.map(function(s){var p=P(s.pid)||{name:"",color:"#999"};return'<div class="row"><div class="time num">'+s.time+'</div><span class="dot" style="background:'+sc(s)+'"></span><div class="grow"><div class="t">'+esc(p.name)+'</div><div class="m">'+esc(p.parent||"")+'</div></div><button class="mini" data-act="remind" data-id="'+s.id+'">תזכורת</button></div>';}).join("")+"</div></section>";}
  if(debtors.length){h+='<section><h2>חובות פתוחים <small class="num">'+money(owed())+'</small></h2><div class="list">'+debtors.slice(0,5).map(function(x){var p=P(x[0])||{name:"(נמחק)",color:"#999"};return'<button class="row" data-act="open-patient" data-id="'+x[0]+'"><div class="av" style="background:'+pc(p)+'">'+esc(initials(p.name))+'</div><div class="grow"><div class="t">'+esc(p.name)+'</div><div class="m">'+esc(p.payer||"")+'</div></div><span class="pill p-owe num">'+money(x[1])+"</span></button>";}).join("")+"</div></section>";}
  return h;
}

function calSeg(){return'<div class="seg" style="margin-bottom:12px">'+[["day","יום"],["week","שבוע"],["month","חודש"]].map(function(x){return'<button data-act="cv" data-v="'+x[0]+'" class="'+(UI.cv===x[0]?"on":"")+'">'+x[1]+"</button>";}).join("")+"</div>";}
function calNav(label,v){return'<div class="monthbar" style="margin-bottom:8px"><button class="arrow" data-act="cal-shift" data-v="-1" aria-label="הקודם">'+I.right+'</button><b class="num" style="flex:1;text-align:center;font-size:17px">'+label+'</b><button class="mini" data-act="day" data-v="'+today()+'">היום</button><button class="arrow" data-act="cal-shift" data-v="1" aria-label="הבא">'+I.left+"</button></div>";}
function sumLine(list){var live=list.filter(function(s){return s.status!=="cancel";});return'<div style="color:var(--ink-3);font-size:14px;margin:0 0 8px">'+live.length+" טיפולים · "+money(live.reduce(function(a,s){return a+(+s.price||0);},0))+"</div>";}
function vCalWeek(){
  var sel=UI.sel,ws=addDays(sel,-pd(sel).getDay()),we=addDays(ws,6),t=today();
  var a=pd(ws),b=pd(we);
  var label=a.getMonth()===b.getMonth()?a.getDate()+"-"+b.getDate()+" ב"+MONTHS[a.getMonth()]:shortDate(ws)+" - "+shortDate(we);
  var h=top("יומן",monthName(sel.slice(0,7)))+calSeg()+calNav(label);
  var all=S.sessions.filter(function(s){return s.date>=ws&&s.date<=we;});
  h+=sumLine(all);
  var st=+S.settings.dayStart,en=+S.settings.dayEnd;
  all.forEach(function(s){var x=Math.floor(toMin(s.time)/60),y=Math.ceil((toMin(s.time)+(+s.dur))/60);if(x<st)st=x;if(y>en)en=y;});
  var HH=52,H=(en-st)*HH;
  h+='<div class="wkgrid card"><div class="wkhead"><span></span>';
  for(var i=0;i<7;i++){var dd=addDays(ws,i);h+='<button class="wkd'+(dd===t?" today":"")+'" data-act="day-open" data-v="'+dd+'"><span>'+DAYS_S[i]+'</span><b class="num">'+pd(dd).getDate()+"</b></button>";}
  h+='</div><div class="wkbody" style="height:'+H+'px;background-size:100% '+HH+'px"><div class="wktimes">';
  for(var hh=st;hh<en;hh++)h+='<span class="num" style="top:'+((hh-st)*HH)+'px">'+pad(hh)+"</span>";
  h+="</div>";
  for(i=0;i<7;i++){var d2=addDays(ws,i);
    h+='<div class="wkcol'+(d2===t?" today":"")+'" data-act="slot" data-date="'+d2+'" data-start="'+st+'" data-hh="'+HH+'">';
    sessionsOn(d2).forEach(function(s){var p=P(s.pid)||{name:"?",color:"#999"};var tp=(toMin(s.time)-st*60)/60*HH,ht=Math.max(22,(+s.dur)/60*HH-2);
      var cls=s.status==="done"?" done":s.status==="cancel"?" cancel":s.status==="noshow"?" noshow":" sched";
      h+='<button class="wev'+cls+'" data-act="edit-session" data-id="'+s.id+'" style="top:'+(tp+1)+"px;height:"+ht+"px;background:"+sc(s)+'"><span class="num">'+s.time+"</span>"+esc((p.name||"").split(" ")[0])+"</button>";});
    if(d2===t){var nm=nowMin();if(nm>=st*60&&nm<=en*60)h+='<div class="wknow" style="top:'+((nm-st*60)/60*HH)+'px"></div>';}
    h+="</div>";}
  h+="</div></div>";
  return h;
}
function vCalMonth(){
  var sel=UI.sel,m=sel.slice(0,7),first=m+"-01",t=today();
  var start=addDays(first,-pd(first).getDay());
  var h=top("יומן",m.slice(0,4))+calSeg()+calNav(monthName(m));
  var inMonth=S.sessions.filter(function(s){return s.date.slice(0,7)===m;});
  h+=sumLine(inMonth);
  h+='<div class="mgrid card"><div class="mhead">'+DAYS_S.map(function(x){return"<span>"+x+"</span>";}).join("")+'</div><div class="mbody">';
  var weeks=Math.ceil((pd(first).getDay()+new Date(+m.slice(0,4),+m.slice(5,7),0).getDate())/7);
  for(var i=0;i<weeks*7;i++){var dd=addDays(start,i),list=sessionsOn(dd).filter(function(s){return s.status!=="cancel";});
    var out=dd.slice(0,7)!==m;
    h+='<button class="mday'+(out?" out":"")+(dd===t?" today":"")+'" data-act="day-open" data-v="'+dd+'"><b class="num">'+pd(dd).getDate()+'</b><span class="mdots">'+list.slice(0,4).map(function(s){var p=P(s.pid)||{color:"#999"};return'<i style="background:'+sc(s)+'"></i>';}).join("")+"</span>"+(list.length?'<small class="num">'+list.length+"</small>":"")+"</button>";}
  h+="</div></div>";
  var byPat={};inMonth.forEach(function(s){if(s.status!=="cancel")byPat[s.pid]=(byPat[s.pid]||0)+1;});
  var ks=Object.keys(byPat).sort(function(a,b){return byPat[b]-byPat[a];});
  if(ks.length)h+='<section><h2>טיפולים החודש לפי מטופל</h2><div class="list">'+ks.map(function(k){var p=P(k)||{name:"(נמחק)",color:"#999"};return'<button class="row" data-act="open-patient" data-id="'+k+'"><span class="dot" style="background:'+pc(p)+'"></span><div class="grow"><div class="t">'+esc(p.name)+'</div></div><b class="num">'+byPat[k]+"</b></button>";}).join("")+"</div></section>";
  return h;
}
function vCal(){
  if(UI.cv==="week")return vCalWeek();
  if(UI.cv==="month")return vCalMonth();
  var sel=UI.sel,d=pd(sel),ws=addDays(sel,-d.getDay()),t=today();
  var h=top("יומן",monthName(sel.slice(0,7)))+calSeg();
  h+='<div class="weekbar"><button class="arrow" data-act="week" data-v="-7" aria-label="שבוע קודם">'+I.right+'</button><div class="week">';
  for(var i=0;i<7;i++){var dd=addDays(ws,i),n=sessionsOn(dd).filter(function(s){return s.status!=="cancel";}).length;
    h+='<button class="wd'+(dd===t?" today":"")+(dd===sel?" sel":"")+'" data-act="day" data-v="'+dd+'"><span class="l">'+DAYS_S[i]+'</span><span class="n num">'+pd(dd).getDate()+'</span><span class="c">'+new Array(Math.min(n,4)+1).join("<i></i>")+"</span></button>";}
  h+='</div><button class="arrow" data-act="week" data-v="7" aria-label="שבוע הבא">'+I.left+"</button></div>";
  var list=sessionsOn(sel),live=list.filter(function(s){return s.status!=="cancel";});
  h+='<div class="dayhead"><b>'+niceDate(sel)+'</b><span class="actions">'+(sel!==t?'<button class="mini" data-act="day" data-v="'+t+'">היום</button>':"")+'<input id="jump" class="mini" type="date" value="'+sel+'" aria-label="מעבר לתאריך" style="padding:5px 8px"></span></div>';
  h+='<div class="m" style="color:var(--ink-3);font-size:14px;margin-top:2px">'+live.length+" טיפולים · "+money(live.reduce(function(a,s){return a+(+s.price||0);},0))+" · לחיצה על שעה פנויה קובעת טיפול</div>";
  var st=+S.settings.dayStart,en=+S.settings.dayEnd;
  list.forEach(function(s){var a=Math.floor(toMin(s.time)/60),b=Math.ceil((toMin(s.time)+(+s.dur))/60);if(a<st)st=a;if(b>en)en=b;});
  var HH=64;
  h+='<div class="timeline" data-act="slot" data-date="'+sel+'" data-start="'+st+'" style="height:'+(en-st)*HH+'px">';
  for(var hh=st;hh<en;hh++)h+='<div class="hr"><span class="num">'+pad(hh)+":00</span></div>";
  list.forEach(function(s){var p=P(s.pid)||{name:"(נמחק)",color:"#999"};var top_=(toMin(s.time)-st*60)/60*HH,ht=Math.max(30,(+s.dur)/60*HH-3);
    var cls=s.status==="done"?" done":s.status==="cancel"?" cancel":s.status==="noshow"?" noshow":" sched";
    if(s.status!=="cancel"&&clashes(s))cls+=" clash";
    h+='<button class="ev'+cls+'" data-act="edit-session" data-id="'+s.id+'" style="top:'+(top_+1)+"px;height:"+ht+"px;border-inline-start-color:"+sc(s)+'"><b>'+esc(p.name)+'</b><span class="num">'+s.time+"-"+fromMin(toMin(s.time)+(+s.dur))+" · "+(STATUS[s.status]||STATUS.scheduled)[0]+"</span></button>";});
  if(sel===t){var nm=nowMin();if(nm>=st*60&&nm<=en*60)h+='<div class="nowline" style="top:'+((nm-st*60)/60*HH)+'px"></div>';}
  h+="</div>";
  return h;
}

function vPatients(){
  var q=UI.q.trim(),f=UI.filter;
  var list=S.patients.filter(function(p){return(f==="all"||p.status===f)&&(!q||(p.name+" "+(p.parent||"")+" "+(p.type||"")).indexOf(q)>-1);}).sort(function(a,b){return a.name.localeCompare(b.name,"he");});
  var cnt=function(k){return S.patients.filter(function(p){return k==="all"||p.status===k;}).length;};
  var h=top("מטופלים",S.patients.filter(function(p){return p.status==="active";}).length+" פעילים");
  h+='<div class="search">'+I.search+'<input id="q" type="search" placeholder="חיפוש לפי שם ילד/הורה/סוג טיפול" value="'+esc(UI.q)+'"></div>';
  h+='<div class="chips">'+[["active","פעילים"],["paused","בהפסקה"],["done","סיימו"],["all","כולם"]].map(function(x){return'<button class="chip'+(f===x[0]?" on":"")+'" data-act="filter" data-v="'+x[0]+'">'+x[1]+" "+cnt(x[0])+"</button>";}).join("")+"</div>";
  h+='<section class="list">';
  if(!list.length)h+='<div class="empty">'+(S.patients.length?"לא נמצאו מטופלים":"עדיין אין מטופלים")+'. <button class="link" data-act="new-patient">הוספת מטופל</button></div>';
  list.forEach(function(p){var n=nextSession(p.id),o=owed(p.id);
    h+='<button class="row" data-act="open-patient" data-id="'+p.id+'"><div class="av" style="background:'+pc(p)+'">'+esc(initials(p.name))+'</div><div class="grow"><div class="t">'+esc(p.name)+' <span style="font-weight:500;color:var(--ink-3);font-size:13.5px">'+age(p.birth)+'</span></div><div class="m">'+esc(p.type||"")+(n?" · הבא: "+DAYS_S[pd(n.date).getDay()]+" "+shortDate(n.date)+" "+n.time:" · אין טיפול קבוע")+"</div></div>"+(o?'<span class="pill p-owe num">'+money(o)+"</span>":"")+"</button>";});
  h+="</section>";return h;
}

function vPatient(p){
  if(!p){UI.pid=null;return vPatients();}
  var all=S.sessions.filter(function(s){return s.pid===p.id;}).sort(sortS);
  var done=all.filter(function(s){return s.status==="done";}).length;
  var m=today().slice(0,7),thisM=all.filter(function(s){return s.date.slice(0,7)===m&&s.status==="done";}).length;
  var o=owed(p.id),n=nextSession(p.id);
  var noshow=all.filter(function(s){return s.status==="noshow";}).length;
  var h='<header class="top"><button class="icon-btn" data-act="back" aria-label="חזרה">'+I.right+'</button><button class="mini" data-act="edit-patient" data-id="'+p.id+'">עריכה</button></header>';
  h+='<div class="phead"><div class="av" style="background:'+pc(p)+'">'+esc(initials(p.name))+'</div><div><h1>'+esc(p.name)+'</h1><div class="sub" style="color:var(--ink-3)">'+[age(p.birth),esc(p.type||""),{active:"פעיל",paused:"בהפסקה",done:"סיים"}[p.status]].filter(Boolean).join(" · ")+"</div></div></div>";
  h+='<section class="stats"><div class="stat"><b class="num">'+done+'</b><span>טיפולים שבוצעו</span></div><div class="stat"><b class="num">'+thisM+'</b><span>החודש</span></div><div class="stat'+(o?" hl":"")+'"><b class="num">'+money(o)+'</b><span>לגבייה</span></div></section>';
  h+='<section class="actions"><button class="mini acc" data-act="new-session" data-pid="'+p.id+'">+ קביעת טיפול</button>'+(p.phone?'<a class="mini" href="https://wa.me/'+waPhone(p.phone)+'" target="_blank" rel="noopener">וואטסאפ להורה</a><button class="mini" data-act="copy" data-v="'+esc(p.phone)+'">העתקת טלפון</button>':"")+(o?'<button class="mini ok" data-act="pay-all" data-id="'+p.id+'">סימון הכל שולם</button>':"")+(p.payer!=="דרך המעסיק"?'<button class="mini" data-act="parent-sum" data-id="'+p.id+'">סיכום חודשי להורה</button>':"")+"</section>";
  h+='<section><h2>פרטים</h2><div class="card pad"><dl class="kv" style="margin:0">';
  [["הורה",p.parent],["טלפון",p.phone],["תאריך לידה",p.birth?shortDate(p.birth)+"."+p.birth.slice(0,4):""],["מסגרת",p.school],["מימון",p.payer],["מחיר לטיפול",money(p.price)],["טיפול הבא",n?niceDate(n.date)+" "+n.time:"לא נקבע"],["לא הגיע",noshow?noshow+" פעמים":""]].forEach(function(r){if(r[1])h+="<dt>"+r[0]+'</dt><dd class="num">'+esc(r[1])+"</dd>";});
  h+="</dl></div></section>";
  if(p.goals)h+='<section><h2>מטרות טיפול</h2><div class="note" style="border-color:var(--accent)"><p>'+esc(p.goals)+"</p></div></section>";
  var notes=(p.notes||[]).slice().sort(function(a,b){return a.date<b.date?1:-1;});
  var sn=all.filter(function(s){return s.note;}).map(function(s){return{date:s.date,text:s.note,sess:s.id};});
  var merged=notes.map(function(x){return{date:x.date,text:x.text,nid:x.id};}).concat(sn).sort(function(a,b){return a.date<b.date?1:-1;});
  h+='<section><h2>הערות ומעקב <button class="link" data-act="add-note" data-id="'+p.id+'">+ הערה</button></h2><div class="list">';
  if(!merged.length)h+='<div class="empty">אין הערות עדיין</div>';
  merged.slice(0,20).forEach(function(x){h+='<div class="note"><div class="d">'+shortDate(x.date)+"."+x.date.slice(2,4)+(x.sess?" · מתוך טיפול":"")+(x.nid?' · <button class="link" style="font-size:12.5px;color:var(--ink-3)" data-act="del-note" data-pid="'+p.id+'" data-id="'+x.nid+'">מחיקה</button>':"")+"</div><p>"+esc(x.text)+"</p></div>";});
  h+="</div></section>";
  h+='<section><h2>היסטוריית טיפולים <small>'+all.length+'</small></h2><div class="list">';
  if(!all.length)h+='<div class="empty">אין טיפולים עדיין</div>';
  all.slice().reverse().slice(0,40).forEach(function(s){h+=sRow(s,{date:true});});
  h+="</div></section>";
  return h;
}

function monthData(m){
  var ss=S.sessions.filter(function(s){return s.date.slice(0,7)===m;}).sort(sortS);
  var bill=ss.filter(billable);
  var inc=bill.reduce(function(a,s){return a+(+s.price||0);},0);
  var col=bill.filter(function(s){return s.paid;}).reduce(function(a,s){return a+(+s.price||0);},0);
  var plan=ss.filter(function(s){return s.status==="scheduled";}).reduce(function(a,s){return a+(+s.price||0);},0);
  var exp=S.expenses.filter(function(e){return e.date.slice(0,7)===m;});
  var ex=exp.reduce(function(a,e){return a+(+e.amount||0);},0);
  return{ss:ss,bill:bill,inc:inc,col:col,open:inc-col,plan:plan,exp:exp,ex:ex,profit:inc-ex,
    done:ss.filter(function(s){return s.status==="done";}).length,
    noshow:ss.filter(function(s){return s.status==="noshow";}).length,
    cancel:ss.filter(function(s){return s.status==="cancel";}).length};
}
function shiftMonth(m,n){var a=m.split("-");var d=new Date(+a[0],+a[1]-1+n,1);return d.getFullYear()+"-"+pad(d.getMonth()+1);}

function vMoney(){
  var m=UI.month,D=monthData(m);
  var h=top("כספים","רווח, גבייה והוצאות");
  h+='<div class="monthbar"><button class="arrow" data-act="month" data-v="-1" aria-label="חודש קודם">'+I.right+"</button><b>"+monthName(m)+'</b><button class="arrow" data-act="month" data-v="1" aria-label="חודש הבא">'+I.left+"</button></div>";
  h+='<div class="hero"><div class="l">רווח נקי לחודש</div><div class="v num">'+money(D.profit)+'</div><div class="s"><div>הכנסות<b class="num">'+money(D.inc)+'</b></div><div>נגבה<b class="num">'+money(D.col)+'</b></div><div>הוצאות<b class="num">'+money(D.ex)+"</b></div></div></div>";
  h+='<section class="stats"><div class="stat"><b class="num">'+D.done+'</b><span>טיפולים שבוצעו</span></div><div class="stat"><b class="num">'+money(D.open)+'</b><span>עוד לגבות</span></div><div class="stat"><b class="num">'+money(D.plan)+'</b><span>צפי מטיפולים מתוכננים</span></div></section>';
  // last 6 months bars
  var ms=[];for(var i=5;i>=0;i--)ms.push(shiftMonth(m,-i));
  var vals=ms.map(function(x){return monthData(x).profit;});var mx=Math.max.apply(null,vals.map(function(v){return Math.abs(v);}).concat([1]));
  h+='<section><h2>רווח לפי חודש</h2><div class="card"><div class="bars">'+ms.map(function(x,i){var v=vals[i];return'<div class="bar"><em class="num">'+(v?money(v):"")+'</em><i class="'+(x===m?"cur":"")+'" style="height:'+Math.max(3,Math.max(0,v)/mx*78)+'px"></i></div>';}).join("")+'</div><div class="barlab">'+ms.map(function(x){return"<span>"+MONTHS[+x.split("-")[1]-1].slice(0,3)+"</span>";}).join("")+"</div></div></section>";
  var empInc=D.bill.filter(function(s){var p=P(s.pid);return p&&p.payer==="דרך המעסיק";}).reduce(function(a,s){return a+(+s.price||0);},0);
  var empN=D.ss.filter(function(s){var p=P(s.pid);return p&&p.payer==="דרך המעסיק"&&s.status==="done";}).length;
  h+='<section class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><b class="num">'+money(D.inc-empInc)+'</b><span>הכנסה פרטית</span></div><div class="stat"><b class="num">'+money(empInc)+'</b><span>דרך המעסיק · '+empN+' טיפולים</span></div></section>';
  h+='<section class="list"><button class="btn block" data-act="export">דוח רווח חודשי (אקסל)</button><button class="btn block ghost" data-act="export-emp">דוח למעסיק (אקסל)</button></section>';
  // per patient
  var per={};D.bill.forEach(function(s){var r=per[s.pid]=per[s.pid]||{n:0,inc:0,open:0};r.n++;r.inc+=+s.price||0;if(!s.paid)r.open+=+s.price||0;});
  var keys=Object.keys(per).sort(function(a,b){return per[b].inc-per[a].inc;});
  h+='<section><h2>לפי מטופל</h2>';
  h+=keys.length?'<div class="card tablewrap"><table><thead><tr><th>מטופל</th><th>טיפולים</th><th>הכנסה</th><th>פתוח</th></tr></thead><tbody>'+keys.map(function(k){var p=P(k)||{name:"(נמחק)"};var r=per[k];return'<tr><td>'+esc(p.name)+'</td><td class="num">'+r.n+'</td><td class="num">'+money(r.inc)+'</td><td class="num" style="color:'+(r.open?"var(--warn)":"var(--ink-3)")+'">'+(r.open?money(r.open):"-")+"</td></tr>";}).join("")+"</tbody></table></div>":'<div class="empty">אין הכנסות בחודש הזה</div>';
  h+="</section>";
  h+='<section><h2>הוצאות <button class="link" data-act="add-expense">+ הוצאה</button></h2><div class="list">';
  if(!D.exp.length)h+='<div class="empty">אין הוצאות בחודש הזה</div>';
  D.exp.forEach(function(e){h+='<div class="row"><div class="grow"><div class="t">'+esc(e.label)+'</div><div class="m num">'+shortDate(e.date)+'</div></div><b class="num">'+money(e.amount)+'</b><button class="mini" data-act="del-expense" data-id="'+e.id+'" aria-label="מחיקה">✕</button></div>';});
  h+="</div></section>";
  if(D.noshow||D.cancel)h+='<section><div class="banner"><span>'+D.noshow+" לא הגיעו · "+D.cancel+" ביטולים החודש</span></div></section>";
  return h;
}

/* ---------- sheet ---------- */
var scrim=null;
function sheet(html,mount){
  closeSheet();
  scrim=document.createElement("div");scrim.className="scrim";scrim.setAttribute("dir","rtl");
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>'+html+"</div>";
  scrim.addEventListener("click",function(e){if(e.target===scrim)closeSheet();});
  document.body.appendChild(scrim);
  if(mount)mount(scrim.querySelector(".sheet"));
}
function closeSheet(){if(scrim){scrim.remove();scrim=null;}if(render._pending){render._pending=false;if(window.__authed)render();}}
function toast(msg){var t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
function confirmIn(root,text,label,fn){
  var box=document.createElement("div");box.className="warnbox";box.innerHTML=esc(text)+'<div class="actions" style="margin-top:8px"><button class="mini bad" type="button">'+esc(label)+'</button><button class="mini" type="button">ביטול</button></div>';
  var old=root.querySelector(".warnbox.cf");if(old)old.remove();box.classList.add("cf");
  root.appendChild(box);box.scrollIntoView({block:"nearest"});
  var b=box.querySelectorAll("button");b[0].onclick=fn;b[1].onclick=function(){box.remove();};
}
function val(root,id){var el=root.querySelector("#"+id);return el?el.value:"";}

function sessionForm(s,isNew,preset){
  preset=preset||{};
  var pats=S.patients.filter(function(p){return p.status!=="done"||p.id===s.pid;}).sort(function(a,b){return a.name.localeCompare(b.name,"he");});
  if(!pats.length){patientForm(null);toast("קודם מוסיפים מטופל");return;}
  if(isNew&&!s.pid){s.pid=preset.pid||pats[0].id;var p0=P(s.pid);s.price=p0.price;}
  var h="<h3>"+(isNew?"טיפול חדש":"עריכת טיפול")+'</h3><form id="sf">';
  h+='<div class="f"><label for="s_p">מטופל</label><select id="s_p">'+pats.map(function(p){return'<option value="'+p.id+'"'+(p.id===s.pid?" selected":"")+">"+esc(p.name)+"</option>";}).join("")+"</select></div>";
  h+='<div class="three"><div class="f"><label for="s_d">תאריך</label><input id="s_d" type="date" value="'+s.date+'" required></div><div class="f"><label for="s_t">שעה</label><input id="s_t" type="time" step="300" value="'+s.time+'" required></div><div class="f"><label for="s_u">דקות</label><input id="s_u" type="number" inputmode="numeric" min="10" step="5" value="'+s.dur+'"></div></div>';
  h+='<div id="clash"></div>';
  if(isNew)h+='<label class="switch" for="s_r"><span>חוזר כל שבוע</span><input id="s_r" type="checkbox"></label><div class="f" id="rw" hidden><label for="s_rn">כמה שבועות קדימה</label><input id="s_rn" type="number" inputmode="numeric" min="2" max="52" value="12"></div>';
  h+='<div class="f"><label>סטטוס</label><div class="seg" id="s_st">'+[["scheduled","מתוכנן"],["done","בוצע"],["noshow","לא הגיע"],["cancel","בוטל"]].map(function(x){return'<button type="button" data-v="'+x[0]+'" class="'+(s.status===x[0]?"on":"")+'">'+x[1]+"</button>";}).join("")+"</div></div>";
  h+='<label class="switch" for="s_c" id="cw"><span>לחייב על הטיפול</span><input id="s_c" type="checkbox"'+(s.charge?" checked":"")+"></label>";
  h+='<div class="two"><div class="f"><label for="s_pr">מחיר (₪)</label><input id="s_pr" type="number" inputmode="numeric" value="'+s.price+'"></div><div class="f"><label for="s_m">אמצעי תשלום</label><select id="s_m">'+["ביט","פייבוקס","מזומן","העברה","אשראי","קופת חולים","צ׳ק"].map(function(x){return"<option"+(s.method===x?" selected":"")+">"+x+"</option>";}).join("")+"</select></div></div>";
  if(!isNew){var futN=futureOf(s).length;if(futN)h+='<label class="switch" for="s_all"><span>להחיל שעה, משך, מחיר ויום גם על '+futN+' הטיפולים הבאים בסדרה</span><input id="s_all" type="checkbox"></label>';}
  h+='<label class="switch" for="s_pd"><span>שולם</span><input id="s_pd" type="checkbox"'+(s.paid?" checked":"")+"></label>";
  h+='<div class="f"><label for="s_n">סיכום טיפול / הערה</label><textarea id="s_n" placeholder="מה עבדנו היום, התקדמות, משימה לבית">'+esc(s.note||"")+"</textarea></div>";
  h+='<div class="foot"><button class="btn" type="submit">שמירה</button>'+(!isNew&&s.paid&&billable(s)?'<button class="btn ghost" type="button" id="s_pc">אישור תשלום</button>':"")+(!isNew?'<button class="btn ghost" type="button" id="s_rem">תזכורת</button><button class="btn danger" type="button" id="s_del">מחיקה</button>':'<button class="btn ghost" type="button" id="s_x">סגירה</button>')+"</div></form>";
  sheet(h,function(r){
    var st=s.status;
    function syncCharge(){r.querySelector("#cw").hidden=!(st==="noshow"||st==="cancel");}
    syncCharge();
    r.querySelector("#s_st").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;st=b.dataset.v;r.querySelectorAll("#s_st button").forEach(function(x){x.classList.toggle("on",x===b);});
      if(st==="noshow"||st==="cancel")r.querySelector("#s_c").checked=false;if(st==="done")r.querySelector("#s_pd").checked=true;syncCharge();});
    r.querySelector("#s_p").addEventListener("change",function(){var p=P(this.value);if(p)r.querySelector("#s_pr").value=p.price;});
    function chk(){var tmp={id:s.id,date:val(r,"s_d"),time:val(r,"s_t")||"00:00",dur:+val(r,"s_u")||45};r.querySelector("#clash").innerHTML=(tmp.date&&clashes(tmp))?'<div class="warnbox">שימי לב: יש כבר טיפול בשעה הזו</div>':"";}
    ["s_d","s_t","s_u"].forEach(function(id){r.querySelector("#"+id).addEventListener("input",chk);});chk();
    var rep=r.querySelector("#s_r");if(rep)rep.addEventListener("change",function(){r.querySelector("#rw").hidden=!rep.checked;});
    var x=r.querySelector("#s_x");if(x)x.onclick=closeSheet;
    var pc=r.querySelector("#s_pc");if(pc)pc.onclick=function(){payConfirm(s);};
    var rem=r.querySelector("#s_rem");if(rem)rem.onclick=function(){remind(s.id);};
    var del=r.querySelector("#s_del");if(del)del.onclick=function(){
      var fut=futureOf(s);
      if(!fut.length){confirmIn(r,"למחוק את הטיפול?","מחיקת הטיפול",function(){S.sessions=S.sessions.filter(function(o){return o.id!==s.id;});save();closeSheet();render();toast("הטיפול נמחק");});return;}
      var p0=P(s.pid)||{name:""};
      sheet('<h3>מחיקת טיפול</h3><p style="color:var(--ink-2);margin:0 0 12px">'+esc(p0.name)+' · '+niceDate(s.date)+' '+s.time+'</p><div class="list"><button class="btn block danger" type="button" id="dl1">רק את הטיפול הזה</button><button class="btn block danger" type="button" id="dlall">גם את כל '+fut.length+' הטיפולים הבאים</button><button class="btn block ghost" type="button" id="dlx">ביטול</button></div>',function(r2){
        r2.querySelector("#dl1").onclick=function(){S.sessions=S.sessions.filter(function(o){return o.id!==s.id;});save();closeSheet();render();toast("הטיפול נמחק");};
        r2.querySelector("#dlall").onclick=function(){var ids={};ids[s.id]=1;fut.forEach(function(o){ids[o.id]=1;});S.sessions=S.sessions.filter(function(o){return!ids[o.id];});save();closeSheet();render();toast("נמחקו "+(fut.length+1)+" טיפולים");};
        r2.querySelector("#dlx").onclick=closeSheet;});
    };
    r.querySelector("#sf").addEventListener("submit",function(e){e.preventDefault();
      var o={pid:val(r,"s_p"),date:val(r,"s_d"),time:val(r,"s_t"),dur:+val(r,"s_u")||45,price:+val(r,"s_pr")||0,method:val(r,"s_m"),paid:r.querySelector("#s_pd").checked,note:val(r,"s_n").trim(),status:st,charge:(st==="noshow"||st==="cancel")?r.querySelector("#s_c").checked:false};
      if(!o.date||!o.time){toast("חסר תאריך או שעה");return;}
      if(isNew){
        var n=rep&&rep.checked?Math.min(52,Math.max(2,+val(r,"s_rn")||12)):1,series=n>1?uid():null;
        for(var i=0;i<n;i++){var c=Object.assign({},o,{id:uid()+i,date:addDays(o.date,i*7),series:series});if(i>0){c.status="scheduled";c.paid=false;c.note="";c.charge=false;}S.sessions.push(c);}
        toast(n>1?n+" טיפולים נקבעו":"הטיפול נקבע");
      }else{
        var allEl=r.querySelector("#s_all"),oldDate=s.date,futList=futureOf(s);
        var finish=function(all){
          var cnt=0;
          if(all){
            var shift=Math.round((pd(o.date)-pd(oldDate))/864e5);
            futList.forEach(function(x){{x.time=o.time;x.dur=o.dur;x.price=o.price;x.pid=o.pid;if(shift)x.date=addDays(x.date,shift);cnt++;}});
          }
          Object.assign(s,o);UI.sel=o.date;save();closeSheet();render();toast(cnt?"נשמר, עודכנו עוד "+cnt+" טיפולים":"נשמר");
        };
        var changedSched=o.date!==s.date||o.time!==s.time||o.dur!==(+s.dur)||o.price!==(+s.price);
        if(allEl&&allEl.checked){finish(true);return;}
        if(allEl&&changedSched){
          var futN2=futList.length;
          sheet('<h3>לשמור את השינוי</h3><p style="color:var(--ink-2);margin:0 0 12px">'+esc((P(o.pid)||{}).name||"")+' · '+niceDate(o.date)+' '+o.time+'</p><div class="list"><button class="btn block" type="button" id="ap1">רק את הטיפול הזה</button><button class="btn block ghost" type="button" id="apall">גם את כל '+futN2+' הטיפולים הבאים</button></div>',function(r2){
            r2.querySelector("#ap1").onclick=function(){finish(false);};
            r2.querySelector("#apall").onclick=function(){finish(true);};
          });
          return;
        }
        finish(false);return;}
      UI.sel=o.date;save();closeSheet();render();});
  });
}
function newSession(preset){
  preset=preset||{};
  var d=preset.date||(UI.tab==="cal"?UI.sel:today());
  var t=preset.time||(function(){if(d!==today())return"16:00";var m=Math.ceil((nowMin()+15)/15)*15;return fromMin(Math.min(m,23*60));})();
  var pp=preset.pid&&P(preset.pid);
  sessionForm({id:null,pid:preset.pid||null,date:d,time:t,dur:S.settings.dur,price:(pp&&pp.price)||S.settings.price,status:"scheduled",charge:false,paid:false,method:"ביט",note:""},true,preset);
}

function patientForm(p){
  var isNew=!p;
  p=p||{name:"",birth:"",parent:"",phone:"",school:"",type:"",payer:"פרטי",price:S.settings.price,goals:"",status:"active"};
  var types=["טיפול באומנות פרטני","טיפול באומנות קבוצתי","הדרכת הורים"];S.patients.forEach(function(x){if(x.type&&types.indexOf(x.type)<0)types.push(x.type);});
  var h="<h3>"+(isNew?"מטופל חדש":"עריכת מטופל")+'</h3><form id="pf">';
  h+='<div class="f"><label for="p_n">שם הילד/ה</label><input id="p_n" required value="'+esc(p.name)+'" autocomplete="off"></div>';
  h+='<div class="two"><div class="f"><label for="p_b">תאריך לידה</label><input id="p_b" type="date" value="'+esc(p.birth)+'"></div><div class="f"><label for="p_sc">גן / בית ספר</label><input id="p_sc" value="'+esc(p.school||"")+'"></div></div>';
  h+='<div class="two"><div class="f"><label for="p_pa">שם הורה</label><input id="p_pa" value="'+esc(p.parent)+'"></div><div class="f"><label for="p_ph">טלפון הורה</label><input id="p_ph" type="tel" inputmode="tel" value="'+esc(p.phone)+'"></div></div>';
  h+='<div class="f"><label for="p_t">סוג טיפול</label><input id="p_t" list="tlist" value="'+esc(p.type)+'" placeholder="לדוגמה: טיפול באומנות פרטני"><datalist id="tlist">'+types.map(function(x){return'<option value="'+esc(x)+'">';}).join("")+"</datalist></div>";
  h+='<div class="two"><div class="f"><label for="p_py">מימון</label><select id="p_py">'+["פרטי","דרך המעסיק","קופת חולים","ביטוח משלים","אחר"].map(function(x){return"<option"+(p.payer===x?" selected":"")+">"+x+"</option>";}).join("")+'</select></div><div class="f"><label for="p_pr">מחיר לטיפול (₪)</label><input id="p_pr" type="number" inputmode="numeric" value="'+esc(p.price)+'"></div></div>';
  h+='<div class="f"><label for="p_g">מטרות טיפול</label><textarea id="p_g" placeholder="על מה עובדים">'+esc(p.goals)+"</textarea></div>";
  if(isNew)h+='<div class="f"><label for="p_fn">הערה ראשונה (לא חובה)</label><textarea id="p_fn" placeholder="רקע, אבחון, מה ההורים סיפרו"></textarea></div>';
  else h+='<div class="f"><label>סטטוס</label><div class="seg" id="p_st">'+[["active","פעיל"],["paused","בהפסקה"],["done","סיים"]].map(function(x){return'<button type="button" data-v="'+x[0]+'" class="'+(p.status===x[0]?"on":"")+'">'+x[1]+"</button>";}).join("")+"</div></div>";
  h+='<div class="foot"><button class="btn" type="submit">שמירה</button>'+(isNew?'<button class="btn ghost" type="button" id="p_x">סגירה</button>':'<button class="btn danger" type="button" id="p_del">מחיקה</button>')+"</div></form>";
  sheet(h,function(r){
    var st=p.status;
    var sg=r.querySelector("#p_st");if(sg)sg.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;st=b.dataset.v;sg.querySelectorAll("button").forEach(function(x){x.classList.toggle("on",x===b);});});
    var x=r.querySelector("#p_x");if(x)x.onclick=closeSheet;
    var del=r.querySelector("#p_del");if(del)del.onclick=function(){var n=S.sessions.filter(function(s){return s.pid===p.id;}).length;
      confirmIn(r,"למחוק את "+p.name+" ואת "+n+" הטיפולים שלו/ה? אי אפשר לשחזר. אפשר במקום זה לסמן ׳סיים׳.","מחיקה סופית",function(){S.patients=S.patients.filter(function(o){return o.id!==p.id;});S.sessions=S.sessions.filter(function(o){return o.pid!==p.id;});UI.pid=null;save();closeSheet();render();toast("נמחק");});};
    r.querySelector("#pf").addEventListener("submit",function(e){e.preventDefault();
      var o={name:val(r,"p_n").trim(),birth:val(r,"p_b"),school:val(r,"p_sc").trim(),parent:val(r,"p_pa").trim(),phone:val(r,"p_ph").trim(),type:val(r,"p_t").trim(),payer:val(r,"p_py"),price:+val(r,"p_pr")||0,goals:val(r,"p_g").trim(),status:st};
      if(!o.name){toast("חסר שם");return;}
      if(isNew){o.id=uid();o.color=COLORS[S.patients.length%COLORS.length];o.notes=[];o.created=Date.now();var fn=val(r,"p_fn").trim();if(fn)o.notes.push({id:uid(),date:today(),text:fn});S.patients.push(o);UI.tab="kids";UI.pid=o.id;toast("המטופל נוסף");}
      else{
        var oldPrice=+p.price||0,pc=0;
        if(o.price!==oldPrice){S.sessions.forEach(function(x){if(x.pid===p.id&&!x.paid&&(+x.price||0)===oldPrice&&x.status!=="cancel"){x.price=o.price;pc++;}});}
        Object.assign(p,o);toast(pc?"נשמר. המחיר עודכן ב-"+pc+" טיפולים שלא שולמו":"נשמר");}
      save();closeSheet();render();});
  });
}

function msgSheet(title,msg,phone,note){
  var h="<h3>"+esc(title)+"</h3>"+(note?'<div style="font-size:13.5px;color:var(--ink-3);margin-bottom:8px">'+esc(note)+"</div>":"")+'<div class="msg">'+esc(msg)+'</div><div class="foot">'+(phone?'<a class="btn" style="text-align:center;text-decoration:none" href="https://wa.me/'+waPhone(phone)+"?text="+encodeURIComponent(msg)+'" target="_blank" rel="noopener">שליחה בוואטסאפ</a>':"")+'<button class="btn ghost" type="button" id="rc">העתקה</button></div>';
  sheet(h,function(r){r.querySelector("#rc").onclick=function(){copy(msg);};});
}
function parentSummary(pid){
  var p=P(pid);if(!p)return;var m=today().slice(0,7);
  var ss=S.sessions.filter(function(s){return s.pid===pid&&s.date.slice(0,7)===m&&billable(s);}).sort(sortS);
  var tot=ss.reduce(function(a,s){return a+(+s.price||0);},0),paid=ss.filter(function(s){return s.paid;}).reduce(function(a,s){return a+(+s.price||0);},0);
  var open=owed(pid);
  var msg="היי"+(p.parent?" "+p.parent.split(" ")[0]:"")+", סיכום "+monthName(m)+" עבור "+p.name.split(" ")[0]+":\n"+(ss.length?ss.map(function(s){return"• "+shortDate(s.date)+" "+s.time+" "+money(s.price)+(s.paid?" (שולם)":"");}).join("\n"):"אין טיפולים החודש")+"\nסה״כ החודש: "+money(tot)+"\nשולם: "+money(paid)+(open?"\nיתרה לתשלום: "+money(open):"\nהכל מסודר, תודה!")+"\n"+S.settings.name;
  msgSheet("סיכום חודשי להורה",msg,p.phone,"זה סיכום לידיעה, לא קבלה רשמית.");
}
function payConfirm(s){
  var p=P(s.pid);if(!p)return;
  var msg="היי"+(p.parent?" "+p.parent.split(" ")[0]:"")+", התקבל תשלום "+money(s.price)+" ("+(s.method||"")+") עבור הטיפול של "+p.name.split(" ")[0]+" ב-"+shortDate(s.date)+". תודה! "+S.settings.name;
  msgSheet("אישור תשלום להורה",msg,p.phone,"אישור לידיעה, לא קבלה רשמית.");
}
function remind(id){
  var s=SS(id),p=s&&P(s.pid);if(!p)return;
  var first=(p.name||"").split(" ")[0];
  var when=s.date===today()?"היום":s.date===addDays(today(),1)?"מחר":"ב"+niceDate(s.date);
  var msg="היי"+(p.parent?" "+p.parent.split(" ")[0]:"")+", תזכורת לטיפול של "+first+" "+when+" בשעה "+s.time+". נתראה! "+S.settings.name;
  var h="<h3>תזכורת להורה</h3><div class=\"msg\" id=\"rm\">"+esc(msg)+'</div><div class="foot">'+(p.phone?'<a class="btn" style="text-align:center;text-decoration:none" href="https://wa.me/'+waPhone(p.phone)+"?text="+encodeURIComponent(msg)+'" target="_blank" rel="noopener">שליחה בוואטסאפ</a>':"")+'<button class="btn ghost" type="button" id="rc">העתקה</button></div>';
  sheet(h,function(r){r.querySelector("#rc").onclick=function(){copy(msg);};});
}
function copy(text){
  try{navigator.clipboard.writeText(text).then(function(){toast("הועתק");},function(){toast("סמני את הטקסט והעתיקי");});}catch(e){toast("סמני את הטקסט והעתיקי");}
}

function noteForm(pid){
  sheet('<h3>הערה חדשה</h3><form id="nf"><div class="f"><label for="n_d">תאריך</label><input id="n_d" type="date" value="'+today()+'"></div><div class="f"><label for="n_t">הערה</label><textarea id="n_t" required placeholder="שיחה עם הורים, דיווח מהגננת, תצפית..."></textarea></div><div class="foot"><button class="btn" type="submit">שמירה</button></div></form>',function(r){
    r.querySelector("#n_t").focus();
    r.querySelector("#nf").addEventListener("submit",function(e){e.preventDefault();var t=val(r,"n_t").trim();if(!t)return;var p=P(pid);p.notes=p.notes||[];p.notes.push({id:uid(),date:val(r,"n_d")||today(),text:t});save();closeSheet();render();toast("ההערה נשמרה");});
  });
}
function expenseForm(){
  var d=UI.month===today().slice(0,7)?today():UI.month+"-01";
  sheet('<h3>הוצאה חדשה</h3><form id="ef"><div class="f"><label for="e_l">על מה</label><input id="e_l" list="elist" required placeholder="שכירות, חומרים, הדרכה..."><datalist id="elist"><option value="שכירות חדר טיפולים"><option value="חומרים ומשחקים"><option value="הדרכה מקצועית"><option value="השתלמות"><option value="ביטוח מקצועי"><option value="נסיעות"><option value="הנהלת חשבונות"></datalist></div><div class="two"><div class="f"><label for="e_a">סכום (₪)</label><input id="e_a" type="number" inputmode="numeric" required></div><div class="f"><label for="e_d">תאריך</label><input id="e_d" type="date" value="'+d+'"></div></div><div class="foot"><button class="btn" type="submit">שמירה</button></div></form>',function(r){
    r.querySelector("#ef").addEventListener("submit",function(e){e.preventDefault();S.expenses.push({id:uid(),label:val(r,"e_l").trim(),amount:+val(r,"e_a")||0,date:val(r,"e_d")||d});save();closeSheet();render();toast("ההוצאה נשמרה");});
  });
}

/* ---------- settings, backup, export ---------- */
function saveFile(name,data){
  var b=data instanceof Blob?data:new Blob([data],{type:/\.json$/.test(name)?"application/json":"application/octet-stream"});
  try{
    var f=new File([b],name,{type:b.type||"application/octet-stream"});
    if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&navigator.canShare&&navigator.canShare({files:[f]})){
      return navigator.share({files:[f],title:name}).then(function(){toast("הקובץ נשמר");return true;},function(e){throw e;});
    }
  }catch(e){}
  var u=URL.createObjectURL(b);var el=document.createElement("a");el.href=u;el.download=name;document.body.appendChild(el);el.click();el.remove();setTimeout(function(){URL.revokeObjectURL(u);},4000);toast("הקובץ ירד");return Promise.resolve(true);
}
function backup(){
  var name="גיבוי-קליניקה-"+today()+".json";
  saveFile(name,JSON.stringify(S,null,1)).then(function(){S.settings.lastBackup=Date.now();save();render();},function(){});
}
function hash(pin){
  var s="chen::"+pin;
  if(window.crypto&&crypto.subtle&&window.TextEncoder){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0");}).join("");});}
  var h=0;for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;}return Promise.resolve("s"+h);
}
function settings(){
  var st=S.settings,lb=st.lastBackup?new Date(st.lastBackup):null;
  var h='<h3>הגדרות</h3><form id="gf"><div class="two"><div class="f"><label for="g_n">השם שלך</label><input id="g_n" value="'+esc(st.name)+'"></div><div class="f"><label for="g_em">שם המעסיק</label><input id="g_em" value="'+esc(st.employer||"")+'" placeholder="לדוחות למעסיק"></div></div>';
  h+='<div class="two"><div class="f"><label for="g_p">מחיר ברירת מחדל (₪)</label><input id="g_p" type="number" inputmode="numeric" value="'+st.price+'"></div><div class="f"><label for="g_d">משך טיפול (דק׳)</label><input id="g_d" type="number" inputmode="numeric" value="'+st.dur+'"></div></div>';
  h+='<div class="two"><div class="f"><label for="g_s">יומן מתחיל ב-</label><input id="g_s" type="number" min="0" max="23" value="'+st.dayStart+'"></div><div class="f"><label for="g_e">ומסתיים ב-</label><input id="g_e" type="number" min="1" max="24" value="'+st.dayEnd+'"></div></div>';
  h+='<label class="switch" for="g_oc"><span>צבע אחיד לכל המטופלים ביומן</span><input id="g_oc" type="checkbox"'+(st.oneColor!==false?" checked":"")+'></label>';
  h+='<div class="foot"><button class="btn" type="submit">שמירה</button></div></form>';
  h+='<section><h2>נעילה בקוד</h2><div class="card pad" style="font-size:14.5px"><p style="margin:0 0 10px;color:var(--ink-2)">קוד של 4 ספרות שמסתיר את המידע כשמישהו אחר מחזיק את הטלפון.</p><div class="actions">'+(st.pinHash?'<button class="mini" data-act="pin-set">החלפת קוד</button><button class="mini bad" data-act="pin-off">ביטול נעילה</button>':'<button class="mini acc" data-act="pin-set">הגדרת קוד</button>')+"</div></div></section>";
  h+='<section><h2>גיבוי ושחזור</h2><div class="card pad" style="font-size:14.5px"><p style="margin:0 0 10px;color:var(--ink-2)">המידע מוצפן במכשיר שלך לפני שהוא נשמר בענן, ומסונכרן בין הטלפון למחשב. גיבוי לקובץ אחת לחודש הוא שכבת ביטחון נוספת. גיבוי אחרון: <b>'+(lb?lb.toLocaleDateString("he-IL"):"אף פעם")+'</b></p><div class="actions"><button class="mini acc" data-act="backup">שמירת גיבוי</button><label class="mini acc" for="impf">ייבוא מטופלים (בלי למחוק)<input id="impf" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px"></label><label class="mini" for="restore">שחזור מקובץ<input id="restore" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px"></label></div><div id="rs"></div></div></section>';
  h+='<section><h2>נתונים <small>גרסה 14</small></h2><div class="card pad" style="font-size:14.5px;color:var(--ink-2)">'+S.patients.length+" מטופלים · "+S.sessions.length+" טיפולים · "+S.expenses.length+' הוצאות<div class="actions" style="margin-top:10px">'+(S.demo?'<button class="mini" data-act="clear-demo">מחיקת נתוני הדוגמה</button>':"")+'<button class="mini" data-act="logout">התנתקות מהמכשיר הזה</button>'+"</div></div></section>";
  sheet(h,function(r){
    r.querySelector("#gf").addEventListener("submit",function(e){e.preventDefault();
      st.name=val(r,"g_n").trim()||"חן";st.employer=val(r,"g_em").trim();st.price=+val(r,"g_p")||0;st.dur=+val(r,"g_d")||45;
      var a=Math.max(0,Math.min(23,+val(r,"g_s"))),b=Math.max(a+1,Math.min(24,+val(r,"g_e")));st.dayStart=a;st.dayEnd=b;st.oneColor=r.querySelector("#g_oc").checked;
      save();closeSheet();render();toast("ההגדרות נשמרו");});
    r.querySelector("#impf").addEventListener("change",function(){var f=this.files[0];if(!f)return;var fr=new FileReader();fr.onload=function(){
      var data;try{data=JSON.parse(fr.result);}catch(e){r.querySelector("#rs").innerHTML='<div class="warnbox" style="margin-top:10px">הקובץ לא נקרא.</div>';return;}
      if(!data||!Array.isArray(data.patients)||!Array.isArray(data.sessions)){r.querySelector("#rs").innerHTML='<div class="warnbox" style="margin-top:10px">זה לא קובץ ייבוא של האפליקציה.</div>';return;}
      var norm=function(n){return String(n||"").replace(/\s+/g," ").trim();};
      var byName={};S.patients.forEach(function(p){byName[norm(p.name)]=p;});
      var map={},newP=0,newS=0,skip=0,keys={};
      S.sessions.forEach(function(x){keys[x.pid+"|"+x.date+"|"+x.time]=1;});
      data.patients.forEach(function(p){var ex=byName[norm(p.name)];if(ex){map[p.id]=ex.id;}else{var c=Object.assign({},p);c.id=uid();c.color=c.color||COLORS[S.patients.length%COLORS.length];c.notes=c.notes||[];S.patients.push(c);byName[norm(c.name)]=c;map[p.id]=c.id;newP++;}});
      var exDates={};S.sessions.forEach(function(x){exDates[x.pid+"|"+x.date]=1;});
      data.sessions.forEach(function(x){var pid=map[x.pid];if(!pid)return;if(keys[pid+"|"+x.date+"|"+x.time]||(x.status==="scheduled"&&exDates[pid+"|"+x.date])){skip++;return;}var c=Object.assign({},x);c.id=uid();c.pid=pid;S.sessions.push(c);keys[pid+"|"+c.date+"|"+c.time]=1;newS++;});
      save();closeSheet();render();toast("נוספו "+newP+" מטופלים ו-"+newS+" טיפולים"+(skip?" ("+skip+" כפולים דולגו)":""));
    };fr.readAsText(f);});
    r.querySelector("#restore").addEventListener("change",function(){var f=this.files[0];if(!f)return;var fr=new FileReader();fr.onload=function(){
      var data;try{data=JSON.parse(fr.result);}catch(e){r.querySelector("#rs").innerHTML='<div class="warnbox" style="margin-top:10px">הקובץ לא נקרא. בחרי קובץ גיבוי שנשמר מהאפליקציה.</div>';return;}
      if(!data||!Array.isArray(data.patients)||!Array.isArray(data.sessions)){r.querySelector("#rs").innerHTML='<div class="warnbox" style="margin-top:10px">זה לא קובץ גיבוי של האפליקציה.</div>';return;}
      confirmIn(r.querySelector("#rs"),"השחזור יחליף את כל מה שיש עכשיו ב-"+data.patients.length+" מטופלים ו-"+data.sessions.length+" טיפולים מהגיבוי.","החלפה בגיבוי",function(){var pin=S.settings.pinHash;S=data;S.settings=Object.assign(blank().settings,S.settings||{});S.expenses=S.expenses||[];S.deleted={};COLS.forEach(function(k){(S[k]||[]).forEach(function(it){it.u=Date.now();});});initH();S.settingsU=Date.now();if(!S.settings.pinHash)S.settings.pinHash=pin;save();closeSheet();render();toast("הגיבוי שוחזר");});
    };fr.readAsText(f);});
  });
}
function pinSetup(){
  var step=1,first="",cur="";
  function draw(){lockScreen(step===1?"בחרי קוד חדש":"הקלידי שוב לאישור",cur.length,function(k){
    if(k==="x"){closeLock();settings();return;}
    if(k==="<"){cur=cur.slice(0,-1);draw();return;}
    cur+=k;draw();
    if(cur.length===4){if(step===1){first=cur;cur="";step=2;setTimeout(draw,150);}else if(cur===first){hash(cur).then(function(hh){S.settings.pinHash=hh;save();closeLock();toast("הקוד נשמר");});}else{cur="";step=1;toast("הקודים לא תאמו, נסי שוב");setTimeout(draw,150);}}
  },true);}
  closeSheet();draw();
}
var lockEl=null;
function lockScreen(title,n,onKey,cancelable){
  if(!lockEl){lockEl=document.createElement("div");lockEl.className="lock";lockEl.setAttribute("dir","rtl");document.body.appendChild(lockEl);
    lockEl.addEventListener("click",function(e){var b=e.target.closest("button[data-k]");if(b&&lockEl._on)lockEl._on(b.dataset.k);});}
  lockEl._on=onKey;
  var keys=["1","2","3","4","5","6","7","8","9",cancelable?"x":"","0","<"];
  lockEl.innerHTML="<h1>"+esc(title)+'</h1><div class="pins">'+[0,1,2,3].map(function(i){return'<i class="'+(i<n?"f":"")+'"></i>';}).join("")+'</div><div class="keys" dir="ltr">'+keys.map(function(k){return k?'<button data-k="'+k+'" aria-label="'+(k==="<"?"מחיקה":k==="x"?"ביטול":k)+'">'+(k==="<"?"⌫":k==="x"?"✕":k)+"</button>":"<span></span>";}).join("")+"</div>";
}
function closeLock(){if(lockEl){lockEl.remove();lockEl=null;}}
function unlock(){
  var cur="";
  function draw(){lockScreen("הקליניקה של "+S.settings.name,cur.length,function(k){
    if(k==="<"){cur=cur.slice(0,-1);draw();return;}
    cur+=k;draw();
    if(cur.length===4){hash(cur).then(function(hh){if(hh===S.settings.pinHash){closeLock();UI.unlocked=true;render();}else{cur="";toast("קוד שגוי");draw();}});}
  },false);}
  draw();
}

function loadXLSX(){
  return new Promise(function(res,rej){if(window.XLSX)return res(window.XLSX);var s=document.createElement("script");s.src="xlsx.full.min.js";s.onload=function(){res(window.XLSX);};s.onerror=rej;document.head.appendChild(s);});
}
function exportMonth(){
  var m=UI.month,D=monthData(m);
  toast("מכינה את הדוח...");
  loadXLSX().then(function(X){
    var wb=X.utils.book_new();wb.Workbook={Views:[{RTL:true}]};
    var sum=[["דוח חודשי",monthName(m)],["מטפלת",S.settings.name],[],["טיפולים שבוצעו",D.done],["לא הגיעו",D.noshow],["ביטולים",D.cancel],[],["הכנסות (₪)",D.inc],["נגבה (₪)",D.col],["עוד לגבות (₪)",D.open],["הוצאות (₪)",D.ex],["רווח נקי (₪)",D.profit],[],["צפי מטיפולים מתוכננים (₪)",D.plan],["הופק",new Date().toLocaleString("he-IL")]];
    var ws1=X.utils.aoa_to_sheet(sum);ws1["!cols"]=[{wch:26},{wch:18}];ws1["!rtl"]=true;
    var rows=[["תאריך","יום","שעה","מטופל","סוג טיפול","מימון","סטטוס","מחויב","מחיר (₪)","שולם","אמצעי תשלום","הערה"]];
    D.ss.forEach(function(s){var p=P(s.pid)||{};rows.push([s.date.split("-").reverse().join("/"),DAYS[pd(s.date).getDay()],s.time,p.name||"",p.type||"",p.payer||"",(STATUS[s.status]||STATUS.scheduled)[0],billable(s)?"כן":"לא",billable(s)?+s.price:0,billable(s)?(s.paid?"כן":"לא"):"",billable(s)&&s.paid?s.method:"",s.note||""]);});
    var ws2=X.utils.aoa_to_sheet(rows);ws2["!cols"]=[{wch:11},{wch:8},{wch:7},{wch:18},{wch:18},{wch:13},{wch:9},{wch:7},{wch:9},{wch:6},{wch:12},{wch:40}];
    var per={};D.ss.forEach(function(s){var r=per[s.pid]=per[s.pid]||{d:0,n:0,c:0,inc:0,paid:0};if(s.status==="done")r.d++;if(s.status==="noshow")r.n++;if(s.status==="cancel")r.c++;if(billable(s)){r.inc+=+s.price||0;if(s.paid)r.paid+=+s.price||0;}});
    var pr=[["מטופל","הורה","טלפון","מימון","בוצעו","לא הגיע","בוטלו","הכנסה (₪)","נגבה (₪)","פתוח (₪)"]];
    Object.keys(per).forEach(function(k){var p=P(k)||{};var r=per[k];pr.push([p.name||"",p.parent||"",p.phone||"",p.payer||"",r.d,r.n,r.c,r.inc,r.paid,r.inc-r.paid]);});
    var ws3=X.utils.aoa_to_sheet(pr);ws3["!cols"]=[{wch:18},{wch:14},{wch:13},{wch:13},{wch:7},{wch:8},{wch:7},{wch:10},{wch:10},{wch:10}];
    var er=[["תאריך","הוצאה","סכום (₪)"]];D.exp.forEach(function(e){er.push([e.date.split("-").reverse().join("/"),e.label,+e.amount]);});
    var ws4=X.utils.aoa_to_sheet(er);ws4["!cols"]=[{wch:11},{wch:26},{wch:10}];
    X.utils.book_append_sheet(wb,ws1,"סיכום");X.utils.book_append_sheet(wb,ws2,"טיפולים");X.utils.book_append_sheet(wb,ws3,"לפי מטופל");X.utils.book_append_sheet(wb,ws4,"הוצאות");
    var out=X.write(wb,{bookType:"xlsx",type:"array"});
    saveFile("דוח-"+m+".xlsx",new Blob([out])).catch(function(){});
  },function(){toast("טעינת רכיב האקסל נכשלה. בדקי חיבור לאינטרנט.");});
}

function exportEmployer(){
  var m=UI.month,emp=S.settings.employer||"";
  var ss=S.sessions.filter(function(s){var p=P(s.pid);return s.date.slice(0,7)===m&&p&&p.payer==="דרך המעסיק"&&s.status!=="scheduled";}).sort(sortS);
  if(!ss.length){toast("אין החודש טיפולים של מטופלים דרך המעסיק");return;}
  toast("מכינה את הדוח...");
  loadXLSX().then(function(X){
    var wb=X.utils.book_new();wb.Workbook={Views:[{RTL:true}]};
    var done=ss.filter(function(s){return s.status==="done";});
    var mins=done.reduce(function(a,s){return a+(+s.dur||0);},0);
    var billed=ss.filter(billable);var amt=billed.reduce(function(a,s){return a+(+s.price||0);},0);
    var rows=[["דוח טיפולים חודשי",monthName(m)],["מטפלת",S.settings.name],["מעסיק",emp],[],["תאריך","יום","משעה","עד שעה","דקות","מטופל","סוג טיפול","סטטוס","לחיוב","תעריף (₪)"]];
    ss.forEach(function(s){var p=P(s.pid)||{};rows.push([s.date.split("-").reverse().join("/"),DAYS[pd(s.date).getDay()],s.time,fromMin(toMin(s.time)+(+s.dur||0)),+s.dur||0,p.name||"",p.type||"",(STATUS[s.status]||STATUS.scheduled)[0],billable(s)?"כן":"לא",billable(s)?+s.price:0]);});
    rows.push([]);rows.push(["טיפולים שבוצעו",done.length]);rows.push(["שעות טיפול",Math.round(mins/6)/10]);rows.push(["סה״כ לחיוב (₪)",amt]);
    var ws=X.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:12},{wch:8},{wch:8},{wch:8},{wch:7},{wch:18},{wch:20},{wch:9},{wch:7},{wch:10}];
    X.utils.book_append_sheet(wb,ws,"טיפולים");
    var per={};done.forEach(function(s){var r=per[s.pid]=per[s.pid]||{n:0,min:0};r.n++;r.min+=+s.dur||0;});
    var pr=[["מטופל","טיפולים","שעות"]];Object.keys(per).forEach(function(k){var p=P(k)||{};pr.push([p.name||"",per[k].n,Math.round(per[k].min/6)/10]);});
    var ws2=X.utils.aoa_to_sheet(pr);ws2["!cols"]=[{wch:18},{wch:9},{wch:8}];X.utils.book_append_sheet(wb,ws2,"לפי מטופל");
    saveFile("דוח-למעסיק-"+m+".xlsx",new Blob([X.write(wb,{bookType:"xlsx",type:"array"})])).catch(function(){});
  },function(){toast("טעינת רכיב האקסל נכשלה. בדקי חיבור לאינטרנט.");});
}

/* ---------- events ---------- */
/* ---------- drag to move (day + week views) ---------- */
/* mouse: click-drag. touch (iPhone): press and hold ~0.3s, then drag. */
var drag=null,suppressClick=false;
function dragTarget(x,y){var el=document.elementFromPoint(x,y);return el&&el.closest('.timeline,.wkcol');}
function beginDrag(ev,x,y,touch){
  var r=ev.getBoundingClientRect();
  drag={el:ev,id:ev.dataset.id,x0:x,y0:y,offY:y-r.top,active:false,touch:touch,ghost:null,timer:null};
  if(touch)drag.timer=setTimeout(function(){if(drag&&!drag.active)startDrag();},300);
}
function startDrag(){
  if(!drag)return;drag.active=true;
  var r=drag.el.getBoundingClientRect(),g=drag.el.cloneNode(true);
  g.className+=" ghost";g.style.cssText="position:fixed;inset:auto;margin:0;left:"+r.left+"px;top:"+r.top+"px;width:"+r.width+"px;height:"+r.height+"px;z-index:90;opacity:.92;pointer-events:none;box-shadow:0 10px 26px rgba(0,0,0,.28);transform:scale(1.04);"+(drag.el.className.indexOf("wev")>-1?"background:"+drag.el.style.background:"");
  document.body.appendChild(g);drag.ghost=g;drag.el.style.opacity=".3";
  var tip=document.createElement("div");tip.className="dragtip num";tip.style.display="none";document.body.appendChild(tip);drag.tip=tip;
  try{if(window.getSelection)window.getSelection().removeAllRanges();}catch(x){}
  try{if(navigator.vibrate)navigator.vibrate(15);}catch(x){}
}
function moveDrag(x,y){
  var r=drag.el.getBoundingClientRect(),dx=x-drag.x0,dy=y-drag.y0;
  drag.ghost.style.left=(r.left+dx)+"px";drag.ghost.style.top=(r.top+dy)+"px";
  document.querySelectorAll(".droptarget").forEach(function(t){t.classList.remove("droptarget");});
  var at=dropAt(x,y);if(at)at.el.classList.add("droptarget");
  if(drag.tip){if(at){var s0=SS(drag.id);drag.tip.textContent=DAYS_S[pd(at.date).getDay()]+" "+shortDate(at.date)+" · "+at.time+"-"+fromMin(toMin(at.time)+(+(s0&&s0.dur)||45));drag.tip.style.display="block";var gn=drag.ghost.querySelector(".num");if(gn)gn.textContent=drag.ghost.classList.contains("wev")?at.time:at.time+"-"+fromMin(toMin(at.time)+(+(s0&&s0.dur)||45));drag.tip.style.top=Math.max(8,y-drag.offY-44)+"px";}else drag.tip.style.display="none";}
}
function dropAt(x,y){
  var t=dragTarget(x,y);if(!t||!drag)return null;
  var rect=t.getBoundingClientRect(),hh=+(t.dataset.hh||64),st=+t.dataset.start;
  var m=st*60+Math.round(((y-drag.offY)-rect.top)/hh*60/15)*15;m=Math.max(0,Math.min(23*60+45,m));
  return{el:t,date:t.dataset.date,time:fromMin(m)};
}
function finishDrag(x,y,cancel){
  if(!drag)return;clearTimeout(drag.timer);
  var d=drag;drag=null;
  if(!d.active)return;
  suppressClick=true;setTimeout(function(){suppressClick=false;},500);
  if(d.ghost)d.ghost.remove();if(d.tip)d.tip.remove();d.el.style.opacity="";
  document.querySelectorAll(".droptarget").forEach(function(t){t.classList.remove("droptarget");});
  if(cancel)return;
  drag=d;var at=dropAt(x,y);drag=null;var s=SS(d.id);if(!at||!s)return;
  moveSession(s,at.date,at.time);
}
/* mouse */
document.addEventListener("pointerdown",function(e){
  if(e.pointerType!=="mouse"||e.button>0)return;
  var ev=e.target.closest(".ev,.wev");if(!ev)return;beginDrag(ev,e.clientX,e.clientY,false);
});
document.addEventListener("pointermove",function(e){
  if(!drag||drag.touch)return;
  if(!drag.active){if(Math.abs(e.clientX-drag.x0)+Math.abs(e.clientY-drag.y0)>6)startDrag();else return;}
  moveDrag(e.clientX,e.clientY);
});
document.addEventListener("pointerup",function(e){if(drag&&!drag.touch)finishDrag(e.clientX,e.clientY,false);});
/* touch */
document.addEventListener("touchstart",function(e){
  if(e.touches.length!==1)return;var ev=e.target.closest(".ev,.wev");if(!ev)return;
  var t=e.touches[0];beginDrag(ev,t.clientX,t.clientY,true);
},{passive:true});
document.addEventListener("touchmove",function(e){
  if(!drag||!drag.touch)return;var t=e.touches[0];
  if(!drag.active){if(Math.abs(t.clientX-drag.x0)>10||Math.abs(t.clientY-drag.y0)>10){clearTimeout(drag.timer);drag=null;}return;}
  e.preventDefault();moveDrag(t.clientX,t.clientY);
},{passive:false});
document.addEventListener("touchend",function(e){
  if(!drag||!drag.touch)return;var t=e.changedTouches[0];
  if(drag.active)e.preventDefault();
  finishDrag(t.clientX,t.clientY,false);
},{passive:false});
document.addEventListener("touchcancel",function(){if(drag&&drag.touch)finishDrag(0,0,true);});
document.addEventListener("contextmenu",function(e){if(e.target.closest(".ev,.wev"))e.preventDefault();});
document.addEventListener("click",function(e){if(suppressClick){e.stopPropagation();e.preventDefault();suppressClick=false;}},true);
function moveSession(s,date,time){
  if(s.date===date&&s.time===time)return;
  var fut=futureOf(s);
  var p=P(s.pid)||{name:""};
  function apply(all){
    var shift=Math.round((pd(date)-pd(s.date))/864e5);
    if(all)fut.forEach(function(o){o.date=addDays(o.date,shift);o.time=time;});
    s.date=date;s.time=time;save();closeSheet();render();
    toast(all?"הועברו "+(fut.length+1)+" טיפולים":"הטיפול הועבר ל"+niceDate(date)+" "+time);
  }
  if(!fut.length){apply(false);return;}
  sheet('<h3>העברת '+esc(p.name)+'</h3><p style="color:var(--ink-2);margin:0 0 12px">ל'+niceDate(date)+' בשעה '+time+'</p><div class="list"><button class="btn block" type="button" id="mv1">רק את הטיפול הזה</button><button class="btn block ghost" type="button" id="mvall">גם את כל '+fut.length+' הטיפולים הבאים</button><button class="btn block ghost" type="button" id="mvx">ביטול</button></div>',function(r){
    r.querySelector("#mv1").onclick=function(){apply(false);};
    r.querySelector("#mvall").onclick=function(){apply(true);};
    r.querySelector("#mvx").onclick=closeSheet;
  });
}
document.addEventListener("click",function(e){
  var a=e.target.closest("[data-act]");if(!a)return;
  var act=a.dataset.act,id=a.dataset.id,v=a.dataset.v;
  if(act!=="slot")e.stopPropagation();
  switch(act){
    case"nav":UI.tab=v;if(v!=="kids")UI.pid=null;if(v==="kids")UI.pid=null;render._scrolled=false;window.scrollTo(0,0);render();break;
    case"settings":settings();break;
    case"week":var nd=addDays(UI.sel,+v);UI.sel=nd;render();break;
    case"day":UI.sel=v;render();break;
    case"day-open":UI.sel=v;UI.cv="day";try{localStorage.setItem("chen-cv","day");}catch(x){}render._scrolled=false;render();break;
    case"cv":UI.cv=v;try{localStorage.setItem("chen-cv",v);}catch(x){}render._scrolled=false;render();break;
    case"cal-shift":if(UI.cv==="month")UI.sel=shiftMonth(UI.sel.slice(0,7),+v)+"-01";else UI.sel=addDays(UI.sel,(+v)*7);render();break;
    case"slot":
      if(e.target.closest(".ev,.wev"))return;
      var rect=a.getBoundingClientRect(),y=e.clientY-rect.top,hh=+(a.dataset.hh||64),m=(+a.dataset.start)*60+Math.floor(y/hh*60/15)*15;
      newSession({date:a.dataset.date,time:fromMin(m)});break;
    case"new-session":newSession({pid:a.dataset.pid});break;
    case"edit-session":var s=SS(id);if(s)sessionForm(s,false);break;
    case"st":var s2=SS(id);if(s2){s2.status=v;if(v==="noshow")s2.charge=false;if(v==="done")s2.paid=true;save();render();toast(v==="done"?"סומן כבוצע":"סומן: לא הגיע");}break;
    case"paid":var s3=SS(id);if(s3){s3.paid=true;save();render();toast("סומן כשולם");}break;
    case"pay-all":S.sessions.forEach(function(s){if(s.pid===id&&billable(s))s.paid=true;});save();render();toast("הכל סומן כשולם");break;
    case"remind":remind(id);break;
    case"new-patient":patientForm(null);break;
    case"open-patient":UI.tab="kids";UI.pid=id;window.scrollTo(0,0);render();break;
    case"edit-patient":patientForm(P(id));break;
    case"back":UI.pid=null;render();break;
    case"filter":UI.filter=v;render();break;
    case"add-note":noteForm(id);break;
    case"del-note":var pp=P(a.dataset.pid);if(pp){pp.notes=(pp.notes||[]).filter(function(n){return n.id!==id;});save();render();toast("ההערה נמחקה");}break;
    case"copy":copy(v);break;
    case"month":UI.month=shiftMonth(UI.month,+v);render();break;
    case"add-expense":expenseForm();break;
    case"del-expense":S.expenses=S.expenses.filter(function(x){return x.id!==id;});save();render();toast("ההוצאה נמחקה");break;
    case"export":exportMonth();break;
    case"export-emp":exportEmployer();break;
    case"parent-sum":parentSummary(id);break;
    case"backup":backup();break;
    case"clear-demo":S.patients=S.patients.filter(function(p){return!p.demo;});S.sessions=S.sessions.filter(function(s){return!s.demo;});S.expenses=S.expenses.filter(function(x){return!x.demo;});S.demo=false;save();closeSheet();UI.pid=null;render();toast("נתוני הדוגמה נמחקו. אפשר להתחיל");break;
    case"load-demo":seedDemo();save();closeSheet();render();toast("נטענו נתוני דוגמה");break;
    case"pin-set":pinSetup();break;
    case"logout":if(window.__sync)window.__sync.logout();break;
    case"pin-off":S.settings.pinHash="";save();closeSheet();toast("הנעילה בוטלה");break;
  }
});
document.addEventListener("input",function(e){
  if(e.target.id==="q"){UI.q=e.target.value;var pos=e.target.selectionStart;render();var q=document.getElementById("q");if(q){q.focus();try{q.setSelectionRange(pos,pos);}catch(x){}}}
});
document.addEventListener("change",function(e){if(e.target.id==="jump"&&e.target.value){UI.sel=e.target.value;render();}});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet();});
document.addEventListener("visibilitychange",function(){if(document.hidden&&S.settings.pinHash){UI.lockAt=Date.now();}else if(!document.hidden&&S.settings.pinHash&&UI.lockAt&&Date.now()-UI.lockAt>60000){closeSheet();unlock();}});

/* one-time data fixes (names matched by hash, never stored in code) */
function nh(s){s=String(s||"").replace(/\s+/g," ").trim();var x=5381;for(var i=0;i<s.length;i++){x=((x<<5)+x+s.charCodeAt(i))|0;}return x;}
function fixups(){
  var K="chen-fix13";try{if(localStorage.getItem(K))return false;}catch(x){return false;}
  if(!S.sessions.length)return false;
  var t=today(),ch=false;
  S.sessions.forEach(function(s){if(s.date<=t){if(s.status==="done"&&!s.paid){s.paid=true;ch=true;}if(s.status==="noshow"&&s.charge){s.charge=false;ch=true;}}});
  try{localStorage.setItem(K,"1");}catch(x){}
  return ch;
}
function fix1(){
  if(S.settings.fix1)return false;
  var t=S.patients.filter(function(p){return nh(p.name)===1436732829;})[0];
  if(!t)return false;
  var occupied=function(d,tm){return S.sessions.some(function(x){return x.date===d&&x.time===tm&&x.status!=="cancel";});};
  var n=0;
  S.sessions.forEach(function(x){
    if(x.pid!==t.id)return;
    if(x.date==="2026-07-07"){var tj="09:00";while(occupied("2026-07-08",tj)&&tj<"18:00"){tj=fromMin(toMin(tj)+60);}x.date="2026-07-08";x.time=tj;n++;return;}
    if(x.status==="scheduled"&&pd(x.date).getDay()===2){var nd=addDays(x.date,1),tm="12:00";while(occupied(nd,tm)&&tm<"18:00"){tm=fromMin(toMin(tm)+60);}x.date=nd;x.time=tm;n++;}
  });
  S.settings.fix1=true;
  return true;
}
/* fix2: from 2026-09-01, Wednesday kids -> Thursday, Monday kids -> Wednesday */
function fix2(){
  if(S.settings.fix2)return false;
  var WED=[677595487,419579227,866668053,1436732829],MON=[-1263149329,2087420090,-204185861,1445323908,2142451688];
  var grp={};S.patients.forEach(function(p){var h=nh(p.name);if(WED.indexOf(h)>-1)grp[p.id]="w";else if(MON.indexOf(h)>-1)grp[p.id]="m";});
  if(!Object.keys(grp).length)return false;
  var n=0;
  S.sessions.forEach(function(x){
    var g=grp[x.pid];if(!g||x.date<"2026-09-01")return;
    var wd=pd(x.date).getDay();
    var old=x.date;
    if(g==="w"&&(wd===3||wd===2)){x.date=addDays(x.date,4-wd);n++;}
    else if(g==="m"&&wd===1){x.date=addDays(x.date,2);n++;}
    if(old<"2026-10-01"&&x.date>="2026-10-01"&&x.status==="done"&&!x.paid){x.status="scheduled";}
  });
  S.settings.fix2=true;
  return true;
}
/* fix3 (final): from 2026-09-01 ex-Monday kids -> Tuesday, Tuesday kids -> Wednesday, ex-Wednesday kids -> Thursday.
   Works from the original schedule or after fix2; moves inside the same week. */
function fix3(){
  if(S.settings.fix3)return false;
  var G={thu:[677595487,419579227,866668053,1436732829],tue:[-1263149329,2087420090,-204185861,1445323908,2142451688],wed:[1657625772,1092614600,294268316,1650537475]};
  var tgt={};S.patients.forEach(function(p){var h=nh(p.name);if(G.thu.indexOf(h)>-1)tgt[p.id]=4;else if(G.tue.indexOf(h)>-1)tgt[p.id]=2;else if(G.wed.indexOf(h)>-1)tgt[p.id]=3;});
  if(!Object.keys(tgt).length)return false;
  S.sessions.forEach(function(x){
    var tw=tgt[x.pid];if(!tw||x.date<"2026-09-01")return;
    var wd=pd(x.date).getDay();if(wd<1||wd>4||wd===tw)return;
    var old=x.date;x.date=addDays(x.date,tw-wd);
    if(x.date<"2026-09-01"){x.date=old;return;}
    if(old<"2026-10-01"&&x.date>="2026-10-01"&&x.status==="done"&&!x.paid)x.status="scheduled";
    if(old>="2026-10-01"&&x.date<"2026-10-01"&&x.status==="scheduled")x.status="done";
  });
  S.settings.fix3=true;S.settings.fix2=true;
  return true;
}
/* fix4: same final schedule as fix3, matching kids by any word of their name (works even if Chen edited names) */
function fix4(){
  if(S.settings.fix4)return false;
  var TOK={"5910615":4,"195048436":4,"195056792":2,"355362152":3,"369411281":2,"517970199":2,"962705990":3,"1954011920":3,"1954820258":3,"1959124774":4,"1968502631":2,"1970560973":4,"1970886275":4,"1974289565":4,"2141838905":2,"2142060335":2,"2142199929":3,"2142275666":2,"2142451688":2,"2142481788":4,"2142503165":3,"-596376394":3};
  var tgt={};S.patients.forEach(function(p){var parts=String(p.name||"").split(/\s+/);for(var i=0;i<parts.length;i++){var w=TOK[nh(parts[i])];if(w){tgt[p.id]=w;break;}}});
  if(!Object.keys(tgt).length)return false;
  S.sessions.forEach(function(x){
    var tw=tgt[x.pid];if(!tw||x.date<"2026-09-01")return;
    var wd=pd(x.date).getDay();if(wd<1||wd>4||wd===tw)return;
    var old=x.date;x.date=addDays(x.date,tw-wd);
    if(x.date<"2026-09-01"){x.date=old;return;}
    if(old<"2026-10-01"&&x.date>="2026-10-01"&&x.status==="done"&&!x.paid)x.status="scheduled";
  });
  S.settings.fix4=true;S.settings.fix3=true;S.settings.fix2=true;
  return true;
}
window.__app={
  getState:function(){return S;},
  replaceState:function(n){S=n;S.settings=Object.assign(blank().settings,S.settings||{});COLS.forEach(function(k){S[k]=S[k]||[];});S.deleted=S.deleted||{};initH();saveLocal();},
  stamp:stamp,saveLocal:saveLocal,initH:initH,
  render:function(){if(window.__authed&&fixups())save();if(!scrim&&!lockEl&&window.__authed)render();else render._pending=true;},
  start:function(){window.__authed=true;if(fixups())save();render();if(S.settings.pinHash)unlock();},
  isEmpty:function(){return !S.patients.length&&!S.sessions.length&&!S.expenses.length;},
  toast:toast,esc:esc
};
initH();
})();
