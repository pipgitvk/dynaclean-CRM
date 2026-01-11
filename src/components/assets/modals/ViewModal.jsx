// src/app/components/assets/modals/ViewModal.jsx
"use client";

export default function ViewModal({ asset }) {
  if (!asset) return null;

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 text-gray-800">Asset Details</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-6 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">Category</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.asset_category || asset.type}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Asset Name</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.asset_name}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Brand</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.brand_name}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600">Tag Number</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.asset_tag_number}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Model Name</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.model_name}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Color</p>
            <p className="text-lg font-medium text-gray-900">{asset.color || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Condition</p>
            <p className="text-lg font-medium text-gray-900">{asset.asset_condition}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Invoice Number
            </p>
            <p className="text-lg font-medium text-gray-900">
              {asset.invoice_number}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Purchase Price
            </p>
            <p className="text-lg font-medium text-gray-900">
              Rs. {asset.purchase_price}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Purchase Date</p>
            <p className="text-lg font-medium text-gray-900">
              {new Date(asset.purchase_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Serial</p>
            <p className="text-lg font-medium text-gray-900">{asset.serial_number || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Purchase From</p>
            <p className="text-lg font-medium text-gray-900">
              {asset.purchased_from}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Warrenty Period
            </p>
            <p className="text-lg font-medium text-gray-900">
              {asset.warranty_period}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Associated Email
            </p>
            <p className="text-lg font-medium text-gray-900">
              {asset.associated_email}
            </p>
          </div>
        </div>

        {/* Category specific views */}
        {asset.asset_category === 'Mobile' && (
          <div className="p-4 bg-gray-50 rounded-md">
            <p className="font-bold mb-2 text-gray-700">Mobile</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-semibold">SIM 1:</span> {asset.sim_no_1 || '-'}</div>
              <div><span className="font-semibold">SIM 2:</span> {asset.sim_no_2 || '-'}</div>
              <div><span className="font-semibold">IMEI 1:</span> {asset.imei_no_1 || '-'}</div>
              <div><span className="font-semibold">IMEI 2:</span> {asset.imei_no_2 || '-'}</div>
              <div><span className="font-semibold">WhatsApp:</span> {asset.whatsapp_no_normal || '-'}</div>
              <div><span className="font-semibold">WA Business:</span> {asset.whatsapp_no_business || '-'}</div>
            </div>
            {asset.login_gmails && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-gray-700">Login Gmails</p>
                <ul className="list-disc list-inside text-sm">
                  {String(asset.login_gmails).split(',').filter(Boolean).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Assignment Info */}
        <div className="p-4 bg-gray-50 rounded-md">
          <p className="font-bold mb-2 text-gray-700">Assignment Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Assigned To</p>
              <p className="text-base text-gray-900">
                {asset.Assigned_to || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">
                Assigned Date
              </p>
              <p className="text-base text-gray-900">
                {asset.Assigned_Date
                  ? new Date(asset.Assigned_Date).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Attachment Links */}
        <div className="p-4 bg-gray-50 rounded-md">
          <p className="font-bold mb-2 text-gray-700">Attachments</p>
          {asset.invoice_attachment_path && (
            <a
              href={asset.invoice_attachment_path}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              Invoice Attachment
            </a>
          )}
          {asset.warranty_card_path && (
            <a
              href={asset.warranty_card_path}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              Warranty Card
            </a>
          )}
          {asset.user_manual_path && (
            <a
              href={asset.user_manual_path}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              User Manual
            </a>
          )}
          {asset.asset_photos_paths &&
            JSON.parse(asset.asset_photos_paths).map((path, index) => (
              <a
                key={index}
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                Photo {index + 1}
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}
