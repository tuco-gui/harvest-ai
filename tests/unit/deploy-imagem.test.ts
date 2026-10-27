import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/imagem.yml','utf8');
const validacao=readFileSync('.github/workflows/validar-deploy.yml','utf8');
const docs=readFileSync('docs/deploy.md','utf8');
const readme=readFileSync('README.md','utf8');

const contem=(texto:string,padrao:RegExp,mensagem:string)=>assert.match(texto,padrao,mensagem);

contem(workflow,/context:\s*\.\/app/,'O build precisa usar o contexto do app.');
contem(workflow,/push:\s*true/,'A imagem precisa ser publicada no registry.');
contem(workflow,/\$\{\{\s*github\.sha\s*\}\}/,'A imagem precisa ter tag imutável pelo commit.');
contem(workflow,/needs:\s*publicar/,'O deploy precisa depender da publicação da imagem.');
contem(workflow,/needs\.publicar\.outputs\.imagem/,'O deploy precisa usar o digest produzido pelo build.');
contem(workflow,/docker service update[\s\S]*--with-registry-auth[\s\S]*--image/,'A atualização do Swarm precisa autenticar o registry.');
contem(workflow,/--force/,'A atualização do serviço precisa recriar a tarefa.');
contem(workflow,/harvest_harvest/,'O serviço padrão do Harvest precisa ser harvest_harvest.');
contem(workflow,/StrictHostKeyChecking=yes/,'O SSH precisa validar a chave do servidor.');
contem(workflow,/DEPLOY_HOST/,'O deploy precisa documentar/validar DEPLOY_HOST.');
contem(workflow,/DEPLOY_USER/,'O deploy precisa documentar/validar DEPLOY_USER.');
contem(workflow,/DEPLOY_SSH_KEY/,'O deploy precisa documentar/validar DEPLOY_SSH_KEY.');
contem(workflow,/DEPLOY_KNOWN_HOSTS/,'O deploy precisa documentar/validar DEPLOY_KNOWN_HOSTS.');
contem(workflow,/\/entrar/,'O smoke test precisa bater na rota /entrar.');
contem(workflow,/rollback\(\)/,'O deploy precisa ter rotina de rollback.');
contem(workflow,/restaurando a imagem anterior/i,'O rollback precisa restaurar a imagem anterior.');
contem(workflow,/docker logout ghcr\.io/,'A credencial temporária do registry precisa ser removida.');

assert.doesNotMatch(workflow,/docker build/i,'O build não pode acontecer dentro do VPS.');
assert.doesNotMatch(workflow,/BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY/,'Nenhuma chave privada pode ficar no repositório.');
assert.doesNotMatch(workflow,/gh[pousr]_[A-Za-z0-9]{20,}/,'Nenhum token pode ficar no repositório.');

contem(validacao,/tests\/unit\/deploy-imagem\.test\.ts/,'O CI de deploy precisa executar o teste de contrato.');
contem(validacao,/\.github\/workflows\/imagem\.yml/,'O CI de deploy precisa observar o workflow de imagem.');

for(const secret of ['DEPLOY_HOST','DEPLOY_USER','DEPLOY_SSH_KEY','DEPLOY_KNOWN_HOSTS']){
  assert(docs.includes(secret),'docs/deploy.md precisa explicar '+secret);
}
contem(docs,/digest/i,'docs/deploy.md precisa registrar o deploy por digest.');
contem(docs,/rollback|reverte/i,'docs/deploy.md precisa registrar o rollback.');
contem(readme,/deploy automático|implant/i,'README precisa apontar o deploy automático.');

console.log('Deploy da imagem: build fora do VPS, digest imutável, smoke test e rollback protegidos');
