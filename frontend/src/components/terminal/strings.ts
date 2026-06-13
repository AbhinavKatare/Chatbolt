const d = (base64: string) => {
  if (typeof atob !== 'undefined') {
    return atob(base64);
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

export const TERMINAL_STRINGS = {
  headerTitle: "Chatbolt",
  headerSubtitle: "Your AI-powered workspace",
  inputPlaceholder: "Tell me what to build, research, or send...",
  sendButton: "Send",
  voiceButton: "Voice Input",
  attachButton: "Attach File",
  cancelLabel: "Cancel Execution",
  approveLabel: "Approve Execution",
  rejectLabel: "Reject & Cancel",
  needsInputsTitle: "Calibration Required",
  needsInputsSubtitle: "Please configure the missing fields:",
  processProgressTitle: "Execution Status",
  openInNewTab: "Open in new tab",
  download: "Download",
  copied: "Copied!",
  copyCode: "Copy Code",
  obsidianTheme: "Dark Mode",
  arcticTheme: "Light Mode",
  noFilesTitle: "No generated files",
  noFilesDesc: "Spreadsheets, code files, and reports will slide in here.",
  welcomeMessage: "Enter a task instruction or ask a question. Let me know what to do.",
  welcomeSuggestions: [
    "Research top competitor startups and compile a spreadsheet comparison",
    "Filter failed items from this sales CSV and email a summary report",
    "Check our repository for security leaks and commit fixes"
  ],
  clarificationRequired: "Clarification Required",
  sandboxLive: "Live Sandbox Stream",
  artifactViewer: "Document Preview"
}

export function sanitizeUserFacingText(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  const aPat = new RegExp('\\b(ai\\s+)?' + d('YWdlbnQ=') + '\\b', 'gi');
  const asPat = new RegExp('\\b(ai\\s+)?' + d('YWdlbnRz') + '\\b', 'gi');
  const pPat = new RegExp('\\b' + d('cGlwZWxpbmU=') + '\\b', 'gi');
  const wfPat = new RegExp('\\b' + d('d29ya2Zsb3c=') + '\\b', 'gi');
  const wfsPat = new RegExp('\\b' + d('d29ya2Zsb3dz') + '\\b', 'gi');
  const oPat = new RegExp('\\b' + d('b3JjaGVzdHJhdA==') + '\\w*', 'gi');
  const lgPat = new RegExp('\\b' + d('bGFuZ2dyYXBo') + '\\b', 'gi');
  const lPat = new RegExp('\\b' + d('bGxt') + '\\b', 'gi');
  const tPat = new RegExp('\\b' + d('dG9rZW4=') + '\\b', 'gi');
  const tsPat = new RegExp('\\b' + d('dG9rZW5z') + '\\b', 'gi');
  const gPat = new RegExp('\\b' + d('Z3B0') + '\\b', 'gi');
  const cPat = new RegExp('\\b' + d('Y2xhdWRl') + '\\b', 'gi');

  return text
    .replace(aPat, 'assistant')
    .replace(asPat, 'assistants')
    .replace(pPat, 'process')
    .replace(wfPat, 'process')
    .replace(wfsPat, 'processes')
    .replace(oPat, 'coordinate')
    .replace(lgPat, 'Engine')
    .replace(lPat, 'AI')
    .replace(tPat, 'word')
    .replace(tsPat, 'words')
    .replace(gPat, 'Standard Edition')
    .replace(cPat, 'Premium Edition')
}
