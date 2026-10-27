# Deploy automático Harvest validado — 27/10/2026

- Estado inicial: `main` em `88a2995`, um commit à frente de `origin/main`.
- VPS institucional confirmada pela API Hostinger: `srv893947.hstgr.cloud`, `77.37.40.97`.
- Secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY` e `DEPLOY_KNOWN_HOSTS` configurados no environment GitHub `Production`. Chave SSH dedicada ao deploy; host key baseada no registro local confiável e acesso testado com verificação estrita.
- Commit publicado: `88a2995d7f48a30887b5bfe2b976c2b4e94ba4e5`.
- Workflow concluído com sucesso: https://github.com/tuco-gui/harvest-ai/actions/runs/40588106945 (`validar`, `publicar`, `implantar`).
- Imagem confirmada via SSH no Swarm: `ghcr.io/tuco-gui/harvest-ai@sha256:eed811337c6aaa22b1e60ba9607021871fa7022b922a1207b279427c2b132ef2`.
- Serviço `harvest_harvest`: atualização `completed`, tarefa `Running`.
- Smoke externo: `https://harvest.figueiramarketing.com.br/entrar` respondeu HTTP 200. No Actions, a primeira tentativa expirou e a segunda respondeu 200.
- Imagem anterior registrada pelo workflow para rollback: `ghcr.io/tuco-gui/harvest-ai:1711e77dc7243cd5db5cbf664ea253eaccac9f58@sha256:f09a6237e8ce4c69a085b1a545aa2658d6abc00a9e0b9a0dbec56588e92167d6`.
- Consulta genérica ao cofre retornou erro de login OpenBao; a capability institucional Hostinger funcionou e o SSH administrativo existente permitiu concluir a configuração. Nenhuma credencial bruta foi registrada neste documento.
