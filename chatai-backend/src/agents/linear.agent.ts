import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'

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
 * LinearAgent — manages issues and projects via Linear GraphQL API
 */
export class LinearAgent {
  name = 'Linear Agent'
  description = 'Create, list, comment, and update issues and projects in Linear'
  category = 'project-management'

  private async linearQuery(token: string, query: string, variables?: any): Promise<any> {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) throw new Error(`Linear API error: ${res.status}`)
    const data = await res.json()
    if (data.errors?.length) throw new Error(data.errors[0].message)
    return data.data
  }

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { task, inputs, tenantId } = ctx
    const token = inputs?.linear_token || await integrationRegistryService.getToken(tenantId, 'linear')

    if (!token) {
      return {
        output: 'Linear is not connected. Please connect your Linear account in Connections.',
        status: 'success',
      }
    }

    const taskLower = task.toLowerCase()

    try {
      // ── Get Specific Issue ──────────────────────────────────────────────
      if (taskLower.includes('get issue') || taskLower.includes('fetch issue') || taskLower.includes('view issue')) {
        const issueId = inputs?.issueId || task.match(/(?:issue|id)[:\s]+["']?([A-Z]+-\d+|\w+)/i)?.[1]
        if (!issueId) return { output: 'Please specify the Linear issue ID (e.g. ENG-123).', status: 'success' }
        
        const issue = await this.getIssue(token, issueId)
        const assignee = issue.assignee?.name || 'Unassigned'
        return {
          output: `**Linear Issue: ${issue.title}** [${issue.state?.name}]\nAssignee: ${assignee} | Priority: ${issue.priority}\nURL: ${issue.url}\n\nDescription: ${issue.description || 'No description provided.'}`,
          status: 'success',
          metadata: { issue_id: issue.id, url: issue.url }
        }
      }

      // ── Update Issue Priority (PermissionCard) ──────────────────────────
      if (taskLower.includes('priority') && (taskLower.includes('update') || taskLower.includes('change') || taskLower.includes('set'))) {
        const issueId = inputs?.issueId || task.match(/(?:issue|id)[:\s]+["']?([A-Z]+-\d+|\w+)/i)?.[1]
        const priorityStr = inputs?.priority || task.match(/priority\s+(?:to\s+)?(\w+)/i)?.[1]
        if (!issueId) return { output: 'Please specify the Linear issue ID.', status: 'success' }
        
        let priorityVal = 0
        if (priorityStr) {
          const p = priorityStr.toLowerCase()
          if (p.includes('urgent')) priorityVal = 1
          else if (p.includes('high')) priorityVal = 2
          else if (p.includes('med')) priorityVal = 3
          else if (p.includes('low')) priorityVal = 4
        }

        const updated = await this.updateIssuePriority(token, issueId, priorityVal)
        return {
          output: `✅ Updated priority for issue **${issueId}** to level ${updated.priority}.`,
          status: 'success',
          metadata: { issue_id: issueId }
        }
      }

      // ── Add Comment (PermissionCard) ────────────────────────────────────
      if (taskLower.includes('comment') || taskLower.includes('add note')) {
        const issueId = inputs?.issueId || task.match(/(?:issue|id)[:\s]+["']?([A-Z]+-\d+|\w+)/i)?.[1]
        const commentBody = inputs?.comment || task.match(/comment[:\s]+["']?([^"'\n]+)/i)?.[1]
        if (!issueId || !commentBody) return { output: 'Please specify both the issue ID and comment content.', status: 'success' }

        const comment = await this.addComment(token, issueId, commentBody)
        return {
          output: `✅ Comment added successfully to issue **${issueId}**.`,
          status: 'success',
          metadata: { comment_id: comment.id }
        }
      }

      // ── Get Project ─────────────────────────────────────────────────────
      if (taskLower.includes('get project') || taskLower.includes('project details') || taskLower.includes('view project')) {
        const projectId = inputs?.projectId || task.match(/(?:project|id)[:\s]+["']?(\w+)/i)?.[1]
        if (!projectId) return { output: 'Please specify the Linear project ID/name.', status: 'success' }

        const project = await this.getProject(token, projectId)
        return {
          output: `**Linear Project: ${project.name}** [${project.state}]\nProgress: ${Math.round(project.progress * 100)}% | Target: ${project.targetDate || 'None'}\nURL: ${project.url}\n\nDescription: ${project.description || 'No description.'}`,
          status: 'success',
          metadata: { project_id: project.id }
        }
      }

      // ── Create Issue ─────────────────────────────────────────────────────
      if (taskLower.includes('create') || taskLower.includes('new issue') || taskLower.includes('add issue')) {
        const titleMatch = task.match(/create (?:an? )?issue[:\s]+["']?([^"'\n]+)["']?/i) ||
                           task.match(/new issue[:\s]+["']?([^"'\n]+)["']?/i)
        const issueTitle = titleMatch?.[1]?.trim() || inputs?.title || task

        // Get first team
        const teamsData = await this.linearQuery(token, `{ teams { nodes { id name } } }`)
        const team = teamsData.teams?.nodes?.[0]
        if (!team) return { output: 'No Linear teams found in your workspace.', status: 'success' }

        const created = await this.linearQuery(token, `
          mutation CreateIssue($title: String!, $teamId: String!, $description: String) {
            issueCreate(input: { title: $title, teamId: $teamId, description: $description }) {
              success
              issue { id title url state { name } }
            }
          }
        `, { title: issueTitle, teamId: team.id, description: inputs?.description || '' })

        const issue = created.issueCreate?.issue
        if (!issue) return { output: 'Failed to create the issue. Please try again.', status: 'error' }

        return {
          output: `✅ Issue created successfully!\n\n**${issue.title}**\nStatus: ${issue.state?.name}\nURL: ${issue.url}`,
          status: 'success',
          metadata: { issue_id: issue.id, issue_url: issue.url },
        }
      }

      // ── Default / List my issues ────────────────────────────────────────
      const result = await this.listMyIssues(token)
      return result
    } catch (err: any) {
      logger.error(`[LinearAgent] operation failed:`, err.message)
      return { output: `Linear error: ${err.message}`, status: 'error' }
    }
  }

  async getIssue(token: string, id: string): Promise<any> {
    const data = await this.linearQuery(token, `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id title description state { name } assignee { name } priority url
        }
      }
    `, { id })
    return data.issue
  }

  async updateIssuePriority(token: string, id: string, priority: number): Promise<any> {
    const data = await this.linearQuery(token, `
      mutation UpdateIssuePriority($id: String!, $priority: Int!) {
        issueUpdate(id: $id, input: { priority: $priority }) {
          success
          issue { id title priority }
        }
      }
    `, { id, priority })
    return data.issueUpdate?.issue
  }

  async addComment(token: string, issueId: string, body: string): Promise<any> {
    const data = await this.linearQuery(token, `
      mutation AddComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment { id body }
        }
      }
    `, { issueId, body })
    return data.commentCreate?.comment
  }

  async listMyIssues(token: string): Promise<AgentResult> {
    const data = await this.linearQuery(token, `
      query {
        viewer { name }
        issues(filter: { assignee: { isMe: { eq: true } } }, first: 20) {
          nodes { id title state { name } priority url }
        }
      }
    `)
    const issues = data.issues?.nodes || []
    if (issues.length === 0) return { output: 'No issues assigned to you.', status: 'success' }

    const lines = issues.map((i: any) => `• **${i.title}** [${i.state?.name || 'Open'}] Priority: ${i.priority}\n  ${i.url}`)
    return {
      output: `**Linear Overview for ${data.viewer?.name}**\n\n${lines.join('\n\n')}`,
      status: 'success',
      metadata: { total_assigned: issues.length }
    }
  }

  async getProject(token: string, id: string): Promise<any> {
    const data = await this.linearQuery(token, `
      query GetProject($id: String!) {
        project(id: $id) {
          id name description state progress targetDate url
        }
      }
    `, { id })
    return data.project
  }
}

export const linearAgent = new LinearAgent()
