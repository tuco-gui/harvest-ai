import type { Metadata } from 'next';
import './globals.css';
import FaixaAmbiente from '@/componentes/FaixaAmbiente';

// STAGING (Entrega 15, Seção 9): quando NEXT_PUBLIC_AMBIENTE=staging, o
// build bloqueia indexação — não pode aparecer em resultado de busca nem
// ser rastreado. Em produção essa env não existe, então o comportamento
// padrão (indexável) não muda.
const ehStaging = process.env.NEXT_PUBLIC_AMBIENTE === 'staging';

export const metadata: Metadata = {
  title: ehStaging ? 'Harvest AI — STAGING' : 'Harvest AI',
  description: 'Prospecção ativa por WhatsApp — Figueira Marketing',
  ...(ehStaging ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" async />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js" async />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* aplica o tema antes da pintura, senão pisca o claro antes do escuro */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('harvest_tema');if(t)document.documentElement.dataset.tema=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <FaixaAmbiente />
        {children}
      </body>
    </html>
  );
}
