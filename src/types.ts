import type { EvidenceReport } from "./shared/report";
export interface User {
  id: string;
  email?: string;
  fullName: string;
  isGuest?: boolean;
  createdAt?: string;
}
export interface VerificationHistory {
  id: string;
  userId: string;
  type: EvidenceReport["kind"];
  title: string;
  target: string;
  timestamp: string;
  status:
    "queued" | "processing" | "completed" | "failed" | "canceled" | "legacy";
  report?: EvidenceReport;
  error?: string;
}
export interface DashboardStats {
  totalVerifications: number;
  partial: number;
  inconclusive: number;
  pending: number;
  recentVerifications: VerificationHistory[];
  byType: { name: string; value: number }[];
  trends: { date: string; count: number }[];
}
