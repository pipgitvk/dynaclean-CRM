import {
  ViewReturnBookingMenuItem,
  WarehouseInMenuItem,
} from "@/components/orders/ReturnBookingWarehouseMenuItems";

/** Accountant menu: view return booking / warehouse-in after those steps are done. */
export default function AccountantReturnViewMenuItems({ order, onClick }) {
  const showReturnBooking = Number(order?.return_booking_done) === 1;
  const showWarehouseIn = Number(order?.warehouse_in_done) === 1;
  if (!showReturnBooking && !showWarehouseIn) return null;

  return (
    <>
      {showReturnBooking && (
        <div
          className="border-t border-gray-100 mt-1 pt-1"
          onClick={onClick}
        >
          <ViewReturnBookingMenuItem order={order} />
        </div>
      )}
      {showWarehouseIn && (
        <div
          className="border-t border-gray-100 mt-1 pt-1"
          onClick={onClick}
        >
          <WarehouseInMenuItem order={order} />
        </div>
      )}
    </>
  );
}
