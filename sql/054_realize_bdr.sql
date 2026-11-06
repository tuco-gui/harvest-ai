-- 054: BDR especializado: metadados de orquestração, não uma segunda Inbox.
-- Nenhum tenant/canal é criado ou habilitado por esta migration.
BEGIN;
CREATE TABLE public.bdr_config (
 conta_id uuid PRIMARY KEY REFERENCES public.contas(id) ON DELETE CASCADE,
 canal_id bigint NOT NULL REFERENCES public.whatsapp_canais(id),
 funil_id bigint NOT NULL REFERENCES public.funis(id),
 codigo_anuncio text NOT NULL DEFAULT 'CA0653_MMOL' CHECK(codigo_anuncio='CA0653_MMOL'),
 modo text NOT NULL DEFAULT 'simulacao' CHECK(modo IN('simulacao','homologacao','producao')),
 aprovado_em timestamptz, aprovado_por uuid REFERENCES public.perfis(id),
 evidencia_homologacao text,
 crm_habilitado boolean NOT NULL DEFAULT false,
 responsavel_crm_confirmado boolean NOT NULL DEFAULT false,
 base_aprovada text NOT NULL DEFAULT '',
 contatos_teste text[] NOT NULL DEFAULT '{}',
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(modo<>'producao' OR (aprovado_em IS NOT NULL AND aprovado_por IS NOT NULL
   AND length(evidencia_homologacao)>20 AND responsavel_crm_confirmado AND crm_habilitado))
);
CREATE TABLE public.bdr_sessoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.bdr_config(conta_id),
 canal_id bigint NOT NULL REFERENCES public.whatsapp_canais(id),
 telefone text NOT NULL CHECK(telefone ~ '^55[0-9]{10,11}$'),
 lead_id bigint REFERENCES public.prospecta_leads(id),
 estado text NOT NULL DEFAULT 'novo' CHECK(estado IN('novo','contato_iniciado','em_qualificacao',
  'qualificado','aguardando_corretor','transferido','sem_resposta','nutricao','desqualificado','opt_out','humano_assumiu')),
 qualificacao jsonb NOT NULL DEFAULT '{}',
 resumo text NOT NULL DEFAULT '',
 ultima_entrada_id bigint REFERENCES public.inbound_eventos(id),
 processada_entrada_id bigint REFERENCES public.inbound_eventos(id),
 turno_pendente boolean NOT NULL DEFAULT true,
 proxima_execucao timestamptz NOT NULL DEFAULT now(),
 ultima_resposta_em timestamptz,
 cadencia_inicio timestamptz,
 proximo_followup timestamptz,
 followups integer NOT NULL DEFAULT 0 CHECK(followups BETWEEN 0 AND 4),
 consentimento_followup boolean NOT NULL DEFAULT false,
 versao bigint NOT NULL DEFAULT 0,
 bloqueado_ate timestamptz,
 envio_pendente boolean NOT NULL DEFAULT false,
 erro text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,canal_id,telefone), UNIQUE(conta_id,id)
);
CREATE TABLE public.superlogica_registros (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.bdr_config(conta_id),
 lead_id_harvest bigint REFERENCES public.prospecta_leads(id),
 telefone text, email text, nome text NOT NULL,
 codigo_anuncio text NOT NULL DEFAULT 'CA0653_MMOL' CHECK(codigo_anuncio='CA0653_MMOL'),
 origem jsonb NOT NULL,
 id_superlogica text,
 status_sincronizacao text NOT NULL DEFAULT 'pendente' CHECK(status_sincronizacao IN
 ('pendente','processando','cadastrado','retry','reconciliar','falha')),
 tentativas integer NOT NULL DEFAULT 0,
 proxima_tentativa timestamptz NOT NULL DEFAULT now(),
 erro_tecnico text,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(telefone IS NOT NULL OR email IS NOT NULL), UNIQUE(conta_id,id)
);
CREATE UNIQUE INDEX superlogica_tel ON public.superlogica_registros(conta_id,codigo_anuncio,telefone) WHERE telefone IS NOT NULL;
CREATE UNIQUE INDEX superlogica_email ON public.superlogica_registros(conta_id,codigo_anuncio,email) WHERE email IS NOT NULL;
CREATE TABLE public.superlogica_entradas (
 conta_id uuid NOT NULL, chave text NOT NULL CHECK(length(chave) BETWEEN 3 AND 300),
 registro_id uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conta_id,chave),
 FOREIGN KEY(conta_id,registro_id) REFERENCES public.superlogica_registros(conta_id,id)
);
-- Ledger de decisões/saídas. Mensagens continuam em inbound_eventos/prospecta_mensagens.
CREATE TABLE public.bdr_execucoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL, sessao_id uuid NOT NULL,
 chave text NOT NULL, tipo text NOT NULL CHECK(tipo IN('resposta','followup','assumir','liberar','visita_confirmada','consentimento')),
 status text NOT NULL CHECK(status IN('simulado','reservado','enviado','incerto','registrado')),
 mensagem_id bigint REFERENCES public.prospecta_mensagens(id),
 previa text, autor_id uuid REFERENCES public.perfis(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conta_id,sessao_id) REFERENCES public.bdr_sessoes(conta_id,id),
 UNIQUE(conta_id,sessao_id,chave)
);

