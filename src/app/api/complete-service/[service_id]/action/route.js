import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sendTemplatedEmail } from "@/lib/template-utils";
import { v4 as uuidv4 } from "uuid";

// Helper to save base64 signature
const saveSignature = async (dataUrl, serviceId, type) => {
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    console.log(`[saveSignature] ⚠️ No data provided for ${type}`);
    return null;
  }

  try {
    const base64Data = dataUrl.split(";base64,").pop();
    const fileExtension = dataUrl.split(";")[0].split("/")[1];
    const fileName = `${serviceId}-${type}-${uuidv4()}.${fileExtension}`;
    const uploadDir = path.join(process.cwd(), "public", "signatures");
    const filePath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, base64Data, "base64");
    console.log(`[saveSignature] ✅ Saved ${type} to: ${fileName}`);
    return fileName;
  } catch (err) {
    console.error(`[saveSignature] ❌ Error saving ${type}:`, err);
    return null;
  }
};

export async function POST(request, context) {
  const { params } = await context;
  const serviceId = (await params).service_id;
  console.log(`📥 [POST] Start | Service ID: ${serviceId}`);

  console.log("----------------------------------------------------------------------------------------------------------------------------------------------");
  console.log("----------------------------------------------------------------------------------------------------------------------------------------------");
  console.log("----------------------------------------------------------------------------------------------------------------------------------------------");


  if (!serviceId) {
    console.error("❌ [POST] Missing service ID");
    return NextResponse.json(
      { status: "error", message: "Missing service ID" },
      { status: 400 }
    );
  }

  let conn;
  try {
    conn = await getDbConnection();
    console.log("✅ Connected to DB");

    const formData = await request.formData();
    console.log("📦 Parsed formData");

    // --- Service Record fields
    const status = formData.get("status");
    const completionRemark = formData.get("completion_remark");
    const completedDate = formData.get("completed_date");
    const serviceType = formData.get("service_type");

    // --- Location fields
    const latitude = formData.get("latitude");
    const longitude = formData.get("longitude");
    const locationAddress = formData.get("location_address");

    console.log("📝 Record Fields:", {
      status,
      completionRemark,
      completedDate,
      serviceType,
    });

    console.log("📍 Location Fields:", {
      latitude,
      longitude,
      locationAddress,
    });

    // Files
    const uploadedImageFiles = formData.getAll("completion_images");
    const preCompletionFiles = formData.getAll("pre_completion_images");
    const afterCompletionFiles = formData.getAll("after_completion_images");

    console.log("📷 File counts:", {
      completion: uploadedImageFiles.length,
      pre: preCompletionFiles.length,
      after: afterCompletionFiles.length,
    });

    // --- Report fields
    const reportFields = {
      checklist: formData.get("checklist"),
      replaced: formData.get("spare_replaced"),
      to_be_replaced: formData.get("spare_to_be_replaced"),
      nature_of_complaints: formData.get("nature_of_complaint"),
      service_rate: formData.get("service_rating"),
      feedback: formData.get("customer_feedback"),
      authorised_person_sign: formData.get("authorized_person_sign"),
      authorised_person_name: formData.get("authorized_person_name"),
      authorised_person_designation: formData.get("authorized_person_designation"),
      authorised_person_mobile: formData.get("authorized_person_mobile"),
      customer_sign: formData.get("customer_sign"),
      customer_name: formData.get("customer_name"),
      customer_designation: formData.get("customer_designation"),
      customer_mobile: formData.get("customer_mobile"),
      observation: formData.get("observation"),
      action_taken: formData.get("action_taken"),
      defects_on_inspection: formData.get("defects_on_inspection"),
      engineer_remarks: formData.get("engineer_remarks"),
      trainees: formData.get("trainees"),
    };
    console.log("🧾 Report Fields:", reportFields);

    // --- Save files
    const uploadDir = path.join(process.cwd(), "public", "completion_files");
    await mkdir(uploadDir, { recursive: true });

    const completionImagePaths = [];
    const preCompletionPaths = [];
    const afterCompletionPaths = [];

    const saveFiles = async (files, targetArray, label) => {
      for (const file of files) {
        if (file && file.size > 0) {
          const fileName = `${uuidv4()}-${file.name}`;
          const buffer = Buffer.from(await file.arrayBuffer());
          await writeFile(path.join(uploadDir, fileName), buffer);
          targetArray.push(fileName);
          console.log(`🖼️ Saved ${label}: ${fileName}`);
        } else {
          console.log(`⚠️ Skipped empty ${label} file`);
        }
      }
    };

    await saveFiles(uploadedImageFiles, completionImagePaths, "completion");
    await saveFiles(preCompletionFiles, preCompletionPaths, "pre-completion");
    await saveFiles(afterCompletionFiles, afterCompletionPaths, "after-completion");

    const engineerSignPath = await saveSignature(
      reportFields.authorised_person_sign,
      serviceId,
      "engineer"
    );
    const customerSignPath = await saveSignature(
      reportFields.customer_sign,
      serviceId,
      "customer"
    );

    // === Fetch existing service_record
    const [[existingRecord]] = await conn.execute(
      `SELECT attachments, pre_completion, after_completion 
       FROM service_records WHERE service_id = ?`,
      [serviceId]
    );
    console.log("📄 Existing service_record:", existingRecord);

    const mergeList = (existing, newList) =>
      (existing ? existing.split(",") : [])
        .concat(newList)
        .filter(Boolean)
        .join(",");

    const finalAttachments = mergeList(existingRecord.attachments, completionImagePaths);
    const finalPreCompletion = mergeList(existingRecord.pre_completion, preCompletionPaths);
    const finalAfterCompletion = mergeList(existingRecord.after_completion, afterCompletionPaths);

    console.log("📂 Final file paths:", {
      attachments: finalAttachments,
      pre_completion: finalPreCompletion,
      after_completion: finalAfterCompletion,
    });

    // === Update service_records
    const updateRecordFields = {
      status,
      attachments: finalAttachments,
      pre_completion: finalPreCompletion,
      after_completion: finalAfterCompletion,
    };

    // === Upsert service_reports on every submit (captures latest form values)
    try {
      const serviceDate = formData.get("service_date") || new Date().toISOString().split("T")[0];

      const upsertColumns = [
        "service_id",
        "service_date",
        "checklist",
        "nature_of_complaint",
        "observation",
        "action_taken",
        "spare_replaced",
        "spare_to_be_replaced",
        "service_rating",
        "customer_feedback",
        "authorized_person_name",
        "authorized_person_sign",
        "authorized_person_designation",
        "authorized_person_mobile",
        "customer_name",
        "customer_sign",
        "customer_designation",
        "customer_mobile",
      ];

      const upsertValues = [
        serviceId,
        serviceDate,
        reportFields.checklist,
        reportFields.nature_of_complaints,
        reportFields.observation,
        reportFields.action_taken,
        reportFields.replaced,
        reportFields.to_be_replaced,
        reportFields.service_rate,
        reportFields.feedback,
        reportFields.authorised_person_name,
        engineerSignPath || "",
        reportFields.authorised_person_designation,
        reportFields.authorised_person_mobile,
        reportFields.customer_name || "N/A",
        customerSignPath || "",
        reportFields.customer_designation,
        reportFields.customer_mobile,
      ];

      const placeholders = upsertColumns.map(() => "?").join(", ");
      const updateSet = upsertColumns
        .filter((c) => c !== "service_id")
        .map((c) => `${c} = VALUES(${c})`)
        .join(", ");

      console.log("🛠️ Upserting into service_reports", { service_id: serviceId, serviceDate });

      await conn.execute(
        `INSERT INTO service_reports (${upsertColumns.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSet}`,
        upsertValues
      );
      console.log("✅ service_reports upserted successfully");

      // Mark installation report flag when it's an installation submission
      if (serviceType === "INSTALLATION" && status === "COMPLETED") {
        const [instFlagUpdate] = await conn.execute(
          `UPDATE service_records SET installation_report = 'uploadFO' WHERE service_id = ?`,
          [serviceId]
        );
        console.log("🔖 installation_report flag set | Affected Rows:", instFlagUpdate.affectedRows);
        const [instUpdate] = await conn.execute(
          `UPDATE warranty_products 
           SET installation_date = ? 
           WHERE serial_number = (
               SELECT serial_number COLLATE utf8mb3_unicode_ci 
               FROM service_records 
               WHERE service_id = ?
           )`,
          [completedDate, serviceId]
        );
        console.log("🔖 installation_date flag set | Affected Rows:", instUpdate.affectedRows);
      }
    } catch (err) {
      console.error("❌ Upsert to service_reports failed:", err);
    }

    if (status === "COMPLETED") {
      Object.assign(updateRecordFields, {
        completion_remark: completionRemark,
        completed_date: completedDate,
        checklist: reportFields.checklist,
        replaced: reportFields.replaced,
        to_be_replaced: reportFields.to_be_replaced,
        observation: reportFields.observation,
        action_taken: reportFields.action_taken,
        nature_of_complaints: reportFields.nature_of_complaints,
        service_rate: reportFields.service_rate,
        feedback: reportFields.feedback,
        authorised_person_sign: engineerSignPath,
        authorised_person_name: reportFields.authorised_person_name,
        authorised_person_designation: reportFields.authorised_person_designation,
        authorised_person_mobile: reportFields.authorised_person_mobile,
        customer_sign: customerSignPath,
        customer_name: reportFields.customer_name,
        customer_designation: reportFields.customer_designation,
        customer_mobile: reportFields.customer_mobile,
      });

      const keys = Object.keys(updateRecordFields);
      const values = Object.values(updateRecordFields);
      const setClause = keys.map((k) => `${k} = ?`).join(", ");

      console.log("🛠️ Updating service_records with:", updateRecordFields);

      const [recordUpdate] = await conn.execute(
        `UPDATE service_records SET ${setClause} WHERE service_id = ?`,
        [...values, serviceId]
      );
      console.log("✅ service_records updated | Affected Rows:", recordUpdate.affectedRows);

      // Ensure status is explicitly set to COMPLETED
      const [statusUpdate] = await conn.execute(
        `UPDATE service_records SET status = 'COMPLETED' WHERE service_id = ?`,
        [serviceId]
      );
      console.log("🔁 Explicit status update to COMPLETED | Affected Rows:", statusUpdate.affectedRows);
    } else {
      console.log("ℹ️ Status is not COMPLETED — updating status/images only");

      const [recordUpdate] = await conn.execute(
        `UPDATE service_records SET status = ?, attachments = ?, pre_completion = ?, after_completion = ? WHERE service_id = ?`,
        [status, finalAttachments, finalPreCompletion, finalAfterCompletion, serviceId]
      );
      console.log("✅ service_records (status/images) updated | Affected Rows:", recordUpdate.affectedRows);
    }

    // === UPDATE neworder.installation_status if all serials installed
    try {
      // 1. Fetch all completed installation service_records
      const [completedServices] = await conn.execute(`
    SELECT serial_number
    FROM service_records
    WHERE service_type = 'INSTALLATION' AND status = 'COMPLETED'
  `);
      const completedSerialsSet = new Set(completedServices.map(s => s.serial_number));

      if (completedSerialsSet.size === 0) {
        console.log("⚠️ No completed installation service records found");
      } else {
        // 2. Fetch all dispatch rows with quote_number and serial_no
        const [dispatchRows] = await conn.execute(`
      SELECT serial_no, quote_number
      FROM dispatch
    `);

        // 3. Group dispatch rows by quote_number
        const quoteToSerials = {};
        dispatchRows.forEach(row => {
          if (!quoteToSerials[row.quote_number]) quoteToSerials[row.quote_number] = [];
          quoteToSerials[row.quote_number].push(row.serial_no);
        });

        // 4. Check which quote_numbers have all serial_no completed
        const quotesToUpdate = [];
        for (const [quote, serials] of Object.entries(quoteToSerials)) {
          const allCompleted = serials.every(s => completedSerialsSet.has(s));
          if (allCompleted) quotesToUpdate.push(quote);
        }

        console.log("✅ Quotes eligible for installation_status update:", quotesToUpdate);

        // 5. Bulk update neworder.installation_status = 1
        if (quotesToUpdate.length > 0) {
          await conn.execute(
            `UPDATE neworder SET installation_status = 1 WHERE quote_number IN (${quotesToUpdate.map(() => "?").join(",")})`,
            quotesToUpdate
          );
          console.log("✅ Installation status updated for eligible quotes");
        } else {
          console.log("ℹ️ No quote_numbers met criteria for update");
        }
      }
    } catch (err) {
      console.error("❌ Error updating neworder installation_status:", err);
    }

    // === Update warranty_products with location data (if provided)
    if (latitude && longitude) {
      console.log("📍 Updating warranty_products with location data...");

      // Get the serial number from service_records
      const [[serviceRecord]] = await conn.execute(
        `SELECT serial_number FROM service_records WHERE service_id = ?`,
        [serviceId]
      );

      if (serviceRecord?.serial_number) {
        const [locationUpdate] = await conn.execute(
          `UPDATE warranty_products SET lat = ?, longt = ? WHERE serial_number = ?`,
          [latitude, longitude, serviceRecord.serial_number]
        );
        console.log("✅ warranty_products location updated | Affected Rows:", locationUpdate.affectedRows);
      } else {
        console.log("⚠️ No serial number found for service_id:", serviceId);
      }
    } else {
      console.log("ℹ️ No location data provided, skipping warranty_products update");
    }

    // === Installation-specific insert
    if (serviceType === "INSTALLATION") {
      console.log("🚀 INSTALLATION detected — preparing installation_reports insert...");

      let traineeNames = "";
      let traineeDepartments = "";
      let traineeContacts = "";

      if (reportFields.trainees) {
        try {
          const traineeArr = JSON.parse(reportFields.trainees);
          console.log("👩‍💻 Parsed trainees array:", traineeArr);

          traineeNames = traineeArr.map((t) => t.name).join(",");
          traineeDepartments = traineeArr.map((t) => t.designation).join(",");
          traineeContacts = traineeArr.map((t) => t.contact).join(",");

          console.log("📊 Trainee parsed values:", {
            traineeNames,
            traineeDepartments,
            traineeContacts,
          });
        } catch (err) {
          console.error("❌ Failed to parse trainees JSON:", err);
        }
      } else {
        console.log("⚠️ No trainees provided in formData");
      }

      const installValues = [
        serviceId,
        new Date().toISOString().split("T")[0],
        status,
        reportFields.defects_on_inspection,
        reportFields.engineer_remarks,
        traineeNames,
        traineeDepartments,
        traineeContacts,
        reportFields.service_rate,
        reportFields.feedback,
        reportFields.authorised_person_name,
        engineerSignPath || "",
        reportFields.authorised_person_designation,
        reportFields.authorised_person_mobile,
        reportFields.customer_name,
        customerSignPath || "",
        reportFields.customer_designation,
        reportFields.customer_mobile,
      ];

      console.log("🛠️ Inserting installation_reports with:", installValues);

      const [installInsert] = await conn.execute(
        `INSERT INTO installation_reports (
            service_id,
            installation_date,
            status,
            defects_on_inspection,
            engineer_remarks,
            trainee_names,
            trainee_departments,
            trainee_contacts,
            service_rating,
            customer_feedback,
            authorized_person_name,
            authorized_person_sign,
            authorized_person_designation,
            authorized_person_mobile,
            customer_name1,
            customer_sign,
            customer_designation,
            customer_mobile
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        installValues
      );
      console.log("✅ installation_reports inserted | Affected Rows:", installInsert.affectedRows);
    }

    // === Email on completion
    if (status === "COMPLETED") {
      console.log("📧 Preparing completion email...");

      const [[customerData]] = await conn.execute(
        `SELECT T1.serial_number, T2.email, T2.installed_address,T2.site_email,T2.site_contact,T2.site_person
         FROM service_records T1
         LEFT JOIN warranty_products T2 
           ON T1.serial_number COLLATE utf8mb3_unicode_ci = T2.serial_number COLLATE utf8mb3_unicode_ci
         WHERE T1.service_id = ?`,
        [serviceId]
      );

      console.log("📨 Customer data for email:", customerData);

      if (customerData?.email || customerData?.site_email) {
        // Generate feedback link
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const feedbackLink = `${baseUrl}/feedback/${serviceId}`;

        // Prepare template data
        const templateData = {
          service_id: serviceId,
          serial_number: customerData.serial_number,
          location: customerData.installed_address,
          installed_address: customerData.installed_address,
          completion_remark: completionRemark,
          completed_date: completedDate,
          feedback_link: feedbackLink,
          current_year: new Date().getFullYear(),
        };

        // Send email using template system
        await sendTemplatedEmail(
          'SERVICE_COMPLETION',
          templateData,
          {
            to: [customerData.email, customerData.site_email].filter(Boolean).join(","),
            cc: "service@dynacleanindustries.com",
          }
        );

        console.log("✅ Completion email sent");
      } else {
        console.log("⚠️ No customer email found, skipping email");
      }
    }

    return NextResponse.json({
      status: "success",
      message: "Service data saved successfully",
    });
  } catch (error) {
    console.error("❌ Caught Error:", error);
    return NextResponse.json(
      { status: "error", message: `Failed: ${error.message}` },
      { status: 500 }
    );
  } finally {
    // Don't close the pool - it's shared across all requests
    // The pool will manage connections automatically
    if (conn) {
      console.log("🔚 DB connection returned to pool");
    }
  }
}
