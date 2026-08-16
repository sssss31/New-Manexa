"use client";

// React Hook Form field wrapper on the MANEXA input classes. Pairs with Zod via
// @hookform/resolvers. Shows label, control, and inline validation error.
import { type UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// Thin input bound to RHF register(); use inside <Field>.
export function TextInput({
  registration,
  error,
  className,
  ...props
}: {
  registration?: UseFormRegisterReturn;
  error?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("input", error && "border-error/70 focus:!shadow-none", className)}
      {...registration}
      {...props}
    />
  );
}
