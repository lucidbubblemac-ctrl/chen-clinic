if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").then(function(r){try{r.update();}catch(e){}}).catch(function(){});});}
