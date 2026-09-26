#!/usr/bin/env node

import { ChatboltClient } from '../src/client'
import { runCommand } from '../src/commands/run'
import { statusCommand } from '../src/commands/status'
import { replayCommand } from '../src/commands/replay'
import { memoryCommand } from '../src/commands/memory'
import { permissionsCommand } from '../src/commands/permissions'
import { costCommand, modelsCommand } from '../src/commands/cost'
import { shareCommand } from '../src/commands/share'
import { doctorCommand } from '../src/commands/doctor'
import { evalCommand } from '../src/commands/eval'
import { securityCommand } from '../src/commands/security'

function parseArgs(args: string[]) {
  const flags: Record<string, any> = {}
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[key] = args[i + 1]
        i++
      } else {
        flags[key] = true
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[key] = args[i + 1]
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { positional, flags }
}

function printHelp() {
  console.log(`
Chatbolt CLI - Non-Intrusive Developer Companion for Multi-Agent Workforces

USAGE:
  chatbolt <command> [arguments] [options]

COMMANDS:
  run <prompt>                Execute an autonomous task (returns immediately by default)
  status [runId]              Check status of active or specific task run
  replay <runId>              View complete decision trail, rationales, and itemized spend
  memory list|add|delete      Inspect and curate native cross-session memory
  permissions list|approve    Manage standing rules and approve pending permissions
  cost summary                View real-time token and financial spend breakdown
  models                      List non-marked-up provider token rates ($/1M)
  share <runId> [--revoke]    Generate or revoke privacy-scrubbed public replay links
  eval list|show|gate|custom  Inspect benchmark competency scorecards and deployment gates
  security trust|audit|export Inspect enterprise security trust center, audit logs, and compliance
  doctor                      Check system connectivity and tripartite architecture health
  help                        Show this help message

OPTIONS:
  --watch, -w                 Stream live agent execution via SSE (does not lock terminal)
  --json                      Output machine-parseable JSON for CI/CD scripting
  --team <id>                 Target specific multi-agent team squad
  --model <model>             Specify LLM model (e.g., openai/gpt-4o, anthropic/claude-3-5-sonnet)
  --role <role>               Specify agent role (e.g., researcher, developer, writer)
  --category <cat>            Memory category: fact, decision, preference, architecture, constraint
  --expires-in <days>         Days before share link expires (default: 7)

EXAMPLES:
  # 1. Non-blocking kickoff (executes in background, returns control immediately):
  chatbolt run "Audit API routes for authorization bypasses" --team technical_team

  # 2. Live streaming mode (watch progress without terminal hijacking):
  chatbolt run "Generate product launch press release" --team marketing --watch

  # 3. Query current status:
  chatbolt status run_1790156339552_n07q

  # 4. View itemized session replay and model costs:
  chatbolt replay run_1790156339552_n07q

  # 5. Inspect cross-session memory:
  chatbolt memory list --role developer
`)
}

