import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanalWhatsApp } from './whatsappCanais.ts';

type Credenciais = {url:string;instancia:string;key:string};
function validarUrl(url:string):string {
  const u=new URL(url);
  if(u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw Error('URL Evolution inválida.');
  if(u.protocol==='http:' && !['evolution_evolution_api','evolution-api','evolution'].includes(u.hostname)) throw Error('Evolution exige HTTPS externo.');
  return u.origin+u.pathname.replace(/\/+$/,'');
}
export async function credencialEvolution(admin:SupabaseClient,contaId:string,canal:CanalWhatsApp):Promise<Credenciais>{
  if(canal.conta_id!==contaId||canal.provider!=='evolution'||!canal.ativo)
    throw Error('Canal Evolution não disponível nesta conta.');
  const {data,error}=await admin.from('conta_credenciais')
    .select('evolution_url,evolution_instancia,evolution_key')
    .eq('conta_id',contaId).maybeSingle();
  if(error||!data?.evolution_url||!data.evolution_instancia||!data.evolution_key||
     canal.identificador_externo!==data.evolution_instancia)
    throw Error('Instância Evolution não configurada ou não pertence à workspace.');
  return {url:validarUrl(data.evolution_url),instancia:data.evolution_instancia,key:data.evolution_key};
}
async function consulta(c:Credenciais,endpoint:string):Promise<{ok:boolean;status:number;body:any}>{
  const r=await fetch(c.url+endpoint,{headers:{apikey:c.key,Accept:'application/json'},
    signal:AbortSignal.timeout(12000),cache:'no-store',redirect:'error'});
  const body=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,body};
}
export function statusEvolution(d:any):boolean {
  return d?.instance?.state==='open'||d?.state==='open'||d?.instance?.status==='open';
}
export function qrEvolution(d:any):string|null {
  for(const val of [d?.base64,d?.qrcode?.base64,d?.qrcode?.code,d?.data?.base64,d?.data?.qrcode?.base64]){
    if(typeof val!=='string')continue;
    if(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(val))return val;
    if(/^[A-Za-z0-9+/=]{200,}$/.test(val))return 'data:image/png;base64,'+val;
  }
  return null;
}
export async function estadoEvolution(c:Credenciais):Promise<{status:string;qr:string|null;numero:null}>{
  const path=encodeURIComponent(c.instancia);
  const st=await consulta(c,'/instance/connectionState/'+path);
  if(st.ok&&statusEvolution(st.body))return {status:'WORKING',qr:null,numero:null};
  const conect=await consulta(c,'/instance/connect/'+path);
  if(!conect.ok)throw Error('Evolution indisponível para conectar.');
  const qr=qrEvolution(conect.body);
  return {status:qr?'SCAN_QR_CODE':'STARTING',qr,numero:null};
}
export async function codigoEvolution(c:Credenciais,telefone:string):Promise<string>{
  const numero=telefone.replace(/\D/g,'');
  if(!/^\d{10,15}$/.test(numero))throw Error('Telefone inválido.');
  const path=encodeURIComponent(c.instancia);
  const st=await consulta(c,'/instance/connectionState/'+path);
  if(st.ok&&statusEvolution(st.body))throw Error('Canal já conectado.');
  const r=await consulta(c,'/instance/connect/'+path+'?number='+encodeURIComponent(numero));
  if(!r.ok)throw Error('Evolution não gerou código de pareamento.');
  const codigo=r.body?.pairingCode??r.body?.data?.pairingCode;
  if(typeof codigo!=='string'||!/^[A-Z0-9-]{6,12}$/i.test(codigo))
    throw Error('Evolution não retornou código válido. Use QR Code.');
  return codigo;
}
