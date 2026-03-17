import { NextResponse } from "next/server";
import { checkPhoneDuplicate } from "@/lib/phone-check";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone || !String(phone).trim()) {
      return NextResponse.json(
        { error: "phone parameter is required" },
        { status: 400 }
      );
    }

    const result = await checkPhoneDuplicate(phone);

    return NextResponse.json({
      duplicate: result.duplicate,
      source: result.source,
      customerId: result.customerId,
    });
  } catch (error) {
    console.error("check-phone error:", error);
    return NextResponse.json(
      { error: "Failed to check phone" },
      { status: 500 }
    );
  }
}
