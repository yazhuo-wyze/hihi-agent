import { loadConfig, startSession } from '@hihi-agent/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { prompt, model, mode } = (await req.json()) as {
    prompt: string;
    model?: string;
    mode?: 'ask' | 'auto';
  };

  const cfg = loadConfig();
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: any) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let running: Awaited<ReturnType<typeof startSession>> | null = null;
      try {
        running = await startSession({
          config: cfg,
          mode: mode || 'ask',
          modelOverride: model,
          confirm: async () => false,
        });

        running.session.on?.((event: any) => {
          if (event.type === 'assistant.message') {
            send({ type: 'message', data: { content: event.data?.content || '' } });
          } else if (event.type === 'tool.call') {
            send({ type: 'tool', data: event.data });
          } else if (event.type === 'error') {
            send({ type: 'error', data: event.data });
          }
        });

        if (typeof running.session.sendAndWait === 'function') {
          await running.session.sendAndWait({ prompt });
        } else {
          await running.session.send({ prompt });
        }
        send({ type: 'done', data: {} });
      } catch (err: any) {
        send({ type: 'error', data: { message: err?.message || String(err) } });
      } finally {
        try {
          await running?.end();
        } catch {
          /* ignore */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
