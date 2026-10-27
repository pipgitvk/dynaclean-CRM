import { NextResponse } from 'next/server';
import { findCredentialByFormId } from '@/lib/mysql/metaLeadModel';
import { createLead, getLeadByLeadgenId, markLeadAsImported } from '@/lib/mysql/metaLeadModel';
const { getDbConnection } = require('@/lib/db');
const { normalizePhone, PHONE_LAST10_WHERE } = require('@/lib/phone-check');

const GLOBAL_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'dynaclean-secret';

/**
 * Parse lead field data from Meta format
 */
function parseLeadFromFieldData(fieldData) {
  const getValue = (name) =>
    fieldData.find((f) => f.name === name)?.values?.[0] || null;
  
  const first_name = getValue('full_name') || getValue('first_name') || '';
  const email = getValue('email') || '';
  const rawPhone = getValue('phone_number');
  const address = getValue('city') || '';
  const language = getValue('preferred_language_to_communicate') || '';
  
  return {
    first_name,
    email,
    phone: normalizePhone(rawPhone),
    address,
    language
  };
}

/**
 * GET - Webhook verification
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  // Verify webhook
  if (mode === 'subscribe' && token === GLOBAL_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }
  
  console.log('❌ Webhook verification failed');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST - Webhook payload (lead notifications)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log('📥 Received webhook payload:', JSON.stringify(body, null, 2));
    
    if (body.object !== 'page') {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    
    // Process each entry
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;
          const pageId = change.value.page_id;
          const adId = change.value.ad_id;
          
          console.log(`🎯 New lead received: ${leadgenId} from form ${formId}`);
          
          // Find matching credential by form ID
          const credential = await findCredentialByFormId(formId);
          
          if (!credential) {
            console.error(`❌ No active credential found for form ID: ${formId}`);
            continue;
          }
          
          console.log(`✅ Found credential for employee: ${credential.employeeName}`);
          
          // Fetch full lead data from Meta
          const leadRes = await fetch(
            `https://graph.facebook.com/v18.0/${leadgenId}?fields=field_data,ad_id,created_time&access_token=${credential.pageToken}`
          );
          const leadData = await leadRes.json();
          
          if (!leadRes.ok) {
            console.error('❌ Failed to fetch lead data from Meta:', leadData);
            continue;
          }
          
          const fieldData = leadData.field_data || [];
          const parsedLead = parseLeadFromFieldData(fieldData);
          
          // Check for duplicate lead in meta_leads table
          const existingLead = await getLeadByLeadgenId(leadgenId);
          if (existingLead) {
            console.log(`⚠️ Lead ${leadgenId} already exists, skipping`);
            continue;
          }
          
          // Resolve campaign name if ad_id exists
          let campaignName = '';
          if (adId) {
            try {
              const adRes = await fetch(
                `https://graph.facebook.com/v18.0/${adId}?fields=campaign_id&access_token=${credential.pageToken}`
              );
              const adJson = await adRes.json();
              const campaign_id = adJson?.campaign_id;
              
              if (campaign_id) {
                const campRes = await fetch(
                  `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${credential.pageToken}`
                );
                const campJson = await campRes.json();
                campaignName = campJson?.name || '';
              }
            } catch (err) {
              console.warn('⚠️ Failed to resolve campaign for ad', adId, err);
            }
          }
          
          // Extract product from form data
          const formProduct = fieldData.find(f => f.name === 'product')?.values?.[0] || '';
          const productsInterest = campaignName ? `${formProduct} - ${campaignName}` : formProduct;
          
          // Create meta_leads record
          const metaLead = await createLead({
            leadgenId,
            assignedTo: credential.employeeName,
            employeeName: credential.employeeName,
            formId,
            pageId,
            leadData: {
              ...parsedLead,
              lead_campaign: 'social_media',
              products_interest: productsInterest
            },
            fieldData,
            adId,
            campaignName,
            productsInterest
          });
          
          console.log(`✅ MetaLead created: ${metaLead.id}`);
          
          // Auto-import to CRM
          if (parsedLead.phone) {
            const normalizedPhone = normalizePhone(parsedLead.phone);
            if (normalizedPhone.length === 10) {
              try {
                const conn = await getDbConnection();
                
                // Check if phone exists in customers table
                const [custRows] = await conn.execute(
                  `SELECT customer_id FROM customers WHERE ${PHONE_LAST10_WHERE} LIMIT 1`,
                  [normalizedPhone]
                );
                
                // Check if phone exists in meta_leads table (already imported)
                const [metaRows] = await conn.execute(
                  `SELECT id FROM meta_leads WHERE ${PHONE_LAST10_WHERE} AND is_imported_to_crm = 1 LIMIT 1`,
                  [normalizedPhone]
                );
                
                if (custRows.length === 0 && metaRows.length === 0) {
                  // Import to CRM
                  const now = new Date();
                  const phoneToStore = normalizedPhone;
                  
                  const [customerResult] = await conn.execute(
                    `INSERT INTO customers (
                        first_name, email, phone, address, lead_campaign,
                        lead_source, sales_representative, assigned_to, status, date_created, products_interest
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      parsedLead.first_name,
                      parsedLead.email,
                      phoneToStore,
                      parsedLead.address || '',
                      'social_media',
                      credential.employeeName,
                      credential.employeeName,
                      'Automatic',
                      'New',
                      now,
                      productsInterest
                    ]
                  );
                  
                  const customerId = customerResult.insertId;
                  
                  await conn.execute(
                    `INSERT INTO customers_followup (
                        customer_id, name, contact, next_followup_date, followed_by,
                        followed_date, communication_mode, notes, email
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      customerId,
                      parsedLead.first_name,
                      phoneToStore,
                      null,
                      credential.employeeName,
                      now,
                      'Facebook',
                      'Lead from Facebook webhook (multi-credential)',
                      parsedLead.email || ''
                    ]
                  );
                  
                  // Update meta_leads with CRM customer ID
                  await markLeadAsImported(leadgenId, customerId);
                  
                  console.log(`✅ Lead imported to CRM: ${customerId}`);
                } else {
                  if (custRows.length > 0) {
                    console.log(`⚠️ Lead phone already exists in CRM: ${normalizedPhone}`);
                  } else if (metaRows.length > 0) {
                    console.log(`⚠️ Lead phone already exists in meta_leads (imported): ${normalizedPhone}`);
                  }
                }
              } catch (err) {
                console.error('❌ Error importing lead to CRM:', err);
              }
            }
          }
        }
      }
    }
    
    return NextResponse.json({ received: true }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Error in webhook POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
