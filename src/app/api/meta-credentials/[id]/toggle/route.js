import { NextResponse } from 'next/server';
import { toggleCredentialActive } from '@/lib/mysql/metaCredentialModel';

// POST toggle credential active status
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const credential = await toggleCredentialActive(id);
    
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: credential,
      message: `Credential ${credential.isActive ? 'enabled' : 'disabled'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling credential:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
