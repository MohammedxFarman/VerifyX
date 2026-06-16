/**
 * Shared types for VerifyX Platform
 */

export interface User {
  id: string;
  email: string;
  fullName: string;
  apiKey?: string;
  createdAt: string;
}

export interface VerificationHistory {
  id: string;
  userId: string;
  type: 'news' | 'website' | 'image' | 'profile' | 'plagiarism' | 'ai-content';
  target: string; // The query, url, or input summary
  title: string;
  score: number; // 0 to 100 trust score
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
  details: any;
}

export interface DashboardStats {
  trustScoreAvg: number;
  totalVerifications: number;
  recentVerifications: VerificationHistory[];
  byRisk: { name: string; value: number; color: string }[];
  byType: { name: string; value: number }[];
  trends: { name: string; Trust: number; Scams: number }[];
}

export interface VerifyNewsResponse {
  trustScore: number;
  fakeProbability: number;
  aiConfidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factCheckSummary: string;
  explanation: string;
  supportingEvidence: string[];
  trustedReferences: string[];
  sourceLinks: string[];
}

export interface VerifyUrlResponse {
  trustScore: number;
  safetyRating: 'SAFE' | 'WARNING' | 'DANGEROUS';
  sslStatus: 'VALID' | 'INVALID' | 'NOT_FOUND';
  domainAge: string;
  phishingProbability: number;
  scamProbability: number;
  summary: string;
  suggestions: string[];
}

export interface VerifyImageResponse {
  authenticityScore: number;
  manipulationScore: number;
  aiProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
  confidenceScore?: number;
  details: {
    photoshopSign?: boolean;
    noiseInconsistency?: boolean;
    exifDataFound?: boolean;
    dimensions?: string;
    compression?: string;
    metadataStatus?: string;
  };
}

export interface VerifyProfileResponse {
  trustScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  botProbability: number;
  isVerifiedAccount: boolean;
  engagementQuality: string;
  explanation: string;
  redFlags: string[];
}

export interface VerifyPlagiarismResponse {
  originalityScore: number;
  similarityScore: number;
  matchedSources: { source: string; similarity: number; snippet: string }[];
  highlightedText: { text: string; isCopied: boolean }[];
}

export interface VerifyAiContentResponse {
  humanScore: number;
  aiScore: number;
  mixedContent: boolean;
  confidence: number;
  explanation: string;
}
