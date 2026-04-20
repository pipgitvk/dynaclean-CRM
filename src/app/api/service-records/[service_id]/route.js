


// // app/api/service-records/[service_id]/route.js
// import { NextResponse } from "next/server";
// import { getDbConnection } from "@/lib/db";

// export async function GET(request, context) {
//   try {
//     const { params } = context;
//     const serviceId = params.service_id;

//     if (!serviceId) {
//       return NextResponse.json(
//         { error: "Service ID is required" },
//         { status: 400 }
//       );
//     }

//     const db = await getDbConnection();

//     // Get service record
//     const [records] = await db.query(
//       "SELECT * FROM service_records WHERE service_id = ?",
//       [serviceId]
//     );

//     const serviceRecord = records[0];
//     if (!serviceRecord) {
//       return NextResponse.json(
//         { error: "Service record not found" },
//         { status: 404 }
//       );
//     }



//               const [installdata] = await db.query(
//       "SELECT * FROM installation_reports WHERE service_id = ?",
//       [records[0].service_id]
//     );



//     let installedData = installdata[0];
//       if (!installedData) {
//      installedData = "";
//     }


    

//     const serialNumber = serviceRecord.serial_number;

//     // Get warranty product details based on serial_number
//     const [warrantyProducts] = await db.query(
//       `SELECT product_name, model, customer_name, email, contact, 
//               customer_address, installed_address, installation_date, 
//               invoice_number, invoice_date
//        FROM warranty_products 
//        WHERE serial_number = ?`,
//       [serialNumber]
//     );

//     const warrantyProduct = warrantyProducts[0] || {};

//     return NextResponse.json({
//       record: serviceRecord,
//       product: warrantyProduct,
//       install: installedData,
//     });
//   } catch (error) {
//     console.error("Error fetching service record:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch service record" },
//       { status: 500 }
//     );
//   }
// }




// app/api/service-records/[service_id]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function GET(request, context) {
  try {
    const { params } = await context;
    const serviceId = (await params).service_id;

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const db = await getDbConnection();

    // ✅ Get service record (including PDF path)
    const [records] = await db.query(
      "SELECT *, pdf_path FROM service_records WHERE service_id = ?",
      [serviceId]
    );

    const serviceRecord = records[0];
    if (!serviceRecord) {
      return NextResponse.json(
        { error: "Service record not found" },
        { status: 404 }
      );
    }

    // ✅ Get installation report (if exists)
    const [installationRows] = await db.query(
      "SELECT * FROM installation_reports WHERE service_id = ? and status = ?",
      [serviceRecord.service_id, serviceRecord.status]
    );

    const installationData = installationRows.length > 0 ? installationRows[0] : null;

    const [reportRows] = await db.query(
      `SELECT authorized_person_sign, customer_sign
       FROM service_reports WHERE service_id = ? LIMIT 1`,
      [serviceId]
    );
    const reportRow = reportRows[0] || null;

    const pickStr = (a, b) => {
      const ta = a != null && String(a).trim() !== "" ? String(a).trim() : "";
      const tb = b != null && String(b).trim() !== "" ? String(b).trim() : "";
      return ta || tb || null;
    };

    const mergedRecord = {
      ...serviceRecord,
      authorised_person_sign: pickStr(
        reportRow?.authorized_person_sign,
        serviceRecord.authorised_person_sign
      ),
      customer_sign: pickStr(
        reportRow?.customer_sign,
        serviceRecord.customer_sign
      ),
    };

    // ✅ Get warranty product details using serial number
    const serialNumber = serviceRecord.serial_number;
    let warrantyProduct = {};

    if (serialNumber) {
      const [warrantyRows] = await db.query(
        `SELECT product_name, model, customer_name, email, contact, 
                customer_address, installed_address, installation_date, 
                invoice_number, invoice_date,
                contact_person, site_person
         FROM warranty_products 
         WHERE serial_number = ?`,
        [serialNumber]
      );
      warrantyProduct = warrantyRows.length > 0 ? warrantyRows[0] : {};
    }

    return NextResponse.json(
      {
        record: mergedRecord,
        product: warrantyProduct,
        install: installationData,
        fetchedAt: Date.now(),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("Error fetching service record:", error);
    return NextResponse.json(
      { error: "Failed to fetch service record" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
