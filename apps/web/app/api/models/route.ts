import { NextResponse } from 'next/server';
import { loadConfig, updateConfig } from '@hihi-agent/core';

export const runtime = 'nodejs';

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json({ models: cfg.models, currentModel: cfg.currentModel });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (body.currentModel) {
    const c = updateConfig((cfg) => {
      cfg.currentModel = body.currentModel;
    });
    return NextResponse.json({ ok: true, currentModel: c.currentModel });
  }
  if (body.add) {
    updateConfig((cfg) => {
      const idx = cfg.models.findIndex((m) => m.id === body.add.id);
      if (idx >= 0) cfg.models[idx] = body.add;
      else cfg.models.push(body.add);
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
