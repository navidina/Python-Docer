
export interface GithubNode {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
  size?: number;
}

/**
 * Parses a raw GitHub URL to extract the owner and repository name.
 * 
 * @param url - The full GitHub URL (e.g., "https://github.com/facebook/react").
 * @returns An object containing `owner` and `repo` strings, or null if invalid.
 */
export const parseGithubUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;
    return { owner: pathParts[0], repo: pathParts[1] };
  } catch (e) {
    return null;
  }
};

/**
 * Fetches the entire file tree of a GitHub repository recursively.
 * Attempts to fetch from 'main', then 'master' branches.
 * 
 * @param owner - The repository owner (username or org).
 * @param repo - The repository name.
 * @returns A promise resolving to an object containing the tree and the detected branch.
 * @throws Error if the repo is not found or inaccessible.
 */
export const fetchGithubRepoTree = async (owner: string, repo: string) => {
  // Try 'main' first, then 'master'
  const branches = ['main', 'master'];
  
  for (const branch of branches) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
      if (response.ok) {
        const data = await response.json();
        return { tree: data.tree as GithubNode[], branch };
      }
    } catch (e) {
      console.warn(`Failed to fetch branch ${branch}`, e);
    }
  }
  throw new Error('Repository not found or accessed denied (Check if private).');
};

/**
 * Fetches the raw text content of a specific file from GitHub.
 * 
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param branch - Branch name (e.g., 'main').
 * @param path - File path within the repository.
 * @returns A promise resolving to the file content as a string.
 */
export const fetchGithubFileContent = async (owner: string, repo: string, branch: string, path: string): Promise<string> => {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    if (!response.ok) throw new Error('Failed to fetch file');
    return await response.text();
  } catch (e) {
    console.error(`Error fetching ${path}`, e);
    return '';
  }
};
