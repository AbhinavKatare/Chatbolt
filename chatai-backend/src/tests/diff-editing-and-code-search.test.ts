import assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { agentRuntimeClient } from '../services/agent-runtime-client.service'
import { semanticCodeSearchService } from '../services/semantic-code-search.service'
import { progressiveToolDisclosureService } from '../services/progressive-tool-disclosure.service'
import { agentBrainClient } from '../services/agent-brain-client.service'

async function runTests() {
  console.log('⚡ Starting Diff-Based Editing, Go Patching & Semantic Search Test Suite...\n')
  let passed = 0
  let total = 0

  function test(name: string, fn: () => void | Promise<void>) {
    total++
    return (async () => {
      try {
        await fn()
        console.log(`  ✅ PASS: ${name}`)
        passed++
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}`)
        console.error(`     Error: ${err.message}\n`)
      }
    })()
  }

  // =========================================================================
  // ITEM 1: Python Brain Diff-Based File Editing & Thresholding
  // =========================================================================
  await test('Item 1: Python Agent-Brain validates diff-first editing for files > 20 lines', async () => {
    const isAvail = await agentBrainClient.isAvailable()
    assert.strictEqual(isAvail, true, 'Python agent-brain must be healthy')

    // Simulate code agent requesting a targeted diff edit
    const stepRes = await agentBrainClient.executeStep({
      run_id: 'test-diff-run-1',
      agent_role: 'code',
      agent_name: 'SoftwareEngineer',
      task: 'Update database connection pool timeout from 2000 to 5000 in config.ts',
      context: 'File config.ts has 150 lines of configuration.',
      available_tools: [
        { name: 'apply_file_diff', description: 'Apply targeted diff hunks to a file' },
        { name: 'semantic_code_search', description: 'Search semantic repository chunks' }
      ]
    })

    assert.ok(['completed', 'tool_call_required'].includes(stepRes.status), `Status must be valid (${stepRes.status})`)
    assert.strictEqual(stepRes.run_id, 'test-diff-run-1')
  })

  // =========================================================================
  // ITEM 2: Go Sandboxed Diff Applicator with 3-Stage Matching & Context Retry
  // =========================================================================
  await test('Item 2: Go Sandbox applies exact, whitespace-agnostic, and fuzzy context-widened diffs', async () => {
    const isAvail = await agentRuntimeClient.isAvailable()
    assert.strictEqual(isAvail, true, 'Go agent-runtime must be healthy')

    const testFilePath = path.join(process.cwd(), 'scratch', 'test_patch_sample.ts')
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true })

    const sampleContent = [
      '// Sample Database Configuration',
      'export const dbConfig = {',
      '  host: "127.0.0.1",',
      '  port: 5432,',
      '  poolTimeoutMs: 2000,',
      '  maxConnections: 10,',
      '  idleTimeoutMs: 30000',
      '};',
      '',
      'export function connect() {',
      '  console.log("Connecting with timeout:", dbConfig.poolTimeoutMs);',
      '}'
    ].join('\n')

    fs.writeFileSync(testFilePath, sampleContent, 'utf8')

    // 1. Stage 1: Exact Match Patch
    const exactRes = await agentRuntimeClient.applyFileDiff({
      filePath: testFilePath,
      hunks: [{
        start_line: 5,
        end_line: 5,
        target_content: '  poolTimeoutMs: 2000,',
        replacement_content: '  poolTimeoutMs: 5000,'
      }]
    })

    assert.strictEqual(exactRes.success, true, 'Exact match diff must apply successfully')
    assert.strictEqual(exactRes.hunks_applied, 1)
    assert.ok(exactRes.patched_content?.includes('poolTimeoutMs: 5000,'))

    // 2. Stage 2: Whitespace & CRLF Normalized Patch
    const normalizedRes = await agentRuntimeClient.applyFileDiff({
      filePath: testFilePath,
      hunks: [{
        start_line: 6,
        end_line: 6,
        target_content: '  maxConnections: 10,   \r\n', // intentionally messy whitespace/CRLF
        replacement_content: '  maxConnections: 50,'
      }]
    })

    assert.strictEqual(normalizedRes.success, true, 'Whitespace normalized diff must apply successfully')
    assert.ok(normalizedRes.patched_content?.includes('maxConnections: 50,'))

    // 3. Stage 3: Fuzzy Context-Widened Hunk Matching (shifted line numbers)
    const fuzzyRes = await agentRuntimeClient.applyFileDiff({
      filePath: testFilePath,
      hunks: [{
        start_line: 25, // intentionally shifted line number
        end_line: 27,
        target_content: 'export function connect() {\n  console.log("Connecting with timeout:", dbConfig.poolTimeoutMs);\n}',
        replacement_content: 'export function connect() {\n  console.log("Connecting with high-throughput pool:", dbConfig.poolTimeoutMs);\n}'
      }]
    })

    assert.strictEqual(fuzzyRes.success, true, 'Fuzzy context-widened hunk diff must locate target and apply')
    assert.ok(fuzzyRes.patched_content?.includes('high-throughput pool'))

    // 4. Stage 4: Unlocatable content triggers structured retry recommendation
    const failedRes = await agentRuntimeClient.applyFileDiff({
      filePath: testFilePath,
      hunks: [{
        start_line: 1,
        end_line: 2,
        target_content: 'NON_EXISTENT_FUNCTION_NAME_XYZ()',
        replacement_content: 'REPLACEMENT_CODE()'
      }]
    })

    assert.strictEqual(failedRes.success, false, 'Non-existent target content must fail safely')
    assert.strictEqual(failedRes.retry_with_context, true, 'Should flag retry_with_context')

    // Clean up
    try { fs.unlinkSync(testFilePath) } catch {}
  })

  // =========================================================================
  // ITEM 3: Semantic Code Search (Incremental Chunking & Embeddings)
  // =========================================================================
  await test('Item 3: Semantic code search indexes chunks and returns precise file:line references', async () => {
    semanticCodeSearchService.clear()

    // Add virtual test chunks representing different subsystems
    semanticCodeSearchService.addChunk({
      id: 'src/services/sandbox.service.ts:L15-L45',
      filePath: 'src/services/sandbox.service.ts',
      relativePath: 'src/services/sandbox.service.ts',
      startLine: 15,
      endLine: 45,
      content: 'export class SandboxService {\n  async runNode(code: string) {\n    return executeSafely(code, sandboxRoot);\n  }\n}',
      contentHash: 'hash1',
      language: 'typescript'
    })

    semanticCodeSearchService.addChunk({
      id: 'src/services/billing.service.ts:L80-L120',
      filePath: 'src/services/billing.service.ts',
      relativePath: 'src/services/billing.service.ts',
      startLine: 80,
      endLine: 120,
      content: 'export async function handleStripeWebhook(event: Stripe.Event) {\n  if (event.type === "customer.subscription.updated") {\n    await updateSubscriptionPlan(event.data);\n  }\n}',
      contentHash: 'hash2',
      language: 'typescript'
    })

    const searchResults = await semanticCodeSearchService.searchCode('Stripe customer subscription webhook', 3)
    assert.ok(searchResults.length > 0, 'Search should return matching code chunks')
    assert.strictEqual(searchResults[0].relativePath, 'src/services/billing.service.ts')
    assert.strictEqual(searchResults[0].reference, 'src/services/billing.service.ts:L80-L120')
    assert.ok(searchResults[0].content.includes('handleStripeWebhook'))
  })

  // =========================================================================
  // ITEM 4: Progressive Tool & API Output Disclosure (Smart Truncation)
  // =========================================================================
  await test('Item 4: Progressive disclosure truncates large tool outputs with paginated handles', () => {
    // 1. Small tool output passes through directly
    const smallOut = { status: 'success', count: 5 }
    const smallRes = progressiveToolDisclosureService.processToolOutput(smallOut, 'small_tool')
    assert.strictEqual(smallRes.isTruncated, false, 'Small tool output must not be truncated')

    // 2. Large tool output (e.g. 200 lines of logs / file contents)
    const largeLog = Array.from({ length: 150 }, (_, i) => `[LOG ${i + 1}] System trace entry with detailed debugging payload`).join('\n')
    const largeRes = progressiveToolDisclosureService.processToolOutput(largeLog, 'terminal_exec', 1000, 25)

    assert.strictEqual(largeRes.isTruncated, true, 'Large tool output must be truncated')
    assert.ok(largeRes.contentRef !== undefined, 'Handle pointer reference must be generated')
    assert.ok(largeRes.contentForModel.includes('⚠️ [Tool Output Summarized: 150 lines'), 'Context summary notice must be present')
    assert.strictEqual(largeRes.previewLines, 25)

    // 3. Agent inspects chunk on demand using handle reference
    const chunkRes = progressiveToolDisclosureService.fetchChunk(largeRes.contentRef!, 30, 20)
    assert.strictEqual(chunkRes.offset, 30)
    assert.strictEqual(chunkRes.lines.length, 20)
    assert.strictEqual(chunkRes.hasMore, true)
    assert.ok(chunkRes.lines[0].includes('[LOG 31]'))
  })

  console.log(`\n=============================================`)
  console.log(`Diff Editing & Code Search Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`)
  console.log(`=============================================\n`)

  if (passed !== total) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
