#!/usr/bin/env node
// Self-learning hook — runs on Stop
// Reads session transcript summary, extracts learnings, appends to .claude/learnings.md

const fs = require('fs')
const path = require('path')

const chunks = []
process.stdin.on('data', c => chunks.push(c))
process.stdin.on('end', () => {
  let input = {}
  try { input = JSON.parse(Buffer.concat(chunks)) } catch {}

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const learningsPath = path.join(projectDir, '.claude', 'learnings.md')

  // Extract from session data
  const session = input.session_id || 'unknown'
  const summary = input.summary || ''
  const toolsUsed = (input.tools_used || []).join(', ')
  const errors = (input.errors || []).slice(0, 3)

  const date = new Date().toISOString().slice(0, 16).replace('T', ' ')

  // Build learning entry
  const entries = []
  entries.push(`\n## ${date} [${session.slice(-8)}]`)

  // Extract patterns from summary
  if (summary) {
    const patterns = extractPatterns(summary)
    if (patterns.length) {
      entries.push('**Patterns:**')
      patterns.forEach(p => entries.push(`- ${p}`))
    }
  }

  // Log errors for future avoidance
  if (errors.length) {
    entries.push('**Erreurs à éviter:**')
    errors.forEach(e => entries.push(`- ${String(e).slice(0, 120)}`))
  }

  // Tools used — infer task type for future routing improvement
  if (toolsUsed && toolsUsed.includes('Edit')) {
    entries.push(`**Outils:** ${toolsUsed.slice(0, 100)}`)
  }

  if (entries.length <= 1) return // nothing useful

  // Init file if needed
  if (!fs.existsSync(learningsPath)) {
    fs.writeFileSync(learningsPath, '# Project Learnings\n\nApprentissages cumulatifs — injecté automatiquement chaque session.\n')
  }

  // Trim file if > 200 lines (keep last 160)
  try {
    const existing = fs.readFileSync(learningsPath, 'utf8').split('\n')
    if (existing.length > 200) {
      const header = existing.slice(0, 3)
      const tail = existing.slice(-160)
      fs.writeFileSync(learningsPath, [...header, ...tail].join('\n'))
    }
  } catch {}

  fs.appendFileSync(learningsPath, entries.join('\n') + '\n')
})

function extractPatterns(text) {
  const patterns = []
  const lower = text.toLowerCase()

  if (lower.includes('merge conflict')) patterns.push('Conflits merge fréquents — fetch + rebase avant push')
  if (lower.includes('permission')) patterns.push('Problèmes de permissions — vérifier bypassPermissions dans settings.json')
  if (lower.includes('background-clip') || lower.includes('transition-all')) patterns.push('CSS interdit détecté — éviter background-clip:text, transition-all, Inter font')
  if (lower.includes('billing') || lower.includes('runner')) patterns.push('CI runners Mac/Win = minutes payantes — garder workflow_dispatch only')
  if (lower.includes('draft') || lower.includes('draft pr')) patterns.push('PR draft ne merge pas — marquer ready avant merge')
  if (lower.includes('error') || lower.includes('erreur')) patterns.push('Session avec erreurs — voir section ci-dessus')

  return patterns
}
