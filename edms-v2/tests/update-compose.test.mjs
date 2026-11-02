import test from 'node:test';
import assert from 'node:assert/strict';
import {updateViews} from '../scripts/update-compose.mjs';
test('update changes only app image; staging limits only the existing app port',()=>{
 const app={container_name:'edms-ups-app',image:'edms-ups:2.1.1',working_dir:'/opt/edms',command:['node','scripts/start.mjs'],environment:{DB_PASSWORD:'DUMMY$literal'},ports:[{target:3000,published:'3000'}],volumes:[{type:'bind',source:'/share/Container/edms-app/storage',target:'/app/storage'}]};
 const before={name:'edms-mutu-system',services:{'edms-app':app,other:{image:'DUMMY-other'}},networks:{default:{name:'DUMMY-existing'}}};
 const {release,staging}=updateViews(before);
 const expected=structuredClone(before);expected.services['edms-app'].image='edms-ups:2.1.3';assert.deepEqual(release,expected);
 assert.deepEqual(staging.services.other,before.services.other);assert.deepEqual(staging.networks,before.networks);
 assert.equal(staging.services['edms-app'].ports[0].host_ip,'127.0.0.1');assert.equal(app.image,'edms-ups:2.1.1');
});
