import { createHandler } from './handler.mjs';
Deno.serve(createHandler({authUrl:Deno.env.get('SUPABASE_URL'),authKey:Deno.env.get('SUPABASE_ANON_KEY')}));
