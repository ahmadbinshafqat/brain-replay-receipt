import { NextResponse } from 'next/server';
import { parseReceiptText } from '@/lib/receiptParser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;

    if (!rawText) {
      return NextResponse.json({ error: 'Receipt text is required. Upload an image for OCR or paste text.' }, { status: 400 });
    }

    const receipt = parseReceiptText(rawText, imageUrl);
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json({ error: 'Could not parse receipt.' }, { status: 500 });
  }
}
