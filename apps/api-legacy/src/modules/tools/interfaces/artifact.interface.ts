export type ArtifactType =
  | 'document'
  | 'spreadsheet'
  | 'calculation'
  | 'text'
  | 'presentation'
  | 'image'
  | 'unknown';

export type ArtifactStatus = 'draft' | 'final' | 'archived';

export interface ArtifactMetadata {
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineage: string[];
  tags: string[];
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  filename: string;
  mimeType: string;
  contentBase64?: string;
  preview: string;
  data: Record<string, any>;
  metadata: ArtifactMetadata;
  status: ArtifactStatus;
}

export interface CreateArtifactInput {
  type: ArtifactType;
  filename: string;
  mimeType: string;
  contentBase64?: string;
  preview: string;
  data?: Record<string, any>;
  createdBy: string;
  tags?: string[];
  lineage?: string[];
}

export interface ArtifactFilter {
  type?: ArtifactType;
  status?: ArtifactStatus;
  tags?: string[];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
