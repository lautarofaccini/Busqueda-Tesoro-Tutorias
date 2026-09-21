import { useEffect, useRef, useState } from 'react'

export function ScoreDisplay({ score }: { score: number }) {
  const [delta, setDelta] = useState<number | null>(null)
  const prevScore = useRef(score)

  useEffect(() => {
    if (score !== prevScore.current) {
      setDelta(score - prevScore.current)
      prevScore.current = score
      const timer = setTimeout(() => setDelta(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [score])

  return (
    <span className="relative inline-flex items-center">
      Puntos: {score}
      {delta !== null && (
        <span
          key={Date.now()}
          className={`absolute left-full ml-1.5 text-xs font-black animate-slide-up-fade pointer-events-none ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}
        >
          {delta > 0 ? `+${delta} ↑` : `${delta} ↓`}
        </span>
      )}
    </span>
  )
}
