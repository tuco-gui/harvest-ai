import {redirect} from 'next/navigation';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import AgendaCrm from '@/componentes/AgendaCrm';
export default async function PaginaAgendaCrm(){
 const perfil=await perfilAtual();if(!perfil)redirect('/entrar');if(!perfil.conta_id)redirect('/contas');
 const db=supabaseAdmin();
 if(!(await perfilTemModulo(db,perfil,'crm'))||!(await perfilTemModulo(db,perfil,'crm_avancado')))redirect('/crm');
 return <AgendaCrm/>;
}
