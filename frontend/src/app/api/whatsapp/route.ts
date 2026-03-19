import { NextRequest, NextResponse } from 'next/server';

// Twilio WhatsApp webhook handler
// When testator replies "ALIVE" or "CHECK IN" to a WhatsApp message,
// the agent picks it up and records the check-in on-chain.

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const from = body.get('From') as string; // e.g. "whatsapp:+14155238886"
    const message = (body.get('Body') as string)?.trim().toUpperCase();

    const CHECK_IN_KEYWORDS = ['ALIVE', 'CHECK IN', 'CHECKIN', 'OK', 'YES', '1'];

    if (CHECK_IN_KEYWORDS.some(kw => message.includes(kw))) {
      // Forward to agent for on-chain check-in
      const agentUrl = process.env.AGENT_URL || 'http://localhost:3001';
      await fetch(`${agentUrl}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: from.replace('whatsapp:', '') }),
      });

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Check-in recorded! You're safe. We'll remind you again before your next deadline.</Message>
</Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Handle REGISTER command
    if (message.startsWith('REGISTER')) {
      const parts = message.split(' ');
      const walletAddress = parts[1];
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>📝 To register wallet ${walletAddress}, visit https://willeth.xyz/dashboard and connect your wallet to link this phone number.</Message>
</Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Reply ALIVE to check in, or REGISTER 0x... to link a wallet. Visit will.eth to manage your will.</Message>
</Response>`;
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
