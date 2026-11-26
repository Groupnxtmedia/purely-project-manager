import type {Metadata,Viewport} from 'next';
import './globals.css';
import './theme.css';
import './china.css';
export const metadata:Metadata={title:'Purely Project Manager',description:'Your team’s shared plan, project history, and David project manager.',icons:{icon:[{url:'/brand/purely-navy-32.png',sizes:'32x32',type:'image/png'},{url:'/brand/purely-navy-48.png',sizes:'48x48',type:'image/png'},{url:'/favicon.ico?v=2',sizes:'16x16 32x32 48x48'}],apple:{url:'/brand/purely-navy-180.png',sizes:'180x180',type:'image/png'}},manifest:'/manifest.webmanifest?v=2',appleWebApp:{capable:true,title:'Purely Project Manager',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#ffffff'};
const themeScript=`try{var m=localStorage.getItem('purely-theme')||'auto';var h=new Date().getHours();document.documentElement.dataset.theme=m==='dark'||(m!=='light'&&(h>=18||h<6))?'dark':'light'}catch(e){document.documentElement.dataset.theme=new Date().getHours()>=18||new Date().getHours()<6?'dark':'light'}`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><link rel="preload" href="/fonts/inter-variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/><link rel="preload" href="/fonts/larken-light.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>;}
