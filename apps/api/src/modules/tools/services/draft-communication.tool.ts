import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class DraftCommunicationTool {
  private readonly logger = new Logger(DraftCommunicationTool.name);

  async draft(params: {
    type: 'whatsapp' | 'email' | 'quotation' | 'invoice_reminder';
    recipientName: string;
    topic: string;
    keyPoints?: string[];
  }): Promise<ToolResult> {
    const startTime = Date.now();
    const { type, recipientName, topic, keyPoints = [] } = params;

    if (!type || !recipientName || !topic) {
      return {
        status: 'error',
        data: {},
        preview: 'Parameter type, recipientName, dan topic wajib diisi.',
        metadata: {
          toolName: 'draft_communication',
          displayName: 'Pembuat Draf Pesan',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_PARAMS', message: 'Missing required parameters' },
      };
    }

    let template = '';
    const pointsList = keyPoints.length > 0
      ? keyPoints.map((p) => `- ${p}`).join('\n')
      : '- (Detail pembahasan)';

    switch (type) {
      case 'whatsapp':
        template = `Halo Kak ${recipientName} 👋,\n\nMengenai *${topic}*:\n${pointsList}\n\nJika ada pertanyaan atau perubahan, silakan kabari ya Kak. Terima kasih! 🙏`;
        break;
      case 'email':
        template = `Subject: Mengenai ${topic} - Arunaki\n\nKepada Yth. ${recipientName},\n\nSemoga Bapak/Ibu dalam keadaan sehat.\n\nMelalui email ini, kami ingin menyampaikan informasi terkait ${topic}:\n${pointsList}\n\nDemikian informasi ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.\n\nHormat kami,\nTim Operasional Arunaki`;
        break;
      case 'quotation':
        template = `=== PENAWARAN HARGA (QUOTATION) ===\nKepada: ${recipientName}\nPerihal: ${topic}\n\nDetail Penawaran:\n${pointsList}\n\nSyarat & Ketentuan:\n- Pembayaran DP 50% saat komitmen awal\n- Pelunasan sebelum pengiriman barang\n- Estimasi pengerjaan sesuai kesepakatan`;
        break;
      case 'invoice_reminder':
        template = `Halo Kak ${recipientName} 👋,\n\nSekadar mengingatkan untuk tagihan pembayaran *${topic}*.\n\nDetail:\n${pointsList}\n\nMohon konfirmasi jika pembayaran sudah dilakukan ya Kak. Terima kasih banyak! 🙏`;
        break;
      default:
        template = `Kepada ${recipientName},\n\nTerkait ${topic}:\n${pointsList}`;
    }

    return {
      status: 'success',
      data: {
        type,
        recipientName,
        topic,
        keyPoints,
        draftText: template,
      },
      preview: template,
      metadata: {
        toolName: 'draft_communication',
        displayName: 'Pembuat Draf Pesan & Email',
        executionTime: Date.now() - startTime,
        type,
        recipientName,
      },
    };
  }
}
