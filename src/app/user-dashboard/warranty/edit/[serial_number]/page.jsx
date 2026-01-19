// app/warranty/[serial_number]/page.jsx

import EditWarrantyPage from "@/components/EditWarrantyClient";

export default async function Page({ params }) {
  const { serial_number } = await params;
  console.log("serial number", serial_number);

  return <EditWarrantyPage serial_number={serial_number} />;
}
