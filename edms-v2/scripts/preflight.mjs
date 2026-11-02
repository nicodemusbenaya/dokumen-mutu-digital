import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {query,pool} from '../src/lib/db.mjs';
import {root,ensure} from '../src/lib/core.mjs';
try{process.loadEnvFile('.env.local');}catch{}
const checks={};
try{await query('SELECT 1');checks.database=true;const [r]=await query('SELECT COUNT(*) count FROM users WHERE is_active=1');checks.activeUsers=r.count;}catch(e){checks.database=false;checks.databaseError=e.code;}
try{await ensure();const p=path.join(root(),'staging','preflight-write');await fs.writeFile(p,'DUMMY preflight',{flag:'wx'});await fs.unlink(p);checks.storage=true;}catch(e){checks.storage=false;checks.storageError=e.code;}
checks.secret=!!process.env.JWT_SECRET&&process.env.JWT_SECRET.length>=32;
checks.python=spawnSync(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),['--version'],{windowsHide:true}).status===0;
checks.libreoffice=spawnSync(process.env.LIBREOFFICE_BIN||'libreoffice',['--version'],{windowsHide:true}).status===0;
checks.platform=process.platform+'/'+process.arch;
checks.productionReady=checks.database&&checks.storage&&checks.secret&&checks.python&&checks.libreoffice&&process.platform==='linux'&&process.arch==='x64';
console.log(JSON.stringify(checks,null,2));await pool().end();process.exitCode=checks.productionReady?0:1;
