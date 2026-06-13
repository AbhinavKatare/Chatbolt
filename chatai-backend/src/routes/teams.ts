import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'
import { sendTeamInviteEmail } from '../services/email.service'


const router = Router()

// All team routes require authentication
router.use(authMiddleware)

// ── Validation schemas ─────────────────────────────────────────────
const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().default(''),
})

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
})

const InviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member', 'viewer']).optional().default('member'),
})

const DelegateSchema = z.object({
  run_id: z.string().uuid('Valid run_id UUID required'),
  assigned_to_tenant_id: z.string().uuid('Valid assigned_to_tenant_id UUID required'),
})

// ── Helper: verify team membership/ownership ──────────────────────
async function getTeamMember(teamId: string, tenantId: string) {
  return queryOne<any>(
    `SELECT tm.*, t.name as team_name, t.owner_tenant_id
     FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     WHERE tm.team_id = $1 AND tm.tenant_id = $2`,
    [teamId, tenantId]
  )
}

// ── POST / — Create a new team ────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    const { name, description } = parsed.data
    const tenantId = req.tenantId

    // Create the team
    const team = await queryOne<any>(
      `INSERT INTO teams (owner_tenant_id, name, description, plan)
       VALUES ($1, $2, $3, 'team')
       RETURNING *`,
      [tenantId, name, description]
    )

    if (!team) {
      return res.status(500).json({ error: 'Failed to create team' })
    }

    // Add the creator as the owner member
    await query(
      `INSERT INTO team_members (team_id, tenant_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (team_id, tenant_id) DO NOTHING`,
      [team.id, tenantId]
    )

    logger.info(`[Teams] Team created: ${team.id} by tenant ${tenantId}`)
    return res.status(201).json({ team })
  } catch (err: any) {
    logger.error(`[Teams] Create error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to create team: ' + err.message })
  }
})

// ── GET / — List teams the current user is a member of ───────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId

    const teams = await query<any>(
      `SELECT t.*,
              tm.role as my_role,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
              owner.name as owner_name,
              owner.email as owner_email
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN tenants owner ON t.owner_tenant_id = owner.id
       WHERE tm.tenant_id = $1
       ORDER BY t.created_at DESC`,
      [tenantId]
    )

    return res.json({ teams })
  } catch (err: any) {
    logger.error(`[Teams] List error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to list teams: ' + err.message })
  }
})

// ── GET /:id — Get team details + members list ────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    // Verify membership
    const membership = await getTeamMember(id, req.tenantId!)
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this team' })
    }

    const team = await queryOne<any>(
      `SELECT t.*,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
              owner.name as owner_name,
              owner.email as owner_email
       FROM teams t
       LEFT JOIN tenants owner ON t.owner_tenant_id = owner.id
       WHERE t.id = $1`,
      [id]
    )

    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    const members = await query<any>(
      `SELECT tm.*, ten.name, ten.email, ten.plan
       FROM team_members tm
       JOIN tenants ten ON tm.tenant_id = ten.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [id]
    )

    const pendingInvites = await query<any>(
      `SELECT ti.*, inv.name as invited_by_name, inv.email as invited_by_email
       FROM team_invites ti
       LEFT JOIN tenants inv ON ti.invited_by = inv.id
       WHERE ti.team_id = $1 AND ti.accepted = false AND ti.expires_at > NOW()
       ORDER BY ti.created_at DESC`,
      [id]
    )

    return res.json({ team, members, pending_invites: pendingInvites, my_role: membership.role })
  } catch (err: any) {
    logger.error(`[Teams] Get error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to get team: ' + err.message })
  }
})

// ── PATCH /:id — Update team name/description (owner only) ───────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    const parsed = UpdateTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    // Verify ownership
    const team = await queryOne<any>(
      `SELECT * FROM teams WHERE id = $1`,
      [id]
    )
    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }
    if (team.owner_tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Only the team owner can update team details' })
    }

    const { name, description } = parsed.data
    const updated = await queryOne<any>(
      `UPDATE teams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name ?? null, description ?? null, id]
    )

    logger.info(`[Teams] Team updated: ${id} by ${tenantId}`)
    return res.json({ team: updated })
  } catch (err: any) {
    logger.error(`[Teams] Update error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to update team: ' + err.message })
  }
})

