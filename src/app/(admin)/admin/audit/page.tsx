"use client";

import { AuditLogView } from "@/components/audit/AuditLogView";
import { auditLogs } from "@/data/wealth-transfer";

export default function AdminAuditPage() {
  return <AuditLogView initialLogs={auditLogs} />;
}
