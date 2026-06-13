import { logger } from './services/logger.service';
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config()

import { classifyPrompt } from './services/execution-router.service'

async function runTests() {
  logger.info('--- Starting Execution Router Classification Tests ---')

  const testPrompts = [
    { text: 'Hello, who are you and how does this operating system work?', expected: 'conversation' },
    { text: 'Build a premium marketing landing page for a coffee startup and send the code to test@example.com', expected: 'task' },
    { text: 'Hi! Can you explain the difference between a sequential pipeline and a dynamic graph?', expected: 'conversation' },
    { text: 'Scrape the pricing page of competitor website https://example.com/pricing and save to Google Sheet', expected: 'task' }
  ]

  for (const prompt of testPrompts) {
    try {
      logger.info(`\nTesting Prompt: "${prompt.text}"`)
      const startTime = Date.now()
      const result = await classifyPrompt(prompt.text)
      const duration = Date.now() - startTime
      logger.info(`Result: "${result.type}" | Expected: "${prompt.expected}" | Duration: ${duration}ms`)
      if (result.type === prompt.expected) {
        logger.info('✅ Match!')
      } else {
        logger.info('❌ Mismatch!')
      }
    } catch (err: any) {
      console.error('Error during test:', err.stack || err.message)
    }
  }

  logger.info('\n--- Tests Completed ---')
  process.exit(0)
}

runTests()