async function main() {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs[0] === 'help') {
    printHelp()
    return
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    console.log('chatbolt-cli v1.0.0 (dashboard-first architecture)')
    return
  }

  const { positional, flags } = parseArgs(rawArgs)
  const command = positional[0]
  const client = new ChatboltClient()
  const isJson = Boolean(flags.json)

  switch (command) {
    case 'run':
    case 'task':
    case 'exec': {
      const prompt = positional.slice(1).join(' ') || flags.prompt || flags.p
      await runCommand({
        prompt,
        team: flags.team || flags.t,
        model: flags.model || flags.m,
        role: flags.role || flags.r,
        watch: Boolean(flags.watch || flags.w || flags.attach || flags.a),
        json: isJson
      }, client)
      break
    }

    case 'status': {
      const runId = positional[1] || flags.run || flags.id
      await statusCommand({
        runId,
        json: isJson
      }, client)
      break
    }

    case 'replay': {
      const runId = positional[1] || flags.run || flags.id
      await replayCommand({
        runId,
        format: flags.format || (isJson ? 'json' : 'text'),
        json: isJson
      }, client)
      break
    }

    case 'memory': {
      const sub = positional[1] || 'list'
      if (sub === 'list') {
        await memoryCommand({
          action: 'list',
          role: flags.role || flags.r,
          teamId: flags.team || flags.t,
          category: flags.category || flags.c,
          json: isJson
        }, client)
      } else if (sub === 'add') {
        const content = positional.slice(2).join(' ') || flags.content
        await memoryCommand({
          action: 'add',
          content,
          role: flags.role || flags.r,
          teamId: flags.team || flags.t,
          category: flags.category || flags.c || 'fact',
          json: isJson
        }, client)
      } else if (sub === 'delete' || sub === 'rm') {
        const id = positional[2] || flags.id
        await memoryCommand({
          action: 'delete',
          id,
          json: isJson
        }, client)
      } else {
        console.error(`Unknown memory subcommand: ${sub}. Supported: list, add, delete`)
        process.exitCode = 1
      }
      break
    }

    case 'permissions':
    case 'perm': {
      const sub = positional[1] || 'list'
      if (sub === 'list') {
        await permissionsCommand({ action: 'list', json: isJson }, client)
      } else if (sub === 'approve') {
        const runId = positional[2] || flags.run
        await permissionsCommand({ action: 'approve', runId, json: isJson }, client)
      } else if (sub === 'deny') {
        const runId = positional[2] || flags.run
        await permissionsCommand({ action: 'deny', runId, reason: flags.reason, json: isJson }, client)
      } else {
        console.error(`Unknown permissions subcommand: ${sub}. Supported: list, approve, deny`)
        process.exitCode = 1
      }
      break
    }

    case 'cost': {
      await costCommand({
        teamId: flags.team || flags.t,
        json: isJson
      }, client)
      break
    }

    case 'models': {
      await modelsCommand(isJson, client)
      break
    }

    case 'share': {
      const runId = positional[1] || flags.run
      await shareCommand({
        runId,
        expiresInDays: flags['expires-in'] ? Number(flags['expires-in']) : 7,
        revoke: Boolean(flags.revoke),
        json: isJson
      }, client)
      break
    }

    case 'eval':
    case 'benchmark':
    case 'scorecard': {
      const sub = positional[1] || 'list'
      if (sub === 'list') {
        await evalCommand({ action: 'list', json: isJson }, client)
      } else if (sub === 'show') {
        const role = positional[2] || flags.role || flags.r
        await evalCommand({ action: 'show', role, json: isJson }, client)
      } else if (sub === 'gate') {
        const role = positional[2] || flags.role || flags.r
        const team = flags.team || flags.t
        const tier = flags.tier || 'pro'
        await evalCommand({ action: 'gate', role, team, tier, json: isJson }, client)
      } else if (sub === 'custom') {
        const customSub = positional[2] || 'list'
        if (customSub === 'list') {
          const role = flags.role || flags.r
          await evalCommand({ action: 'custom', customSubAction: 'list', role, json: isJson }, client)
        } else if (customSub === 'add') {
          const role = flags.role || flags.r
          const name = flags.name || flags.n
          const prompt = positional.slice(3).join(' ') || flags.prompt || flags.p
          const keywords = flags.keywords ? flags.keywords.split(',') : []
          await evalCommand({ action: 'custom', customSubAction: 'add', role, name, prompt, keywords, json: isJson }, client)
        } else if (customSub === 'run') {
          const evalId = positional[3] || flags.id
          const output = flags.output || flags.o || positional.slice(4).join(' ')
          await evalCommand({ action: 'custom', customSubAction: 'run', evalId, output, json: isJson }, client)
        }
      } else {
        console.error(`Unknown eval subcommand: ${sub}. Supported: list, show, gate, custom`)
        process.exitCode = 1
      }
      break
    }

    case 'security':
    case 'trust': {
      const sub = (positional[1] || 'trust') as any
      const format = (flags.format || 'json') as any
      const category = flags.category || flags.c
      const userId = flags.user || flags.u
      const limit = flags.limit ? Number(flags.limit) : 20
      const scope = (flags.scope || 'all') as any
      await securityCommand({ action: sub, format, category, userId, limit, scope, json: isJson }, client)
      break
    }

    case 'doctor': {
      await doctorCommand(isJson, client)
      break
    }

    default:
      console.error(`Unknown command: ${command}. Run 'chatbolt --help' for available commands.`)
      process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err.message)
  process.exitCode = 1
})
