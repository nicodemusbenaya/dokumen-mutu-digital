import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Dokumen Mutu | PLN UP Sertifikasi',description:'Pengelolaan dokumen mutu dan riwayat revisi PLN UP Sertifikasi'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
