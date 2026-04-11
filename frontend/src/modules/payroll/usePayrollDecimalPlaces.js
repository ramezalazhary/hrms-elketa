import { useEffect, useState } from "react";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import { clampDecimalPlaces } from "./payrollVerification";

/**
 * Loads organization payroll `decimalPlaces` (0–8) for consistent EGP display with the server.
 */
export function usePayrollDecimalPlaces() {
  const [decimalPlaces, setDecimalPlaces] = useState(2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDocumentRequirementsApi();
        if (cancelled || !data?.payrollConfig) return;
        setDecimalPlaces(clampDecimalPlaces(data.payrollConfig.decimalPlaces, 2));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return decimalPlaces;
}
