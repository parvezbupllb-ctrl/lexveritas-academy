"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const methods = [
  { value: "bkash", label: "bKash", key: "bkashPayment" },
  { value: "nagad", label: "Nagad", key: "nagadPayment" },
  { value: "rocket", label: "Rocket", key: "rocketPayment" },
] as const;

export function PaymentMethodPicker({ settings, value, onChange, amount }: any) {
  const selected = methods.find((method) => method.value === value) || methods[0];
  const number = settings?.[selected.key] || settings?.payment || "";

  return (
    <div className="payment-method-picker">
      <span className="eyebrow">PAYMENT METHOD</span>
      <RadioGroup className="payment-method-options" value={value} onValueChange={onChange} aria-label="Choose a payment method">
        {methods.map((method) => (
          <label className={`payment-method-option ${value === method.value ? "selected" : ""}`} key={method.value}>
            <RadioGroupItem value={method.value} />
            <span>{method.label}</span>
          </label>
        ))}
      </RadioGroup>
      <div className="payment-method-number" aria-live="polite">
        <span>Send{amount ? ` ${amount}` : ""} to {selected.label}</span>
        <strong>{number}</strong>
      </div>
      <p>Send the payment to the selected account, then enter the correct transaction ID. Payment is confirmed manually.</p>
    </div>
  );
}
