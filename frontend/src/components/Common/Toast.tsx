import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = 'info', onClose, duration }: ToastProps) {
  const effectiveDuration = duration ?? (type === 'error' ? 8000 : 3000)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, effectiveDuration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    success: 'bg-green-900/90 border-green-700 text-green-200',
    error: 'bg-red-900/90 border-red-700 text-red-200',
    info: 'bg-zinc-800/90 border-zinc-600 text-zinc-200',
  }

  return (
    <div
      className={`fixed bottom-24 md:bottom-6 right-4 z-50 px-4 py-2.5 rounded-lg border text-sm backdrop-blur-lg transition-all duration-300 max-w-md break-words ${
        colors[type]
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {message}
    </div>
  )
}
