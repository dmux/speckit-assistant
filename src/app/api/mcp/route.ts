import { NextResponse } from 'next/server';
import { mcpConfig } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { McpFile } from '../../../domain/models/mcp';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const file = await mcpConfig.getServers(workspacePath);
    return NextResponse.json(file);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as McpFile;
    if (!body || !Array.isArray(body.servers)) {
      return NextResponse.json({ error: 'Body must be an McpFile with a servers array' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    await mcpConfig.saveServers(workspacePath, body);
    return NextResponse.json({ success: true, servers: body.servers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
