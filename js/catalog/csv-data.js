(function(root){
'use strict';
function parseTable(text,delimiter=';'){
 const rows=[];let row=[],cell='',quoted=false;const source=String(text||'').replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const char=source[i];
  if(char==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(char===delimiter&&!quoted){row.push(cell);cell='';}
  else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}
  else cell+=char;
 }
 if(quoted)throw Error('O CSV contém uma aspa não fechada.');
 if(cell!==''||row.length){row.push(cell);rows.push(row);}return rows;
}
function serializeTable(rows,delimiter=';'){return rows.map(row=>row.map(value=>{const text=String(value??'');return text.includes(delimiter)||/["\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}).join(delimiter)).join('\r\n')+'\r\n';}
const api={parseTable,serializeTable};root.CatalogCsv=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
