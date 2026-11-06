type Obj = Record<string, any>;
/** Chatwoot envia message_created com campos no topo; aceita também o envelope antigo. */
export function normalizarWebhookChatwoot(body: Obj) {
  const atualizado = body.event==='conversation_updated';
  const conv = body.conversation??(atualizado?body:{});
  const m = atualizado?{...body,id:conv.id}:body.message??body;
  const contato = body.contact??(body.sender?.type==='contact'?body.sender:null)??conv.meta?.sender??{};
  const accountId = body.account?.id;
  const inboxId = body.inbox?.id??conv.inbox_id;
  const conversationId = conv.id;
  if (![accountId,inboxId,conversationId,m.id].every(x=>Number.isSafeInteger(x)&&x>0)) return null;
  const tipo = m.message_type;
  const incoming = tipo==='incoming'||tipo===0;
  const outgoing = tipo==='outgoing'||tipo===1;
  const createdAt = m.created_at;
  const date = typeof createdAt==='number'?new Date(createdAt*1000):new Date(createdAt??Date.now());
  if (!Number.isFinite(date.getTime())) return null;
  return {accountId,inboxId,conversationId,id:m.id,incoming,outgoing,privada:m.private===true,
    conteudo:typeof m.content==='string'?m.content:null,
    telefone:typeof contato.phone_number==='string'?contato.phone_number:'',
    nome:typeof contato.name==='string'?contato.name:null,timestamp:date.toISOString(),
    sourceId:typeof m.source_id==='string'&&m.source_id.length<=300?m.source_id:null,
    atribuidaHumano:Number.isSafeInteger(conv.meta?.assignee?.id) && conv.meta.assignee.id>0,
    humano:(outgoing && (m.sender?.type==='user'||body.sender?.type==='user')) ||
      (atualizado && Number.isSafeInteger(conv.meta?.assignee?.id) && conv.meta.assignee.id>0),
  };
}
