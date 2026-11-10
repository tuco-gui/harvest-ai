export const CAMPOS_RECURSO:Record<string,string>={
 serpapi_key:'integracoes.serpapi',evolution_key:'integracoes.waha',evolution_url:'integracoes.waha',evolution_instancia:'integracoes.waha',whatsapp_provider:'integracoes.waha',
 ia_key:'integracoes.ia',ia_provedor:'integracoes.ia',ia_modelo:'integracoes.ia',
 perplexity_key:'integracoes.enriquecimento',decisor_provedor:'integracoes.enriquecimento',serper_key:'integracoes.enriquecimento',tavily_key:'integracoes.enriquecimento',linkedin_provedor:'integracoes.enriquecimento',email_provedor:'integracoes.enriquecimento',anymail_key:'integracoes.enriquecimento',apollo_key:'integracoes.enriquecimento',snov_client_id:'integracoes.enriquecimento',snov_client_secret:'integracoes.enriquecimento',
 modo:'prospeccao.campanhas',mensagens:'prospeccao.campanhas',contexto:'prospeccao.campanhas',intervalo_min:'prospeccao.campanhas',intervalo_max:'prospeccao.campanhas',
};
export function filtrarConfiguracao(b:Record<string,unknown>,liberados?:string[]){return liberados?Object.fromEntries(Object.entries(b).filter(([k])=>!CAMPOS_RECURSO[k]||liberados.includes(CAMPOS_RECURSO[k]))):b;}
