'use strict';
// Composition checked against the supplier's current catalog photos on 2026-10-29.
// Match the photo too: a changed presentation needs a new composition review.
const known={
 '3SSKRFEP5':{image:'https://images.yampi.me/assets/stores/grupo-ecobelle/uploads/images/kit-coco-camomila-by-vitoria-lima-ecobelle-300-ml-66cf3cd879731-large.png',roles:['wash','condition','treat','finish'],labels:['Shampoo','Condicionador','Máscara','Proteção térmica e solar','Reparador de pontas']},
 '2QSQFLXZ6':{image:'https://images.yampi.me/assets/stores/grupo-ecobelle/uploads/images/kit-doeden-capim-limao-alecrim-6479e42ea3cfc-large.png',roles:['wash','condition','treat'],labels:['Shampoo','Condicionador','Máscara']},
 'LPGSTQBW8':{image:'https://images.yampi.me/assets/stores/grupo-ecobelle/uploads/images/kit-hidrasim-bela-pro-66c69d55659b2-large.png',roles:['wash','condition','treat','finish'],labels:['Shampoo','Condicionador','Máscara','Sérum']},
 'YYYS5P629':{image:'https://images.yampi.me/assets/stores/grupo-ecobelle/uploads/images/kit-nutrisim-bela-pro-6a6a5d128a78f-large.jpeg',roles:['wash','condition','treat','finish'],labels:['Shampoo','Condicionador','Máscara','Creme de pentear','Ampolaço']},
 '7TNHTQDUL':{image:'https://images.yampi.me/assets/stores/grupo-ecobelle/uploads/images/kit-curlys-cachos-bela-pro-66c69c30593a1-large.png',roles:['wash','condition','treat'],labels:['Shampoo','Condicionador','Máscara']}
};
function composition(product){const entry=known[product.sku];return entry&&entry.image===product.image?entry:null;}
module.exports={composition};
