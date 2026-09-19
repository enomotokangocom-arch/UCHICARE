export interface ExpectedImpact {
  metric: string;
  label: string;
  low: number;
  high: number;
  unit: string;
}

export interface ActualImpact {
  metric: string;
  value: number;
  unit: string;
  note?: string;
}
