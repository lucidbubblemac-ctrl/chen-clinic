if("serviceWorker" in navigator){
  var hadController=!!navigator.serviceWorker.controller,reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",function(){if(hadController&&!reloaded){reloaded=true;(function go(){if(document.querySelector(".scrim")||document.querySelector(".ghost"))return setTimeout(go,2000);location.reload();})();}hadController=true;});
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").then(function(r){try{r.update();}catch(e){}}).catch(function(){});});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")navigator.serviceWorker.getRegistration().then(function(r){if(r)r.update();}).catch(function(){});});
}
