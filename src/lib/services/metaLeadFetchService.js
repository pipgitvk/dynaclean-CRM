const { getDbConnection } = require('../db');
const { getActiveCredentials, updateCredentialSync } = require('../mysql/metaCredentialModel');
const { createLead, getLeadByLeadgenId, markLeadAsImported } = require('../mysql/metaLeadModel');
const { createSyncLog } = require('../mysql/metaSyncLogModel');
const { normalizePhone, PHONE_LAST10_WHERE } = require('../phone-check');

/**
 * Fetch leads from Meta Graph API for a specific form
 */
async function fetchLeadsFromMeta(formId, pageToken, since = null, until = null) {
  // Trim and clean the token
  const cleanToken = pageToken ? pageToken.trim() : '';
  
  if (!cleanToken) {
    throw new Error('Page access token is empty');
  }
  
  console.log(`Fetching leads for form ${formId} with token length: ${cleanToken.length}`);
  
  let url = new URL(`https://graph.facebook.com/v18.0/${formId}/leads`);
  url.searchParams.set('access_token', cleanToken);
  url.searchParams.set('limit', '100');
  url.searchParams.set('fields', 'field_data,ad_id,created_time');
  
  if (since && until) {
    url.searchParams.set('time_range[since]', since);
    url.searchParams.set('time_range[until]', until);
  }
  
  let rawLeads = [];
  let pageCount = 0;
  const maxPages = 50;
  
  while (url && pageCount < maxPages) {
    pageCount += 1;
    const res = await fetch(url.toString());
    const data = await res.json();
    
    if (!res.ok) {
      const errorMsg = data?.error?.message || 'Failed to fetch leads from Meta';
      console.error(`Meta API Error for form ${formId}:`, errorMsg, data?.error);
      throw new Error(errorMsg);
    }
    
    rawLeads = rawLeads.concat(data?.data || []);
    const next = data?.paging?.next;
    url = next ? new URL(next) : null;
  }
  
  return rawLeads;
}

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
 * Resolve campaign name from ad ID
 */
async function resolveCampaignNameForAd(adId, token) {
  try {
    const adRes = await fetch(
      `https://graph.facebook.com/v18.0/${adId}?fields=campaign_id&access_token=${token}`
    );
    const adJson = await adRes.json();
    const campaign_id = adJson?.campaign_id;
    
    if (!campaign_id) return '';
    
    const campRes = await fetch(
      `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${token}`
    );
    const campJson = await campRes.json();
    return campJson?.name || '';
  } catch (err) {
    console.warn('Failed to resolve campaign for ad', adId, err);
    return '';
  }
}

/**
 * Check if lead already exists in customers table (MySQL)
 */
async function checkLeadExistsInCRM(phone) {
  if (!phone) return false;
  
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length !== 10) return false;
  
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT customer_id FROM customers WHERE ${PHONE_LAST10_WHERE} LIMIT 1`,
      [normalizedPhone]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error checking lead in CRM:', error);
    return false;
  }
}

/**
 * Import lead into CRM (MySQL customers table)
 */
async function importLeadToCRM(lead, assignedTo) {
  const conn = await getDbConnection();
  const now = new Date();
  
  const normalizedPhone = normalizePhone(lead.phone);
  const phoneToStore = (normalizedPhone && normalizedPhone.length === 10) ? normalizedPhone : lead.phone;
  
  const [customerResult] = await conn.execute(
    `INSERT INTO customers (
        first_name, email, phone, address, lead_campaign,
        lead_source, sales_representative, assigned_to, status, date_created, products_interest
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lead.first_name,
      lead.email,
      phoneToStore,
      lead.address || '',
      'social_media',
      assignedTo,
      assignedTo,
      'Automatic',
      'New',
      now,
      lead.products_interest || ''
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
      lead.first_name,
      phoneToStore,
      null,
      assignedTo,
      now,
      'Facebook',
      'Lead from Facebook ad (multi-credential)',
      lead.email || ''
    ]
  );
  
  return customerId;
}

/**
 * Main function: Fetch and sync leads for a single credential
 */
