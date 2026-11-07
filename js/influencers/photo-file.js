export async function readProfilePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 8 MB.');
 const image=await createImageBitmap(file,{imageOrientation:'from-image'});
 try{
  if(!image.width||!image.height||image.width*image.height>30000000)throw Error('Escolha uma foto menor.');
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;
  const context=canvas.getContext('2d'),side=Math.min(image.width,image.height);
  context.fillStyle='#fff';context.fillRect(0,0,480,480);context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,480,480);
  return canvas.toDataURL('image/jpeg',.86);
 }finally{image.close();}
}
