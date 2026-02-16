
import { OllamaConfig, ChatMessage } from '../types';

/**
 * Helper to ensure the base URL is clean and doesn't contain trailing slashes or /v1 suffix
 * since we append /v1 manually in the endpoints.
 */
const cleanBaseUrl = (url: string): string => {
  let clean = url.trim();
  // Remove trailing slash
  if (clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  // Remove trailing /v1 if user added it by mistake
  if (clean.endsWith('/v1')) {
    clean = clean.slice(0, -3);
  }
  return clean;
};

/**
 * Checks if the LM Studio server is reachable on the specified IP.
 * Checks /v1/models which is standard for OpenAI-compatible local servers.
 */
export const checkOllamaConnection = async (config: OllamaConfig): Promise<boolean> => {
  const baseUrl = cleanBaseUrl(config.baseUrl);
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio',
      }
    });
    return response.ok;
  } catch (e) {
    console.error("Connection check failed:", e);
    return false;
  }
};

/**
 * Generates text completion using the specified LLM model via LM Studio.
 * Updated: Increased default timeout to 5 minutes (300,000ms) and token limits for heavy workloads.
 */
export const generateCompletion = async (
  config: OllamaConfig,
  prompt: string,
  system: string,
  timeoutMs: number = 300000, // Default 5 minutes (No Limit approach)
  numCtx: number = 32768      // Increased default context to 32k
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = cleanBaseUrl(config.baseUrl);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: config.model || "local-model",
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 8192, // Increased output token limit
        stream: false,
        // Attempt to request context size for Ollama/compatible servers
        options: {
          num_ctx: numCtx
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      // Handle Context Window Error Specifically
      if (response.status === 400 && errorText.includes('n_ctx')) {
          throw new Error('CONTEXT_EXCEEDED');
      }
      throw new Error(`LM Studio Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs/1000}s. Ensure LM Studio is running on ${baseUrl}`);
    }
    console.error("Generation Error:", error);
    throw error;
  }
};

/**
 * Sends a multi-turn chat request to the LM Studio API.
 */
export const sendChatRequest = async (
  config: OllamaConfig,
  messages: ChatMessage[]
): Promise<string> => {
  const baseUrl = cleanBaseUrl(config.baseUrl);
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: config.model || "local-model",
        messages: messages,
        temperature: 0.7,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat API Error: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

/**
 * Generates vector embeddings for a given text prompt.
 * Uses /v1/embeddings.
 */
export const generateEmbeddings = async (
  config: OllamaConfig,
  prompt: string
): Promise<number[]> => {
  // Sanitize input: Remove newlines (common issue with embedding models) and trim
  const cleanPrompt = prompt.replace(/\n/g, ' ').trim();
  if (!cleanPrompt) return [];

  const baseUrl = cleanBaseUrl(config.baseUrl);
  const modelName = config.embeddingModel ? config.embeddingModel.trim() : 'text-embedding-nomic-embed-text-v1.5';

  console.log(`Sending embedding request to: ${baseUrl}/v1/embeddings for model: ${modelName}`);

  try {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: modelName,
        // Reverted to string input. Some LM Studio versions/models choke on single-item arrays.
        input: cleanPrompt, 
      }),
    });

    if (!response.ok) {
       const errorText = await response.text();
       console.error(`Embedding Failed. Status: ${response.status}. Response: ${errorText}`);
       
       // Explicitly throw the server error so we can see it in the UI logs
       throw new Error(`Embedding API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response structures
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0].embedding;
    } else if (Array.isArray(data)) {
        // Some older non-standard endpoints return array directly
        return data;
    }
    
    return [];
  } catch (error) {
    console.error("Embedding logic error:", error);
    throw error;
  }
};
