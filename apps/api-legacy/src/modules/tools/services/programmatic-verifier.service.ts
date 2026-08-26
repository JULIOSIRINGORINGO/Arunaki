import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface VerificationRule {
  mustExist?: boolean;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  mustContainRegex?: RegExp;
  validFormat?: 'json' | 'csv' | 'txt' | 'any';
}

export interface ProgrammaticVerificationResult {
  verified: boolean;
  executionTimeMs: number;
  checksPassed: string[];
  checksFailed: string[];
  details: {
    exists: boolean;
    sizeBytes: number;
    formatValid: boolean;
  };
}

const MAX_VERIFICATION_READ_BYTES = 2 * 1024 * 1024; // 2MB safety buffer limit

/**
 * ProgrammaticVerifierService — Fast 0-token verifier engine.
 * Validates file outputs deterministically in milliseconds without LLM turns.
 */
@Injectable()
export class ProgrammaticVerifierService {
  private readonly logger = new Logger(ProgrammaticVerifierService.name);

  /**
   * Perform instant deterministic verification on a file target.
   */
  async verifyFile(
    filePath: string,
    rule: VerificationRule = {},
  ): Promise<ProgrammaticVerificationResult> {
    const startTime = Date.now();
    const checksPassed: string[] = [];
    const checksFailed: string[] = [];

    const defaultRule: VerificationRule = {
      mustExist: true,
      minSizeBytes: 1,
      validFormat: 'any',
      ...rule,
    };

    let exists = false;
    let sizeBytes = 0;
    let formatValid = true;

    try {
      const stats = await fs.stat(filePath);
      exists = true;
      sizeBytes = stats.size;
      checksPassed.push('FILE_EXISTS');
    } catch {
      exists = false;
      checksFailed.push('FILE_EXISTS');
    }

    if (defaultRule.mustExist && !exists) {
      return {
        verified: false,
        executionTimeMs: Date.now() - startTime,
        checksPassed,
        checksFailed,
        details: { exists, sizeBytes, formatValid: false },
      };
    }

    // Min Size check
    if (exists && defaultRule.minSizeBytes !== undefined) {
      if (sizeBytes >= defaultRule.minSizeBytes) {
        checksPassed.push('MIN_SIZE_CHECK');
      } else {
        checksFailed.push('MIN_SIZE_CHECK');
      }
    }

    // Max Size check
    if (exists && defaultRule.maxSizeBytes !== undefined) {
      if (sizeBytes <= defaultRule.maxSizeBytes) {
        checksPassed.push('MAX_SIZE_CHECK');
      } else {
        checksFailed.push('MAX_SIZE_CHECK');
      }
    }

    // Format & Content checks if file exists and has size
    if (
      exists &&
      sizeBytes > 0 &&
      (defaultRule.mustContainRegex || defaultRule.validFormat !== 'any')
    ) {
      try {
        // Read bounded buffer to avoid memory overflow on huge binary files
        const readLength = Math.min(sizeBytes, MAX_VERIFICATION_READ_BYTES);
        const handle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(readLength);
        await handle.read(buffer, 0, readLength, 0);
        await handle.close();

        const content = buffer.toString('utf-8');

        if (defaultRule.mustContainRegex) {
          if (defaultRule.mustContainRegex.test(content)) {
            checksPassed.push('REGEX_MATCH');
          } else {
            checksFailed.push('REGEX_MATCH');
          }
        }

        if (defaultRule.validFormat === 'json') {
          try {
            JSON.parse(content);
            checksPassed.push('VALID_JSON_FORMAT');
          } catch {
            formatValid = false;
            checksFailed.push('VALID_JSON_FORMAT');
          }
        } else if (defaultRule.validFormat === 'csv') {
          if (
            content.includes(',') ||
            content.includes(';') ||
            content.includes('\n')
          ) {
            checksPassed.push('VALID_CSV_FORMAT');
          } else {
            formatValid = false;
            checksFailed.push('VALID_CSV_FORMAT');
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed reading file for content verification: ${filePath} - ${err.message}`,
        );
      }
    }

    const verified = checksFailed.length === 0;
    const executionTimeMs = Date.now() - startTime;

    this.logger.log(
      `File verification for "${path.basename(filePath)}": ${verified ? 'VERIFIED ✅' : 'FAILED ❌'} (${executionTimeMs}ms)`,
    );

    return {
      verified,
      executionTimeMs,
      checksPassed,
      checksFailed,
      details: { exists, sizeBytes, formatValid },
    };
  }
}
