import { NextResponse } from 'next/server';
import {
  getCredentialById,
  updateCredential,
  deleteCredential
} from '@/lib/mysql/metaCredentialModel';

// GET single credential by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const credential = await getCredentialById(id);
    
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: credential });
  } catch (error) {
    console.error('Error fetching credential:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT update credential
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { employeeName, verifyToken, pageId, pageToken, formIds, isActive } = body;
    
    const updateData = {};
    if (employeeName !== undefined) updateData.employeeName = employeeName;
    if (verifyToken !== undefined) updateData.verifyToken = verifyToken;
    if (pageId !== undefined) updateData.pageId = pageId;
    if (pageToken !== undefined) updateData.pageToken = pageToken;
    if (formIds !== undefined) {
      updateData.formIds = formIds.map(id => id.trim()).filter(id => id);
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const credential = await updateCredential(id, updateData);
    
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: credential });
  } catch (error) {
    console.error('Error updating credential:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE credential
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteCredential(id);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