// ── DELETE /:id — Delete team (owner only) ────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    const team = await queryOne<any>(`SELECT * FROM teams WHERE id = $1`, [id])
    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }
    if (team.owner_tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Only the team owner can delete the team' })
    }

    await query(`DELETE FROM teams WHERE id = $1`, [id])

    logger.info(`[Teams] Team deleted: ${id} by ${tenantId}`)
    return res.json({ success: true })
  } catch (err: any) {
    logger.error(`[Teams] Delete error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to delete team: ' + err.message })
  }
})

// ── POST /:id/invite — Invite a user by email ────────────────────
router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    const parsed = InviteSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    // Verify membership (admin or owner can invite)
    const membership = await getTeamMember(id, req.tenantId!)
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this team' })
    }
    if (!['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only team owners and admins can invite members' })
    }

    // Check plan restriction for teammate invite (requires Team or Enterprise)
    const ownerTenant = await queryOne<any>('SELECT plan FROM tenants WHERE id = $1', [tenantId])
    const planName = (ownerTenant?.plan || 'free').toLowerCase()
    if (planName !== 'team' && planName !== 'enterprise') {
      return res.status(402).json({
        upgrade_required: true,
        message: 'Inviting teammates requires Team plan — $49/month.',
        checkout_url: '/dashboard/settings/billing?plan=team'
      })
    }

    const team = await queryOne<any>(`SELECT * FROM teams WHERE id = $1`, [id])
    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    const { email, role } = parsed.data

    // Check if user is already a member by email
    const existingMember = await queryOne<any>(
      `SELECT tm.* FROM team_members tm
       JOIN tenants t ON tm.tenant_id = t.id
       WHERE tm.team_id = $1 AND t.email = $2`,
      [id, email]
    )
    if (existingMember) {
      return res.status(409).json({ error: 'This user is already a member of the team' })
    }

    // Remove any existing pending invite for this email+team
    await query(
      `DELETE FROM team_invites WHERE team_id = $1 AND invited_email = $2 AND accepted = false`,
      [id, email]
    )

    // Create the invite
    const invite = await queryOne<any>(
      `INSERT INTO team_invites (team_id, invited_email, invited_by, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, email, tenantId, role]
    )

    // Send the invitation email
    const inviter = await queryOne<any>('SELECT name FROM tenants WHERE id = $1', [tenantId])
    const inviteUrl = `${req.protocol}://${req.get('host')}/api/invites/${invite?.token}`
    await sendTeamInviteEmail(
      email,
      inviter?.name || 'A teammate',
      team.name || 'Chatbolt Workspace',
      inviteUrl
    ).catch((mailErr) => {
      logger.error(`[Teams] Invite email failed to send to ${email}: ${mailErr.message}`)
    })

    logger.info(`[Teams] Invite sent to ${email} for team ${id} by ${tenantId}`)
    return res.status(201).json({
      invite,
      invite_url: inviteUrl,
    })
  } catch (err: any) {
    logger.error(`[Teams] Invite error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to send invite: ' + err.message })
  }
})

// ── POST /accept/:token — Accept an invite ────────────────────────
router.post('/accept/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const tenantId = req.tenantId

    // Find the invite
    const invite = await queryOne<any>(
      `SELECT ti.*, t.name as team_name
       FROM team_invites ti
       JOIN teams t ON ti.team_id = t.id
       WHERE ti.token = $1 AND ti.accepted = false AND ti.expires_at > NOW()`,
      [token]
    )

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or has expired' })
    }

    // Verify the accepting user's email matches the invite
    const tenant = await queryOne<any>(`SELECT * FROM tenants WHERE id = $1`, [tenantId])
    if (!tenant) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (tenant.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' })
    }

    // Check if already a member
    const existingMember = await queryOne<any>(
      `SELECT * FROM team_members WHERE team_id = $1 AND tenant_id = $2`,
      [invite.team_id, tenantId]
    )
    if (existingMember) {
      // Mark invite accepted anyway
      await query(`UPDATE team_invites SET accepted = true WHERE id = $1`, [invite.id])
      const team = await queryOne<any>(`SELECT * FROM teams WHERE id = $1`, [invite.team_id])
      return res.json({ success: true, team, message: 'Already a member of this team' })
    }

    // Add to team_members
    await query(
      `INSERT INTO team_members (team_id, tenant_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, tenant_id) DO NOTHING`,
      [invite.team_id, tenantId, invite.role]
    )

    // Mark invite as accepted
    await query(`UPDATE team_invites SET accepted = true WHERE id = $1`, [invite.id])

    const team = await queryOne<any>(`SELECT * FROM teams WHERE id = $1`, [invite.team_id])

    logger.info(`[Teams] Invite accepted: team ${invite.team_id} by tenant ${tenantId}`)
    return res.json({ success: true, team })
  } catch (err: any) {
    logger.error(`[Teams] Accept invite error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to accept invite: ' + err.message })
  }
})

