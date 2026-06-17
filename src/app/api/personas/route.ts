import { NextResponse } from 'next/server';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { DEFAULT_PERSONAS } from '../../../domain/models/personas';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const configPath = path.join(workspacePath, '.specify', 'personas-config.json');

    if (!fs.existsSync(configPath)) {
      return NextResponse.json(DEFAULT_PERSONAS);
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const workspacePath = getWorkspacePath();
    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be an array of persona configs' }, { status: 400 });
    }

    const configDir = path.join(workspacePath, '.specify');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configPath = path.join(configDir, 'personas-config.json');
    fs.writeFileSync(configPath, JSON.stringify(body, null, 2), 'utf-8');

    return NextResponse.json({ success: true, personas: body });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
