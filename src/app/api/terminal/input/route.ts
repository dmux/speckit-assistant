import { NextResponse } from 'next/server';
import { terminalManager } from '../../../../adapters/primary/api/terminalManager';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (text === undefined) {
      return NextResponse.json({ error: 'Missing text input' }, { status: 400 });
    }

    const success = terminalManager.writeInput(text);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
