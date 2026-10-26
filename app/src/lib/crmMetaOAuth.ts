import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export type PlataformaMeta='instagram_dm'|'facebook_messenger';
export const ORIGEM_HARVEST='https://harvest.figueiramarketing.com.br';
export const VERSAO_META='v26.0';

export function chaveCriptografia():Buffer|null{
 const chave=process.env.HARVEST_META_TOKEN_KEY??'';
 return /^[a-f0-9]{64}$/i.test(chave)?Buffer.from(chave,'hex'):null;
}
export function cifrarMeta(valor:string):string{
 const chave=chaveCriptografia();
 if(!chave)throw Error('Chave de criptografia Meta não configurada.');
 const nonce=randomBytes(12),alg=createCipheriv('aes-256-gcm',chave,nonce);
 const cifrado=Buffer.concat([alg.update(valor,'utf8'),alg.final()]);
 return [nonce.toString('base64url'),alg.getAuthTag().toString('base64url'),
  cifrado.toString('base64url')].join('.');
}
export function decifrarMeta(valor:string):string{
 const chave=chaveCriptografia();
 if(!chave)throw Error('Chave de criptografia Meta não configurada.');
 const partes=valor.split('.');
 if(partes.length!==3)throw Error('Formato de credencial inválido.');
 const [nonce,tag,conteudo]=partes.map(x=>Buffer.from(x,'base64url'));
 if(nonce.length!==12||tag.length!==16)throw Error('Formato de credencial inválido.');
 const dec=createDecipheriv('aes-256-gcm',chave,nonce);
 dec.setAuthTag(tag);return Buffer.concat([dec.update(conteudo),dec.final()]).toString('utf8');
}
export function configuracaoMeta(tipo:PlataformaMeta):{id:string;secret:string}|null{
 const id=tipo==='instagram_dm'?process.env.HARVEST_INSTAGRAM_APP_ID:process.env.HARVEST_META_APP_ID;
 const secret=tipo==='instagram_dm'?process.env.HARVEST_INSTAGRAM_APP_SECRET:process.env.HARVEST_META_APP_SECRET;
 if(!id?.trim()||!secret?.trim()||!chaveCriptografia())return null;
 return {id:id.trim(),secret:secret.trim()};
}
export function redirectUriMeta(tipo:PlataformaMeta):string{
 return ORIGEM_HARVEST+'/api/meta/oauth/callback/'+(tipo==='instagram_dm'?'instagram':'facebook');
}
export function urlAutorizacaoMeta(tipo:PlataformaMeta,state:string):string{
 const config=configuracaoMeta(tipo);
 if(!config)throw Error('Aplicativo de mensagens Meta não configurado para OAuth.');
 const instagram=tipo==='instagram_dm';
 const url=new URL(instagram?'https://www.instagram.com/oauth/authorize':
  'https://www.facebook.com/'+VERSAO_META+'/dialog/oauth');
 url.searchParams.set('client_id',config.id);
 url.searchParams.set('redirect_uri',redirectUriMeta(tipo));
 url.searchParams.set('response_type','code');
 url.searchParams.set('state',state);
 url.searchParams.set('scope',instagram?
  'instagram_business_basic,instagram_business_manage_messages':
  'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging');
 if(instagram)url.searchParams.set('enable_fb_login','0');
 return url.toString();
}
export function verificarAssinaturaMeta(bruto:Buffer,assinatura:string|null,secret:string):boolean{
 if(!secret||!assinatura||!/^sha256=[a-f0-9]{64}$/i.test(assinatura))return false;
 const recebido=Buffer.from(assinatura.slice(7),'hex');
 const esperado=createHmac('sha256',secret).update(bruto).digest();
 return recebido.length===esperado.length&&timingSafeEqual(recebido,esperado);
}
export function oauthConfigurado(tipo:PlataformaMeta):boolean{
 return Boolean(configuracaoMeta(tipo));
}
