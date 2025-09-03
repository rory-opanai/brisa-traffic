export const config = { runtime: 'edge' }

async function getProvider(env) {
  const hasUpstash = !!(env?.UPSTASH_REDIS_REST_URL && env?.UPSTASH_REDIS_REST_TOKEN)
  const hasKV = !!(env?.KV_REST_API_URL && env?.KV_REST_API_TOKEN)
  const provider = hasUpstash ? 'upstash' : hasKV ? 'kv' : 'none'
  const url = env?.UPSTASH_REDIS_REST_URL || env?.KV_REST_API_URL
  const token = env?.UPSTASH_REDIS_REST_TOKEN || env?.KV_REST_API_TOKEN
  return { provider, url, hasToken: !!token }
}

export default async function handler() {
  const { provider, url, hasToken } = await getProvider(process.env)
  const ok = provider !== 'none' && !!url && hasToken
  return new Response(JSON.stringify({ ok, provider, hasUrl: !!url, hasToken }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

