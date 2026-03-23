"use client";

export function initialImportQuoteForm() {
  return {
    shipment_id: "",
    agent_id: "",
    ocean_freight: "",
    origin_cfs: "",
    origin_customs: "",
    origin_docs: "",
    origin_vgm: "",
    destination_cc_fee: "",
    destination_thc: "",
    destination_do_fee: "",
    destination_deconsole_fee: "",
    destination_gst: "",
    clearance_agency: "",
    clearance_loading: "",
    clearance_edi: "",
    clearance_exam: "",
    clearance_cfs_actual: "",
    clearance_transport_actual: "",
    clearance_misc: "",
    exchange_rate: "",
    total_cost_inr: "",
    remarks: "",
  };
}

export const importQuoteInputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", step, readOnly }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        className={`${importQuoteInputClass}${readOnly ? " cursor-not-allowed bg-slate-50 text-slate-600" : ""}`}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        autoComplete="off"
        readOnly={readOnly}
      />
    </div>
  );
}

/**
 * Same field groups as the public supplier import-quote form.
 */
export function ImportCrmPublicQuoteFormSections({
  form,
  update,
  shipmentIdReadOnly = false,
  hideShipmentIdField = false,
}) {
  return (
    <>
      <Section title="Shipment">
        {hideShipmentIdField ? null : (
          <Field
            label="Shipment ID"
            name="shipment_id"
            value={form.shipment_id}
            onChange={update}
            readOnly={shipmentIdReadOnly}
          />
        )}
        <Field
          label="Agent ID"
          name="agent_id"
          value={form.agent_id}
          onChange={update}
        />
      </Section>

      <Section title="Ocean & origin">
        <Field
          label="Ocean freight"
          name="ocean_freight"
          type="number"
          step="0.01"
          value={form.ocean_freight}
          onChange={update}
        />
        <Field
          label="Origin CFS"
          name="origin_cfs"
          type="number"
          step="0.01"
          value={form.origin_cfs}
          onChange={update}
        />
        <Field
          label="Origin customs"
          name="origin_customs"
          type="number"
          step="0.01"
          value={form.origin_customs}
          onChange={update}
        />
        <Field
          label="Origin docs"
          name="origin_docs"
          type="number"
          step="0.01"
          value={form.origin_docs}
          onChange={update}
        />
        <Field
          label="Origin VGM"
          name="origin_vgm"
          type="number"
          step="0.01"
          value={form.origin_vgm}
          onChange={update}
        />
      </Section>

      <Section title="Destination">
        <Field
          label="Destination CC fee"
          name="destination_cc_fee"
          type="number"
          step="0.01"
          value={form.destination_cc_fee}
          onChange={update}
        />
        <Field
          label="Destination THC"
          name="destination_thc"
          type="number"
          step="0.01"
          value={form.destination_thc}
          onChange={update}
        />
        <Field
          label="Destination DO fee"
          name="destination_do_fee"
          type="number"
          step="0.01"
          value={form.destination_do_fee}
          onChange={update}
        />
        <Field
          label="Destination deconsole fee"
          name="destination_deconsole_fee"
          type="number"
          step="0.01"
          value={form.destination_deconsole_fee}
          onChange={update}
        />
        <Field
          label="Destination GST"
          name="destination_gst"
          type="number"
          step="0.01"
          value={form.destination_gst}
          onChange={update}
        />
      </Section>

      <Section title="Clearance">
        <Field
          label="Clearance agency"
          name="clearance_agency"
          type="number"
          step="0.01"
          value={form.clearance_agency}
          onChange={update}
        />
        <Field
          label="Clearance loading"
          name="clearance_loading"
          type="number"
          step="0.01"
          value={form.clearance_loading}
          onChange={update}
        />
        <Field
          label="Clearance EDI"
          name="clearance_edi"
          type="number"
          step="0.01"
          value={form.clearance_edi}
          onChange={update}
        />
        <Field
          label="Clearance exam"
          name="clearance_exam"
          type="number"
          step="0.01"
          value={form.clearance_exam}
          onChange={update}
        />
        <Field
          label="Clearance CFS (actual)"
          name="clearance_cfs_actual"
          type="number"
          step="0.01"
          value={form.clearance_cfs_actual}
          onChange={update}
        />
        <Field
          label="Clearance transport (actual)"
          name="clearance_transport_actual"
          type="number"
          step="0.01"
          value={form.clearance_transport_actual}
          onChange={update}
        />
        <Field
          label="Clearance misc"
          name="clearance_misc"
          type="number"
          step="0.01"
          value={form.clearance_misc}
          onChange={update}
        />
      </Section>

      <Section title="Totals">
        <Field
          label="Exchange rate"
          name="exchange_rate"
          type="number"
          step="0.000001"
          value={form.exchange_rate}
          onChange={update}
        />
        <Field
          label="Total cost (INR)"
          name="total_cost_inr"
          type="number"
          step="0.01"
          value={form.total_cost_inr}
          onChange={update}
        />
      </Section>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Remarks
        </label>
        <textarea
          name="remarks"
          rows={4}
          className={`${importQuoteInputClass} min-h-[5rem] py-2`}
          value={form.remarks}
          onChange={(e) => update("remarks", e.target.value)}
        />
      </div>
    </>
  );
}
