import { NextResponse } from 'next/server';
import {
  getAllLeads,
  countLeads,
  createLead,
  getLeadByLeadgenId
} from '@/lib/mysql/metaLeadModel';

// GET all leads with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const formId = searchParams.get('formId');
    const isImported = searchParams.get('isImported');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const skip = parseInt(searchParams.get('skip')) || 0;
    
    const filters = {};
    if (assignedTo) filters.assignedTo = assignedTo;
    if (formId) filters.formId = formId;
    if (isImported !== null) {
      filters.isImported = isImported === 'true';
      // For skipped leads, get unique leads by leadgen_id
      if (filters.isImported === false) {
        filters.unique = true;
      }
    }
    filters.limit = limit;
    filters.skip = skip;
    
    const leads = await getAllLeads(filters);
    const total = await countLeads(filters);
    
    return NextResponse.json({ 
      success: true, 
      data: leads,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + leads.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST create new lead (typically from webhook)
export async function POST(request) {
  try {
    const body = await request.json();
    const { leadgenId, assignedTo, employeeName, formId, pageId, leadData, fieldData } = body;
    
    if (!leadgenId || !assignedTo || !employeeName || !formId || !pageId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check for duplicate lead
    const existingLead = await getLeadByLeadgenId(leadgenId);
    if (existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead already exists', data: existingLead },
        { status: 409 }
      );
    }
    
    const lead = await createLead({
      leadgenId,
      assignedTo,
      employeeName,
      formId,
      pageId,
      leadData,
      fieldData
    });
    
    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
