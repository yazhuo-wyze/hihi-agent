import { NextResponse } from 'next/server';
import { skills, awesomeCopilot } from '@hihi-agent/core';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ installed: skills.listLocalSkills() as any });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.search) {
    const r = await awesomeCopilot.search(body.search);
    return NextResponse.json({ results: r });
  }
  if (body.install) {
    const dest = await awesomeCopilot.install(body.install);
    return NextResponse.json({ ok: true, dest });
  }
  if (body.enable) {
    skills.setSkillEnabled(body.enable, true);
    return NextResponse.json({ ok: true });
  }
  if (body.disable) {
    skills.setSkillEnabled(body.disable, false);
    return NextResponse.json({ ok: true });
  }
  if (body.remove) {
    skills.removeSkill(body.remove);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
