import dotenv from 'dotenv';
import twilio from 'twilio';
import express from 'express';

dotenv.config();

export const authRouter = express.Router();

// Configure Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory storage for OTPs (You should use a more persistent solution like Redis in production)
const otpStorage = new Map();

// Helper function to generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /send-otp
authRouter.post('/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const otp = generateOTP();
  const expiryTime = new Date().getTime() + process.env.OTP_EXPIRY_MINUTES * 60000;

  // Store OTP in memory (use Redis or a database in production)
  otpStorage.set(phoneNumber, { otp, expiryTime });

  try {
    // Send OTP via SMS using Twilio
    await twilioClient.messages.create({
      body: `Your OTP code is ${otp}. It will expire in ${process.env.OTP_EXPIRY_MINUTES} minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    return res.status(200).json({ message: 'OTP sent successfully!' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
});

// POST /verify-otp
authRouter.post('/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  const storedData = otpStorage.get(phoneNumber);

  if (!storedData) {
    return res.status(400).json({ error: 'No OTP sent to this phone number' });
  }

  const { otp: storedOtp, expiryTime } = storedData;

  if (new Date().getTime() > expiryTime) {
    otpStorage.delete(phoneNumber); // Remove expired OTP
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (storedOtp === otp) {
    otpStorage.delete(phoneNumber); // OTP is valid, remove it
    return res.status(200).json({ message: 'OTP verified successfully!' });
  }

  return res.status(400).json({ error: 'Invalid OTP' });
});