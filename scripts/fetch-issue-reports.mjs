const key = process.env.JAPOTEACHER_EDITORIAL_KEY || process.env.PROXY_TOKEN;
if (!key) throw new Error("Define JAPOTEACHER_EDITORIAL_KEY o PROXY_TOKEN antes de consultar el buzon.");
const limit = Math.max(1, Math.min(100, Number(process.argv[2]) || 50));
const response = await fetch(`https://japoteacher-ai.raul-nihongo.workers.dev/editorial/issues?limit=${limit}`, { headers: { "X-Editorial-Key": key } });
const body = await response.text();
if (!response.ok) throw new Error(`No se pudo recuperar el buzon (${response.status}): ${body}`);
process.stdout.write(`${body}\n`);
