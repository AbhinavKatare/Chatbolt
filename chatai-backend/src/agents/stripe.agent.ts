import Stripe from 'stripe'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

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

export class StripeAgent {
  name = 'Stripe Agent'
  description = 'Manage payment links, charges, customers and retrieve revenue summaries'
  category = 'billing'

  private async getStripeClient(userId: string): Promise<Stripe | null> {
    const token = await integrationRegistryService.getToken(userId, 'stripe')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    return new Stripe(token, { apiVersion: '2023-10-16' as any })
  }

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { task, inputs, tenantId } = ctx
    const stripe = await this.getStripeClient(tenantId)
    const t = task.toLowerCase()

    try {
      // ── getRevenueSummary (read-only) ──────────────────────────────────
      if (t.includes('revenue') || t.includes('summary') || t.includes('earnings')) {
        if (!stripe) {
          return {
            output: `**Stripe Revenue Summary (Mock)**\n\nTotal Sales: **$15,420.00**\nPending Payouts: **$1,250.00**\nActive Subscribers: **45**\nRefund Rate: **1.2%**`,
            status: 'success',
            metadata: { total_sales: 15420 }
          }
        }
        
        const balance = await stripe.balance.retrieve()
        const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100
        const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100
        
        return {
          output: `**Stripe Balance Summary**\n\nAvailable Balance: **$${available.toFixed(2)}**\nPending Balance: **$${pending.toFixed(2)}**`,
          status: 'success',
          metadata: { available, pending }
        }
      }

      // ── lookupCustomer (read-only) ─────────────────────────────────────
      if (t.includes('customer') || t.includes('user') || t.includes('lookup')) {
        const email = inputs?.email || task.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)?.[1]
        if (!email) return { output: 'Please specify the customer email address.', status: 'success' }

        if (!stripe) {
          return {
            output: `**Stripe Customer Search: ${email} (Mock)**\n\nName: John Doe\nEmail: ${email}\nCustomer ID: cus_Mock12345\nCreated: ${new Date().toLocaleDateString()}\nStatus: Active Subscription`,
            status: 'success',
            metadata: { customer_id: 'cus_Mock12345' }
          }
        }

        const customers = await stripe.customers.list({ email, limit: 1 })
        const customer = customers.data[0]
        if (!customer) return { output: `No Stripe customer found for email: ${email}`, status: 'success' }

        return {
          output: `**Stripe Customer: ${customer.name || 'Unnamed'}**\nEmail: ${customer.email}\nID: ${customer.id}\nCreated: ${new Date(customer.created * 1000).toLocaleDateString()}`,
          status: 'success',
          metadata: { customer_id: customer.id }
        }
      }

      // ── listRecentCharges (read-only) ──────────────────────────────────
      if (t.includes('charges') || t.includes('transactions') || t.includes('payments')) {
        if (!stripe) {
          return {
            output: `**Recent Stripe Charges (Mock)**\n\n• **$50.00** by user1@example.com (ch_1234)\n• **$120.00** by user2@example.com (ch_5678)\n• **$15.00** by user3@example.com (ch_9012)`,
            status: 'success'
          }
        }

        const charges = await stripe.charges.list({ limit: 10 })
        const lines = charges.data.map(c => `• **$${(c.amount / 100).toFixed(2)}** · ${c.receipt_email || 'no email'} · ${c.status} (${c.id})`)
        return {
          output: `**Recent Stripe Charges (${charges.data.length})**\n\n${lines.join('\n') || 'No recent charges.'}`,
          status: 'success'
        }
      }

      // ── createPaymentLink (requires approval) ──────────────────────────
      if (t.includes('link') || t.includes('create payment') || t.includes('charge')) {
        const amountStr = inputs?.amount || task.match(/(?:\$|usd\s*)(\d+(?:\.\d{2})?)/i)?.[1]
        if (!amountStr) return { output: 'Please specify the payment link amount (e.g. $50).', status: 'success' }
        const amountCents = Math.round(parseFloat(amountStr) * 100)
        const description = inputs?.description || task.match(/(?:for|desc)[:\s]+["']?([^"'\n]+)/i)?.[1] || 'Payment Link'

        if (!stripe) {
          const mockUrl = `https://checkout.stripe.com/pay/mock_link_${Date.now()}`
          return {
            output: `✅ Payment link created successfully (Mock)!\n\nURL: ${mockUrl}\nAmount: $${parseFloat(amountStr).toFixed(2)} for ${description}`,
            status: 'success',
            metadata: { payment_link_url: mockUrl }
          }
        }

        const product = await stripe.products.create({ name: description })
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: amountCents,
          currency: 'usd'
        })
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }]
        })

        return {
          output: `✅ Payment link created successfully!\n\nURL: ${paymentLink.url}\nAmount: $${parseFloat(amountStr).toFixed(2)} for ${description}`,
          status: 'success',
          metadata: { payment_link_url: paymentLink.url, product_id: product.id }
        }
      }

      return {
        output: 'Supported Stripe actions: revenue summary, lookup customer, list recent charges, create payment link.',
        status: 'success'
      }
    } catch (err: any) {
      logger.error(`[StripeAgent] operation failed:`, err.message)
      return { output: `Stripe error: ${err.message}`, status: 'error' }
    }
  }
}

export const stripeAgent = new StripeAgent()

// Backwards-compatible runStripeAgent wrapper
export async function runStripeAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Starting Stripe agent...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    const result = await stripeAgent.execute({
      task: prompt,
      inputs: input.user_inputs,
      tenantId
    })

    const output: AgentOutput = {
      success: result.status === 'success',
      data: result.metadata || {},
      summary: result.output,
      output_type: 'text',
      confidence: 1.0,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: ['stripe_operations'],
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output
  } catch (err: any) {
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: `Stripe action failed: ${err.message}`,
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: ['stripe_operations'],
        retries: 0
      }
    }
  }
}
