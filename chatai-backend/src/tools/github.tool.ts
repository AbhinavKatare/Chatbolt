import axios from 'axios';

export interface GitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
}

const GITHUB_API_URL = 'https://api.github.com';

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

/**
 * Reads a file's content from a GitHub repository.
 */
export async function readGitHubFile(
  { owner, repo, path, branch = 'main', token }: { owner: string; repo: string; path: string; branch?: string; token: string }
) {
  try {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await axios.get(url, { headers: getHeaders(token) });
    
    // GitHub API returns file content as base64
    if (response.data.type === 'file' && response.data.content) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      return { success: true, content, sha: response.data.sha };
    }
    
    return { success: false, error: 'Path is not a file or is empty.' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Commits a single file change directly to a branch.
 */
export async function commitToGitHub(
  { owner, repo, path, branch = 'main', content, message, token }: 
  { owner: string; repo: string; path: string; branch?: string; content: string; message: string; token: string }
) {
  try {
    // 1. Get the current file SHA (needed for updating an existing file)
    const currentFile = await readGitHubFile({ owner, repo, path, branch, token });
    const sha = currentFile.success ? currentFile.sha : undefined;

    // 2. Commit the new file content
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
    const data = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha, // Include sha if updating
    };

    const response = await axios.put(url, data, { headers: getHeaders(token) });
    return { success: true, commitUrl: response.data.commit.html_url };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Creates a Pull Request on a GitHub repository.
 */
export async function createPullRequest(
  { owner, repo, title, body, head, base = 'main', token }:
  { owner: string; repo: string; title: string; body: string; head: string; base?: string; token: string }
) {
  try {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`;
    const data = { title, body, head, base };
    
    const response = await axios.post(url, data, { headers: getHeaders(token) });
    return { success: true, prUrl: response.data.html_url, prNumber: response.data.number };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}
