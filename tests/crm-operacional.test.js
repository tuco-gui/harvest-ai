const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

test('criação manual não exige lead_id e mantém conta da sessão', () => {
  const rota = ler('app/src/app/api/crm/oportunidades/route.ts');
  assert.match(rota, /const leadId = b\.lead_id \? Number/);
  assert.match(rota, /Informe pelo menos a empresa ou o contato/);
  assert.match(rota, /crmBackend\(\)\.criar\(perfil\.conta_id/);
});

test('atividades e mensagens validam módulo, oportunidade e tenant', () => {
  for (const arquivo of [
    'app/src/app/api/crm/oportunidades/[id]/atividades/route.ts',
    'app/src/app/api/crm/oportunidades/[id]/mensagens/route.ts',
  ]) {
    const fonte = ler(arquivo);
    assert.match(fonte, /perfilTemModulo\(admin, perfil, 'crm'\)/);
    assert.match(fonte, /\.eq\('id', id\)\.eq\('conta_id', perfil\.conta_id\)/);
  }
});

test('envio CRM preserva opt-out, whitelist e canal conectado', () => {
  const rota = ler('app/src/app/api/crm/oportunidades/[id]/mensagens/route.ts');
  assert.match(rota, /envioPermitidoNoAmbiente\(ctx\.admin, contaId, telefone\)/);
  assert.match(rota, /estaSuprimido\(ctx\.admin, contaId, telefone\)/);
  assert.match(rota, /c\.id === canalId && c\.ativo && c\.status === 'conectado'/);
  assert.match(rota, /status\.status !== 'WORKING'/);
  assert.match(rota, /status: entregue \? 'enviado' : 'erro'/);
});

test('migração operacional é aditiva e aplica RLS', () => {
  const sql = ler('sql/022_crm_operacional.sql');
  assert.match(sql, /create table if not exists public\.crm_atividades/);
  assert.match(sql, /alter table public\.crm_atividades enable row level security/);
  assert.match(sql, /conta_id = public\.minha_conta\(\) or public\.sou_super_admin\(\)/);
  assert.doesNotMatch(sql, /drop table/i);
});
