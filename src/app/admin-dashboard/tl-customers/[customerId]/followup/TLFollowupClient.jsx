"use client";

import { useState } from "react";
import TLFollowupForm from "@/components/TL/TLFollowupForm";
import FollowupNotesWithDelete from "@/components/TL/FollowupNotesWithDelete";
import PreBookingModal from "@/components/PreBookingModal";
import dayjs from "dayjs";
import { ShoppingCart } from "lucide-react";

export default function TLFollowupClient({
  customerId,
  customer,
  latestEmpFollowupTimeStampStr,
  latestTLFollowup,
}) {
  const [preBookingModal, setPreBookingModal] = useState(false);

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        TL Follow-up Entry (Admin)
      </h1>

      {/* Customer Info Card */}
      <div className="bg-white shadow-lg rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 flex-1">
            Customer Information
          </h2>
          {/* Pre-Booking Button */}
          <button
            onClick={() => setPreBookingModal(true)}
            className="ml-4 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 flex items-center gap-2 font-medium text-sm shadow-md hover:shadow-lg"
          >
            <ShoppingCart size={18} />
            Pre-Booking
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <div>
            <p className="mb-2">
              <strong>Customer ID:</strong> {customer.customer_id}
            </p>
            <p className="mb-2">
              <strong>Name:</strong> {customer.first_name} {customer.last_name}
            </p>
            <p className="mb-2">
              <strong>Company:</strong> {customer.company}
            </p>
            <p className="mb-2">
              <strong>Phone:</strong> {customer.phone}
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong>Email:</strong> {customer.email}
            </p>
            <p className="mb-2">
              <strong>Status:</strong>{" "}
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                {customer.status || "N/A"}
              </span>
            </p>
            <p className="mb-2">
              <strong>Assigned To:</strong>{" "}
              {customer.lead_source || "Unassigned"}
            </p>
            <p className="mb-2">
              <strong>Products Interest:</strong> {customer.products_interest}
            </p>
          </div>
        </div>

        {/* Latest Employee Follow-up Info */}
        {customer.latest_followed_date && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">
              Latest Employee Follow-up
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <p>
                <strong>Last Called:</strong>{" "}
                {dayjs(customer.latest_followed_date).format(
                  "DD MMM YYYY, hh:mm A",
                )}
              </p>
              <p>
                <strong>By:</strong> {customer.latest_followed_by}
              </p>
              <FollowupNotesWithDelete
                customerId={customerId}
                variant="employee"
                notes={customer.latest_notes}
                empTimeStamp={latestEmpFollowupTimeStampStr}
              />
            </div>
          </div>
        )}

        {/* Latest TL Follow-up Info */}
        {latestTLFollowup && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">
              Latest TL Follow-up
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <p>
                <strong>Date:</strong>{" "}
                {dayjs(latestTLFollowup.followed_date).format(
                  "DD MMM YYYY, hh:mm A",
                )}
              </p>
              <p>
                <strong>Quality Score:</strong>{" "}
                {latestTLFollowup.lead_quality_score
                  ? `${latestTLFollowup.lead_quality_score}/10`
                  : "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {latestTLFollowup.status || "N/A"}
              </p>
              <p>
                <strong>Tags:</strong> {latestTLFollowup.multi_tag || "N/A"}
              </p>
              {latestTLFollowup.model && (
                <p>
                  <strong>Model:</strong> {latestTLFollowup.model}
                </p>
              )}
              <FollowupNotesWithDelete
                customerId={customerId}
                variant="tl"
                notes={latestTLFollowup.notes}
                tlFollowupId={latestTLFollowup.id}
              />
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Form */}
      <TLFollowupForm
        customerId={customerId}
        customerData={customer}
        isAdmin={true}
        latestfollowup={latestTLFollowup ? { ...latestTLFollowup, status: customer.status, stage: customer.stage } : { status: customer.status, stage: customer.stage }}
        currentStage={customer.stage || "New"}
      />

      {/* Pre-Booking Modal */}
      <PreBookingModal
        isOpen={preBookingModal}
        onClose={() => setPreBookingModal(false)}
        customerId={customerId}
        customerName={`${customer.first_name} ${customer.last_name}`}
        onSuccess={() => {
          // Optionally refresh or show success message
        }}
      />
    </div>
  );
}
