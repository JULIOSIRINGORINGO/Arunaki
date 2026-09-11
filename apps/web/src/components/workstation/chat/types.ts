import { StepItem } from "../LiveExecutionBadge";

export type MessagePart =
  | { type: "thought"; text: string; durationSec?: number; durationMs?: number }
  | { type: "text"; text: string }
  | { type: "tool"; step: StepItem };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  executionSteps?: StepItem[];
  thoughtSec?: number;
  thoughtMs?: number;
  metadata?: string | Record<string, any>;
  reasoning?: string;
  parts?: MessagePart[];
}

export interface AttachedImage {
  id: string;
  name: string;
  url: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}
