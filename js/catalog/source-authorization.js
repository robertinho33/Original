(function(root){
'use strict';
// Commercial authorization confirmed by the store owner. Expand only after approval.
const authorized=Object.freeze(['ecobelle']);
const isSourceAuthorized=id=>authorized.includes(String(id??'').trim().toLowerCase());
const isProductAuthorized=product=>isSourceAuthorized(product?.sourceId);
const api={authorized,isSourceAuthorized,isProductAuthorized};root.CatalogAuthorization=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
