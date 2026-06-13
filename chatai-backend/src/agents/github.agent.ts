import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { callLLM } from './base.agent'

interface AgentContext {
  task: string
  inputs?: Record<string, any>
  tenantId: string
}

interface AgentResult {
  output: string
  status: 'success' | 'error'
  metadata?: Record<string, any>
}

/**
 * GitHubAgent — lists PRs, open issues, repo summary, commit history, and creates issues
 */
export class GitHubAgent {
  name = 'GitHub Agent'
  description = 'Check pull request status, browse open issues, get repo summaries, and manage GitHub tasks'
  category = 'development'

  private async ghFetch(token: string, path: string): Promise<any> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
    return res.json()
  }

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { task, inputs, tenantId } = ctx
    const token = inputs?.github_token || await integrationRegistryService.getToken(tenantId, 'github')

    if (!token) {
      return {
        output: 'GitHub is not connected. Please connect your GitHub account in Connections.',
        status: 'success',
      }
    }

    const taskLower = task.toLowerCase()
    const repo = inputs?.repo || task.match(/(?:repo|repository)[:\s]+["']?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i)?.[1]

    try {
      // ── Get Commit History ──────────────────────────────────────────────
      if (taskLower.includes('commit') || taskLower.includes('history')) {
        if (!repo) return { output: 'Please specify the repository name in the format owner/repo.', status: 'success' }
        
        const commits = await this.getCommitHistory(token, repo)
        const lines = commits.map((c: any) => `• **${c.commit.message.split('\n')[0]}**\n  Author: ${c.commit.author?.name} · ${new Date(c.commit.author?.date).toLocaleDateString()}`)
        
        return {
          output: `**Recent Commits in ${repo}**\n\n${lines.join('\n\n')}`,
          status: 'success',
          metadata: { commit_count: commits.length }
        }
      }

      // ── Get PR Diff / Summary (Plain-English Summary) ───────────────────
      if (taskLower.includes('pr diff') || taskLower.includes('pull request diff') || taskLower.includes('summarize pr') || taskLower.includes('pr summary')) {
        if (!repo) return { output: 'Please specify the repository name in the format owner/repo.', status: 'success' }
        const prNumberStr = inputs?.prNumber || task.match(/(?:pr|pull request|#)[:\s]*(\d+)/i)?.[1]
        if (!prNumberStr) return { output: 'Please specify the PR number.', status: 'success' }
        const prNumber = parseInt(prNumberStr, 10)

        const summary = await this.getPRDiff(token, repo, prNumber)
        return {
          output: `**PR #${prNumber} Summary in ${repo}**\n\n${summary}`,
          status: 'success',
          metadata: { repo, prNumber }
        }
      }

      // ── Get README ──────────────────────────────────────────────────────
      if (taskLower.includes('readme') || taskLower.includes('read me')) {
        if (!repo) return { output: 'Please specify the repository name in the format owner/repo.', status: 'success' }
        
        const readme = await this.getRepoReadme(token, repo)
        return {
          output: `**README.md for ${repo}**\n\n${readme}`,
          status: 'success',
          metadata: { repo }
        }
      }

      // ── Create Issue (PermissionCard) ───────────────────────────────────
      if (taskLower.includes('create issue') || taskLower.includes('open issue') || taskLower.includes('new issue')) {
        if (!repo) return { output: 'Please specify the repository name in the format owner/repo.', status: 'success' }
        const titleMatch = task.match(/(?:create|open|new) issue[:\s]+["']?([^"'\n]+)["']?/i)
        const title = titleMatch?.[1] || inputs?.title || 'New Issue'
        const body = inputs?.body || 'Created from Chatbolt'

        const issue = await this.createIssue(token, repo, title, body)
        return {
          output: `✅ Issue created successfully!\n\n**#${issue.number} ${issue.title}**\nURL: ${issue.html_url}`,
          status: 'success',
          metadata: { issue_number: issue.number, url: issue.html_url }
        }
      }

      // ── PR Status (Browse) ───────────────────────────────────────────────
      if (taskLower.includes('pull request') || taskLower.includes('pr') || taskLower.includes('review')) {
        if (repo) {
          const prs = await this.ghFetch(token, `/repos/${repo}/pulls?state=open&per_page=15`)
          if (!prs.length) return { output: `No open pull requests in ${repo}.`, status: 'success' }

          const lines = prs.map((pr: any) => {
            const reviews = pr.requested_reviewers?.map((r: any) => r.login).join(', ') || 'No reviewers requested'
            return `• **#${pr.number} ${pr.title}**\n  Author: ${pr.user.login} | ${pr.draft ? '🔲 Draft' : '🟢 Ready'}\n  Reviewers: ${reviews}\n  ${pr.html_url}`
          })

          return {
            output: `**Open Pull Requests in ${repo} (${prs.length})**\n\n${lines.join('\n\n')}`,
            status: 'success',
            metadata: { pr_count: prs.length, repo },
          }
        }

        // Without repo: get assigned PRs across all repos
        const prs = await this.ghFetch(token, '/search/issues?q=is:open+is:pr+review-requested:@me&per_page=15')
        const items = prs.items || []
        if (!items.length) return { output: 'No pull requests awaiting your review.', status: 'success' }
        const lines = items.map((pr: any) => `• **${pr.title}**\n  ${pr.repository_url?.replace('https://api.github.com/repos/', '')}\n  ${pr.html_url}`)
        return {
          output: `**PRs Awaiting Your Review (${items.length})**\n\n${lines.join('\n\n')}`,
          status: 'success',
        }
      }

      // ── Open Issues ───────────────────────────────────────────────────────
      if (taskLower.includes('issue') || taskLower.includes('bug') || taskLower.includes('todo')) {
        if (repo) {
          const issues = await this.ghFetch(token, `/repos/${repo}/issues?state=open&per_page=20`)
          const realIssues = issues.filter((i: any) => !i.pull_request) // exclude PRs
          if (!realIssues.length) return { output: `No open issues in ${repo}.`, status: 'success' }

          const lines = realIssues.slice(0, 10).map((i: any) => {
            const labels = i.labels?.map((l: any) => `[${l.name}]`).join(' ') || ''
            return `• **#${i.number} ${i.title}** ${labels}\n  Opened by ${i.user.login} · ${new Date(i.created_at).toLocaleDateString()}\n  ${i.html_url}`
          })

          return {
            output: `**Open Issues in ${repo} (${realIssues.length}${realIssues.length >= 20 ? '+' : ''})**\n\n${lines.join('\n\n')}`,
            status: 'success',
            metadata: { issue_count: realIssues.length, repo },
          }
        }

        const issues = await this.ghFetch(token, '/search/issues?q=is:open+is:issue+assignee:@me&per_page=15')
        const items = issues.items || []
        if (!items.length) return { output: 'No issues assigned to you.', status: 'success' }
        const lines = items.map((i: any) => `• **${i.title}**\n  ${i.repository_url?.replace('https://api.github.com/repos/', '')} · #${i.number}\n  ${i.html_url}`)
        return {
          output: `**Issues Assigned to You (${items.length})**\n\n${lines.join('\n\n')}`,
          status: 'success',
        }
      }

      // ── Repo Summary ──────────────────────────────────────────────────────
      if (repo) {
        const [repoData, prs, issues] = await Promise.all([
          this.ghFetch(token, `/repos/${repo}`),
          this.ghFetch(token, `/repos/${repo}/pulls?state=open&per_page=5`),
          this.ghFetch(token, `/repos/${repo}/issues?state=open&per_page=5`),
        ])

        const realIssues = issues.filter((i: any) => !i.pull_request)

        return {
          output: `**${repoData.full_name}** — ${repoData.description || 'No description'}
 
⭐ ${repoData.stargazers_count} stars · 🍴 ${repoData.forks_count} forks · 👁 ${repoData.watchers_count} watchers
Language: ${repoData.language || 'N/A'} · Default branch: \`${repoData.default_branch}\`
 
📌 Open Issues: ${repoData.open_issues_count}
🔀 Open PRs: ${prs.length}${prs.length === 5 ? '+' : ''}
 
${prs.length > 0 ? `**Recent PRs:**\n${prs.slice(0, 3).map((p: any) => `• #${p.number} ${p.title} by ${p.user.login}`).join('\n')}\n` : ''}${realIssues.length > 0 ? `**Recent Issues:**\n${realIssues.slice(0, 3).map((i: any) => `• #${i.number} ${i.title}`).join('\n')}` : ''}`,
          status: 'success',
          metadata: { stars: repoData.stargazers_count, open_prs: prs.length, open_issues: repoData.open_issues_count },
        }
      }

      // ── Default: user activity summary ───────────────────────────────────
      const user = await this.ghFetch(token, '/user')
      const events = await this.ghFetch(token, `/users/${user.login}/events?per_page=10`)

      const summary = events.slice(0, 5).map((e: any) => {
        const repo = e.repo?.name || ''
        if (e.type === 'PushEvent') return `• Pushed to ${repo} (${e.payload?.commits?.length || 1} commits)`
        if (e.type === 'PullRequestEvent') return `• ${e.payload?.action} PR in ${repo}: ${e.payload?.pull_request?.title}`
        if (e.type === 'IssuesEvent') return `• ${e.payload?.action} issue in ${repo}: ${e.payload?.issue?.title}`
        if (e.type === 'CreateEvent') return `• Created ${e.payload?.ref_type} in ${repo}`
        return null
      }).filter(Boolean).join('\n')

      return {
        output: `**GitHub Summary — ${user.name || user.login}**\n\nPublic repos: ${user.public_repos} · Followers: ${user.followers}\n\n**Recent Activity:**\n${summary || 'No recent activity'}`,
        status: 'success',
        metadata: { github_username: user.login },
      }
    } catch (err: any) {
      logger.error(`[GitHubAgent] operation failed:`, err.message)
      return { output: `GitHub error: ${err.message}`, status: 'error' }
    }
  }

  async listRepos(userId: string): Promise<any[]> {
    const token = await integrationRegistryService.getToken(userId, 'github')
    if (!token) {
      return [{ id: 1, name: 'mock-repo', full_name: 'mock-owner/mock-repo' }]
    }
    try {
      return await this.ghFetch(token, '/user/repos?per_page=10')
    } catch {
      return [{ id: 1, name: 'mock-repo', full_name: 'mock-owner/mock-repo' }]
    }
  }

  async getCommitHistory(token: string, repo: string): Promise<any[]> {
    return this.ghFetch(token, `/repos/${repo}/commits?per_page=10`)
  }

  async getPRDiff(token: string, repo: string, prNumber: number): Promise<string> {
    try {
      const files = await this.ghFetch(token, `/repos/${repo}/pulls/${prNumber}/files?per_page=20`)
      const fileList = files.map((f: any) => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')
      
      const systemPrompt = `You are a GitHub Pull Request Explainer.
Given the list of files changed in a PR, summarize in 2-3 sentences what features or bugfixes this PR likely contains.
Write in plain, professional English. Never use technical jargon like LLM, agent, pipeline.`
      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content } = await callLLM(modelToUse, systemPrompt, `PR files changed in ${repo} #${prNumber}:\n${fileList}`, 300)
      return content.trim()
    } catch (err: any) {
      return `Failed to fetch PR diff: ${err.message}`
    }
  }

  async getRepoReadme(token: string, repo: string): Promise<string> {
    try {
      const data = await this.ghFetch(token, `/repos/${repo}/readme`)
      if (data && data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf8')
        return decoded.slice(0, 1500) + (decoded.length > 1500 ? '\n\n...(truncated)' : '')
      }
      return 'No readme found.'
    } catch (err: any) {
      return `Failed to fetch README: ${err.message}`
    }
  }

  async createIssue(token: string, repo: string, title: string, body?: string): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, body })
    })
    if (!res.ok) throw new Error(`GitHub createIssue error: ${res.status} ${res.statusText}`)
    return res.json()
  }
}

export const githubAgent = new GitHubAgent()
