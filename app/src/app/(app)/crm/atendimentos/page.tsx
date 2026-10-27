import { redirect } from 'next/navigation';

// URL legado mantido como alias sem interface concorrente.
export default async function PaginaAtendimentosCrm({
 searchParams,
}: { searchParams: Promise<{ telefone?: string;conversa?:string }> }) {
 const q=await searchParams;
 if(q.conversa)redirect('/inbox?conversa='+encodeURIComponent(q.conversa));
 redirect(q.telefone ? '/inbox?telefone='+encodeURIComponent(q.telefone) : '/inbox');
}
