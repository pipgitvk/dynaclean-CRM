import { NextResponse } from "next/server";

const otpStore = new Map(); // Must match send-otp

export async function POST(req) {
  const { username, otp } = await req.json();
  const storedOtp = otpStore.get(username);

  if (!storedOtp || storedOtp !== otp) {
    return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
  }

  otpStore.delete(username); // consume OTP
  return NextResponse.json({ success: true });
}
