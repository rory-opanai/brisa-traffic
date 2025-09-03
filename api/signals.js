// Vercel Edge Function: GET returns current timings, POST updates timings.
export const config = { runtime: 'edge' }

const BASELINE = {
  stadiumExit: { green: 45, red: 90 },
  mainline: { green: 60, red: 60 },
  northGate: { green: 30, red: 90 },
  southGate: { green: 60, red: 60 },
  eastGate: { green: 45, red: 75 },
  westGate: { green: 50, red: 70 },
  perimeterNW: { green: 40, red: 80 },
  perimeterSE: { green: 55, red: 65 },
}

const KV_KEY = 'signals:current'

async function getKV(env) {
  // Prefer native Vercel KV binding if present at env.KV
  if (env && env.KV) return env.KV
  // Support Upstash Redis on Vercel Marketplace (preferred)
  const url = env?.UPSTASH_REDIS_REST_URL || env?.KV_REST_API_URL
  const token = env?.UPSTASH_REDIS_REST_TOKEN || env?.KV_REST_API_TOKEN
  if (!url || !token) return null
  return {
    async get(key) {
      const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return null
      const data = await res.json().catch(() => null)
      return data?.result ?? null
    },
    async set(key, value) {
      // Upstash REST: POST /set/{key}/{value}
      await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    },
  }
}

async function readTimings(env) {
  const kv = await getKV(env)
  if (!kv) return BASELINE
  const stored = await kv.get(KV_KEY)
  if (!stored) return BASELINE
  try { return typeof stored === 'string' ? JSON.parse(stored) : stored } catch { return BASELINE }
}

async function writeTimings(env, next) {
  const kv = await getKV(env)
  if (!kv) return
  await kv.set(KV_KEY, JSON.stringify(next))
}

export default async function handler(req) {
  const { method } = req
  if (method === 'GET') {
    const timings = await readTimings(process.env)
    return new Response(JSON.stringify(timings), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  if (method === 'POST') {
    try {
      const incoming = await req.json()
      const current = await readTimings(process.env)
      const merged = { ...current, ...incoming }
      await writeTimings(process.env, merged)
      return new Response(JSON.stringify({ ok: true, timings: merged }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
  }
  return new Response('Method Not Allowed', { status: 405 })
}
