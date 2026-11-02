import {NextRequest} from 'next/server';
import {handle} from '@/lib/api.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function route(req:NextRequest,context:{params:Promise<{path:string[]}>}) {return handle(req,(await context.params).path);}
export {route as GET,route as POST,route as PUT,route as PATCH,route as DELETE};
