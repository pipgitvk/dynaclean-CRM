import { NextResponse } from 'next/server';
import {
  createCredential,
  getAllCredentials
} from '@/lib/mysql/metaCredentialModel';

// GET all credentials
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    const credentials = await getAllCredentials(activeOnly);
    
    return NextResponse.json({ success: true, data: credentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST create new credential
export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeName, verifyToken, pageId, pageToken, formIds } = body;
    
    if (!verifyToken || !pageId || !pageToken || !formIds) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(formIds) || formIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one form ID is required' },
        { status: 400 }
      );
    }
    
    const credential = await createCredential({
      employeeName,
      verifyToken,
      pageId,
      pageToken,
      formIds: formIds.map(id => id.trim()).filter(id => id),
      isActive: true
    });
    
    return NextResponse.json({ success: true, data: credential }, { status: 201 });
  } catch (error) {
    console.error('Error creating credential:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
