// Impide letras al escribir o pegar en controles numéricos, conservando decimales y signos.
const numeric=(target:EventTarget|null)=>target instanceof HTMLInputElement&&target.type==='number';
document.addEventListener('keydown',event=>{if(numeric(event.target)&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1&&!/[0-9.,+-]/.test(event.key))event.preventDefault();});
document.addEventListener('paste',event=>{if(numeric(event.target)&&!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(event.clipboardData?.getData('text').trim()||''))event.preventDefault();});
