import {WORKFLOWS_REALIZE} from '../app/src/lib/superlogicaContrato.mjs';

/** Transformação offline dos exports atuais. Não conecta, publica ou importa workflows. */
export function prepararCutover(workflows,credencial={id:'SELECIONAR_CREDENCIAL_EXISTENTE',name:'Selecionar credencial Harvest existente'}){
  return WORKFLOWS_REALIZE.map(id=>{
    const original=workflows.find(w=>w.id===id);if(!original)throw Error('export_ausente');
    const w=structuredClone(original);w.active=false;delete w.activeVersion;
    if(id==='njZxxrVJrrl6l96i'){
      const n=w.nodes.find(n=>n.id==='618f1476-aa5f-47c9-ae90-9fd3fcae76f0');
      if(!n||n.type!=='n8n-nodes-base.httpRequest')throw Error('child_divergiu');
      n.retryOnFail=false;n.maxTries=1;n.onError='continueRegularOutput';
      n.parameters.options={...n.parameters.options,response:{response:{fullResponse:true,neverError:true}}};
    }else{
      const nodeId=id==='CZ3gAStDKp75yJtm'?'9129069e-ecff-4ad9-b4ec-51f562ba8008':'3bea5a77-e26f-4d25-8862-353d9709bf30';
      const n=w.nodes.find(n=>n.id===nodeId);if(!n||n.type!=='n8n-nodes-base.executeWorkflow')throw Error('origem_divergiu');
      // Mesmo ID/nome mantém as conexões planilha/resposta; substitui a única aresta de escrita.
      n.type='n8n-nodes-base.httpRequest';n.typeVersion=4.2;n.retryOnFail=false;
      n.credentials={httpHeaderAuth:credencial};
      const source=id==='CZ3gAStDKp75yJtm'?'lp':'minichat';
      n.parameters={method:'POST',url:"={{ $env.HARVEST_API_URL + '/api/webhook/bdr' }}",
        authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',
        jsonBody:`={{ { acao: 'capturar', tenant_id: $env.BDR_TICK_WORKSPACE_ID, protocolo: $json.Protocolo, nome: $json.Nome, telefone: $json.WhatsApp, email: $json['E-mail'], origem: { source_channel: '${source}', utm_source: $json.Origem, utm_medium: $json['Mídia'], utm_campaign: $json.Campanha, gclid: $json.gclid, fbclid: $json.fbclid, anuncio: $json['Anúncio / content'], referral: $json.Referenciador } } }}`,options:{timeout:30000}};
    }
    return w;
  });
}
