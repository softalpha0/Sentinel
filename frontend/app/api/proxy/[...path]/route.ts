import { NextRequest, NextResponse } from 'next/server';

const SENTINEL_URL = process.env.SENTINEL_API_URL ?? 'http://localhost:7379';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const url = new URL(req.url);
  const target = `${SENTINEL_URL}/${path.join('/')}${url.search}`;

  try {
    const upstream = await fetch(target, { cache: 'no-store' });
    const data: unknown = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: 'Risk Sentinel API not reachable', url: target },
      { status: 502 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${SENTINEL_URL}/${path.join('/')}`;
  const body: unknown = await req.json();

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: unknown = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: 'Risk Sentinel API not reachable' },
      { status: 502 },
    );
  }
}
