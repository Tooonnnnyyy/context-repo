import { Network, ArrowUpRight } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand${small ? ' brand-small' : ''}`}><span className="brand-mark"><Network size={small ? 19 : 23} strokeWidth={2} /></span><span>context<span className="brand-period">.</span></span></div>
}
export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button {...props} className={`button button-${variant} ${className}`}>{children}</button>
}
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{children}</p>{action}</div>
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-link">{children}<ArrowUpRight size={14} /></a>
}
