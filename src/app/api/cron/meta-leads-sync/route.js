import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cronAuth';
import { 
  startMetaLeadCron, 
  stopMetaLeadCron, 
  getCronStatus, 
  manualSync 
} from '@/lib/cron/metaLeadCron';

// GET - Get cron status or trigger manual sync
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const autoImport = searchParams.get('autoImport') !== 'false';
    
    if (action === 'status') {
      const status = getCronStatus();
      return NextResponse.json({ success: true, data: status });
    }
    
    if (action === 'manual-sync') {
      if (!(await isCronRequestAuthorized(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const results = await manualSync({ since, until, autoImport });
      return NextResponse.json({ success: true, data: results });
    }
    
    // Default: return status
    const status = getCronStatus();
    return NextResponse.json({ success: true, data: status });
    
  } catch (error) {
    console.error('Error in cron API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Start or stop cron
export async function POST(request) {
  try {
    if (!(await isCronRequestAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action } = body;
    
    if (action === 'start') {
      startMetaLeadCron();
      return NextResponse.json({ 
        success: true, 
        message: 'Cron job started' 
      });
    }
    
    if (action === 'stop') {
      stopMetaLeadCron();
      return NextResponse.json({ 
        success: true, 
        message: 'Cron job stopped' 
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in cron POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
