import { StepItem } from "../LiveExecutionBadge";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  executionSteps?: StepItem[];
  thoughtSec?: number;
  metadata?: string | Record<string, any>;
  reasoning?: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}