// ── DELETE /:id/members/:memberId — Remove a team member (owner) ──
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params
    const tenantId = req.tenantId

    const team = await queryOne<any>(`SELECT * FROM teams WHERE id = $1`, [id])
    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    // Only owner or admin can remove members
    const myMembership = await getTeamMember(id, req.tenantId!)
    if (!myMembership) {
      return res.status(403).json({ error: 'Not a member of this team' })
    }
    if (!['owner', 'admin'].includes(myMembership.role)) {
      return res.status(403).json({ error: 'Only the team owner or admin can remove members' })
    }

    // Cannot remove the owner
    if (memberId === team.owner_tenant_id) {
      return res.status(400).json({ error: 'Cannot remove the team owner' })
    }

    // Cannot remove yourself if you are the only admin-level
    if (memberId === tenantId) {
      return res.status(400).json({ error: 'Cannot remove yourself. Transfer ownership first.' })
    }

    const result = await query(
      `DELETE FROM team_members WHERE team_id = $1 AND tenant_id = $2 RETURNING *`,
      [id, memberId]
    )

    if (result.length === 0) {
      return res.status(404).json({ error: 'Member not found in this team' })
    }

    logger.info(`[Teams] Member ${memberId} removed from team ${id} by ${tenantId}`)
    return res.json({ success: true })
  } catch (err: any) {
    logger.error(`[Teams] Remove member error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to remove member: ' + err.message })
  }
})

// ── GET /:id/activity — Get recent task runs by all team members ──
router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    // Verify membership
    const membership = await getTeamMember(id, req.tenantId!)
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this team' })
    }

    // Get last 20 workflow_runs for all members of this team
    const runs = await query<any>(
      `SELECT wr.*,
              w.name as workflow_name,
              w.original_prompt,
              ten.name as member_name,
              ten.email as member_email
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       LEFT JOIN tenants ten ON wr.tenant_id = ten.id
       WHERE wr.tenant_id IN (
         SELECT tenant_id FROM team_members WHERE team_id = $1
       )
       ORDER BY wr.created_at DESC
       LIMIT 20`,
      [id]
    )

    return res.json({ runs })
  } catch (err: any) {
    logger.error(`[Teams] Activity error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to fetch team activity: ' + err.message })
  }
})

// ── POST /:id/delegate — Delegate a task run to a team member ─────
router.post('/:id/delegate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId

    const parsed = DelegateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }

    const { run_id, assigned_to_tenant_id } = parsed.data

    // Verify the requester is a member
    const myMembership = await getTeamMember(id, req.tenantId!)
    if (!myMembership) {
      return res.status(403).json({ error: 'Not a member of this team' })
    }

    // Verify the assignee is a member of the same team
    const assigneeMembership = await getTeamMember(id, assigned_to_tenant_id)
    if (!assigneeMembership) {
      return res.status(404).json({ error: 'Assignee is not a member of this team' })
    }

    // Verify the run exists and belongs to the requester (or any team member)
    const run = await queryOne<any>(
      `SELECT wr.* FROM workflow_runs wr
       WHERE wr.id = $1
         AND wr.tenant_id IN (SELECT tenant_id FROM team_members WHERE team_id = $2)`,
      [run_id, id]
    )
    if (!run) {
      return res.status(404).json({ error: 'Task run not found or does not belong to this team' })
    }

    // Update the run with assignment
    await query(
      `UPDATE workflow_runs
       SET assigned_to = $1,
           team_id = $2
       WHERE id = $3`,
      [assigned_to_tenant_id, id, run_id]
    )

    logger.info(`[Teams] Run ${run_id} delegated to ${assigned_to_tenant_id} in team ${id} by ${tenantId}`)
    return res.json({ success: true })
  } catch (err: any) {
    logger.error(`[Teams] Delegate error: ${err.message}`)
    return res.status(500).json({ error: 'Failed to delegate task: ' + err.message })
  }
})

export default router
