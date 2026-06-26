import { useLocation } from "react-router-dom"
import type { ReactNode } from "react"

export function PageTransition({ children, transitionKey }: { children: ReactNode; transitionKey?: string }) {
  const location = useLocation()
  return (
    <div key={transitionKey || location.pathname} className="animate-page-in">
      {children}
    </div>
  )
}
