import {readFileSync} from 'node:fs';
const API='https://zernio.com/api/v1';
export function zernioKey(){
 try{return readFileSync('/run/secrets/zernio_key','utf8').trim();}
 catch{return process.env.ZERNIO_API_KEY?.trim()||'';}
}
export async function zernio(path:string,options:{method?:'GET'|'POST';body?:object;idempotencyKey?:string}={}){
 const key=zernioKey();
 if(!key)throw new Error('Zernio não configurado no servidor.');
 if(!/^\/?[\w/?=&.%-]+$/.test(path))throw new Error('Rota Zernio inválida.');
 const response=await fetch(API+'/'+path.replace(/^\//,''),{
  method:options.method||'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
   ...(options.idempotencyKey?{'Idempotency-Key':options.idempotencyKey}:{})},
  ...(options.body?{body:JSON.stringify(options.body)}:{})
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(response.status===401||response.status===403?
   'Zernio recusou a credencial.':'Falha Zernio (HTTP '+response.status+').');
 return data;
}
export async function perfilZernio(contaId:string){
 const externalId='harvest-'+contaId;
 const found=await zernio('profiles?externalId='+encodeURIComponent(externalId));
 const existing=Array.isArray(found?.profiles)?found.profiles.find((p:{externalId?:string})=>p.externalId===externalId):null;
 if(existing?._id)return existing._id as string;
 try{
  const created=await zernio('profiles',{method:'POST',
   body:{name:'Harvest '+contaId,externalId},idempotencyKey:'harvest-'+contaId});
  if(typeof created?.profile?._id==='string')return created.profile._id;
 }catch(e){
  // Concorrência pode ter criado o perfil em outra requisição.
  const retry=await zernio('profiles?externalId='+encodeURIComponent(externalId));
  const duplicate=retry?.profiles?.find((p:{externalId?:string})=>p.externalId===externalId);
  if(duplicate?._id)return duplicate._id as string;
  throw e;
 }
 throw new Error('Zernio não retornou o perfil da workspace.');
}
