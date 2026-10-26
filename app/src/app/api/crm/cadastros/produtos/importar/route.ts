import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
export const dynamic='force-dynamic';
function linhasCSV(s:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],v='',quoted=false;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){if(quoted&&s[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(c===';'||c===',')){row.push(v.trim());v='';}
  else if(!quoted&&(c==='\n'||c==='\r')){
   if(c==='\r'&&s[i+1]==='\n')i++;
   row.push(v.trim());if(row.some(x=>x))rows.push(row);row=[];v='';
  }else v+=c;
 }
 if(quoted)throw Error('Aspas de CSV não fechadas.');
 row.push(v.trim());if(row.some(x=>x))rows.push(row);
 return rows;
}
export async function POST(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return NextResponse.json({erro:'Sessão expirada.'},{status:401});
 if(!isAdmin(perfil.papel))return NextResponse.json({erro:'Somente administradores.'},{status:403});
 const db=supabaseAdmin();
 if(!(await perfilTemModulo(db,perfil,'crm_avancado')))return NextResponse.json({erro:'CRM não habilitado.'},{status:403});
 const form=await req.formData().catch(()=>null),file=form?.get('file');
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size>1024*1024)
  return NextResponse.json({erro:'Envie um CSV de até 1 MB.'},{status:400});
 const bytes=await file.arrayBuffer();
 const texto=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
 let rows:string[][];
 try{rows=linhasCSV(texto);}catch{return NextResponse.json({erro:'CSV inválido.'},{status:422});}
 if(rows.length<2||rows.length>501)return NextResponse.json({erro:'CSV deve ter cabeçalho e até 500 produtos.'},{status:422});
 const header=rows.shift()!.map(x=>x.toLowerCase());
 const column=(...names:string[])=>header.findIndex(x=>names.includes(x));
 const nome=column('nome','produto','name'),sku=column('sku','codigo','código'),preco=column('preco','preço','price');
 if(nome<0||preco<0)return NextResponse.json({erro:'Colunas obrigatórias: nome e preco.'},{status:422});
 const dados:{nome:string;sku:string|null;preco:number;linha:number}[]=[];
 const erros:{linha:number;erro:string}[]=[];const vistos=new Set<string>();
 for(let i=0;i<rows.length;i++){
  const cells=rows[i],n=(cells[nome]||'').trim(),code=sku>=0?(cells[sku]||'').trim(): '';
  const raw=(cells[preco]||'').replace(/R\$/g,'').replace(/\s/g,'');
  const price=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);
  if(n.length<2||n.length>160||!raw||!Number.isFinite(price)||price<0||price>999999999||
    code.length>160){erros.push({linha:i+2,erro:'Nome, SKU ou preço inválido.'});continue;}
  const identity=(code||n).toLocaleLowerCase('pt-BR');
  if(vistos.has(identity)){erros.push({linha:i+2,erro:'Produto repetido no arquivo.'});continue;}
  vistos.add(identity);dados.push({nome:n,sku:code||null,preco:Math.round(price*100)/100,linha:i+2});
 }
 if(dados.length===0)return NextResponse.json({criados:0,atualizados:0,erros});
 // Só atualiza os campos da planilha; não sobrescreve descrições feitas no CRM.
 const {data:existing,error}=await db.from('crm_produtos').select('id,nome,sku')
  .eq('conta_id',perfil.conta_id).limit(5000);
 if(error)return NextResponse.json({erro:'Não foi possível conferir os produtos existentes.'},{status:503});
 const existingRows=existing??[];
 let criados=0,atualizados=0;
 for(const p of dados){
  const old=existingRows.find(x=>p.sku?x.sku?.toLowerCase()===p.sku.toLowerCase():
   !x.sku&&x.nome.toLocaleLowerCase('pt-BR')===p.nome.toLocaleLowerCase('pt-BR'));
  if(p.sku&&old?.sku!==p.sku){erros.push({linha:p.linha,erro:'SKU existente com grafia diferente.'});continue;}
  const write=old
   ?await db.from('crm_produtos').update({nome:p.nome,preco:p.preco,atualizado_em:new Date().toISOString()})
     .eq('conta_id',perfil.conta_id).eq('id',old.id)
   :await db.from('crm_produtos').insert({conta_id:perfil.conta_id,nome:p.nome,
      sku:p.sku,preco:p.preco,moeda:'BRL',ativo:true});
  if(write.error)erros.push({linha:p.linha,erro:'Falha ao salvar produto; confira SKU duplicado.'});
  else if(old)atualizados++;else criados++;
 }
 return NextResponse.json({criados,atualizados,erros,total:rows.length});
}
