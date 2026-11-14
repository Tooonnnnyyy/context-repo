export type Visibility = 'private' | 'public'
export type Note = {
  id: string
  path: string
  title: string
  body: string
  original: string
  summary: string
  tags: string[]
  links: string[]
  tier: '3A' | '2A' | '1A'
  kind: 'note' | 'project' | 'blog'
  visibility: Visibility
  source: 'obsidian' | 'sample' | 'capture'
}
export type Workspace = {
  schema: 1
  name: string
  notes: Note[]
  onboarding: { step: number; completed: boolean; source: 'obsidian' | 'sample' | 'empty' }
  updatedAt: string
}
export type Account = { id: string; name: string; email: string }
export type View = 'overview' | 'graph' | 'notes' | 'sharing' | 'settings'
