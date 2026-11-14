import { parseNote } from './importer'

// Original fictional teaching notes. Never derived from a personal vault.
const samples: [string, string, string, string[]][] = [
  ['Projects/Neighborhood seed library.md', 'Neighborhood seed library', 'A small exchange shelf can help neighbors share seeds. Start with one location and a short planting guide. Connect this idea to [[Community rituals]] and test it with [[A two-week experiment]].', ['Projects', 'Community']],
  ['Ideas/A quiet reading corner.md', 'A quiet reading corner', 'An inviting place to read does not need much space. Try one comfortable chair, daylight, and a shelf of books. This connects [[Spaces that invite attention]] with [[Reading with a question]].', ['Ideas', 'Design']],
  ['Learning/Reading with a question.md', 'Reading with a question', 'Before opening a book, write one question. Keep the passages that change your understanding, then link them to [[Learning in small loops]]. A note should help a future decision.', ['Learning', 'Thinking']],
  ['Learning/Learning in small loops.md', 'Learning in small loops', 'Notice something, try a small action, and reflect on the outcome. [[A two-week experiment]] gives this loop a practical shape. A useful reflection includes what surprised you.', ['Learning', 'Thinking']],
  ['Ideas/Community rituals.md', 'Community rituals', 'Regular, low-pressure invitations make it easier for people to participate. A weekly seed swap or shared reading hour can connect [[Neighborhood seed library]] and [[A quiet reading corner]].', ['Community', 'Ideas']],
  ['Projects/A two-week experiment.md', 'A two-week experiment', 'Choose one question, one small intervention, and one observation. Write down what success would look like before starting. Use [[Field observations]] to collect evidence without changing the story afterward.', ['Projects', 'Research']],
  ['Research/Field observations.md', 'Field observations', 'Record what happened before interpreting why. Separate observation, interpretation, and next question. Link each observation to the project it informs, such as [[A two-week experiment]].', ['Research', 'Thinking']],
  ['Design/Spaces that invite attention.md', 'Spaces that invite attention', 'Good spaces make the next useful action easy to see. Reduce competing signals and leave room for the work. See [[A quiet reading corner]] and [[Designing a simple tool]].', ['Design', 'Research']],
  ['Design/Designing a simple tool.md', 'Designing a simple tool', 'A tool should make one important job easier. Begin with the action people already take. [[A useful default]] reduces setup, while [[A two-week experiment]] reveals where help is needed.', ['Design', 'Projects']],
  ['Learning/A useful default.md', 'A useful default', 'A useful default is safe, reversible, and easy to understand. Private notes should stay private until their author chooses otherwise. This is a practical example of [[Designing a simple tool]].', ['Learning', 'Design']],
  ['Writing/Keeping a field journal.md', 'Keeping a field journal', 'Capture one observation in a few sentences. Add a link when a connection becomes clear. Over time, [[Field observations]] become material for [[Writing from connected notes]].', ['Writing', 'Research']],
  ['Writing/Writing from connected notes.md', 'Writing from connected notes', 'Begin with a question and a few connected notes. Write a new argument rather than joining excerpts together. [[Reading with a question]] and [[Keeping a field journal]] provide different kinds of evidence.', ['Writing', 'Thinking']],
]

export function sampleNotes() {
  return samples.map(([path, title, body, tags], i) => parseNote(`---\ntitle: ${title}\ntags: [${tags.join(', ')}]\ntier: ${i < 2 ? '2A' : '1A'}\n---\n# ${title}\n\n${body}\n`, path, 'sample'))
}
