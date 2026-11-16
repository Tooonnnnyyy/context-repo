import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const rules = [
  ['private local path', /\/(?:Users|home)\/[a-z0-9._-]+/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|AKIA[0-9A-Z]{16})\b/],
  ['personal academic address', /\b[\w.+-]+@(?:[\w.-]+\.)?(?:uottawa|uwo)\.ca\b/i],
]
const extra = process.env.PRIVACY_DENYLIST_FILE
if (extra) for (const term of JSON.parse(readFileSync(extra, 'utf8'))) rules.push(['owner-specific identifier', { test: s => s.toLocaleLowerCase().includes(term.toLocaleLowerCase()) }])
const problems = []
const inspect = file => {
  if (!existsSync(file) || statSync(file).isDirectory()) return
  const data = readFileSync(file)
  if (data.includes(0)) return
  for (const [category, pattern] of rules) if (pattern.test(data.toString('utf8'))) problems.push(`${category}: ${file}`)
}
for (const file of new Set(files)) {
  if (/^(?:vault|imports|exports|backups|content|context)\//.test(file)) problems.push(`user-data directory: ${file}`)
  inspect(file)
}
const walk = dir => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else inspect(p) } }
if (existsSync('dist')) walk('dist')
const metadata = execFileSync('git', ['log', '--all', '--format=%an|%ae|%cn|%ce'], { encoding: 'utf8' }).trim().split('\n')
for (const record of metadata) {
  const [author, email, committer, commitEmail] = record.split('|')
  if (author !== 'Context Contributors' || committer !== 'Context Contributors' || email !== 'contributors@users.noreply.github.com' || commitEmail !== email) problems.push('Git author/committer metadata outside neutral identity policy')
}
if (problems.length) { console.error([...new Set(problems)].join('\n')); process.exit(1) }
console.log(`Privacy checks passed: ${new Set(files).size} source files, ${existsSync('dist') ? 'built assets' : 'no build yet'}, all-ref Git identities. No matched values printed.`)
