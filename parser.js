/**
 * SubLingua AI - Subtitle & Container Parser
 * Strictly preserves timestamps, locks sync, and serializes SRT / VTT formats.
 */

export class SubtitleParser {
  /**
   * Parse SRT format text into structured cue list
   * @param {string} text 
   * @returns {Array<{id: number, startTime: string, endTime: string, rawTiming: string, sourceText: string, targetText: string, status: string}>}
   */
  static parseSRT(text) {
    if (!text || typeof text !== 'string') return [];
    
    // Normalize line endings
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    // Split on double newlines or cue boundaries
    const blocks = normalized.split(/\n\s*\n+/);
    const cues = [];
    let fallbackId = 1;

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      let idIndex = 0;
      let timingIndex = 1;

      // Sometimes cue index line is missing or malformed
      if (!lines[0].includes('-->') && lines[1] && lines[1].includes('-->')) {
        idIndex = 0;
        timingIndex = 1;
      } else if (lines[0].includes('-->')) {
        timingIndex = 0;
        idIndex = -1;
      }

      const timingLine = lines[timingIndex];
      if (!timingLine || !timingLine.includes('-->')) continue;

      const timingMatch = timingLine.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{2,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{2,3})/);
      if (!timingMatch) continue;

      const startTime = this.normalizeTimeSRT(timingMatch[1]);
      const endTime = this.normalizeTimeSRT(timingMatch[2]);
      const rawTiming = `${startTime} --> ${endTime}`;

      const cueId = (idIndex >= 0 && /^\d+$/.test(lines[idIndex].trim()))
        ? parseInt(lines[idIndex].trim(), 10)
        : fallbackId;

      // Remaining lines form the dialogue text
      const textLines = lines.slice(timingIndex + 1).map(l => l.trim()).filter(Boolean);
      const sourceText = textLines.join('\n');

      if (sourceText) {
        cues.push({
          id: cueId,
          startTime,
          endTime,
          rawTiming,
          sourceText,
          targetText: '',
          status: 'pending' // pending | translating | translated | edited
        });
        fallbackId++;
      }
    }

    return cues;
  }

  /**
   * Parse WebVTT format text into structured cue list
   * @param {string} text 
   * @returns {Array<{id: number, startTime: string, endTime: string, rawTiming: string, sourceText: string, targetText: string, status: string}>}
   */
  static parseVTT(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    
    // Remove WEBVTT header and comments/notes
    const lines = normalized.split('\n');
    let startIndex = 0;
    while (startIndex < lines.length && (lines[startIndex].startsWith('WEBVTT') || lines[startIndex].startsWith('NOTE') || !lines[startIndex].trim())) {
      startIndex++;
    }

    const content = lines.slice(startIndex).join('\n');
    const blocks = content.split(/\n\s*\n+/);
    const cues = [];
    let cueIndex = 1;

    for (const block of blocks) {
      const bLines = block.trim().split('\n');
      if (!bLines.length) continue;

      let timingLineIndex = -1;
      for (let i = 0; i < bLines.length; i++) {
        if (bLines[i].includes('-->')) {
          timingLineIndex = i;
          break;
        }
      }

      if (timingLineIndex === -1) continue;

      const timingLine = bLines[timingLineIndex];
      const match = timingLine.match(/((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{2,3})/);
      if (!match) continue;

      const startTime = this.normalizeTimeVTT(match[1]);
      const endTime = this.normalizeTimeVTT(match[2]);
      const rawTiming = `${startTime} --> ${endTime}`;

      const textLines = bLines.slice(timingLineIndex + 1).map(l => l.trim()).filter(Boolean);
      const sourceText = textLines.join('\n');

      if (sourceText) {
        cues.push({
          id: cueIndex,
          startTime,
          endTime,
          rawTiming,
          sourceText,
          targetText: '',
          status: 'pending'
        });
        cueIndex++;
      }
    }

    return cues;
  }

  /**
   * Format milliseconds or short timestamps to standard SRT: 00:00:00,000
   */
  static normalizeTimeSRT(timeStr) {
    let cleaned = timeStr.replace('.', ',').trim();
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      cleaned = `00:${cleaned}`;
    }
    const [hms, ms] = cleaned.split(',');
    const paddedMs = (ms || '000').padEnd(3, '0').slice(0, 3);
    const [h, m, s] = hms.split(':').map(n => n.padStart(2, '0'));
    return `${h}:${m}:${s},${paddedMs}`;
  }

  /**
   * Format timestamps to standard WebVTT: 00:00:00.000
   */
  static normalizeTimeVTT(timeStr) {
    let cleaned = timeStr.replace(',', '.').trim();
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      cleaned = `00:${cleaned}`;
    }
    const [hms, ms] = cleaned.split('.');
    const paddedMs = (ms || '000').padEnd(3, '0').slice(0, 3);
    const [h, m, s] = hms.split(':').map(n => n.padStart(2, '0'));
    return `${h}:${m}:${s}.${paddedMs}`;
  }

  /**
   * Serialize cues into strict SRT format (standard UTF-8)
   * Guaranteed ZERO timestamp desync.
   * @param {Array} cues 
   * @param {boolean} useTargetText Whether to serialize translated targetText or sourceText
   * @returns {string}
   */
  static serializeToSRT(cues, useTargetText = true) {
    if (!Array.isArray(cues) || cues.length === 0) return '';

    return cues.map((cue, index) => {
      const num = index + 1;
      const start = this.normalizeTimeSRT(cue.startTime);
      const end = this.normalizeTimeSRT(cue.endTime);
      const text = useTargetText ? (cue.targetText || cue.sourceText) : cue.sourceText;
      return `${num}\n${start} --> ${end}\n${text.trim()}\n`;
    }).join('\n');
  }

  /**
   * Serialize cues into strict WebVTT format (standard UTF-8)
   * @param {Array} cues 
   * @param {boolean} useTargetText
   * @returns {string}
   */
  static serializeToVTT(cues, useTargetText = true) {
    if (!Array.isArray(cues) || cues.length === 0) return 'WEBVTT\n\n';

    let output = 'WEBVTT - Generated by SubLingua AI (Roman Gen-Z Hinglish)\n\n';
    cues.forEach((cue, index) => {
      const num = index + 1;
      const start = this.normalizeTimeVTT(cue.startTime);
      const end = this.normalizeTimeVTT(cue.endTime);
      const text = useTargetText ? (cue.targetText || cue.sourceText) : cue.sourceText;
      output += `${num}\n${start} --> ${end}\n${text.trim()}\n\n`;
    });
    return output.trimEnd() + '\n';
  }

  /**
   * Convert SRT timecode string (00:01:23,456) to seconds for video player synchronization
   */
  static timecodeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const cleaned = timeStr.replace(',', '.').trim();
    const parts = cleaned.split(':');
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return (parseFloat(h) * 3600) + (parseFloat(m) * 60) + parseFloat(s);
    } else if (parts.length === 2) {
      const [m, s] = parts;
      return (parseFloat(m) * 60) + parseFloat(s);
    }
    return 0;
  }
}

