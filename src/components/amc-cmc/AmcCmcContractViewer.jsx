"use client";

import { useState } from "react";
import Image from "next/image";
import dynacleanLogo from "@/components/logo1.jpg";
import { INVOICE_LETTERHEAD } from "@/lib/invoiceLetterhead";
import { profileAssetViewUrl } from "@/lib/profileMediaUrl";

const cell = {
  border: "1px solid #000",
  padding: "4px 8px",
  verticalAlign: "top",
  textAlign: "left",
  fontSize: "10px",
};

const labelCell = {
  ...cell,
  fontWeight: "bold",
  width: "28%",
};

const valueCell = {
  ...cell,
  fontWeight: "normal",
};

function formatDocDate(value) {
  if (!value) return "—";
  try {
    return new Date(value)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .replace(/ /g, "-");
  } catch {
    return "—";
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function contractTypeLabel(record) {
  return String(record?.contract_type || "AMC").trim().toUpperCase() === "CMC"
    ? "CMC Contract"
    : "AMC Contract";
}

function contractConditionsLabel(record) {
  return String(record?.contract_type || "AMC").trim().toUpperCase() === "CMC"
    ? "CMC Contract Conditions"
    : "AMC Contract Conditions";
}

function dash(value) {
  const v = value == null ? "" : String(value).trim();
  return v || "—";
}

export default function AmcCmcContractViewer({ record, backHref, showBackLink = true }) {
  const [logoSrc, setLogoSrc] = useState(dynacleanLogo.src);
  const title = contractTypeLabel(record);
  const conditionsTitle = contractConditionsLabel(record);
  const creatorSignatureUrl = profileAssetViewUrl(record.creator_signature || "");

  const detailRows = [
    ["Serial Number", dash(record.serial_number)],
    ["Model", dash(record.model)],
    ["Contract Period Start", formatDateTime(record.amc_start_datetime)],
    ["Contract Period End", formatDateTime(record.amc_end_datetime)],
    ["Quotation Reference", dash(record.quotation_ref)],
    ["Status", dash(record.status)],
    ["Created By", dash(record.created_by)],
    ["Created On", formatDateTime(record.created_time)],
    ["Approved By", dash(record.approved_by)],
    ["Approved On", formatDateTime(record.approved_time)],
  ];

  const termsLines = String(record.terms_and_conditions || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-[210mm] p-4 sm:p-6">
      {showBackLink && backHref ? (
        <a
          href={backHref}
          className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to list
        </a>
      ) : null}

      <div
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: "11px",
          maxWidth: "210mm",
          margin: "0 auto",
          background: "#fff",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 400,
              letterSpacing: "0.02em",
              color: "#000",
            }}
          >
            {title}
          </h1>
        </div>

        <div style={{ padding: "6mm", border: "1px solid #000", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderBottom: 0 }}>
            <tbody>
              <tr>
                <td colSpan={2} style={{ padding: "16px 24px 14px 4px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "44px" }}>
                    <div style={{ flexShrink: 0, width: 110, marginTop: "14px" }}>
                      {logoSrc ? (
                        <Image
                          src={logoSrc}
                          alt="Dynaclean"
                          width={110}
                          height={48}
                          style={{ objectFit: "contain" }}
                          onError={() => setLogoSrc("/logo1.jpg")}
                        />
                      ) : (
                        <div
                          style={{
                            width: 110,
                            minHeight: 48,
                            border: "1px solid #ddd",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#c62828",
                            fontWeight: 700,
                            fontSize: 10,
                          }}
                        >
                          DYNACLEAN
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ display: "inline-block", textAlign: "center", maxWidth: "520px" }}>
                        <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "10px" }}>
                          {INVOICE_LETTERHEAD.name}
                        </div>
                        <div style={{ fontSize: "10px", lineHeight: 1.45 }}>{INVOICE_LETTERHEAD.addressLine1}</div>
                        <div style={{ fontSize: "10px", lineHeight: 1.45, marginBottom: "5px" }}>
                          {INVOICE_LETTERHEAD.addressLine2}
                        </div>
                        <div style={{ fontSize: "10px", lineHeight: 1.45 }}>Ph: {INVOICE_LETTERHEAD.phone}</div>
                        <div style={{ fontSize: "10px", lineHeight: 1.45 }}>
                          GST: {INVOICE_LETTERHEAD.gstin}, State: {INVOICE_LETTERHEAD.state}
                        </div>
                        <div style={{ fontSize: "10px", lineHeight: 1.45 }}>CIN: {INVOICE_LETTERHEAD.cin}</div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ ...cell, width: "33%", fontWeight: "bold", borderRight: 0, borderBottom: 0 }}>
                  Contract No. : <span style={{ fontWeight: "normal" }}>AMC-CMC-{record.id}</span>
                </td>
                <td style={{ ...cell, width: "33%", fontWeight: "bold", borderRight: 0, borderBottom: 0 }}>
                  Contract Date : <span style={{ fontWeight: "normal" }}>{formatDocDate(record.created_time)}</span>
                </td>
                <td style={{ ...cell, width: "34%", fontWeight: "bold", borderBottom: 0 }}>
                  Contract Type : <span style={{ fontWeight: "normal" }}>{dash(record.contract_type || "AMC")}</span>
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, fontWeight: "bold", borderRight: 0, borderBottom: 0 }}>
                  Period Start : <span style={{ fontWeight: "normal" }}>{formatDocDate(record.amc_start_datetime)}</span>
                </td>
                <td style={{ ...cell, fontWeight: "bold", borderRight: 0, borderBottom: 0 }}>
                  Period End : <span style={{ fontWeight: "normal" }}>{formatDocDate(record.amc_end_datetime)}</span>
                </td>
                <td style={{ ...cell, fontWeight: "bold", borderBottom: 0 }}>
                  Quotation Ref. : <span style={{ fontWeight: "normal" }}>{dash(record.quotation_ref)}</span>
                </td>
              </tr>
              <tr>
                <td colSpan={3} style={{ ...cell, fontWeight: "bold" }}>
                  Status : <span style={{ fontWeight: "normal" }}>{dash(record.status)}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0, fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ ...cell, width: "50%", fontWeight: "bold", borderRight: 0, borderBottom: 0 }}>
                  Buyer (Bill To)
                </td>
                <td style={{ ...cell, width: "50%", fontWeight: "bold", borderBottom: 0 }}>
                  Site / Consignee
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, borderRight: 0, lineHeight: 1.5 }}>
                  <div>
                    <strong>Name :</strong> {dash(record.company_name)}
                  </div>
                  <div>
                    <strong>Contact :</strong> {dash(record.contact)}
                  </div>
                  <div>
                    <strong>Email :</strong> {dash(record.email)}
                  </div>
                </td>
                <td style={{ ...cell, lineHeight: 1.5 }}>
                  <div>
                    <strong>Site Address :</strong> {dash(record.site_address)}
                  </div>
                  <div>
                    <strong>Site Contact :</strong> {dash(record.site_contact)}
                  </div>
                  <div>
                    <strong>Site Email :</strong> {dash(record.site_email)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr>
                <th style={{ ...cell, width: "8%", textAlign: "center" }}>Sl No.</th>
                <th style={{ ...cell, width: "32%" }}>Description</th>
                <th style={{ ...cell }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map(([label, value], index) => (
                <tr key={label}>
                  <td style={{ ...cell, textAlign: "center" }}>{index + 1}</td>
                  <td style={{ ...cell, fontWeight: "bold" }}>{label}</td>
                  <td style={valueCell}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {record.image_at_the_time_of_amc ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <tbody>
                <tr>
                  <td style={{ ...cell, fontWeight: "bold" }}>Image at time of contract</td>
                </tr>
                <tr>
                  <td style={{ ...cell, textAlign: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={record.image_at_the_time_of_amc.startsWith("http") ? record.image_at_the_time_of_amc : `/${record.image_at_the_time_of_amc.replace(/^\//, "")}`}
                      alt="Contract"
                      style={{ maxHeight: 220, maxWidth: "100%", objectFit: "contain" }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ ...cell, width: "62%", fontWeight: "bold", borderRight: 0, verticalAlign: "top" }}>
                  {conditionsTitle}
                </td>
                <td style={{ ...cell, width: "38%", fontWeight: "bold", verticalAlign: "top", textAlign: "center" }}>
                  Signature
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, borderRight: 0, verticalAlign: "top", lineHeight: 1.45 }}>
                  {termsLines.length ? (
                    <ol style={{ margin: 0, paddingLeft: "16px" }}>
                      {termsLines.map((line, i) => (
                        <li key={`${i}-${line.slice(0, 20)}`} style={{ marginBottom: "4px" }}>
                          {line}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ ...cell, verticalAlign: "middle", textAlign: "center" }}>
                  {creatorSignatureUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={creatorSignatureUrl}
                        alt="Signature"
                        style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }}
                      />
                      <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                        <div style={{ fontWeight: "bold" }}>{dash(record.created_by)}</div>
                        <div>Authorized Signatory</div>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "9px", color: "#666" }}>—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: "12px", fontSize: "10px", fontStyle: "italic" }}>
            Thanks for doing business with us!
          </div>
          <div style={{ marginTop: "8px", fontSize: "9px", textAlign: "center", fontStyle: "italic" }}>
            This is a Computer Generated {title}
          </div>
        </div>
      </div>
    </div>
  );
}
