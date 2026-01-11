import { NextResponse } from 'next/server';
import { getDbConnection } from "@/lib/db";
import fs from 'fs/promises';
import path from 'path';

async function saveSignature(signatureData, serviceId, type) {
  console.log(`[saveSignature] Saving signature for ${type}, serviceId: ${serviceId}`);
  if (!signatureData) {
    console.warn(`[saveSignature] No signature data for ${type}`);
    return null;
  }

  const signatureDir = path.join(process.cwd(), 'public', 'signatures');
  await fs.mkdir(signatureDir, { recursive: true });

  const base64Data = signatureData.replace(/^data:image\/png;base64,/, "");
  const decodedImage = Buffer.from(base64Data, 'base64');
  const filename = `${serviceId}_${type}_${Date.now()}.png`;
  const filepath = path.join(signatureDir, filename);

  try {
    await fs.writeFile(filepath, decodedImage);
    console.log(`[saveSignature] Saved ${type} signature to ${filepath}`);
    return `/signatures/${filename}`;
  } catch (error) {
    console.error(`[saveSignature] Error saving signature for ${type}:`, error);
    return null;
  }
}

export async function GET(request, context) {
  const { params } = await context;
  const serviceId = params.service_id;
  console.log(`[GET] Received request for serviceId: ${serviceId}`);

  if (!serviceId) {
    console.error(`[GET] No service ID provided`);
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
  }

  let conn;
  try {
    conn = await getDbConnection();
    console.log(`[GET] Connected to DB`);

    const [serviceRecordsRows] = await conn.execute(
      `SELECT serial_number, complaint_date FROM service_records WHERE service_id = ?`,
      [serviceId]
    );

    if (serviceRecordsRows.length === 0) {
      console.warn(`[GET] No service record found for ID: ${serviceId}`);
      return NextResponse.json({ error: 'Service record not found' }, { status: 404 });
    }

    const { serial_number, complaint_date } = serviceRecordsRows[0];
    let reportData = { service_id: serviceId, serial_number, complaint_date };
    console.log(`[GET] Found service record`, reportData);

    const [warrantyProductsRows] = await conn.execute(
      `SELECT * FROM warranty_products WHERE serial_number = ?`,
      [serial_number]
    );

    if (warrantyProductsRows.length > 0) {
      const warrantyProduct = warrantyProductsRows[0];
      reportData = { ...reportData, ...warrantyProduct };
      console.log(`[GET] Found warranty product`, warrantyProduct);
    } else {
      console.warn(`[GET] No warranty product found for serial: ${serial_number}`);
    }

    const [serviceReportsRows] = await conn.execute(
      `SELECT * FROM service_reports WHERE service_id = ?`,
      [serviceId]
    );

    if (serviceReportsRows.length > 0) {
      const existingReport = serviceReportsRows[0];
      reportData = {
        ...reportData,
        ...existingReport,
        spare_replaced: existingReport.spare_replaced ? existingReport.spare_replaced.split(',') : [],
        spare_to_be_replaced: existingReport.spare_to_be_replaced ? existingReport.spare_to_be_replaced.split(',') : [],
        checklist: existingReport.checklist ? existingReport.checklist.split(',') : [],
      };
      console.log(`[GET] Found existing report`, existingReport);
    }

    // return NextResponse.json(reportData);
    return NextResponse.json({ data: reportData });

  } catch (error) {
    console.error(`[GET] API Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    if (conn) {
      // conn.end();
      console.log(`[GET] DB connection closed`);
    }
  }
}

export async function POST(request, context) {
  const { params } = await context;
  const serviceId = params.service_id;
  console.log(`[POST] Received request for serviceId: ${serviceId}`);
  
  if (!serviceId) {
      console.error(`[POST] No service ID provided`);
      return NextResponse.json({ status: 'error', message: 'Service ID is required' }, { status: 400 });
    }
    
    let conn;
    try {
        conn = await getDbConnection();
        console.log(`[POST] Connected to DB`);
        
        const formData = await request.formData();


for (const [key, value] of formData.entries()) {
  console.log(`${key}: ${value}`);
}
        
const serviceDate = formData.get("service_date");
        const checklist = formData.get('checklist');
        const natureOfComplaint = formData.get('natureOfComplaint');
        const observation = formData.get('observation');
        const actionTaken = formData.get('actionTaken');
        const serviceRating = formData.get('serviceRating');
        const customerFeedback = formData.get('customerFeedback');
        
        console.log("******************************************************************");
        console.log("date serive: ", serviceDate);
        

    const spareReplaced = [];
    const spareToBeReplaced = [];
    for (let i = 1; i <= 5; i++) {
      const replaced = formData.get(`replaced${i}`);
      if (replaced) spareReplaced.push(replaced);

      const tobeReplaced = formData.get(`tobereplaced${i}`);
      if (tobeReplaced) spareToBeReplaced.push(tobeReplaced); // ✅ fixed typo
    }
    console.log(`[POST] Processed spare parts`, { spareReplaced, spareToBeReplaced });

    const engineerSignPath = await saveSignature(formData.get('engineerSignature'), serviceId, 'engineer');
    const customerSignPath = await saveSignature(formData.get('customerSignature'), serviceId, 'customer');

    const authorizedPersonName = formData.get('engineerName');
    const authorizedPersonDesignation = formData.get('engDesignation');
    const authorizedPersonMobile = formData.get('engContact');
    const customerName = formData.get('customerName');
    const customerName1 = formData.get('customerName1');
    const customerDesignation = formData.get('customerDesignation');
    const customerMobile = formData.get('customerMobile');

    console.log(`[POST] Insert/update service report for serviceId: ${serviceId}`);

    const [insertResult] = await conn.execute(
      `INSERT INTO service_reports (
        service_id, service_date, checklist, nature_of_complaint, observation, 
        action_taken, spare_replaced, spare_to_be_replaced, service_rating, 
        customer_feedback, authorized_person_name, authorized_person_sign, 
        authorized_person_designation, authorized_person_mobile, customer_name,
        customer_name1, customer_sign, customer_designation, customer_mobile
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      service_date=?, checklist=?, nature_of_complaint=?, observation=?, 
      action_taken=?, spare_replaced=?, spare_to_be_replaced=?, service_rating=?, 
      customer_feedback=?, authorized_person_name=?, authorized_person_sign=?, 
      authorized_person_designation=?, authorized_person_mobile=?, customer_name=?,
      customer_name1=?, customer_sign=?, customer_designation=?, customer_mobile=?`,
      [
        serviceId, serviceDate, checklist, natureOfComplaint, observation,
        actionTaken, spareReplaced.join(','), spareToBeReplaced.join(','), serviceRating,
        customerFeedback, authorizedPersonName, engineerSignPath,
        authorizedPersonDesignation, authorizedPersonMobile, customerName,
        customerName1, customerSignPath, customerDesignation, customerMobile,

        // Duplicate Key update values
        serviceDate, checklist, natureOfComplaint, observation,
        actionTaken, spareReplaced.join(','), spareToBeReplaced.join(','), serviceRating,
        customerFeedback, authorizedPersonName, engineerSignPath,
        authorizedPersonDesignation, authorizedPersonMobile, customerName,
        customerName1, customerSignPath, customerDesignation, customerMobile
      ]
    );

      await conn.execute(`UPDATE service_records SET installation_report = 'uploadFO' WHERE service_id = ?`, [serviceId]);

    console.log(`[POST] Insert/Update Result:`, insertResult);

    if (insertResult.affectedRows > 0) {
      await conn.execute(`UPDATE service_records SET status = 'COMPLETED' WHERE service_id = ?`, [serviceId]);
      console.log(`[POST] Service status updated to COMPLETED for serviceId: ${serviceId}`);
      return NextResponse.json({ status: 'success', message: 'Service report submitted successfully' });
    } else {
      console.warn(`[POST] No rows affected`);
      return NextResponse.json({ status: 'error', message: 'Error submitting service report' }, { status: 500 });
    }
  } catch (error) {
    console.error(`[POST] API Error:`, error);
    return NextResponse.json({ status: 'error', message: `An error occurred: ${error.message}` }, { status: 500 });
  } finally {
    if (conn) {
      // conn.end();
      console.log(`[POST] DB connection closed`);
    }
  }
}
