import { useEffect, useRef } from 'react'

export function useDialog(open: boolean, close: () => void) {
  const callback = useRef(close); callback.current = close
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    const dialog = dialogs.item(dialogs.length - 1)
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), select, textarea, a[href], [tabindex="0"]') || [])].filter(el => el.offsetParent !== null)
    const timer = setTimeout(() => focusable()[0]?.focus(), 50)
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); callback.current(); return }
      if (e.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (!items.length) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [open])
}
