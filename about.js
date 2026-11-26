async function aboutPage(section){
  const host=document.createElement('section');host.className='about-page-host';host.textContent='正在打开关于 Eric…';$('view').replaceChildren(host);
  try{
    const response=await fetch('./about.html?v=about-rewards-20261126');if(!response.ok)throw Error('介绍页暂时无法读取，请刷新后重试。');
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    if(!host.isConnected)return;
    const style=page.querySelector('style'),main=page.querySelector('main'),footer=page.querySelector('footer');
    if(!style||!main)throw Error('介绍页内容不完整，请刷新后重试。');
    const shadow=host.attachShadow({mode:'open'});
    const css=document.createElement('style');css.textContent=style.textContent.replaceAll(':root',':host').replace(/\bbody\{/g,':host{')+'\n:host{display:block} .hero{padding-top:35px}';
    shadow.append(css,main);if(footer)shadow.append(footer);
    const reveal=id=>{const target=id==='top'?host:shadow.getElementById(id);if(!target)return;for(let el=target;el&&el!==host;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
    shadow.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();reveal(a.getAttribute('href').slice(1));}));
    if(section)reveal(section);
  }catch(error){if(host.isConnected)host.textContent=error.message;}
}
