import {notFound} from 'next/navigation';
import WidgetWebchat from '@/componentes/WidgetWebchat';

export default async function WebchatPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))notFound();
 return <WidgetWebchat token={token}/>;
}
