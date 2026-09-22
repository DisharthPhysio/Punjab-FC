import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function CodeInput({ value, onChange, autoFocus = true }) {
  return (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={value} onChange={onChange} autoFocus={autoFocus}>
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg font-bold tabular" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