CREATE FUNCTION public.bdr_validar_workspace() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_canais WHERE id=NEW.canal_id AND conta_id=NEW.conta_id)
 THEN RAISE EXCEPTION 'Canal fora da workspace'; END IF;
 IF TG_TABLE_NAME='bdr_config' THEN
  IF NOT EXISTS(SELECT 1 FROM public.funis WHERE id=NEW.funil_id AND conta_id=NEW.conta_id
   AND canal_padrao_id=NEW.canal_id) THEN RAISE EXCEPTION 'Funil fora do canal/workspace'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.bdr_config WHERE conta_id=NEW.conta_id AND canal_id=NEW.canal_id)
   THEN RAISE EXCEPTION 'Sessão fora do canal configurado'; END IF;
  IF NEW.ultima_entrada_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inbound_eventos
    WHERE id=NEW.ultima_entrada_id AND conta_id=NEW.conta_id AND canal_id=NEW.canal_id AND telefone=NEW.telefone)
   THEN RAISE EXCEPTION 'Entrada fora da conversa'; END IF;
  IF NEW.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.prospecta_leads
    WHERE id=NEW.lead_id AND conta_id=NEW.conta_id) THEN RAISE EXCEPTION 'Lead fora da workspace'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bdr_config_workspace BEFORE INSERT OR UPDATE ON public.bdr_config FOR EACH ROW EXECUTE FUNCTION public.bdr_validar_workspace();
CREATE TRIGGER bdr_sessao_workspace BEFORE INSERT OR UPDATE ON public.bdr_sessoes FOR EACH ROW EXECUTE FUNCTION public.bdr_validar_workspace();

-- Captura atômica de primeira origem e aliases de protocolo. Não depende de qualificação.
CREATE FUNCTION public.superlogica_capturar(p_conta uuid,p_chave text,p_nome text,p_telefone text,p_email text,p_origem jsonb,p_lead bigint DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_ids uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text,51));
 IF NOT EXISTS(SELECT 1 FROM public.bdr_config WHERE conta_id=p_conta) THEN RETURN NULL; END IF;
 IF length(btrim(p_nome))<2 OR (p_telefone IS NULL AND p_email IS NULL) THEN RETURN NULL; END IF;
 IF p_lead IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.prospecta_leads WHERE id=p_lead AND conta_id=p_conta)
 THEN RAISE EXCEPTION 'Lead fora da workspace'; END IF;
 SELECT registro_id INTO v_id FROM public.superlogica_entradas WHERE conta_id=p_conta AND chave=p_chave;
 IF FOUND THEN RETURN v_id; END IF;
 SELECT array_agg(id) INTO v_ids FROM public.superlogica_registros WHERE conta_id=p_conta
  AND ((p_telefone IS NOT NULL AND telefone=p_telefone) OR (p_email IS NOT NULL AND email=lower(p_email)));
 IF cardinality(v_ids)>1 THEN RAISE EXCEPTION 'Identificadores conflitantes: reconciliação humana'; END IF;
 v_id:=v_ids[1];
 IF v_id IS NULL THEN
  INSERT INTO public.superlogica_registros(conta_id,nome,telefone,email,origem,lead_id_harvest)
   VALUES(p_conta,left(p_nome,160),p_telefone,lower(p_email),p_origem,p_lead) RETURNING id INTO v_id;
 ELSE
  UPDATE public.superlogica_registros SET telefone=coalesce(telefone,p_telefone),email=coalesce(email,lower(p_email)),
   lead_id_harvest=coalesce(lead_id_harvest,p_lead) WHERE id=v_id AND conta_id=p_conta;
 END IF;
 INSERT INTO public.superlogica_entradas(conta_id,chave,registro_id) VALUES(p_conta,p_chave,v_id);
 RETURN v_id;
