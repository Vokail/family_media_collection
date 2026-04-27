'use client'
import { createContext, useContext, useReducer, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error'
interface ToastItem { id: number; message: string; type: ToastType }
type Action = { type: 'add'; toast: ToastItem } | { type: 'remove'; id: number }

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  if (action.type === 'add') return [...state, action.toast]
  return state.filter(t => t.id !== action.id)
}

const ToastContext = createContext<{ show: (message: string, type?: ToastType) => void }>({ show: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])
  const nextId = useRef(0)

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++
    dispatch({ type: 'add', toast: { id, message, type } })
    setTimeout(() => dispatch({ type: 'remove', id }), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[9999] pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg animate-fade-in"
            style={{ backgroundColor: t.type === 'error' ? '#b91c1c' : 'var(--accent)' }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
