"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reports progress. Separate component because useFormStatus
 * only reports the status of the form it is rendered inside.
 */
export function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving" : children}
    </button>
  );
}
