"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OrderTable from "@/app/user-dashboard/order/OrderTable";
import WarehouseInchargeDispatchItemModal from "@/components/warehouse-incharge/WarehouseInchargeDispatchItemModal";

export default function WarehouseInchargeOrdersClient({ orders, userRole }) {
  const router = useRouter();
  const [dispatchModal, setDispatchModal] = useState(null);

  const closeModal = () => {
    setDispatchModal(null);
    router.refresh();
  };

  return (
    <>
      <OrderTable
        orders={orders}
        userRole={userRole}
        orderBasePath="/warehouse-incharge/order"
        warehouseInchargeItemExpand
        onWarehouseDispatchItem={({ orderId, itemCode, itemName }) =>
          setDispatchModal({ orderId, itemCode, itemName })
        }
      />
      <WarehouseInchargeDispatchItemModal
        open={Boolean(dispatchModal)}
        onClose={closeModal}
        orderId={dispatchModal?.orderId}
        itemCode={dispatchModal?.itemCode}
        itemName={dispatchModal?.itemName}
      />
    </>
  );
}
