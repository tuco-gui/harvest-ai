import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import ServicosWorkspace from '@/componentes/ServicosWorkspace';
export default async function Pagina({params}:{params:Promise<{id:string}>}){
 const p=await perfilAtual();if(p?.papel!=='super_admin')redirect('/');
 const {id}=await params;const {data}=await supabaseAdmin().from('contas').select('id,nome,slug').eq('id',id).maybeSingle();if(!data)notFound();
 return <div className="pagina pagina-larga"><p className="ajuda">Super Admin · <Link href="/contas">Clientes</Link> · <Link href={'/contas/'+id}>{data.nome}</Link></p><p className="ajuda">Administração global · Serviços de {data.nome} ({data.slug}). Use o acesso delegado para entrar no contexto operacional deste cliente.</p><ServicosWorkspace key={id} contaId={id}/></div>;
}
