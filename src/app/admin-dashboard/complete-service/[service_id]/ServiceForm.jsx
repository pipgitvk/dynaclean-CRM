"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import dayjs from "dayjs";
import { generateServiceReportPDF, downloadPDF } from "@/utils/pdfGenerator";

const CHECKLIST_ITEMS = [
  "Voltage (V)",
  "Condition of Motor",
  "Check Squeegee blades / Adjust",
  "Amperages (Amps)",
  "Greasing Cleaned / Done",
  "Condition of Handle",
  "Switches Checked",
  "Filters Cleaned / Checked",
  "Condition of Wheels",
  "Condition of Elec Cable",
  "Condition of Belt",
  "Check Oil / TOP UP Done",
  "Fuse Checked",
  "Condition of Coupling / Drive Disk",
  "Check Battery Condition / Electrolyte",
  "Condition of Carbon Brush",
  "Condition of Rubber Brush",
  "Check Brush Condition",
];

const FormInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  readOnly = false,
  required = false,
  className = "",
  rows = 1,
}) => (
  <div className={`flex flex-col ${className}`}>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}:
    </label>
    {type === "textarea" ? (
      <textarea
        id={name}
        name={name}
        value={value || ""}
        onChange={onChange}
        readOnly={readOnly}
        required={required}
        rows={rows}
        className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
    ) : (
      <input
        id={name}
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        readOnly={readOnly}
        required={required}
        className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
    )}
  </div>
);

