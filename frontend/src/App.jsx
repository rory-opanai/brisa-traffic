import React, { useEffect, useState } from 'react'

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

function useSignalTimer(initialPhase = 'green', durations) {
  const [phase, setPhase] = useState(initialPhase) // 'green' | 'red'
  const [remaining, setRemaining] = useState(durations[initialPhase])

  useEffect(() => {
    setRemaining(durations[phase])
  }, [durations, phase])

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // switch phase
          setPhase((p) => (p === 'green' ? 'red' : 'green'))
          return durations[phase === 'green' ? 'red' : 'green']
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [durations, phase])

  return { phase, remaining }
}

function Intersection({ title, durations, position }) {
  const { phase, remaining } = useSignalTimer('green', durations)
  const circleColor = phase === 'green' ? 'bg-green-500' : 'bg-red-500'
  return (
    <div className={`absolute ${position}`}>
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full ${circleColor} shadow-inner`} />
        <div className="card">
          <div className="text-sm font-semibold text-gray-700">{title}</div>
          <div className="text-xs text-gray-500">Phase: <span className="font-medium text-gray-700">{phase}</span> • Next switch in {remaining}s</div>
          <div className="mt-1 text-xs text-gray-600">Green: {durations.green}s • Red: {durations.red}s</div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [timings, setTimings] = useState(BASELINE)
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

  // Subscribe to backend updates via SSE, with initial fetch fallback
  useEffect(() => {
    let es;
    const controller = new AbortController();

    const fetchInitial = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/signals`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setTimings((t) => ({ ...t, ...data }))
        }
      } catch { /* ignore */ }
    }

    fetchInitial()

    try {
      es = new EventSource(`${API_BASE}/api/signals/stream`)
      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          setTimings((t) => ({ ...t, ...data }))
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    return () => {
      controller.abort()
      if (es && es.close) es.close()
    }
  }, [API_BASE])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">🚦 Brisa Stadium Traffic Demo</h1>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Canvas */}
        <div className="relative bg-slate-100 rounded-xl shadow-inner h-[520px]">
          {/* Stadium */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 bg-gray-300 rounded-lg border border-gray-400 flex items-center justify-center">
              <span className="font-bold text-gray-700">Stadium</span>
            </div>
          </div>

          {/* Roads - central cross */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-8 bg-gray-200" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 bg-gray-200" />

          {/* Perimeter roads */}
          <div className="absolute left-0 right-0 top-[25%] h-6 bg-gray-200" />
          <div className="absolute left-0 right-0 top-[75%] h-6 bg-gray-200" />
          <div className="absolute top-0 bottom-0 left-[25%] w-6 bg-gray-200" />
          <div className="absolute top-0 bottom-0 left-[75%] w-6 bg-gray-200" />

          {/* Intersections */}
          <Intersection title="Stadium Exit" durations={timings.stadiumExit} position="left-[20%] top-[52%]" />
          <Intersection title="Mainline" durations={timings.mainline} position="right-[20%] top-[38%]" />

          <Intersection title="North Gate" durations={timings.northGate} position="left-[50%] top-[23%] -translate-x-1/2" />
          <Intersection title="South Gate" durations={timings.southGate} position="left-[50%] top-[77%] -translate-x-1/2" />
          <Intersection title="West Gate" durations={timings.westGate} position="left-[23%] top-[50%] -translate-y-1/2" />
          <Intersection title="East Gate" durations={timings.eastGate} position="left-[77%] top-[50%] -translate-y-1/2" />

          <Intersection title="Perimeter NW" durations={timings.perimeterNW} position="left-[25%] top-[25%] -translate-x-1/2 -translate-y-1/2" />
          <Intersection title="Perimeter SE" durations={timings.perimeterSE} position="left-[75%] top-[75%] -translate-x-1/2 -translate-y-1/2" />
        </div>

      </main>
    </div>
  )
}
