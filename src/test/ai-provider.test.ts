import { afterEach, expect, it, vi } from 'vitest';
import { generateResponse, outputText } from '../lib/ai-provider.server';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('calls only the requested OpenRouter model and preserves image/file content', async () => {
  vi.stubEnv('OPENROUTER_API', 'test-only-not-a-credential');
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })));
  vi.stubGlobal('fetch', fetchMock);
  expect(outputText(await generateResponse({ model: 'ignored', input: [{ role: 'user', content: [{ type: 'input_image', image_url: 'data:image/png;base64,AA==' }, { type: 'input_file', filename: 'invoice.pdf', file_data: 'data:application/pdf;base64,AA==' }] }] }))).toBe('OK');
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
  expect(body.model).toBe('openai/gpt-5.6-terra');
  expect(body.messages[0].content.map((p: { type: string }) => p.type)).toEqual(['image_url','file']);
});
it('does not retry or use another provider on OpenRouter failure', async () => {
  vi.stubEnv('OPENROUTER_API', 'test-only-not-a-credential');
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 402 })); vi.stubGlobal('fetch', fetchMock);
  await expect(generateResponse({ model: 'ignored', input: 'hello' })).rejects.toThrow('OpenRouter unavailable (402)');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});