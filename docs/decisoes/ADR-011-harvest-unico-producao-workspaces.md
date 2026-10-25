# ADR-011 — Homologação por workspace no Harvest único de produção

**Data:** 2026-10-24
**Escopo:** Harvest AI institucional. **Decisão mais recente e explícita do responsável.**
**Estado:** decisão aprovada para condução do produto; não implica ativação de funcionalidades novas nem migração de cliente.

## Diretriz
Não usar uma implantação de staging separada como caminho de homologação do Harvest.

O Harvest que atende os clientes vive na VPS institucional, em `harvest.figueiramarketing.com.br`. Novas funcionalidades deverão ser entregues no mesmo produto com ativação controlada **pela workspace Figueira Marketing**, usando as permissões e módulos que já existem na base (`contas.modulos_habilitados`). Após validação, o superadmin libera para outras workspaces.

`Figueira Marketing` (`figueira-marketing`) é a workspace oficial de validação de funcionalidades. Não confundir com `Figueira QA`, `Figueira QA Test` ou projeto Vercel `harvest-staging`. O superadmin deve selecionar a conta Figueira Marketing para testar os módulos opcionais.

O mecanismo de controle de módulos existe em `app/src/lib/autorizacao.ts` e na administração de contas (`PATCH /api/contas`), com checagem de autorização server-side. Novos endpoints e operações também deverão aplicar gating server-side, não apenas ocultar botão.

**Exceção:** correções essenciais para todos, como entrar e recuperar senha, devem funcionar mesmo *antes* da escolha de workspace; não dependem de `conta_id` porque o usuário ainda não está autenticado.

## Auditoria de autenticação feita em modo somente leitura
- Produção Swarm: 1 perfil `super_admin` encontrado, com `senha_provisoria=false`.
- Esse perfil corresponde a 1 usuário Supabase Auth com `email_confirmed_at` preenchido. Não foi alterada senha, usuário nem papel.
- Workspace `figueira-marketing`, ambiente `producao`, com `whatsapp,ia,usuarios,chamados,status,crm`.
- O código de `main` bloqueia `/esqueci-senha`, `/verificar-codigo` e `/api/auth/esqueci-senha` para usuários sem sessão: falha confirmada e registrada para o hotfix.
- O serviço `harvest_harvest` possui `NEXT_PUBLIC_APP_URL` e `APP_URL`, porém **nenhuma variável SMTP_*** nem Docker secrets SMTP associados. `config_sistema` também não tem host, usuário ou senha de SMTP. Logo, entrega de recuperação por e-mail precisa provisionar um provedor autorizado; não inventar segredos nem usar dados de outra empresa.
- Nenhuma tentativa de login foi feita em nome do usuário e não é possível inferir a senha existente a partir do banco.

## Hotfix
Branch `hotfix/producao-auth-recuperacao-20261024` a partir da `main`, independente do experimento Deskcomm. Alterações de middleware, página e endpoint de recuperação sem afetar clientes ou `modulos_habilitados`. A API permanece anti-enumeração de usuários e retorna aviso operacional global quando SMTP não estiver provisionado.

## Critérios antes de afirmar pronto
1. Testar a allowlist pública e que `/api/perfil/senha` continua privada.
2. Passar TypeScript/build em CI fora da VPS.
3. Publicar nova imagem do Harvest para serviço existente, sem criar ambiente paralelo.
4. Confirmar acesso não autenticado às páginas de recuperação; testar login real apenas pelo titular.
5. Provisionar SMTP de forma segura no Swarm (variáveis protegidas ou Docker Secrets/ OpenBao), enviar teste de recuperação com destinatário autorizado e validar o código e a alteração de senha; **sem solicitar ou divulgar senha**.
6. Preservar a imagem anterior para rollback e nunca alterar usuários/roles/credenciais já existentes.

## Memória e Wiki
O Brain institucional continua no Mac, em `/Users/gui_t/Figueira_Marketing/brain`, sem acesso direto nesta sessão. Este registro é operacional para sincronização aditiva no Obsidian quando o filesystem estiver disponível. Não alegar que o Vault local foi editado. Não apagar histórico ou decisões anteriores; esta instrução atualizada prevalece sobre o planejamento de staging anterior no escopo Harvest.
