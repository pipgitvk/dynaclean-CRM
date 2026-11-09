export function CategoryBadge({ category }) {
  if (category === "Product") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        Product
      </span>
    );
  }
  if (category === "Spare") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
        Spare
      </span>
    );
  }
  return <span className="text-gray-400 text-xs">Other</span>;
}

export function itemLineKey(item) {
  return `${item.__source}-${item.id}`;
}

export function appendSharedReceiptFields(fd, formData, supportingDocs) {
  fd.append("received_date", formData.received_date);
  fd.append("warehouse_name", formData.warehouse_name);
  fd.append("remarks", formData.remarks);
  for (const doc of supportingDocs) {
    fd.append("supporting_docs", doc);
  }
}

export function appendLineReceiptFields(fd, { location, receivedImage }) {
  fd.append("location", location);
  fd.append("received_image", receivedImage);
}
