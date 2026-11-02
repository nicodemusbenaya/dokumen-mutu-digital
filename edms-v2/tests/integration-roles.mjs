// Exercise read-only authorization using existing roles; never seed production roles.
export function readOnlyTestRole(roles){
 const role=roles.find(r=>r.name==='Viewer')||roles.find(r=>r.name==='Tim Mutu');
 if(!role)throw new Error('No existing read-only role is available for the DUMMY authorization test');
 return role;
}
