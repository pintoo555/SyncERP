export interface JobCardRow {
  jobId: number;
  instrument: string;
  date: string;
  manufacturer: string;
  serialNumber: string;
  weight: number | null;
  isInstrumentOut: number;
  statusOfWork: string;
  filePath: string;
  fileName: string;
  masterImageUploadID: string;
  feedbackTypeId: number | null;
  feedback: string;
  repeatCount: number | null;
  empName: string;
  clientName: string;
  clientCreatedOn: string | null;
  ownerName: string;
}

export interface JobCardListResult {
  data: JobCardRow[];
  total: number;
}
