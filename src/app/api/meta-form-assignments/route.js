import { NextResponse } from 'next/server';
import {
  createFormAssignment,
  getAllAssignments,
  deleteFormAssignment
} from '@/lib/mysql/metaFormAssignmentModel';

// GET all assignments
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get('formId');

    if (formId) {
      const assignments = await getAllAssignments();
      const filtered = assignments.filter(a => a.form_id === formId);
      return NextResponse.json({ success: true, data: filtered });
    }

    const assignments = await getAllAssignments();
    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST create/update assignment
export async function POST(request) {
  try {
    const body = await request.json();
    const { formId, username, priority, maxLeads } = body;

    if (!formId || !username) {
      return NextResponse.json(
        { success: false, error: 'formId and username are required' },
        { status: 400 }
      );
    }

    const assignment = await createFormAssignment({
      formId,
      username,
      priority: priority || 0,
      maxLeads: maxLeads || 0
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE assignment (using query params instead of route params)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get('formId');
    const username = searchParams.get('username');

    if (!formId || !username) {
      return NextResponse.json(
        { success: false, error: 'formId and username are required' },
        { status: 400 }
      );
    }

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
