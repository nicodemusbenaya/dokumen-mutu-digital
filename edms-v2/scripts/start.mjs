import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
try{process.loadEnvFile('.env.local');}catch{}
const dev=process.argv.includes('--dev');const children=[];
const server=dev?[process.execPath,['node_modules/next/dist/bin/next','dev','-p',process.env.PORT||'3100','-H',process.env.DEV_HOST||'0.0.0.0']]:[process.execPath,[existsSync('server.js')?'server.js':'.next/standalone/server.js']];
for(const [cmd,args] of [server,...(process.env.WORKER_ENABLED==='false'?[]:[[process.execPath,['--max-old-space-size=256','scripts/worker.mjs']]])]){const child=spawn(cmd,args,{stdio:'inherit',env:process.env,windowsHide:true});children.push(child);child.on('error',()=>stop(1));child.on('exit',code=>stop(code||0));}
let stopping=false;function stop(code){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),500).unref();}
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));
