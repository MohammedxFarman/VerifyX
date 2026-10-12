document.addEventListener('DOMContentLoaded',async()=>{
  const $=id=>document.getElementById(id);const button=$('scan-now-btn');let activeUrl='',selectedText='';
  const saved=await chrome.storage.local.get(['lastSelectedText','lastSelectedUrl','backendOrigin']);
  let origin=saved.backendOrigin||'https://verifyx-fue5.onrender.com';$('backend-origin').value=origin;$('dashboard-link').href=origin;
  if(saved.lastSelectedText){selectedText=saved.lastSelectedText;$('context-desc').textContent='Selected claim: '+selectedText.slice(0,300);button.textContent='Review claim';await chrome.storage.local.remove('lastSelectedText');}
  else{activeUrl=saved.lastSelectedUrl||'';if(!activeUrl){const tabs=await chrome.tabs.query({active:true,currentWindow:true});activeUrl=tabs[0]?.url||'';}$('context-desc').textContent='Website: '+activeUrl;await chrome.storage.local.remove('lastSelectedUrl');}
  $('save-backend').addEventListener('click',async()=>{try{const url=new URL($('backend-origin').value);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Use an HTTPS origin or a localhost development origin.');const pattern=url.origin+'/*';if(!await chrome.permissions.request({origins:[pattern]}))throw new Error('Backend access permission was not granted.');origin=url.origin;await chrome.storage.local.set({backendOrigin:origin});await chrome.storage.session.remove('verifyxSession');$('dashboard-link').href=origin;$('config-status').textContent='Backend saved.';}catch(e){$('config-status').textContent=e.message;}});
  async function request(route,body){
    let stored=(await chrome.storage.session.get('verifyxSession')).verifyxSession;
    if(!stored||stored.origin!==origin||stored.expires<Date.now()){const response=await fetch(origin+'/api/session',{credentials:'omit',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok||typeof data.sessionToken!=='string')throw new Error('Backend is unavailable or needs the VerifyX evidence update.');stored={origin,token:data.sessionToken,expires:Date.now()+23*3600000};await chrome.storage.session.set({verifyxSession:stored});}
    const response=await fetch(origin+route,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+stored.token},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const data=await response.json();if(response.status===401)await chrome.storage.session.remove('verifyxSession');if(!response.ok)throw new Error(data.error||'Backend request failed.');if(data.version!==1||typeof data.summary!=='string'||!data.analysis)throw new Error('Backend returned an unsupported report.');return data;
  }
  button.addEventListener('click',async()=>{
    button.disabled=true;$('loading').style.display='block';$('result-box').style.display='none';
    try{const data=await request(selectedText?'/api/verify/news':'/api/verify/url',selectedText?{content:selectedText}:{url:activeUrl});$('trust-score').textContent=data.status.replaceAll('_',' ');$('trust-explanation').textContent=data.summary+'\n\n'+Object.entries(data.analysis).map(([name,check])=>name.replaceAll('_',' ')+': '+check.status+'\n'+check.findings.join('\n')).join('\n\n');}
    catch(e){$('trust-score').textContent='Unavailable';$('trust-explanation').textContent=e.message;}
    finally{button.disabled=false;$('loading').style.display='none';$('result-box').style.display='block';}
  });
});