END $$;

-- Reserva antes de efeitos externos. Crash após reserva nunca repete POST/envio às cegas.
CREATE FUNCTION public.bdr_reservar(p_conta uuid,p_sessao uuid,p_versao bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.bdr_sessoes SET bloqueado_ate=now()+interval '3 minutes'
  WHERE conta_id=p_conta AND id=p_sessao AND versao=p_versao
   AND (bloqueado_ate IS NULL OR bloqueado_ate<now()) AND NOT envio_pendente;
 RETURN FOUND;
END $$;

CREATE FUNCTION public.bdr_receber(p_conta uuid,p_evento bigint,p_estado text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e record; s record; v_lead bigint; v_id uuid;
BEGIN
 SELECT i.* INTO e FROM public.inbound_eventos i JOIN public.bdr_config c
  ON c.conta_id=i.conta_id AND c.canal_id=i.canal_id AND c.funil_id=i.funil_id
  WHERE i.id=p_evento AND i.conta_id=p_conta;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text||':'||e.canal_id||':'||e.telefone,52));
 SELECT * INTO s FROM public.bdr_sessoes WHERE conta_id=p_conta AND canal_id=e.canal_id AND telefone=e.telefone FOR UPDATE;
 IF FOUND AND s.ultima_entrada_id>=p_evento THEN RETURN s.id; END IF;
 IF s.id IS NULL THEN
  SELECT id INTO v_lead FROM public.prospecta_leads WHERE conta_id=p_conta AND telefone=e.telefone ORDER BY id LIMIT 1;
  IF v_lead IS NULL THEN
   INSERT INTO public.prospecta_leads(conta_id,empresa,telefone,origem,status)
    VALUES(p_conta,coalesce(nullif(e.nome_contato,''),'Contato WhatsApp'),e.telefone,'inbox','respondeu') RETURNING id INTO v_lead;
  END IF;
  INSERT INTO public.bdr_sessoes(conta_id,canal_id,telefone,lead_id,ultima_entrada_id,estado)
   VALUES(p_conta,e.canal_id,e.telefone,v_lead,p_evento,coalesce(p_estado,'novo')) RETURNING id INTO v_id;
 ELSE
  v_id:=s.id; v_lead:=s.lead_id;
  UPDATE public.bdr_sessoes SET ultima_entrada_id=p_evento,versao=versao+1,
   estado=CASE WHEN s.estado='opt_out' THEN 'opt_out'
    WHEN p_estado='opt_out' THEN 'opt_out'
    WHEN s.estado IN('humano_assumiu','transferido','aguardando_corretor') THEN s.estado
    ELSE coalesce(p_estado,CASE WHEN s.estado='sem_resposta' THEN 'em_qualificacao' ELSE s.estado END) END,
   proximo_followup=NULL,followups=0,cadencia_inicio=NULL,turno_pendente=true,proxima_execucao=now(),atualizado_em=now()
   WHERE id=v_id AND conta_id=p_conta;
 END IF;
 UPDATE public.bdr_sessoes SET resumo=jsonb_build_object('imovel','CA0653_MMOL','origem','whatsapp',
  'qualificacao',qualificacao,'ultima_mensagem',e.mensagem,'estado',estado,
  'proxima_acao',CASE WHEN estado='aguardando_corretor' THEN 'Corretor deve assumir e confirmar condições/horários'
   WHEN estado='opt_out' THEN 'Não contatar' ELSE 'Continuar atendimento' END)::text
  WHERE id=v_id AND conta_id=p_conta;
 UPDATE public.inbound_eventos SET lead_id=v_lead WHERE id=p_evento AND conta_id=p_conta AND lead_id IS NULL;
 RETURN v_id;
