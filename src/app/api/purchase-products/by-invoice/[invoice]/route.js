import { NextResponse } from 'next/server';
import { dbExecute } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { invoice } = await params;

    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: 'Invoice number is required'
      }, { status: 400 });
    }
    
    // Fetch all products with the same invoice number using dbExecute
    const rows = await dbExecute(`
      SELECT 
        psr.id,
        psr.invoice_number as invoice_no,
        psr.from_company as vendor_name,
        psr.product_name,
        psr.product_code,
        psr.net_amount as amount,
        psr.quantity,
        psr.price_per_unit as unit_price,
        psr.tax_amount as gst_amount,
        psr.invoice_date as purchase_date,
        psr.status,
        psr.customer_id,
        psr.client_name,
        psr.client_company_name,
        psr.client_number,
        psr.client_email,
        psr.client_gstin,
        psr.customer_address,
        psr.payment_entries,
        psr.terms_id,
        tc.title as terms_title,
        tc.terms_text as terms_text,
        tc.applicable_for as terms_applicable_for,
        psr.eway_bill,
        psr.product_image,
        psr.invoice_upload,
        psr.payment_proof_upload,
        psr.quotation_upload,
        psr.delivery_location,
        psr.mode_of_transport,
        psr.transportation_charges,
        psr.self_name,
        psr.courier_tracking_id,
        psr.courier_company,
        psr.porter_tracking_id,
        psr.porter_contact,
        psr.truck_number,
        psr.driver_name,
        psr.driver_number,
        psr.created_at,
        psr.updated_at
      FROM product_stock_request psr
      LEFT JOIN terms_conditions tc ON psr.terms_id = tc.id
      WHERE psr.invoice_number = ?
      ORDER BY psr.created_at ASC
    `, [decodeURIComponent(invoice)]);

    return NextResponse.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Error fetching products by invoice:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch products'
    }, { status: 500 });
  }
}