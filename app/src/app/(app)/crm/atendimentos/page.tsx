import { redirect } from 'next/navigation';

// URL legado mantido como alias sem interface concorrente.
export default async function PaginaAtendimentosCrm({
 searchParams,
}: { searchParams: Promise<{ telefone?: string }> }) {
 const q=await searchParams;
 redirect(q.telefone ? '/inbox?telefone='+encodeURIComponent(q.telefone) : '/inbox');
}
