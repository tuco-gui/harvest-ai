import {NextResponse} from 'next/server';
import {contexto,isAdmin} from '@/lib/contextoConversasExternas';

export async function GET(){
 const c=await contexto();if('erro'in c)return c.erro;
 const {admin,perfil}=c;
 let busca=admin.from('crm_conversas_externas')
  .select('id,fonte_id,nome,visitante_id,status,responsavel_id,criado_em,atualizado_em')
  .eq('conta_id',perfil.conta_id).order('atualizado_em',{ascending:false}).limit(100);
 if(!isAdmin(perfil.papel))busca=busca.eq('responsavel_id',perfil.id);
 const {data:conversas,error}=await busca;
 if(error)return NextResponse.json({erro:'Falha ao carregar conversas externas.'},{status:503});
 const ids=[...new Set((conversas??[]).map(c=>c.fonte_id))];
 const {data:fontes,error:erroFontes}=ids.length
  ?await admin.from('crm_fontes_funil').select('id,tipo,nome,status,funil_id')
   .eq('conta_id',perfil.conta_id).in('id',ids)
  :{data:[],error:null};
 if(erroFontes)return NextResponse.json({erro:'Falha ao localizar fontes.'},{status:503});
 const cvs=(conversas??[]).map(c=>({
  id:c.id,fonte_id:c.fonte_id,nome:c.nome,visitante_id:c.visitante_id,
  status:c.status,responsavel_id:c.responsavel_id,atualizado_em:c.atualizado_em,
  fonte:(fontes??[]).find(f=>f.id===c.fonte_id)??null,
 }));
 return NextResponse.json({conversas:cvs});
}
