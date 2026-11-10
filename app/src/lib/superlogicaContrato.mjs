// Contrato puro compartilhado pelos testes e pelos Code nodes do export n8n.
// Não contém credenciais, transporte ou acesso ao banco.
export const WORKFLOWS_REALIZE = ['CZ3gAStDKp75yJtm','pqVU7Tceb9Xv8dHs','njZxxrVJrrl6l96i'];

export function telefoneCRM(v) {
  let t=String(v??'').replace(/\D/g,'');
  if(t.length===10||t.length===11)t='55'+t;
  return /^55\d{10,11}$/.test(t)?t:null;
}

export function adaptarLeadParaChild(p) {
  const nome=String(p.cliente??'').trim(), telefone=telefoneCRM(p.telefone);
  if(nome.length<3||!telefone)throw Error('dados_incompativeis_child');
  return {'Nome':nome,'WhatsApp':telefone,'E-mail':String(p.email??'').trim(),
    'Protocolo':p.idempotency_key,'Canal':p.midia??'Harvest - Alea',
    'Origem':p.origem?.utm_source??p.midia??'', 'Campanha':p.origem?.utm_campaign??'',
    'Renda familiar':p.origem?.renda_familiar??'', 'Termo':p.origem?.utm_term??'',
    gclid:p.origem?.gclid??'',
    comentarioLead:p.comentarioLead??'',origem:p.origem??{},
    protocolo_origem:p.origem?.protocolo??p.idempotency_key,
    tenant_id:p.tenant_id,idempotency_key:p.idempotency_key,codigo_anuncio:'CA0653_MMOL'};
}

export function validarEscritorUnico(workflows) {
  const ids=['CZ3gAStDKp75yJtm','pqVU7Tceb9Xv8dHs','njZxxrVJrrl6l96i'];
  for(const id of ids){
    const w=workflows.find(x=>x.id===id);
    if(!w||w.active!==true)throw Error('workflow_nao_publicado');
    const publicado=w.activeVersion??w;
    if(!w.activeVersion && (!w.activeVersionId||w.activeVersionId!==w.versionId))throw Error('versao_publicada_nao_confirmada');
    const nodes=publicado.nodes??[],connections=publicado.connections??{};
    if(id===ids[2]){
      const http=nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');
      if(http.length!==1||http[0].parameters.method!=='POST'||
        http[0].parameters.url!=='https://sr3qgnognj.execute-api.sa-east-1.amazonaws.com/production/cliente'||
        http[0].retryOnFail!==false||http[0].parameters.options?.response?.response?.fullResponse!==true)
        throw Error('child_sem_protecao_de_retry_ou_resposta');
      continue;
    }
    const sheets=nodes.filter(n=>n.type==='n8n-nodes-base.googleSheets');
    if(sheets.length!==1)throw Error('origem_sem_planilha_unica');
    const visitados=new Set(),fila=[sheets[0].name];let capturas=0;
    while(fila.length){const name=fila.shift();if(visitados.has(name))continue;visitados.add(name);
      const n=nodes.find(x=>x.name===name);if(!n)throw Error('conexao_invalida');
      if(n.type==='n8n-nodes-base.executeWorkflow')throw Error('escritor_legado_ainda_conectado');
      if(n.type==='n8n-nodes-base.httpRequest'){
        if(n.parameters.url!=="={{ $env.HARVEST_API_URL + '/api/webhook/bdr' }}"||n.parameters.method!=='POST'||
          n.parameters.jsonBody?.includes('capturar')!==true||!n.credentials?.httpHeaderAuth?.id||
          n.credentials.httpHeaderAuth.id==='SELECIONAR_CREDENCIAL_EXISTENTE')throw Error('rota_de_captura_nao_verificada');
        capturas++;
      }
      for(const groups of Object.values(connections[name]??{}))for(const group of groups)for(const edge of group)fila.push(edge.node);
    }
    if(capturas!==1)throw Error('origem_sem_captura_exclusiva');
  }
  return true;
}

/** Consulta LEADS é um contrato separado da escrita. Nunca confia em um booleano do child. */
export function analisarConsultaLeads(p,r) {
  if(r?.fonte!=='api_leads'||r.status_http!==200||!Array.isArray(r.leads)||r.completa!==true)
    return {status:'reconciliar',erro:'consulta_nao_confirmada'};
  const tel=telefoneCRM(p.telefone),email=String(p.email??'').trim().toLowerCase();
  const matches=r.leads.filter(l=>{
    if(l.codigo_anuncio!=='CA0653_MMOL'||!String(l.id_superlogica??'').trim())return false;
    const lt=telefoneCRM(l.telefone),le=String(l.email??'').trim().toLowerCase();
    return (tel?lt===tel:!!email&&le===email) && (!email||!le||le===email);
  });
  if(matches.length===1)return {status:'cadastrado',confirmado_crm:true,
    id_superlogica:String(matches[0].id_superlogica),codigo_anuncio:'CA0653_MMOL',
    tenant_id:p.tenant_id,idempotency_key:p.idempotency_key,origem_confirmacao:'api_leads'};
  if(matches.length>1)return {status:'reconciliar',erro:'multiplos_cadastros_crm'};
  // Um registro com identidade correspondente mas imóvel divergente não autoriza outro POST.
  if(r.leads.length)return {status:'reconciliar',erro:'identidade_ou_imovel_divergente'};
  return {status:'ausente'};
}
