"use client";

import { useSearchParams } from "next/navigation";
import {
  User,
  Phone,
  Building,
  CalendarDays,
  MapPin,
  Laptop,
  CheckCircle,
  HardDrive,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";

export default function DemoDetailsPage({ params }) {
  const customerName = params.customer;
  const searchParams = useSearchParams();

  // Retrieve data from URL query parameters
  const mobile = searchParams.get("mobile");
  const company = searchParams.get("company");
  const demoDate = searchParams.get("demoDate");
  const address = searchParams.get("address");
  const username = searchParams.get("username");
  const machine1 = searchParams.get("machine1");
  const model1 = searchParams.get("model1");
  const machine2 = searchParams.get("machine2");
  const model2 = searchParams.get("model2");
  const machine3 = searchParams.get("machine3");
  const model3 = searchParams.get("model3");
  const demoStatus = searchParams.get("demoStatus");

  if (!customerName) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-500">
          No demo details found. Please go back.
        </p>
      </div>
    );
  }

  // Define a base list of items to display
  const detailItems = [
    {
      label: "Customer Name",
      value: decodeURIComponent(customerName),
      icon: User,
    },
    { label: "Mobile Number", value: mobile, icon: Phone },
    { label: "Company", value: company, icon: Building },
    {
      label: "Demo Date",
      value: dayjs(demoDate).format("DD MMM, YYYY hh:mm A"),
      icon: CalendarDays,
    },
    { label: "Address", value: address, icon: MapPin },
    { label: "Assigned To", value: username, icon: Laptop },
    { label: "Status", value: demoStatus || "Pending", icon: CheckCircle },
  ];

  // Conditionally add machine/model information
  if (machine1 && model1) {
    detailItems.push(
      {
        label: "Machine 1",
        value: machine1,
        icon: HardDrive,
      },
      {
        label: "Model 1",
        value: model1,
        icon: Cpu,
      }
    );
  }

  if (machine2 && model2) {
    detailItems.push(
      {
        label: "Machine 2",
        value: machine2,
        icon: HardDrive,
      },
      {
        label: "Model 2",
        value: model2,
        icon: Cpu,
      }
    );
  }

  if (machine3 && model3) {
    detailItems.push(
      {
        label: "Machine 3",
        value: machine3,
        icon: HardDrive,
      },
      {
        label: "Model 3",
        value: model3,
        icon: Cpu,
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Demo Details
          </h1>
          <Link
            href="/admin-dashboard/today-reports"
            className="text-sm sm:text-base text-blue-600 hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            {decodeURIComponent(customerName)}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {detailItems.map((item, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <item.icon
                  size={20}
                  className="text-blue-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {item.label}
                  </dt>
                  <dd className="text-base font-semibold text-gray-800 break-words">
                    {item.value || "N/A"}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
