import twilio from 'twilio';
import { config } from '../config';

let twilioClient: twilio.Twilio | null = null;

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

export async function sendCheckInReminder(
  phoneNumber: string,
  willAddress: string,
  daysRemaining: number
): Promise<void> {
  const to = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
  const urgency = daysRemaining <= 1 ? '⚠️ URGENT: ' : daysRemaining <= 3 ? '🔔 ' : '';

  const message = `${urgency}Will.eth Check-In Required

Your crypto inheritance will trigger in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} if you don't check in.

Reply *ALIVE* to check in now and protect your family's inheritance.

Will: ${willAddress.slice(0, 8)}...
Dashboard: https://willeth.xyz/dashboard`;

  await getClient().messages.create({
    from: config.twilio.from,
    to,
    body: message,
  });

  console.log(`[WhatsApp] Sent check-in reminder to ${phoneNumber} (${daysRemaining} days)`);
}

export async function sendTriggerAlert(
  phoneNumber: string,
  willAddress: string,
  heirs: string[]
): Promise<void> {
  const to = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;

  const message = `🚨 Will.eth Distribution Triggered

A will has been triggered for distribution.

Will: ${willAddress}
Heirs can now claim at:
https://willeth.xyz/claim?will=${willAddress}

${heirs.map(h => `• ${h}`).join('\n')}`;

  await getClient().messages.create({
    from: config.twilio.from,
    to,
    body: message,
  });
}

export async function sendCheckInConfirmation(
  phoneNumber: string,
  nextDeadline: Date
): Promise<void> {
  const to = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
  const dateStr = nextDeadline.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  await getClient().messages.create({
    from: config.twilio.from,
    to,
    body: `✅ Check-in recorded on Base!\n\nYour will is safe. Next check-in due: ${dateStr}\n\nYour estate continues to earn yield. Manage at: https://willeth.xyz/dashboard`,
  });
}
