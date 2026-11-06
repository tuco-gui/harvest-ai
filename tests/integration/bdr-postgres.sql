-- Somente dados fictícios em tenants novos. Runner remoto SEMPRE usa ROLLBACK.
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c bigint; f bigint; e bigint; s uuid; r uuid; r2 uuid; x uuid; n bigint;
BEGIN
 INSERT INTO contas(id,nome,slug) VALUES(a,'Teste rollback BDR','bdr-'||a),(b,'Teste tenant BDR B','bdr-'||b);
 INSERT INTO whatsapp_canais(conta_id,nome,provider) VALUES(a,'Teste BDR','waha') RETURNING id INTO c;
 INSERT INTO funis(conta_id,nome,canal_padrao_id) VALUES(a,'Alea teste',c) RETURNING id INTO f;
 INSERT INTO bdr_config(conta_id,canal_id,funil_id) VALUES(a,c,f);
 BEGIN
  INSERT INTO bdr_config(conta_id,canal_id,funil_id) VALUES(b,c,f);
  RAISE EXCEPTION 'Cruzou workspace';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Cruzou workspace' THEN RAISE; END IF; END;
 -- Preserva assunção anterior à sessão e ainda registra o inbound.
 PERFORM bdr_assumir(a,c,'5514999999999');
 INSERT INTO inbound_eventos(conta_id,canal_id,funil_id,telefone,nome_contato,mensagem,provider,message_id_externo,payload_bruto)
  VALUES(a,c,f,'5514999999999','Teste controlado','Olá','waha',gen_random_uuid()::text,'{}') RETURNING id INTO e;
 s:=bdr_receber(a,e,NULL);
 IF NOT EXISTS(SELECT 1 FROM bdr_sessoes WHERE id=s AND estado='humano_assumiu') THEN RAISE EXCEPTION 'Ownership perdido'; END IF;
 IF bdr_receber(a,e,NULL)<>s THEN RAISE EXCEPTION 'Sessão duplicada'; END IF;
 SELECT versao INTO n FROM bdr_sessoes WHERE id=s;
 IF NOT bdr_liberar(a,s,n) THEN RAISE EXCEPTION 'Não liberou com versão correta'; END IF;
 IF EXISTS(SELECT 1 FROM bdr_pausas WHERE conta_id=a AND humano) THEN RAISE EXCEPTION 'Pausa não liberada'; END IF;
 -- O ledger só libera reserva comprovadamente não enviada.
 UPDATE bdr_sessoes SET envio_pendente=true WHERE id=s;
 INSERT INTO bdr_execucoes(conta_id,sessao_id,chave,tipo,status) VALUES(a,s,'turno','resposta','reservado') RETURNING id INTO x;
 IF bdr_cancelar_saida(b,x) THEN RAISE EXCEPTION 'Cancelamento cruzou workspace'; END IF;
 IF NOT bdr_cancelar_saida(a,x) THEN RAISE EXCEPTION 'Não cancelou reserva'; END IF;
 IF EXISTS(SELECT 1 FROM bdr_sessoes WHERE id=s AND envio_pendente) THEN RAISE EXCEPTION 'Reserva ficou bloqueada'; END IF;
 INSERT INTO bdr_execucoes(conta_id,sessao_id,chave,tipo,status) VALUES(a,s,'turno','resposta','enviado') RETURNING id INTO x;
 IF bdr_cancelar_saida(a,x) THEN RAISE EXCEPTION 'Cancelou envio confirmado'; END IF;
 r:=superlogica_capturar(a,'lp:teste','Teste controlado','5514999999999','teste@example.test','{"source_channel":"lp"}');
 r2:=superlogica_capturar(a,'minichat:teste','Teste controlado','5514999999999','teste@example.test','{"source_channel":"minichat"}');
 IF r<>r2 OR (SELECT count(*) FROM superlogica_registros WHERE conta_id=a)<>1 THEN RAISE EXCEPTION 'Cadastro duplicado'; END IF;
 IF (SELECT origem->>'source_channel' FROM superlogica_registros WHERE id=r)<>'lp' THEN RAISE EXCEPTION 'Origem sobrescrita'; END IF;
 IF has_function_privilege('authenticated','public.bdr_assumir(uuid,bigint,text)','EXECUTE')
  OR has_function_privilege('anon','public.bdr_cancelar_saida(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'RPC exposta'; END IF;
 RAISE NOTICE 'PASS BDR: schema atual, ownership, cancelamento, dedupe LP/minichat, origem e permissões';
END $$;
