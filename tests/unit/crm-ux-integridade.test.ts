import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function source(path:string){return readFileSync(path,'utf8');}
const crm=source('app/src/componentes/CrmPipeline.tsx');
const editor=source('app/src/componentes/FunilDetalhe.tsx');
const inbox=source('app/src/componentes/CentralAtendimentosCrm.tsx');
const css=source('app/src/app/globals.css');
const contatos=source('app/src/app/(app)/crm/cadastros/[entidade]/page.tsx');
const atendimento=source('app/src/app/(app)/crm/atendimentos/page.tsx');
const routes=[
 source('app/src/app/api/funis/[id]/estagios/route.ts'),
 source('app/src/app/api/funis/[id]/estagios/[estagioId]/route.ts'),
];
assert.match(crm,/\{editorFunil\s*\?\s*<FunilDetalhe/,'editor de funil deve abrir no pipeline');
assert.match(crm,/embutido aoVoltar=/,'editor precisa voltar ao pipeline sem criar outra tela');
assert.match(editor,/crm-kommo-fontes/,'fontes de lead devem estar na lateral das etapas');
assert.match(editor,/fontesAbertas/,'modal de fontes precisa estar no contexto do funil');
assert.match(crm,/crm-kommo-filtros-vistas/,'vistas do funil na coluna de filtros');
assert.match(crm,/crm-kommo-filtros-propriedades/,'propriedades dos leads na coluna central');
assert.match(crm,/crm-kommo-filtros-tags/,'etiquetas/gerência junto dos filtros');
assert.match(crm,/crm-ficha-painel-dados/,'informações do lead à esquerda');
assert.match(crm,/crm-ficha-contexto/,'conversas e atividades à direita');
assert.match(crm,/id==='perdidos'\|\|id==='ganhos'/,'vistas de encerrados precisam exibir negócios ganhos');
assert.match(inbox,/key=\{c\.telefone\+':'\+\(c\.canalId\?\?0\)\}/,
 'um contato em dois canais deve possuir chaves React distintas');
assert.match(css,/\.crm-kommo>\.crm-legado-topo\{display:none!important\}/);
assert.doesNotMatch(css,/\.crm-kommo>div:first-child/,'não ocultar editor inline por seletor genérico');
assert.match(contatos,/redirect\('\/crm\/contatos'\)/,'um único menu de contatos');
assert.match(atendimento,/redirect\(q\.telefone \?/,'atendimento legado deve redirecionar à Inbox');
for (const route of routes){
 assert.match(route, /\.eq\('conta_id',\s*perfil\.conta_id\s*\?\?\s*''\)/,
 'estágios exigem filtro de workspace ativa');
 assert.doesNotMatch(route,/!funil\s*&&\s*perfil\.papel\s*!==\s*'super_admin'/,
 'superadmin não pode transpor o tenant ativo por ID do funil');
}
assert.match(routes[1],/\.eq\('funil_estagio_id',estagioId\)/,
 'não excluir etapa com negócios associados');
console.log('Integridade UX: editor inline, fontes, filtros, contatos, Inbox e isolamento da conta OK');