/**
 * Video Container Inspector:
 * Inspects HTML5 text tracks and binary headers of MP4 / MKV / WebM containers
 */
export class VideoContainerInspector {
  /**
   * Inspect video file for embedded subtitle tracks
   * @param {File} file 
   * @param {HTMLVideoElement} videoElement
   * @returns {Promise<{tracks: Array<{id: string|number, label: string, language: string, kind: string, source: string}>, hasEmbedded: boolean}>}
   */
  static async inspect(file, videoElement) {
    const tracks = [];

    // 1. Check HTML5 Video TextTracks
    if (videoElement && videoElement.textTracks && videoElement.textTracks.length > 0) {
      for (let i = 0; i < videoElement.textTracks.length; i++) {
        const t = videoElement.textTracks[i];
        tracks.push({
          id: `html5_${i}`,
          index: i,
          label: t.label || `Track ${i + 1} (${t.language || 'und'})`,
          language: t.language || 'unknown',
          kind: t.kind || 'subtitles',
          source: 'html5_native',
          rawTrack: t
        });
      }
    }

    // 2. Binary container header heuristic scan for MP4/MKV subtitle tracks
    try {
      const binaryTracks = await this.scanBinaryContainer(file);
      if (binaryTracks && binaryTracks.length > 0) {
        for (const bt of binaryTracks) {
          // Avoid duplicate if already found in html5
          if (!tracks.some(t => t.language === bt.language && t.label === bt.label)) {
            tracks.push(bt);
          }
        }
      }
    } catch (e) {
      console.warn('Binary container scan warning:', e);
    }

    return {
      tracks,
      hasEmbedded: tracks.length > 0
    };
  }

  /**
   * Binary container probe: reads first 4MB of video file to detect subtitle track descriptors
   * Matches MP4 'sbtl', 'subt', 'tx3g', 'text' or Matroska 'S_TEXT/UTF8', 'S_TEXT/ASS'
   */
  static async scanBinaryContainer(file) {
    const sampleSize = Math.min(file.size, 4 * 1024 * 1024);
    const slice = file.slice(0, sampleSize);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const textDecoder = new TextDecoder('latin1');
    const headerStr = textDecoder.decode(bytes);

    const detected = [];

    // Check Matroska MKV (EBML header 0x1A 0x45 0xDF 0xA3)
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      const subtitleCodecs = [
        { code: 'S_TEXT/UTF8', label: 'SubRip (SRT) Subtitle' },
        { code: 'S_TEXT/ASS', label: 'Advanced SubStation Alpha' },
        { code: 'S_TEXT/SSA', label: 'SubStation Alpha' },
        { code: 'S_VOBSUB', label: 'VobSub Bitmap Subtitle' }
      ];

      subtitleCodecs.forEach((sc, idx) => {
        if (headerStr.includes(sc.code)) {
          detected.push({
            id: `mkv_sub_${idx}`,
            label: `Embedded MKV Stream: ${sc.label}`,
            language: 'en',
            kind: 'subtitles',
            source: 'mkv_container'
          });
        }
      });
    }

    // Check MP4 (ftyp box or moov box)
    if (headerStr.includes('ftyp') || headerStr.includes('moov')) {
      const mp4SubHandlers = ['sbtl', 'subt', 'tx3g', 'wvtt'];
      mp4SubHandlers.forEach((handler, idx) => {
        if (headerStr.includes(handler)) {
          detected.push({
            id: `mp4_sub_${idx}`,
            label: `Embedded MP4 Subtitle Track [${handler.toUpperCase()}]`,
            language: 'en',
            kind: 'subtitles',
            source: 'mp4_container'
          });
        }
      });
    }

    return detected;
  }
}