END $$;

-- Vínculo explícito de inbox ao transporte, sem inferência por telefone/nome.
ALTER TABLE public.chatwoot_inboxes ADD COLUMN IF NOT EXISTS whatsapp_canal_id bigint REFERENCES public.whatsapp_canais(id);
CREATE FUNCTION public.bdr_validar_canal_chatwoot() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.chatwoot_account_id::text||':'||NEW.chatwoot_inbox_id::text,53));
 IF NEW.whatsapp_canal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.whatsapp_canais
  WHERE id=NEW.whatsapp_canal_id AND conta_id=NEW.conta_id) THEN RAISE EXCEPTION 'Canal Chatwoot fora da workspace'; END IF;
 IF NEW.ativo AND EXISTS(SELECT 1 FROM public.chatwoot_inboxes WHERE conta_id<>NEW.conta_id
  AND chatwoot_account_id=NEW.chatwoot_account_id AND chatwoot_inbox_id=NEW.chatwoot_inbox_id AND ativo)
 THEN RAISE EXCEPTION 'Inbox já vinculada a outra workspace'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bdr_chatwoot_workspace BEFORE INSERT OR UPDATE ON public.chatwoot_inboxes
 FOR EACH ROW EXECUTE FUNCTION public.bdr_validar_canal_chatwoot();
ALTER TABLE public.inbound_eventos ADD COLUMN IF NOT EXISTS mensagem_fisica_id text;
CREATE UNIQUE INDEX inbound_mensagem_fisica ON public.inbound_eventos(conta_id,canal_id,mensagem_fisica_id)
 WHERE canal_id IS NOT NULL AND mensagem_fisica_id IS NOT NULL;

CREATE FUNCTION public.bdr_kpis(p_conta uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
  'recebidos',(SELECT count(*) FROM superlogica_registros WHERE conta_id=p_conta)+
   (SELECT count(*) FROM bdr_sessoes s WHERE s.conta_id=p_conta AND NOT EXISTS
    (SELECT 1 FROM superlogica_registros r WHERE r.conta_id=p_conta AND r.telefone=s.telefone)),
  'cadastrados_crm',(SELECT count(*) FROM superlogica_registros WHERE conta_id=p_conta AND status_sincronizacao='cadastrado'),
  'atendidos',(SELECT count(DISTINCT sessao_id) FROM bdr_execucoes WHERE conta_id=p_conta AND tipo='resposta' AND status='enviado'),
  'respondidos',(SELECT count(*) FROM bdr_sessoes WHERE conta_id=p_conta),
  'qualificados',(SELECT count(*) FROM bdr_sessoes WHERE conta_id=p_conta AND qualificacao->>'interesse'='confirmado'
    AND length(qualificacao->>'prazo')>0 AND length(qualificacao->>'disponibilidade')>0),
  'encaminhados',(SELECT count(*) FROM bdr_sessoes WHERE conta_id=p_conta AND estado IN('aguardando_corretor','humano_assumiu','transferido')),
  'visitas_confirmadas_humano',(SELECT count(DISTINCT sessao_id) FROM bdr_execucoes WHERE conta_id=p_conta AND tipo='visita_confirmada' AND autor_id IS NOT NULL),
  'falhas',(SELECT count(*) FROM bdr_sessoes WHERE conta_id=p_conta AND erro IS NOT NULL)+
   (SELECT count(*) FROM superlogica_registros WHERE conta_id=p_conta AND status_sincronizacao IN('retry','falha','reconciliar'))
 );
$$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['bdr_config','bdr_sessoes','bdr_execucoes','superlogica_registros','superlogica_entradas','crm_vinculos','chatwoot_inboxes'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.superlogica_capturar(uuid,text,text,text,text,jsonb,bigint),public.bdr_reservar(uuid,uuid,bigint),public.bdr_receber(uuid,bigint,text),public.bdr_kpis(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.superlogica_capturar(uuid,text,text,text,text,jsonb,bigint),public.bdr_reservar(uuid,uuid,bigint),public.bdr_receber(uuid,bigint,text),public.bdr_kpis(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
