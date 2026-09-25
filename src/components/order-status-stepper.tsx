"use client";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

type Props = {
  status: OrderStatus;
};

const steps = [
  { key: "received", label: "รับคำสั่งซื้อ" },
  { key: "confirmed", label: "ยืนยันคำสั่งซื้อ" },
  { key: "preparing", label: "กำลังเตรียมสินค้า" },
  { key: "shipping", label: "กำลังจัดส่ง" },
  { key: "completed", label: "สำเร็จ" },
] as const;

function getCurrentIndex(status: OrderStatus) {
  if (status === "completed") return 4;
  if (status === "out_for_delivery" || status === "ready_for_pickup") return 3;
  if (status === "preparing") return 2;
  if (status === "confirmed") return 1;
  return 0;
}

export function OrderStatusStepper({ status }: Props) {
  if (status === "cancelled") {
    return (
      <div className="order-stepper order-stepper--cancelled">
        <div className="order-stepper__cancel-icon">×</div>
        <div>
          <p className="order-stepper__cancel-title">คำสั่งซื้อนี้ถูกยกเลิก</p>
          <p className="order-stepper__cancel-text">ไม่ดำเนินการต่อในคำสั่งซื้อนี้</p>
        </div>
      </div>
    );
  }

  const currentIndex = getCurrentIndex(status);

  return (
    <section className="order-stepper" aria-label="สถานะคำสั่งซื้อ">
      <div className="order-stepper__track" aria-hidden="true">
        {steps.slice(0, -1).map((step, index) => (
          <span
            key={`${step.key}-line`}
            className={`order-stepper__line${index < currentIndex ? " is-done" : ""}`}
          />
        ))}
      </div>

      <div className="order-stepper__steps">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const finalDone = status === "completed" && index === 2;

          return (
            <div className="order-stepper__step" key={step.key}>
              <div
                className={`order-stepper__circle${done || finalDone ? " is-done" : ""}${active ? " is-active" : ""}`}
              >
                {done || finalDone ? "✓" : index + 1}
              </div>
              <span className={`order-stepper__label${active ? " is-active" : ""}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
