'use client';
import {useEffect,useRef,PointerEvent} from 'react';
import s from './Forms.module.css';
export function SignaturePad({label,value,onChange}:{label:string;value?:string;onChange:(png:string)=>void}){
 const ref=useRef<HTMLCanvasElement>(null),drawing=useRef(false);
 useEffect(()=>{const c=ref.current;if(!c)return;const x=c.getContext('2d')!;x.clearRect(0,0,c.width,c.height);if(value){const img=new Image();img.onload=()=>x.drawImage(img,0,0);img.src=value;}},[value]);
 const point=(e:PointerEvent<HTMLCanvasElement>):[number,number]=>{const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)*e.currentTarget.width/r.width,(e.clientY-r.top)*e.currentTarget.height/r.height];};
 function down(e:PointerEvent<HTMLCanvasElement>){e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;const x=e.currentTarget.getContext('2d')!;x.lineWidth=2.5;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#173344';x.beginPath();x.moveTo(...point(e));}
 function move(e:PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const x=e.currentTarget.getContext('2d')!;x.lineTo(...point(e));x.stroke();}
 function up(e:PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;drawing.current=false;onChange(e.currentTarget.toDataURL('image/png'));}
 return <div className={s.signature}><canvas ref={ref} width={600} height={200} className={s.signatureCanvas} role="img" aria-label={'Area tanda tangan '+label+'. Gambar dengan mouse, pena, atau jari.'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/><button type="button" className={s.linkButton} onClick={()=>onChange('')}>Ulangi tanda tangan</button></div>;
}
