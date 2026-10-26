import {createHmac} from 'node:crypto';
import {zernioKey,zernio} from '@/lib/crmZernio';
export function webhookSecret(fonteId:string){
 const key=zernioKey();
 if(!key)throw Error('Zernio não configurado.');
 return createHmac('sha256',key).update('harvest-zernio-webhook-v1:'+fonteId).digest('hex');
}
export async function assinarFonte(fonteId:string,profileId:string,accountId:string){
 const url='https://harvest.figueiramarketing.com.br/api/webhook/zernio/'+fonteId;
 const existentes=await zernio('webhooks/settings');
 const match=Array.isArray(existentes?.webhooks)?existentes.webhooks.find(
  (w:{url?:string;isActive?:boolean;_id?:string})=>w.url===url&&w.isActive===true):null;
 if(match?._id)return match._id as string;
 const resultado=await zernio('webhooks/settings',{method:'POST',body:{
  name:'Harvest '+fonteId.slice(0,8),url,secret:webhookSecret(fonteId),
  events:['message.received','message.sent','message.delivered','message.read','message.failed'],
  accountIds:[accountId],profileIds:[profileId],isActive:true
 }});
 if(!resultado?.webhook?._id)throw Error('Webhook Zernio não confirmado.');
 return resultado.webhook._id as string;
}
