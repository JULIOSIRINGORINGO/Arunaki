import { Injectable, Logger } from '@nestjs/common';
import type { AgentIntent, PlanGraph, PlanNode, NodeStatus, VerificationResult, RuntimeRecoveryAction, RuntimeContext } from './runtime.types.js';

@Injectable()
export class TaskClassifier {
  private readonly logger = new Logger(TaskClassifier.name);

  classify(goal: string, context: RuntimeContext): AgentIntent {
    const lowered = goal.toLowerCase();
    let category: AgentIntent['category'] = 'unknown';
    const hints: string[] = [];

    if (/\b(buat|tulis|buatkan|isikan|simpan|update|edit|rename)\b/i.test(lowered)) {
      category = 'file_write';
      hints.push('write_workspace_file');
    } else if (/\b(baca|tampilkan|lihat|search|cari|temukan)\b/i.test(lowered)) {
      category = 'file_read';
      hints.push('read_workspace_file', 'search_workspace');
    } else if (/\b(hapus|delete|remove|buang)\b/i.test(lowered)) {
      category = 'file_delete';
      hints.push('delete_workspace_file');
    } else if (/\b(cari|search|query|select|list)\b/i.test(lowered)) {
      category = 'file_search';
      hints.push('search_workspace');
    } else if (/\b(jawab|ringkasan|analisis|insight|poin)\b/i.test(lowered)) {
      category = 'knowledge_search';
      hints.push('search_workspace', 'read_workspace_file');
    } else if (/\b(buka|ketik|click|scroll|screenshot|desktop|excel|word|powerpoint)\b/i.test(lowered)) {
      category = 'desktop';
      hints.push('desktop_open_file', 'desktop_excel_write_cell', 'desktop_send_keys');
    } else if (/\b(rencana|langkah|strategi|pecah)\b/i.test(lowered)) {
      category = 'planning';
    }

    if (category === 'unknown') {
      category = 'planning';
      hints.push('read_workspace_file', 'search_workspace');
    }

    const destructive = category === 'file_delete' || /(\bhapus\b|\bdelete\b|\bbuang\b)/i.test(goal);

    const intent: AgentIntent = {
      category,
      goal,
      confidence: 0.8,
      requiresVerification: category === 'file_write' || category === 'file_delete',
      requiresApproval: destructive,
      estimatedSteps: category === 'planning' ? 3 : 1,
      suggestedToolHints: hints,
    };

    this.logger.log(`Classified goal "${goal.substring(0, 60)}" → ${intent.category} (verification=${intent.requiresVerification})`);
    return intent;
  }
}
