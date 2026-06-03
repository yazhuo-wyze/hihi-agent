import { NextResponse } from 'next/server';
import { loadMcpConfig, updateMcp } from '@hihi-agent/core';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(loadMcpConfig());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.add && body.name) {
    updateMcp((f) => {
      f.mcpServers[body.name] = body.add;
    });
    return NextResponse.json({ ok: true });
  }
  if (body.remove) {
    updateMcp((f) => {
      delete f.mcpServers[body.remove];
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
