import { Injectable, Logger } from '@nestjs/common';

export type ExecutionPhase =
  | 'scanning'
  | 'planning'
  | 'reading'
  | 'analyzing'
  | 'generating'
  | 'completed';

export interface PhaseChangeEvent {
  phase: ExecutionPhase;
  label: string;
}

@Injectable()
export class WorkspacePhaseTrackerService {
  private readonly logger = new Logger(WorkspacePhaseTrackerService.name);

  getIndonesianLabel(phase: ExecutionPhase): string {
    switch (phase) {
      case 'scanning':
        return 'Memindai direktori & mengindeks berkas...';
      case 'planning':
        return 'Merencanakan tahapan kerja...';
      case 'reading':
        return 'Membaca & menganalisis dokumen...';
      case 'analyzing':
        return 'Mengevaluasi data & kalkulasi...';
      case 'generating':
        return 'Membuat / memperbarui dokumen...';
      case 'completed':
        return 'Tugas selesai.';
      default:
        return 'Memproses...';
    }
  }

  setPhase(
    currentPhaseRef: { current: ExecutionPhase },
    newPhase: ExecutionPhase,
    onEvent?: (event: {
      type: 'phase_changed';
      data: PhaseChangeEvent;
    }) => void,
  ) {
    if (currentPhaseRef.current === newPhase) return;
    currentPhaseRef.current = newPhase;
    const label = this.getIndonesianLabel(newPhase);
    this.logger.log(`[ExecutionPhase] → ${newPhase} (${label})`);
    if (onEvent) {
      onEvent({
        type: 'phase_changed',
        data: { phase: newPhase, label },
      });
    }
  }
}
