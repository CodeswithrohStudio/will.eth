import express from 'express';
import cron from 'node-cron';
import { config } from './config';
import { initDB, runCheckInMonitor, registerPhone, relayCheckIn } from './cron/checkInMonitor';
import { sendCheckInConfirmation } from './whatsapp/twilioBot';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize DB
initDB(config.dbPath);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// On-chain check-in via WhatsApp (called by frontend webhook after parsing Twilio message)
app.post('/checkin', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber required' });
  }

  try {
    // Find wills for this phone number
    // In production: look up wallet by phone, then get wills from registry
    // For demo: just confirm the check-in
    const nextDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sendCheckInConfirmation(phoneNumber, nextDeadline);
    res.json({ success: true, message: 'Check-in processed' });
  } catch (err) {
    console.error('[API] Check-in error:', err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// Register phone number for a wallet
app.post('/register', (req, res) => {
  const { walletAddress, phoneNumber, signature } = req.body;
  if (!walletAddress || !phoneNumber) {
    return res.status(400).json({ error: 'walletAddress and phoneNumber required' });
  }

  // TODO: Verify signature in production
  registerPhone(walletAddress, phoneNumber);
  res.json({ success: true, message: `Phone registered for ${walletAddress}` });
});

// Manual trigger of monitor run (for testing)
app.post('/monitor/run', async (_req, res) => {
  runCheckInMonitor().catch(console.error);
  res.json({ success: true, message: 'Monitor run started' });
});

// Cron: Run monitor every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('[Cron] Running check-in monitor...');
  runCheckInMonitor().catch(console.error);
});

// Run once on startup (after 10s delay to let chain settle)
setTimeout(() => {
  console.log('[Startup] Running initial monitor check...');
  runCheckInMonitor().catch(console.error);
}, 10000);

app.listen(config.port, () => {
  console.log(`[Agent] Will.eth agent running on port ${config.port}`);
  console.log(`[Agent] Check-in monitor: every 6 hours`);
  console.log(`[Agent] Registry: ${config.contracts.registry}`);
});

export default app;
