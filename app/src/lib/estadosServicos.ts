import type {SupabaseClient} from '@supabase/supabase-js';
/** Somente estado persistido. Nunca conecta, cria sessão ou envia durante a leitura. */
export async function carregarEstadosServicos(db:SupabaseClient,contaId:string){
 const [cred,canais,fontes,agentes,bdr]=await Promise.all([
  db.from('conta_credenciais').select('serpapi_key,ia_key,evolution_url,evolution_instancia,evolution_key').eq('conta_id',contaId).maybeSingle(),
  db.from('whatsapp_canais').select('provider,ativo,status,numero,atualizado_em').eq('conta_id',contaId),
  db.from('crm_fontes_funil').select('tipo,status,meta_token_cifrado,zernio_account_id,atualizado_em').eq('conta_id',contaId),
  db.from('agentes_workspace').select('tipo,ativo').eq('conta_id',contaId),
  db.from('bdr_config').select('modo,aprovado_em,aprovado_por,crm_habilitado,canal_id').eq('conta_id',contaId).maybeSingle(),
 ]);
 const estados:Record<string,{configurado:boolean|null;conectado:boolean|null;ativado:boolean|null;ia_autorizada:boolean|null;nota?:string}>={};
 const base=()=>({configurado:null,conectado:null,ativado:null,ia_autorizada:null});
 estados['integracoes.serpapi']={...base(),configurado:cred.error?null:!!cred.data?.serpapi_key};
 estados['integracoes.ia']={...base(),configurado:cred.error?null:!!cred.data?.ia_key};
 estados['inbox.whatsapp']={...base(),configurado:canais.error||cred.error?null:(canais.data??[]).some(c=>c.provider==='waha'?!!process.env.WAHA_API_URL&&!!process.env.WAHA_API_KEY&&!!process.env.WAHA_WEBHOOK_HMAC_KEY:!!cred.data?.evolution_url&&!!cred.data?.evolution_instancia&&!!cred.data?.evolution_key),
  conectado:canais.error?null:canais.data?.some(c=>c.ativo&&c.status==='conectado'&&c.numero)||false,
  ativado:canais.error?null:canais.data?.some(c=>c.ativo)||false,nota:'Último estado persistido do canal; pareamento não é executado aqui.'};
 for(const [k,t]of [['inbox.instagram','instagram_dm'],['inbox.facebook','facebook_messenger'],['inbox.webchat','webchat']]){
  const fs=(fontes.data??[]).filter(f=>f.tipo===t);
  estados[k]={...base(),configurado:fontes.error?null:fs.some(f=>t==='webchat'||!!f.meta_token_cifrado||!!f.zernio_account_id),
   conectado:null,ativado:fontes.error?null:fs.some(f=>f.status==='pronto'),nota:'Autorização configurada e fonte pronta não comprovam sessão online.'};
 }
 estados['agentes.base']={...base(),configurado:agentes.error?null:!!agentes.data?.length,ativado:agentes.error?null:agentes.data?.some(a=>a.ativo)||false,
  ia_autorizada:bdr.error||agentes.error?null:!!(bdr.data?.modo==='producao'&&bdr.data.aprovado_em&&bdr.data.aprovado_por&&agentes.data?.some(a=>a.tipo==='bdr'&&a.ativo)),
  nota:'Ativo no catálogo não autoriza respostas. Modo de produção, aprovação e guardas operacionais continuam obrigatórios.'};
 estados['agentes.bdr']={...estados['agentes.base'],ativado:agentes.error?null:agentes.data?.some(a=>a.tipo==='bdr'&&a.ativo)||false,
  nota:'BDR: '+(bdr.data?.modo??'não configurado')+'. Autorização global não dispensa as guardas por canal/contato.'};
 estados['integracoes.waha']={...estados['inbox.whatsapp']};
 estados['integracoes.meta']={...base(),configurado:fontes.error?null:(fontes.data??[]).some(f=>!!f.meta_token_cifrado),ativado:fontes.error?null:(fontes.data??[]).some(f=>!!f.meta_token_cifrado&&f.status==='pronto')};
 estados['integracoes.zernio']={...base(),configurado:fontes.error?null:(fontes.data??[]).some(f=>!!f.zernio_account_id),ativado:fontes.error?null:(fontes.data??[]).some(f=>!!f.zernio_account_id&&f.status==='pronto')};
 estados['integracoes.superlogica']={...base(),configurado:bdr.error?null:!!bdr.data,ativado:bdr.error?null:!!bdr.data?.crm_habilitado};
 return estados;
}
