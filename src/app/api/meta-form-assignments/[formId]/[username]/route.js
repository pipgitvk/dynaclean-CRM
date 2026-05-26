import { NextResponse } from 'next/server';
import {
  deleteFormAssignment,
  getAssignmentsByFormId
} from '@/lib/mysql/metaFormAssignmentModel';

// DELETE assignment
export async function DELETE(request, { params }) {
  try {
    const { formId, username } = params;
    
    const success = await deleteFormAssignment(formId, username);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
