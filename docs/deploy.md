# Publicar o Harvest AI no VPS

O app roda como uma stack própria no Docker Swarm, ao lado do que já existe.
Não toca em Supabase, n8n, Baserow, Evolution nem Chatwoot.

## A regra que não pode ser quebrada

**Nunca construir a imagem dentro do VPS.** Compilar o Next.js pede de 1,5 a
3 GB de RAM em pico. O servidor tem 16 GB, com ~12 GB já em uso — sobram
~3,9 GB. Um build lá dentro pode derrubar o Supabase ou o n8n por falta de
memória, e aí o problema deixa de ser o deploy.

Constrói-se fora, publica-se a imagem, e o servidor só baixa e roda. Em
produção o app ocupa ~250 MB, com teto de 512 MB declarado na stack.

## Uma vez só

**DNS.** Registro A apontando para o servidor:

```
harvest.figueiramarketing.com.br   A   77.37.40.97
```

O certificado sai sozinho: o `letsencryptresolver` já está configurado no
Traefik.

**Acesso ao registro.** Crie um token clássico no GitHub com escopo
`write:packages` e faça login local:

```bash
echo SEU_TOKEN | docker login ghcr.io -u tuco-gui --password-stdin
```

## A cada versão

```bash
cd app

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.figueiramarketing.com.br \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
  -t ghcr.io/tuco-gui/harvest-ai:latest .

docker push ghcr.io/tuco-gui/harvest-ai:latest
```

As `NEXT_PUBLIC_*` entram como build-arg porque vão embutidas no bundle do
navegador — precisam existir na hora de compilar, não só de rodar.

No Portainer: **Stacks → Add stack**, cole `infra/harvest-stack.yml`,
preencha a `SUPABASE_SERVICE_KEY` e suba. Para atualizar depois:

```bash
docker service update --image ghcr.io/tuco-gui/harvest-ai:latest --force harvest_harvest
```

## Como saber se subiu

```bash
curl -sI https://harvest.figueiramarketing.com.br/entrar | head -1
```

Deve responder `200`. A raiz `/` responde `307` para `/entrar` quando não há
sessão — isso é o middleware funcionando, não erro.

## Se der errado

O jeito de voltar é remover a stack `harvest` no Portainer. Nada mais é
afetado, porque nenhum outro serviço depende dela e o roteador do Traefik é
exclusivo desse hostname.

## Onde ficam os segredos

| Segredo | Onde vive |
|---|---|
| `SUPABASE_SERVICE_KEY` | variável da stack, só no servidor |
| Chave da SerpAPI de cada cliente | tabela `conta_credenciais`, lida pelo servidor |
| Token da Evolution de cada cliente | idem |

Nenhum deles chega ao navegador. O front pede `/api/busca` e o servidor
resolve a conta pela sessão, busca a chave e chama a ponte do n8n.

## Folga de memória

Com ~3,9 GB livres cabe este app com sobra, mas não muitos mais. Se um dia
apertar, o primeiro candidato a desligar é o Supabase Studio — ele só serve
para administrar o banco e pode subir sob demanda.
