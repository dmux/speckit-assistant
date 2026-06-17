import { NextResponse } from 'next/server';
import { terminalManager } from '../../../../adapters/primary/api/terminalManager';

export async function POST(req: Request) {
  try {
    const { cols, rows } = await req.json();
    if (typeof cols !== 'number' || typeof rows !== 'number') {
      return NextResponse.json({ error: 'cols and rows must be numbers' }, { status: 400 });
    }
    const success = terminalManager.resize(cols, rows);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
