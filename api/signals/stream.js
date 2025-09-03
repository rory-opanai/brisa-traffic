// Vercel Edge Function: SSE stream that emits current timings periodically.
export const config = { runtime: 'edge' }

const KV_KEY = 'signals:current'

async function getKV(env) {
  if (env && env.KV) return env.KV
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
  }
}

function toUint8(str) {
  return new TextEncoder().encode(str)
}

export default async function handler(req) {
  const kv = await getKV(process.env)
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(toUint8(`data: ${JSON.stringify(obj)}\n\n`))
      // Send initial
      let last = null
      const readOnce = async () => {
        if (!kv) return null
        const stored = await kv.get(KV_KEY)
        try { return typeof stored === 'string' ? JSON.parse(stored) : stored } catch { return null }
      }
      const now = await readOnce()
      if (now) { send(now); last = JSON.stringify(now) }
      // Heartbeat + poll KV every 2s
      const heartbeatId = setInterval(() => controller.enqueue(toUint8(': ping\n\n')), 15000)
      const pollId = setInterval(async () => {
        const latest = await readOnce()
        const str = latest ? JSON.stringify(latest) : null
        if (str && str !== last) { send(latest); last = str }
      }, 2000)
      // Close after 10 minutes
      const timeoutId = setTimeout(() => controller.close(), 10 * 60 * 1000)
      // Cleanup on cancel
      req.signal?.addEventListener('abort', () => {
        clearInterval(heartbeatId)
        clearInterval(pollId)
        clearTimeout(timeoutId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
