/**
 * A reader's own Gemini key. It stays in this browser and goes only to this
 * site's AI routes, which pass it to Google for that one request.
 */
const STORAGE_KEY = "paperless:gemini-key";
export const KEY_HEADER = "x-gemini-key";
export const AI_KEY_CHANGED = "paperless:ai-key-changed";

export function getAiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode: the key lasts for this page only
  }
  window.dispatchEvent(new Event(AI_KEY_CHANGED));
}

/** Headers for a request to the AI routes. */
export function aiHeaders(): Record<string, string> {
  const key = getAiKey();
  return key ? { [KEY_HEADER]: key } : {};
}