export default function ServiceForm({ service }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [trainees, setTrainees] = useState([
    { id: 1, name: "", designation: "", contact: "" },
  ]);

  const addTrainee = () => {
    setTrainees([
      ...trainees,
      { id: Date.now(), name: "", designation: "", contact: "" },
    ]);
  };

  const removeTrainee = (id) => {
    setTrainees(trainees.filter((trainee) => trainee.id !== id));
  };

  const handleTraineeChange = (id, field, value) => {
    setTrainees(
      trainees.map((trainee) =>
        trainee.id === id ? { ...trainee, [field]: value } : trainee
      )
    );
  };

  const [formData, setFormData] = useState({
    service_id: service.service_id,
    serial_number: service.serial_number,
    status: service.status || "PENDING",
    completion_remark: service.completion_remark || "",
    completed_date: service.completed_date || dayjs().format("YYYY-MM-DD"),
    checklist: service.checklist?.split(",") || [],
    nature_of_complaint: service.nature_of_complaint || "",
    observation: service.observation || "",
    action_taken: service.action_taken || "",
    service_rating: service.service_rating || "",
    customer_feedback: service.customer_feedback || "",
    authorized_person_name: service.authorized_person_name || "",
    authorized_person_designation: service.authorized_person_designation || "",
    authorized_person_mobile: service.authorized_person_mobile || "",
    customer_name: service.customer_name || "",
    customer_designation: service.customer_designation || "",
    customer_mobile: service.customer_mobile || "",
    // NEW: Fields for completion status
    completion_engineer_name: "",
    completion_engineer_designation: "",
    completion_engineer_mobile: "",
    completion_customer_name: "",
    completion_customer_designation: "",
    completion_customer_mobile: "",
    // NEW: Location fields
    latitude: "",
    longitude: "",
    location_address: "",
  });

  const [spareParts, setSpareParts] = useState(
    service.spare_replaced && service.spare_to_be_replaced
      ? service.spare_replaced.split(",").map((replaced, index) => ({
          replaced,
          tobereplaced: service.spare_to_be_replaced.split(",")[index] || "",
        }))
      : [{ replaced: "", tobereplaced: "" }]
  );

  const [files, setFiles] = useState({});
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  const engineerSignaturePadRef = useRef(null);
  const customerSignaturePadRef = useRef(null);
  const completionEngineerSignaturePadRef = useRef(null); // NEW
  const completionCustomerSignaturePadRef = useRef(null); // NEW

  const engineerCanvasRef = useRef(null);
  const customerCanvasRef = useRef(null);
  const completionEngineerCanvasRef = useRef(null); // NEW
  const completionCustomerCanvasRef = useRef(null); // NEW

  const resizeCanvas = (canvas) => {
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
  };

  useEffect(() => {
    // Original signature pads (for PENDING statuses)
    if (formData.status !== "COMPLETED") {
      if (engineerCanvasRef.current) {
        resizeCanvas(engineerCanvasRef.current);
        engineerSignaturePadRef.current = new SignaturePad(
          engineerCanvasRef.current
        );
      }
      if (customerCanvasRef.current) {
        resizeCanvas(customerCanvasRef.current);
        customerSignaturePadRef.current = new SignaturePad(
          customerCanvasRef.current
        );
      }
    } else {
      // NEW: Initialize completion signature pads
      if (completionEngineerCanvasRef.current) {
        resizeCanvas(completionEngineerCanvasRef.current);
        completionEngineerSignaturePadRef.current = new SignaturePad(
          completionEngineerCanvasRef.current
        );
      }
      if (completionCustomerCanvasRef.current) {
        resizeCanvas(completionCustomerCanvasRef.current);
        completionCustomerSignaturePadRef.current = new SignaturePad(
          completionCustomerCanvasRef.current
        );
      }
    }

    return () => {
      if (engineerSignaturePadRef.current)
        engineerSignaturePadRef.current.off();
      if (customerSignaturePadRef.current)
        customerSignaturePadRef.current.off();
      if (completionEngineerSignaturePadRef.current)
        completionEngineerSignaturePadRef.current.off();
      if (completionCustomerSignaturePadRef.current)
        completionCustomerSignaturePadRef.current.off();
    };
  }, [formData.status]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "status" && value === "COMPLETED") {
      setFormData((prev) => ({
        ...prev,
        status: "COMPLETED",
        completion_remark: "",
        completed_date: dayjs().format("YYYY-MM-DD"),
        // 🔑 keep checklist, complaint, observation, spares, etc.
        completion_engineer_name: "",
        completion_engineer_designation: "",
        completion_engineer_mobile: "",
        completion_customer_name: "",
        completion_customer_designation: "",
        completion_customer_mobile: "",
      }));

      // clear only signatures
      if (engineerSignaturePadRef.current)
        engineerSignaturePadRef.current.clear();
      if (customerSignaturePadRef.current)
        customerSignaturePadRef.current.clear();
      if (completionEngineerSignaturePadRef.current)
        completionEngineerSignaturePadRef.current.clear();
      if (completionCustomerSignaturePadRef.current)
        completionCustomerSignaturePadRef.current.clear();
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleChecklistChange = (e) => {
    const { name, checked } = e.target;
    const item = name.replace("checklist_", "");
    const newChecklist = checked
      ? [...(formData.checklist || []), item]
      : (formData.checklist || []).filter((i) => i !== item);

    setFormData((prevData) => ({
      ...prevData,
      checklist: newChecklist,
    }));
  };

  const handleSparePartChange = (index, e) => {
    const { name, value } = e.target;
    const newSpareParts = [...spareParts];
    newSpareParts[index][name] = value;
    setSpareParts(newSpareParts);
  };

  const addSparePartRow = () => {
    if (spareParts.length < 5) {
      setSpareParts([...spareParts, { replaced: "", tobereplaced: "" }]);
    }
  };

  const clearSignature = (type) => {
    if (type === "engineer" && engineerSignaturePadRef.current)
      engineerSignaturePadRef.current.clear();
    if (type === "customer" && customerSignaturePadRef.current)
      customerSignaturePadRef.current.clear();
    if (
      type === "completion_engineer" &&
      completionEngineerSignaturePadRef.current
    )
      completionEngineerSignaturePadRef.current.clear();
    if (
      type === "completion_customer" &&
      completionCustomerSignaturePadRef.current
    )
      completionCustomerSignaturePadRef.current.clear();
  };

  // Location fetching functions
  const getCurrentLocation = () => {
    setIsLocationLoading(true);
    
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      setIsLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Get reverse geocoding to get address
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          
          const address = `${data.locality || ''} ${data.city || ''} ${data.principalSubdivision || ''} ${data.countryName || ''}`.trim();
          
          setFormData(prev => ({
            ...prev,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            location_address: address || `${latitude}, ${longitude}`
          }));
          
          console.log("📍 Location fetched:", { latitude, longitude, address });
        } catch (error) {
          console.error("❌ Error getting address:", error);
          setFormData(prev => ({
            ...prev,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            location_address: `${latitude}, ${longitude}`
          }));
        }
        
        setIsLocationLoading(false);
      },
      (error) => {
        console.error("❌ Error getting location:", error);
        let errorMessage = "Unable to retrieve your location.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        
        alert(errorMessage);
        setIsLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const clearLocation = () => {
    setFormData(prev => ({
      ...prev,
      latitude: "",
      longitude: "",
      location_address: ""
    }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    const fileArray = Array.from(selectedFiles).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFiles((prevFiles) => ({
      ...prevFiles,
      [name]: fileArray,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    const data = new FormData();

    // ✅ Always append common fields
    data.append("service_id", formData.service_id);
    data.append("serial_number", formData.serial_number);
    data.append("status", formData.status);
    data.append("service_type", service.service_type || "");
    // ✅ Service date used in reports (today by default; completed_date if completed)
    const reportServiceDate =
      formData.status === "COMPLETED"
        ? (formData.completed_date || dayjs().format("YYYY-MM-DD"))
        : dayjs().format("YYYY-MM-DD");
    data.append("service_date", reportServiceDate);
    // ✅ Checklist
    data.append("checklist", (formData.checklist || []).join(","));

    // ✅ Spare parts
    data.append("spare_replaced", spareParts.map((p) => p.replaced).join(","));
    data.append(
      "spare_to_be_replaced",
      spareParts.map((p) => p.tobereplaced).join(",")
    );

    if (service.service_type === "INSTALLATION") {
      data.append("trainees", JSON.stringify(trainees));
      data.append("defects_on_inspection", formData.defects_found || "");
      data.append("engineer_remarks", formData.engineers_remark || "");
    }

    // ✅ Service details (always included)
    data.append("nature_of_complaint", formData.nature_of_complaint || "");
    data.append("observation", formData.observation || "");
    data.append("action_taken", formData.action_taken || "");
    data.append("service_rating", formData.service_rating || "");
    data.append("customer_feedback", formData.customer_feedback || "");

    // ✅ Location data (always included)
    data.append("latitude", formData.latitude || "");
    data.append("longitude", formData.longitude || "");
    data.append("location_address", formData.location_address || "");

    // ✅ File uploads
    Object.keys(files).forEach((key) => {
      files[key].forEach((item) => {
        data.append(key, item.file);
      });
    });

    if (formData.status === "COMPLETED") {
      // COMPLETED CASE
      data.append("completion_remark", formData.completion_remark || "");
      data.append("completed_date", formData.completed_date || "");

      // Engineer (mapped to authorized_person_* for backend compatibility)
      data.append(
        "authorized_person_name",
        formData.completion_engineer_name || ""
      );
      data.append(
        "authorized_person_designation",
        formData.completion_engineer_designation || ""
      );
      data.append(
        "authorized_person_mobile",
        formData.completion_engineer_mobile || ""
      );

      // Customer
      data.append("customer_name", formData.completion_customer_name || "");
      data.append(
        "customer_designation",
        formData.completion_customer_designation || ""
      );
      data.append("customer_mobile", formData.completion_customer_mobile || "");

      // ✅ Signatures
      if (
        completionEngineerSignaturePadRef.current &&
        !completionEngineerSignaturePadRef.current.isEmpty()
      ) {
        data.append(
          "authorized_person_sign",
          completionEngineerSignaturePadRef.current.toDataURL()
        );
      }
      if (
        completionCustomerSignaturePadRef.current &&
        !completionCustomerSignaturePadRef.current.isEmpty()
      ) {
        data.append(
          "customer_sign",
          completionCustomerSignaturePadRef.current.toDataURL()
        );
      }
    } else {
      // PENDING or PENDING FOR SPARES
      data.append(
        "authorized_person_name",
        formData.authorized_person_name || ""
      );
      data.append(
        "authorized_person_designation",
        formData.authorized_person_designation || ""
      );
      data.append(
        "authorized_person_mobile",
        formData.authorized_person_mobile || ""
      );

      data.append("customer_name", formData.customer_name || "");
      data.append("customer_designation", formData.customer_designation || "");
      data.append("customer_mobile", formData.customer_mobile || "");

      if (
        engineerSignaturePadRef.current &&
        !engineerSignaturePadRef.current.isEmpty()
      ) {
        data.append(
          "authorized_person_sign",
          engineerSignaturePadRef.current.toDataURL()
        );
      }
      if (
        customerSignaturePadRef.current &&
        !customerSignaturePadRef.current.isEmpty()
      ) {
        data.append(
          "customer_sign",
          customerSignaturePadRef.current.toDataURL()
        );
      }
    }

    // 🔎 Debug log
    console.log("🚀 Submitting form with data:");
    for (let [key, value] of data.entries()) {
      if (value instanceof File) {
        console.log(`${key}: [File] ${value.name}, size: ${value.size}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    try {
      const response = await fetch(
        `/api/complete-service/${service.service_id}/action`,
        {
          method: "POST",
          body: data,
        }
      );

      if (!response.ok) throw new Error("Failed to save service record.");
      
      // Generate PDF after successful save
      try {
        // Get signature data URLs
        let engineerSignatureData = null;
        let customerSignatureData = null;
        
        if (formData.status === "COMPLETED") {
          if (completionEngineerSignaturePadRef.current && !completionEngineerSignaturePadRef.current.isEmpty()) {
            engineerSignatureData = completionEngineerSignaturePadRef.current.toDataURL();
          }
          if (completionCustomerSignaturePadRef.current && !completionCustomerSignaturePadRef.current.isEmpty()) {
            customerSignatureData = completionCustomerSignaturePadRef.current.toDataURL();
          }
        } else {
          if (engineerSignaturePadRef.current && !engineerSignaturePadRef.current.isEmpty()) {
            engineerSignatureData = engineerSignaturePadRef.current.toDataURL();
          }
          if (customerSignaturePadRef.current && !customerSignaturePadRef.current.isEmpty()) {
            customerSignatureData = customerSignaturePadRef.current.toDataURL();
          }
        }
        
        const pdfData = {
          service_id: formData.service_id,
          serial_number: formData.serial_number,
          status: formData.status,
          complaint_date: reportServiceDate,
          complaint_number: service.complaint_number,
          service_type: service.service_type,
          reg_date: service.reg_date,
          completed_date: formData.completed_date,
          checklist: (formData.checklist || []).join(","),
          nature_of_complaints: formData.nature_of_complaint,
          observation: formData.observation,
          action_taken: formData.action_taken,
          complaint_summary: formData.complaint_summary,
          completion_remark: formData.completion_remark,
          replaced: spareParts.map((p) => p.replaced).join(","),
          to_be_replaced: spareParts.map((p) => p.tobereplaced).join(","),
          service_rate: formData.service_rating,
          feedback: formData.customer_feedback,
          authorised_person_name: formData.status === "COMPLETED" ? formData.completion_engineer_name : formData.authorized_person_name,
          authorised_person_designation: formData.status === "COMPLETED" ? formData.completion_engineer_designation : formData.authorized_person_designation,
          authorised_person_mobile: formData.status === "COMPLETED" ? formData.completion_engineer_mobile : formData.authorized_person_mobile,
          customer_name: formData.status === "COMPLETED" ? formData.completion_customer_name : formData.customer_name,
          customer_designation: formData.status === "COMPLETED" ? formData.completion_customer_designation : formData.customer_designation,
          customer_mobile: formData.status === "COMPLETED" ? formData.completion_customer_mobile : formData.customer_mobile,
          authorised_person_sign_data: engineerSignatureData,
          customer_sign_data: customerSignatureData,
        };

        const productData = {
          product_name: service.product?.product_name,
          model: service.product?.model,
          customer_name: service.product?.customer_name,
          email: service.product?.email,
          contact: service.product?.contact,
          customer_address: service.product?.customer_address,
          installed_address: service.product?.installed_address,
          installation_date: service.product?.installation_date,
          invoice_number: service.product?.invoice_number,
          invoice_date: service.product?.invoice_date,
        };

        let installData = null;
        if (service.service_type === "INSTALLATION") {
          installData = {
            defects_on_inspection: formData.defects_found,
            engineer_remarks: formData.engineers_remark,
          };
        }

        console.log("🔍 PDF Data Debug:", {
          pdfData,
          productData,
          installData,
          trainees,
          checklist: formData.checklist,
          service_rating: formData.service_rating,
          hasEngineerSignature: !!engineerSignatureData,
          hasCustomerSignature: !!customerSignatureData,
          engineerSignatureLength: engineerSignatureData?.length,
          customerSignatureLength: customerSignatureData?.length
        });

        const pdf = await generateServiceReportPDF(pdfData, productData, installData, trainees);
        const filename = `Service_Report_${formData.service_id}_${dayjs().format('YYYY-MM-DD')}.pdf`;
        
        // Save PDF to server
        const pdfBlob = pdf.output('blob');
        const pdfFormData = new FormData();
        pdfFormData.append('pdf', pdfBlob, filename);
        pdfFormData.append('service_id', formData.service_id);

        // await fetch('/api/save-pdf', {
        //   method: 'POST',
        //   body: pdfFormData,
        // });

        // Download PDF to user
        downloadPDF(pdf, filename);
      } catch (pdfError) {
        console.error("❌ PDF generation error:", pdfError);
        // Don't fail the entire submission if PDF generation fails
      }

      setSubmitted(true);
      router.push("/admin-dashboard/view_service_reports");
    } catch (error) {
      console.error("❌ Submission error:", error);
      alert("Failed to save service record. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const FileUploader = ({ label, name, multiple, required, accept }) => (
    <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg hover:border-blue-400 transition">
      <label className="block font-medium mb-2">{label}</label>
      <input
        type="file"
        name={name}
        multiple={multiple}
        required={required}
        accept={accept || "image/*"}
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-600 
         file:mr-4 file:py-2 file:px-4
         file:rounded-full file:border-0
         file:text-sm file:font-semibold
         file:bg-blue-50 file:text-blue-700
         hover:file:bg-blue-100"
      />
      {files[name] && files[name].length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {files[name].map((item, idx) => (
            <div
              key={idx}
              className="w-24 h-24 border border-gray-300 rounded overflow-hidden"
            >
              <img
                src={item.preview}
                alt={`Preview ${idx}`}
                className="object-cover w-full h-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    return () => {
      Object.values(files)
        .flat()
        .forEach((item) => {
          if (item.preview) {
            URL.revokeObjectURL(item.preview);
          }
        });
    };
  }, [files]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center ">
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg w-full max-w-4xl p-4">
        <form
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="space-y-4"
        >
          <input type="hidden" name="service_id" value={service.service_id} />
          
          {/* Status Selection */}
          <div className="p-4 border rounded-md bg-gray-50">
            <label className="block mb-1 font-medium text-sm">Status</label>
            <select
              name="status"
              className="border p-2 w-full rounded text-sm"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="PENDING">PENDING</option>
              <option value="PENDING FOR SPARES">PENDING FOR SPARES</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>

          {/* Location Section */}
          {service.service_type === "INSTALLATION" ? (
            <>
              <div className="p-4 border rounded-md bg-blue-50">
              <h3 className="text-lg font-semibold mb-3 text-sm">📍 SERVICE LOCATION</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isLocationLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
                  >
                    {isLocationLoading ? "Getting Location..." : "📍 Get Current Location"}
                  </button>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm font-medium transition-colors"
                  >
                    Clear Location
                  </button>
                </div>
                
                {formData.location_address && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address:
                      </label>
                      <div className="p-2 bg-white border rounded text-sm text-gray-600">
                        {formData.location_address}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Latitude:
                        </label>
                        <input
                          type="text"
                          value={formData.latitude}
                          onChange={handleChange}
                          name="latitude"
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="Latitude"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Longitude:
                        </label>
                        <input
                          type="text"
                          value={formData.longitude}
                          onChange={handleChange}
                          name="longitude"
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="Longitude"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </>
            ) : null}
          
          {formData.status === "COMPLETED" ? (
            <>
              <div>
                <label className="block mb-1 font-medium text-sm">
                  Completion Remark
                </label>
                <textarea
                  name="completion_remark"
                  rows="4"
                  className="border p-2 w-full rounded text-sm"
                  value={formData.completion_remark}
                  onChange={handleChange}
                  required
                ></textarea>
              </div>

              <div>
                <label className="block mb-1 font-medium text-sm">
                  Completed Date
                </label>
                <input
                  type="date"
                  name="completed_date"
                  className="border p-2 w-full rounded text-sm"
                  value={formData.completed_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <FileUploader
                label="Pre-Completion Images"
                name="pre_completion_images"
                multiple
                required={!files["pre_completion_images"]?.length}
              />
              <FileUploader
                label="After Completion Images"
                name="after_completion_images"
                multiple
                required={!files["after_completion_images"]?.length}
              />
            </>
          ) : (
            <FileUploader
              label="Upload Service Images"
              name="completion_images"
              multiple
            />
          )}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3 text-sm">
              CHECKLIST
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {CHECKLIST_ITEMS.map((item, index) => (
                <label
                  key={index}
                  className="flex items-center text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    name={`checklist_${item}`}
                    checked={formData.checklist?.includes(item)}
                    onChange={handleChecklistChange}
                    disabled={service.status === "COMPLETED"}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3 text-sm">
              SERVICE RENDERED
            </h3>
            <div className="space-y-4">
              <FormInput
                label="Nature of Complaint"
                name="nature_of_complaint"
                value={formData.nature_of_complaint}
                onChange={handleChange}
                readOnly={service.status === "COMPLETED"}
                required
              />
              <FormInput
                label="Observation"
                name="observation"
                value={formData.observation}
                onChange={handleChange}
                readOnly={service.status === "COMPLETED"}
                required
              />
              <FormInput
                label="Action Taken"
                name="action_taken"
                value={formData.action_taken}
                onChange={handleChange}
                readOnly={service.status === "COMPLETED"}
                required
              />
            </div>
          </div>
          {/* this is */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <div className="md:hidden">
              {/* Stacked layout for small screens (mobile) */}
              {spareParts.map((part, index) => (
                <div
                  key={index}
                  className="mb-4 p-4 border rounded-lg shadow-sm bg-white"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500">
                      S. No.
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {index + 1}
                    </span>
                  </div>

                  <div className="mb-2">
                    <label
                      htmlFor={`replaced-${index}`}
                      className="block text-xs font-medium text-gray-500 mb-1"
                    >
                      REPLACED
                    </label>
                    <input
                      id={`replaced-${index}`}
                      type="text"
                      name="replaced"
                      data-index={index}
                      value={part.replaced}
                      onChange={(e) => handleSparePartChange(index, e)}
                      readOnly={service.status === "COMPLETED"}
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`tobereplaced-${index}`}
                      className="block text-xs font-medium text-gray-500 mb-1"
                    >
                      TO BE REPLACED
                    </label>
                    <input
                      id={`tobereplaced-${index}`}
                      type="text"
                      name="tobereplaced"
                      data-index={index}
                      value={part.tobereplaced}
                      onChange={(e) => handleSparePartChange(index, e)}
                      readOnly={service.status === "COMPLETED"}
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* new section foro the training */}
            {service.service_type === "INSTALLATION" ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Defects Found on Inspection
                  </label>
                  <textarea
                    name="defects_found"
                    value={formData.defects_found || ""}
                    onChange={handleChange}
                    placeholder="Enter defects observed during inspection"
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={3}
                  />
                </div>
                {/* ✅ Engineer's Remark */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Engineer&apos;s Remark
                  </label>
                  <textarea
                    name="engineers_remark"
                    value={formData.engineers_remark || ""}
                    onChange={handleChange}
                    placeholder="Enter engineer's remarks"
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={3}
                  />
                </div>
                <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg p-4 sm:p-6">
                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-left border-collapse"
                      id="traineesTable"
                    >
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tl-lg">
                            S. No.
                          </th>
                          <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                            NAME OF TRAINEES
                          </th>
                          <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                            DESIGNATION
                          </th>
                          <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tr-lg">
                            CONTACT NO.
                          </th>
                          <th className="p-2 sm:p-3 border-b-2 border-gray-300"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainees.map((trainee, index) => (
                          <tr
                            key={trainee.id}
                            className="border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200"
                          >
                            <td className="p-2 sm:p-3 text-gray-600">
                              {index + 1}
                            </td>
                            <td className="p-2 sm:p-3">
                              <input
                                type="text"
                                value={trainee.name}
                                onChange={(e) =>
                                  handleTraineeChange(
                                    trainee.id,
                                    "name",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded-md p-1 sm:p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                placeholder="Enter name"
                              />
                            </td>
                            <td className="p-2 sm:p-3">
                              <input
                                type="text"
                                value={trainee.designation}
                                onChange={(e) =>
                                  handleTraineeChange(
                                    trainee.id,
                                    "designation",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded-md p-1 sm:p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                placeholder="Enter designation"
                                required
                              />
                            </td>
                            <td className="p-2 sm:p-3">
                              <input
                                type="text"
                                value={trainee.contact}
                                onChange={(e) =>
                                  handleTraineeChange(
                                    trainee.id,
                                    "contact",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded-md p-1 sm:p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                placeholder="Enter contact number"
                                required
                              />
                            </td>
                            <td className="p-2 sm:p-3 text-center">
                              {trainees.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTrainee(trainee.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white font-bold p-1 rounded-full w-6 h-6 flex items-center justify-center transition-transform duration-200 hover:scale-110"
                                  aria-label="Remove trainee"
                                >
                                  &times;
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-6 flex justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={addTrainee}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Add Trainee ➕
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <></>
            )}

            {/* end of new sectiomn */}

            {service.service_type !== "INSTALLATION" && service.status !== "COMPLETED" && (

            <div className="hidden md:block overflow-x-auto">
              {/* Traditional table layout for medium and larger screens */}
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S. No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      REPLACED
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TO BE REPLACED
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {spareParts.map((part, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          name="replaced"
                          data-index={index}
                          value={part.replaced}
                          onChange={(e) => handleSparePartChange(index, e)}
                          readOnly={service.status === "COMPLETED"}
                          className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          name="tobereplaced"
                          data-index={index}
                          value={part.tobereplaced}
                          onChange={(e) => handleSparePartChange(index, e)}
                          readOnly={service.status === "COMPLETED"}
                          className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {service.service_type !== "INSTALLATION" && service.status !== "COMPLETED" && (
              <button
                type="button"
                onClick={addSparePartRow}
                disabled={spareParts.length >= 5}
                className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:bg-gray-400 text-sm"
              >
                Add Row
              </button>
            )}
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">
              <strong>Please Rate the service:</strong>
            </label>
            <div className="mt-2 flex flex-wrap gap-4">
              {[
                "extremelySatisfied",
                "satisfied",
                "dissatisfied",
                "annoyed",
              ].map((rating) => (
                <label
                  key={rating}
                  className="flex items-center text-sm text-gray-700 capitalize"
                >
                  <input
                    type="radio"
                    name="service_rating"
                    value={rating}
                    checked={formData.service_rating === rating}
                    onChange={handleChange}
                    disabled={service.status === "COMPLETED"}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  {rating.replace(/([A-Z])/g, " $1").trim()}
                </label>
              ))}
            </div>
          </div>
          <FormInput
            label="Customer Feedback"
            name="customer_feedback"
            value={formData.customer_feedback}
            onChange={handleChange}
            readOnly={service.status === "COMPLETED"}
            required
            className="mt-4"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6">
            {/* Conditional Rendering for PENDING Status */}
            {formData.status !== "COMPLETED" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-sm">
                    Authorized Person (Engineer)
                  </h3>
                  {service.authorized_person_sign ? (
                    <img
                      src={`/signatures/${service.authorized_person_sign}`}
                      alt="Authorized Person Signature"
                      className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 engineer-signature-placeholder">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Signature:
                      </label>
                      <canvas
                        ref={engineerCanvasRef}
                        width="400"
                        height="200"
                        className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                      />
                      <div className="mt-2 flex justify-end no-print">
                        <button
                          type="button"
                          onClick={() => clearSignature("engineer")}
                          className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  <FormInput
                    label="Name"
                    name="authorized_person_name"
                    value={formData.authorized_person_name}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                  <FormInput
                    label="Designation"
                    name="authorized_person_designation"
                    value={formData.authorized_person_designation}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                  <FormInput
                    label="Mobile"
                    name="authorized_person_mobile"
                    value={formData.authorized_person_mobile}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-sm">
                    Customer
                  </h3>
                  {service.customer_sign ? (
                    <img
                      src={`/signatures/${service.customer_sign}`}
                      alt="Customer Signature"
                      className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 customer-signature-placeholder">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Signature:
                      </label>
                      <canvas
                        ref={customerCanvasRef}
                        width="400"
                        height="200"
                        className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                      />
                      <div className="mt-2 flex justify-end no-print">
                        <button
                          type="button"
                          onClick={() => clearSignature("customer")}
                          className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  <FormInput
                    label="Name"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                  <FormInput
                    label="Designation"
                    name="customer_designation"
                    value={formData.customer_designation}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                  <FormInput
                    label="Mobile"
                    name="customer_mobile"
                    value={formData.customer_mobile}
                    onChange={handleChange}
                    readOnly={service.status === "COMPLETED"}
                    required
                  />
                </div>
              </>
            )}

            {/* NEW: Dedicated Signature Section for "COMPLETED" Status */}
            {formData.status === "COMPLETED" && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-sm">
                    Authorized Person (Engineer)
                  </h3>
                  <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature:
                    </label>
                    <canvas
                      ref={completionEngineerCanvasRef}
                      width="400"
                      height="200"
                      className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                    />
                    <div className="mt-2 flex justify-end no-print">
                      <button
                        type="button"
                        onClick={() => clearSignature("completion_engineer")}
                        className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <FormInput
                    label="Name"
                    name="completion_engineer_name"
                    value={formData.completion_engineer_name}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Designation"
                    name="completion_engineer_designation"
                    value={formData.completion_engineer_designation}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Mobile"
                    name="completion_engineer_mobile"
                    value={formData.completion_engineer_mobile}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-sm">
                    Customer
                  </h3>
                  <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature:
                    </label>
                    <canvas
                      ref={completionCustomerCanvasRef}
                      width="400"
                      height="200"
                      className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                    />
                    <div className="mt-2 flex justify-end no-print">
                      <button
                        type="button"
                        onClick={() => clearSignature("completion_customer")}
                        className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <FormInput
                    label="Name"
                    name="completion_customer_name"
                    value={formData.completion_customer_name}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Designation"
                    name="completion_customer_designation"
                    value={formData.completion_customer_designation}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Mobile"
                    name="completion_customer_mobile"
                    value={formData.completion_customer_mobile}
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition disabled:bg-gray-400 no-print"
          >
            {isLoading ? "Saving..." : "Save Service"}
          </button>
        </form>
      </div>
    </div>
  );
}
