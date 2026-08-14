-- Leitura apenas — auditoria dos eventos inbound antigos afetados por LID.
select
  id,
  conta_id,
  provider,
  telefone,
  lead_id,
  tipo_evento,
  message_id_externo,
  criado_em,
  (telefone ~ '@lid' or telefone ~ '[^0-9+]') as telefone_suspeito_lid,
  length(regexp_replace(telefone, '[^0-9]', '', 'g')) as digitos_telefone
from public.inbound_eventos
order by criado_em asc;
