export type AgeGroup = 'child' | 'adult';
export type Language = 'en' | 'ha';

export interface SymptomCheck {
  fever: boolean;
  cough: boolean;
  difficultyBreathing: boolean;
  age: AgeGroup;
}

export interface DiagnosisResult {
  likelyDiagnosis: string;
  severity: 'Mild' | 'Urgent' | 'Emergency';
  confidence: 'Low' | 'Medium' | 'High';
  recommendedAction: string;
  explanation?: string;
}

export interface MalnutritionResult {
  riskLevel: 'Low' | 'Moderate' | 'High';
  confidence: 'Low' | 'Medium' | 'High';
  advice: string;
  observations: string[];
}

export interface HealthCase {
  id: string;
  userId: string;
  timestamp: number;
  symptoms: SymptomCheck;
  diagnosis?: DiagnosisResult;
}