async function syncLeadsForCredential(credential, options = {}) {
  const { since, until, autoImport = false } = options;
  const startTime = Date.now();
  let leadsFetched = 0;
  let leadsImported = 0;
  let leadsSkipped = 0;
  let errorMessage = null;
  
  try {
    // Fetch leads for each form ID
    for (const formId of credential.formIds) {
      const rawLeads = await fetchLeadsFromMeta(
        formId,
        credential.pageToken,
        since,
        until
      );
      
      leadsFetched += rawLeads.length;
      
      for (const rawLead of rawLeads) {
        const leadgenId = rawLead.id;
        
        // Check if lead already exists in meta_leads table
        const existingMetaLead = await getLeadByLeadgenId(leadgenId);
        if (existingMetaLead) {
          leadsSkipped++;
          continue;
        }
        
        // Parse lead data
        const fieldData = rawLead.field_data || [];
        const parsedLead = parseLeadFromFieldData(fieldData);
        
        // Resolve campaign name if ad_id exists
        let campaignName = '';
        if (rawLead.ad_id) {
          campaignName = await resolveCampaignNameForAd(rawLead.ad_id, credential.pageToken);
        }
        
        // Extract product from form data
        const formProduct = fieldData.find(f => f.name === 'product')?.values?.[0] || '';
        const productsInterest = campaignName ? `${formProduct} - ${campaignName}` : formProduct;
        
        // Create meta_leads record with duplicate error handling
        const metaLead = await createLead({
          leadgenId,
          assignedTo: credential.employeeName,
          employeeName: credential.employeeName,
          formId,
          pageId: credential.pageId,
          leadData: {
            ...parsedLead,
            lead_campaign: 'social_media',
            products_interest: productsInterest
          },
          fieldData,
          adId: rawLead.ad_id,
          campaignName,
          productsInterest
        });
        
        // If lead is null, it means duplicate - skip it
        if (metaLead === null) {
          leadsSkipped++;
          continue;
        }
        
        // Auto-import to CRM if requested
        if (autoImport) {
          const existsInCRM = await checkLeadExistsInCRM(parsedLead.phone);
          if (!existsInCRM && parsedLead.phone) {
            try {
              const customerId = await importLeadToCRM(
                {
                  ...parsedLead,
                  products_interest: productsInterest
                },
                credential.employeeName
              );
              
              await markLeadAsImported(leadgenId, customerId);
              
              leadsImported++;
            } catch (err) {
              console.error('Error importing lead to CRM:', err);
            }
          } else {
            leadsSkipped++;
          }
        }
      }
    }
    
    // Update credential sync status
    const syncStatus = errorMessage ? 'error' : (leadsImported > 0 ? 'success' : (leadsFetched > 0 ? 'partial' : 'success'));
    const syncMessage = errorMessage ? errorMessage : (leadsSkipped > 0 ? `Sync completed: Fetched ${leadsFetched}, Imported ${leadsImported}, Skipped ${leadsSkipped} (duplicates)` : 'Sync completed successfully');
    
    await updateCredentialSync(credential.id, {
      lastSyncAt: new Date().toISOString(),
      status: syncStatus,
      message: syncMessage,
      leadsFetched,
      leadsImported
    });
    
  } catch (error) {
    errorMessage = error.message;
    console.error('Error syncing leads for credential:', credential.employeeName, error);
    
    // Update credential with error status
    await updateCredentialSync(credential.id, {
      lastSyncAt: new Date().toISOString(),
      status: 'error',
      message: errorMessage,
      leadsFetched,
      leadsImported
    });
  }
  
  // Create sync log (always try to create, even if it fails)
  const syncDuration = Date.now() - startTime;
  try {
    await createSyncLog({
      credentialId: credential.id,
      employeeName: credential.employeeName,
      syncType: since ? 'cron' : 'manual',
      status: errorMessage ? 'error' : (leadsImported > 0 ? 'success' : 'partial'),
      leadsFetched,
      leadsImported,
      leadsSkipped,
      errorMessage,
      syncDuration,
      formIdsProcessed: credential.formIds
    });
    console.log(`✅ Sync log created for ${credential.employeeName}`);
  } catch (logError) {
    console.error(`❌ Failed to create sync log for ${credential.employeeName}:`, logError);
  }
  
  return {
    credentialId: credential.id,
    employeeName: credential.employeeName,
    leadsFetched,
    leadsImported,
    leadsSkipped,
    error: errorMessage,
    syncDuration
  };
}

/**
 * Sync leads for all active credentials
 */
async function syncAllActiveCredentials(options = {}) {
  const credentials = await getActiveCredentials();
  
  console.log(`🔄 Syncing ${credentials.length} active credentials...`);
  
  const results = [];
  for (const credential of credentials) {
    console.log(`📋 Syncing credential: ${credential.employeeName} (ID: ${credential.id})`);
    try {
      const result = await syncLeadsForCredential(credential, options);
      results.push(result);
      console.log(`✅ Completed sync for ${credential.employeeName}: Fetched ${result.leadsFetched}, Imported ${result.leadsImported}`);
    } catch (error) {
      console.error(`❌ Error syncing credential ${credential.employeeName}:`, error);
      // Update credential with error status
      try {
        await updateCredentialSync(credential.id, {
          lastSyncAt: new Date().toISOString(),
          status: 'error',
          message: error.message || 'Sync failed',
          leadsFetched: 0,
          leadsImported: 0
        });
      } catch (updateError) {
        console.error(`❌ Failed to update error status for ${credential.employeeName}:`, updateError);
      }
      results.push({
        credentialId: credential.id,
        employeeName: credential.employeeName,
        leadsFetched: 0,
        leadsImported: 0,
        leadsSkipped: 0,
        error: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  syncLeadsForCredential,
  syncAllActiveCredentials,
  fetchLeadsFromMeta,
  parseLeadFromFieldData
};
