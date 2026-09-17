/**
 * Copy KnowEmp's Nest-free adapter/tool subset into knowemp-dsh/adapter.
 * Strips decorators and constructor parameter properties so Node 22 strip-only TS can load it.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const destRoot = join(here, 'adapter')
const srcRoot = join(process.env.KNOWEMP_ROOT || 'D:/work/project/KnowEmp', 'server/src')

const SKIP = /\.(spec|module)\.ts$/
const SKIP_NAMES = new Set(['tool.registry.ts'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function want(rel) {
  const posixRel = rel.split(sep).join('/')
  if (!posixRel.endsWith('.ts')) return false
  if (SKIP.test(posixRel) || SKIP_NAMES.has(posixRel.split('/').pop() ?? '')) return false
  return [
    'dsh-bridge.ts',
    'common/types/',
    'domain/',
    'legacy/legacy.facade.ts',
    'legacy/registry.ts',
    'legacy/contracts/',
    'legacy/systems/tds/',
    'legacy/systems/kms/',
    'llm/',
    'agent/vendor-policy.extractor.ts',
    'agent/prompts/knowledge.prompt.ts',
    'agent/tools/',
  ].some(prefix => posixRel === prefix || posixRel.startsWith(prefix))
}

function shimImport(fromFile) {
  const rel = relative(dirname(fromFile), join(destRoot, 'nest-shim.ts')).split(sep).join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function splitParams(raw) {
  const params = []
  let current = ''
  let depth = 0
  for (const ch of raw) {
    if ('<({['.includes(ch)) depth += 1
    else if ('>)}]'.includes(ch)) depth -= 1
    if (ch === ',' && depth === 0) {
      params.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) params.push(current.trim())
  return params.filter(Boolean)
}

function transformConstructor(source) {
  return source.replace(/constructor\s*\(([\s\S]*?)\)(\s*)\{/g, (match, rawParams, space) => {
    const params = splitParams(rawParams)
    const fields = []
    const assigns = []
    const nextParams = []
    let changed = false
    for (const param of params) {
      const cleaned = param.replace(/@Inject\([^)]*\)\s*/g, '').trim()
      const prop = cleaned.match(/^(private|public|protected)\s+(readonly\s+)?([A-Za-z_$][\w$]*)\s*([?=:][\s\S]*)$/)
      if (!prop) {
        nextParams.push(cleaned)
        continue
      }
      changed = true
      const [, vis, readonlyKw = '', name, rest] = prop
      const optional = rest.startsWith('?')
      const after = optional ? rest.slice(1) : rest
      const eq = after.indexOf('=')
      const typePart = (eq >= 0 ? after.slice(0, eq) : after).replace(/^:\s*/, '').trim()
      const defaultPart = eq >= 0 ? after.slice(eq).trim() : ''
      fields.push(`  ${vis} ${readonlyKw}${name}${optional ? '?' : ''}: ${typePart}`)
      assigns.push(`    this.${name} = ${name}`)
      nextParams.push(`${name}${optional ? '?' : ''}: ${typePart}${defaultPart ? ` ${defaultPart}` : ''}`)
    }
    if (!changed) return match
    const head = `${fields.join('\n')}\n  constructor(\n    ${nextParams.join(',\n    ')}\n  )${space}{\n${assigns.join('\n')}\n`
    return head
  })
}

function transform(source, destFile) {
  let text = source
    .replace(/@Injectable\(\)\s*/g, '')
    .replace(/@Inject\([^)]*\)\s*/g, '')
  text = transformConstructor(text)

  const needs = {
    Logger: /\bLogger\b/.test(text),
    ConfigService: /\bConfigService\b/.test(text),
    NotFoundException: /\bNotFoundException\b/.test(text),
  }
  text = text.replace(/import\s+type\s+\{[^}]*\}\s+from\s+'@nestjs\/[^']+';?\r?\n/g, '')
  text = text.replace(/import\s+\{[^}]*\}\s+from\s+'@nestjs\/[^']+';?\r?\n/g, '')
  const names = Object.entries(needs).filter(([, hit]) => hit).map(([name]) => name)
  if (names.length) {
    text = `import { ${names.join(', ')} } from '${shimImport(destFile)}'\n${text}`
  }
  return text
}

mkdirSync(destRoot, { recursive: true })
writeFileSync(join(destRoot, 'nest-shim.ts'), `/** Nest-free stand-ins used by the vendored KnowEmp adapter. */

export class Logger {
  context: string
  constructor(context = 'knowemp') {
    this.context = context
  }
  log(message: string): void { console.log(\`[\${this.context}] \${message}\`) }
  warn(message: string): void { console.warn(\`[\${this.context}] \${message}\`) }
  debug(message: string): void { console.debug(\`[\${this.context}] \${message}\`) }
  error(message: string): void { console.error(\`[\${this.context}] \${message}\`) }
}

export class ConfigService {
  get<T = string>(key: string): T | undefined {
    const value = process.env[key]
    return (value === undefined || value === '' ? undefined : value) as T | undefined
  }
}

export class NotFoundException extends Error {
  constructor(message = 'Not Found') {
    super(message)
    this.name = 'NotFoundException'
  }
}
`)

let copied = 0
for (const full of walk(srcRoot)) {
  const rel = relative(srcRoot, full)
  if (!want(rel)) continue
  const dest = join(destRoot, rel)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, transform(readFileSync(full, 'utf8'), dest))
  copied += 1
  console.log(posix.normalize(rel.split(sep).join('/')))
}
console.log(`copied ${copied} files -> ${destRoot}`)
