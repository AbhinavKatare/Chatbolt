import { logger } from '../services/logger.service';
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import { traceService } from '../services/trace.service'

const sessions: Record<string, { browser: Browser; context: BrowserContext; page: Page }> = {}

/**
 * Ensures that uploads directory exists for saving screenshots.
 */
function ensureUploadsDir(): string {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  return uploadsDir
}

/**
 * Retrieves an existing browser session or creates a new persistent context for the workflow run.
 */
export async function getOrCreateBrowserSession(runId: string): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  if (sessions[runId]) {
    return sessions[runId]
  }

  logger.info(`[Browser Tool] Launching new Playwright browser context for run: ${runId}`)
  
  // Custom user data directory for persistent state (cookies, localstorage) per run
  const userDataDir = path.join(process.cwd(), 'uploads', `session_${runId}`)
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptDownloads: false
  })

  // Set default navigation timeout
  context.setDefaultNavigationTimeout(30000)
  context.setDefaultTimeout(15000)

  const page = await context.newPage()

  sessions[runId] = { browser, context, page }
  return sessions[runId]
}

/**
 * Cleanly closes the browser context and removes the session.
 */
export async function closeBrowserSession(runId: string): Promise<void> {
  const session = sessions[runId]
  if (session) {
    logger.info(`[Browser Tool] Closing browser context for run: ${runId}`)
    try {
      await session.page.close()
      await session.context.close()
      await session.browser.close()
    } catch (err: any) {
      console.warn(`[Browser Tool] Warning when closing session: ${err.message}`)
    }
    delete sessions[runId]
  }
}

/**
 * Navigates to the specified URL.
 */
export async function navigate(runId: string, url: string): Promise<{ title: string; url: string; status: number }> {
  const { page } = await getOrCreateBrowserSession(runId)
  
  logger.info(`[Browser Tool] Navigating to URL: ${url}`)
  
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  const title = await page.title()
  const currentUrl = page.url()
  const status = response?.status() || 200

  // Quick wait for dynamic contents
  await page.waitForTimeout(1000)

  return { title, url: currentUrl, status }
}

/**
 * Annotates all interactive elements with a custom data-chatbolt-id attribute and compresses the DOM tree.
 */
export async function parseDOM(runId: string): Promise<{ title: string; url: string; compressedDOM: string; interactiveElements: any[] }> {
  const { page } = await getOrCreateBrowserSession(runId)
  
  const title = await page.title()
  const url = page.url()

  // Client-side extraction & element tagging script
  // We use a string-based self-invoking function to prevent esbuild/tsx from transpiling nested function declarations
  // and injecting helper references like '__name' which are not available in the browser runtime.
  const result = await page.evaluate(`(() => {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
    const elements = document.querySelectorAll('*');
    let counter = 1;
    const interactiveElements = [];

    // Helper to check visibility
    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    }

    elements.forEach((el) => {
      const tagName = el.tagName;
      const isInteractive =
        interactiveTags.includes(tagName) ||
        el.getAttribute('role') === 'button' ||
        el.getAttribute('onclick') !== null ||
        el.style.cursor === 'pointer';

      if (isInteractive && isVisible(el)) {
        const id = counter++;
        el.setAttribute('data-chatbolt-id', String(id));

        const elementInfo = {
          id,
          tagName,
          text: (el.textContent || '').trim().substring(0, 100),
          placeholder: el.getAttribute('placeholder') || '',
          value: el.value || '',
          type: el.getAttribute('type') || '',
          href: el.getAttribute('href') || ''
        };
        interactiveElements.push(elementInfo);
      }
    });

    // Walk the tree and compile a lightweight structural representation
    function cleanTree(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim().replace(/\\s+/g, ' ');
        return text ? text : '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node;
      const tagName = el.tagName.toLowerCase();

      // Skip scripts, styles, metadata
      if (['script', 'style', 'head', 'noscript', 'meta', 'link', 'svg', 'path'].includes(tagName)) {
        return '';
      }

      const cbId = el.getAttribute('data-chatbolt-id');
      let childrenStr = '';
      el.childNodes.forEach((child) => {
        childrenStr += cleanTree(child);
      });

      childrenStr = childrenStr.trim();

      if (cbId) {
        const placeholder = el.getAttribute('placeholder') ? ' placeholder="' + el.getAttribute('placeholder') + '"' : '';
        const type = el.getAttribute('type') ? ' type="' + el.getAttribute('type') + '"' : '';
        const href = el.getAttribute('href') ? ' href="' + el.getAttribute('href') + '"' : '';
        const val = el.value ? ' value="' + el.value + '"' : '';

        return '\\n[' + tagName + ' id=' + cbId + type + placeholder + href + val + '] ' + (childrenStr || (el.textContent || '').trim().substring(0, 60)) + ' [/' + tagName + ']';
      }

      // If it contains meaningful text or children, wrap lightly, otherwise compress
      if (childrenStr) {
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tagName)) {
          return '\\n<' + tagName + '>' + childrenStr + '</' + tagName + '>';
        }
        return childrenStr;
      }

      return '';
    }

    const compressedDOM = cleanTree(document.body).replace(/\\n\\s*\\n+/g, '\\n');
    return { compressedDOM, interactiveElements };
  })()`) as { compressedDOM: string; interactiveElements: any[] }

  return {
    title,
    url,
    compressedDOM: result.compressedDOM,
    interactiveElements: result.interactiveElements
  }
}

/**
 * Clicks on an element, supporting both data-chatbolt-id numbers and CSS selectors.
 */
export async function clickElement(runId: string, selectorOrId: string): Promise<void> {
  const { page } = await getOrCreateBrowserSession(runId)
  
  let selector = selectorOrId
  // If it's a number, find it by data-chatbolt-id
  if (/^\d+$/.test(selectorOrId)) {
    selector = `[data-chatbolt-id="${selectorOrId}"]`
  }

  logger.info(`[Browser Tool] Clicking element: ${selector}`)
  await page.click(selector)
  
  // Wait for potential navigation or transitions
  await page.waitForTimeout(1500)
}

/**
 * Fills an input/textarea element, supporting data-chatbolt-id numbers and CSS selectors.
 */
export async function fillInput(runId: string, selectorOrId: string, text: string): Promise<void> {
  const { page } = await getOrCreateBrowserSession(runId)
  
  let selector = selectorOrId
  if (/^\d+$/.test(selectorOrId)) {
    selector = `[data-chatbolt-id="${selectorOrId}"]`
  }

  logger.info(`[Browser Tool] Filling element ${selector} with text: "${text}"`)
  await page.fill(selector, text)
  await page.waitForTimeout(500)
}

/**
 * Captures a screenshot of the active page and saves it durably.
 */
export async function captureScreenshot(runId: string): Promise<string> {
  const { page } = await getOrCreateBrowserSession(runId)
  const uploadsDir = ensureUploadsDir()
  
  const filename = `screenshot_${runId}_${Date.now()}.png`
  const screenshotPath = path.join(uploadsDir, filename)

  logger.info(`[Browser Tool] Capturing page screenshot to: ${screenshotPath}`)
  await page.screenshot({ path: screenshotPath, fullPage: false })

  return `/uploads/${filename}`
}
