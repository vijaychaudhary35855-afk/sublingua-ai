/**
 * SubLingua AI - Main Application Controller
 * Coordinates API verification, file ingestion, container inspection,
 * real-time dual workspace rendering, inline editing, and subtitle export.
 */

import { SubtitleParser, VideoContainerInspector } from './parser.js';
import { GeminiTranslator } from './gemini.js';

class SubLinguaApp {
  constructor() {
    this.gemini = new GeminiTranslator();
    this.cues = [];
    this.activeFilter = 'all'; // all | pending | translated | edited
    this.searchQuery = '';
    this.sourceFileType = 'srt'; // 'srt' | 'vtt'
    this.activeFilename = 'sublingua_hinglish_cues';
    this.isTranslating = false;
    this.videoObjectUrl = null;

    // DOM Elements
    this.elements = {};
    this.cacheDOMElements();
    this.bindEvents();
    this.initApiKeyUI();
    this.updateControlsState();
  }

  cacheDOMElements() {
    // Top Progress
    this.elements.stickyProgressWrap = document.getElementById('stickyProgressWrap');
    this.elements.progressTitle = document.getElementById('progressTitle');
    this.elements.progressPercentagePill = document.getElementById('progressPercentagePill');
    this.elements.progressSubtitle = document.getElementById('progressSubtitle');
    this.elements.progressBarFill = document.getElementById('progressBarFill');
    this.elements.btnPauseResume = document.getElementById('btnPauseResume');
    this.elements.btnStopSubbing = document.getElementById('btnStopSubbing');

    // API Config & Guide Modal
    this.elements.apiKeyInput = document.getElementById('apiKeyInput');
    this.elements.toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibilityBtn');
    this.elements.modelSelect = document.getElementById('modelSelect');
    this.elements.btnVerifyKey = document.getElementById('btnVerifyKey');
    this.elements.keyStatusBadge = document.getElementById('keyStatusBadge');
    this.elements.apiFeedback = document.getElementById('apiFeedback');
    this.elements.btnOpenApiGuide = document.getElementById('btnOpenApiGuide');
    this.elements.apiSetupGuideOverlay = document.getElementById('apiSetupGuideOverlay');
    this.elements.btnCloseApiGuide = document.getElementById('btnCloseApiGuide');
    this.elements.modalApiKeyInput = document.getElementById('modalApiKeyInput');
    this.elements.btnModalVerifyKey = document.getElementById('btnModalVerifyKey');
    this.elements.modalApiFeedback = document.getElementById('modalApiFeedback');

    // File Ingestion
    this.elements.subtitleFileInput = document.getElementById('subtitleFileInput');
    this.elements.videoFileInput = document.getElementById('videoFileInput');
    this.elements.subtitleDropZone = document.getElementById('subtitleDropZone');
    this.elements.btnLoadSample = document.getElementById('btnLoadSample');
    this.elements.btnLoad100Sample = document.getElementById('btnLoad100Sample');
    this.elements.videoPreviewContainer = document.getElementById('videoPreviewContainer');
    this.elements.videoElement = document.getElementById('videoElement');
    this.elements.videoPlaceholder = document.getElementById('videoPlaceholder');
    this.elements.trackSelectorBar = document.getElementById('trackSelectorBar');
    this.elements.videoTrackSelect = document.getElementById('videoTrackSelect');
    this.elements.noTracksAlert = document.getElementById('noTracksAlert');
    this.elements.btnUploadSrtFallback = document.getElementById('btnUploadSrtFallback');

    // Controls
    this.elements.vibeSelect = document.getElementById('vibeSelect');
    this.elements.batchSizeSelect = document.getElementById('batchSizeSelect');
    this.elements.btnStartSubbing = document.getElementById('btnStartSubbing');
    this.elements.statTotalCues = document.getElementById('statTotalCues');
    this.elements.statTranslatedCues = document.getElementById('statTranslatedCues');

    // Dual Workspace
    this.elements.workspaceSearch = document.getElementById('workspaceSearch');
    this.elements.filterBtns = document.querySelectorAll('.filter-btn');
    this.elements.dualWorkspaceGrid = document.getElementById('dualWorkspaceGrid');
    this.elements.sourceColHeaderCount = document.getElementById('sourceColHeaderCount');
    this.elements.targetColHeaderCount = document.getElementById('targetColHeaderCount');

    // Export
    this.elements.filenameInput = document.getElementById('filenameInput');
    this.elements.exportFormatExt = document.getElementById('exportFormatExt');
    this.elements.exportFormatSelect = document.getElementById('exportFormatSelect');
    this.elements.btnDownload = document.getElementById('btnDownload');
    this.elements.btnCopyClipboard = document.getElementById('btnCopyClipboard');
    this.elements.btnResetWorkspace = document.getElementById('btnResetWorkspace');

    // Toast
    this.elements.toastContainer = document.getElementById('toastContainer');
  }

  bindEvents() {
    // API verification
    this.elements.btnVerifyKey.addEventListener('click', () => this.handleVerifyKey());
    this.elements.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleVerifyKey();
    });
    this.elements.apiKeyInput.addEventListener('input', () => {
      // If user alters verified key, invalidate verification
      if (this.gemini.isVerified && this.elements.apiKeyInput.value.trim() !== this.gemini.apiKey) {
        this.gemini.isVerified = false;
        this.updateKeyStatusUI('unverified', 'Key changed. Click Verify to test again.');
        this.updateControlsState();
      }
    });

    // Guide Modal
    if (this.elements.btnOpenApiGuide) {
      this.elements.btnOpenApiGuide.addEventListener('click', () => this.openApiGuideModal());
    }
    if (this.elements.btnCloseApiGuide) {
      this.elements.btnCloseApiGuide.addEventListener('click', () => this.closeApiGuideModal());
    }
    if (this.elements.apiSetupGuideOverlay) {
      this.elements.apiSetupGuideOverlay.addEventListener('click', (e) => {
        if (e.target === this.elements.apiSetupGuideOverlay) this.closeApiGuideModal();
      });
    }
    if (this.elements.btnModalVerifyKey) {
      this.elements.btnModalVerifyKey.addEventListener('click', () => this.handleModalVerifyKey());
    }
    if (this.elements.modalApiKeyInput) {
      this.elements.modalApiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleModalVerifyKey();
      });
    }

    this.elements.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPwd = this.elements.apiKeyInput.type === 'password';
      this.elements.apiKeyInput.type = isPwd ? 'text' : 'password';
      this.elements.toggleKeyVisibilityBtn.setAttribute('title', isPwd ? 'Hide Key' : 'Show Key');
    });

    this.elements.modelSelect.addEventListener('change', (e) => {
      this.gemini.setModel(e.target.value);
      this.showToast(`Selected model: ${e.target.value}`, 'info');
      this.updateControlsState();
    });

    // Subtitle upload / drop zone
    this.elements.subtitleFileInput.addEventListener('change', (e) => {
      if (e.target.files?.length) this.handleSubtitleFile(e.target.files[0]);
    });

    this.elements.subtitleDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.subtitleDropZone.classList.add('dragover');
    });

    this.elements.subtitleDropZone.addEventListener('dragleave', () => {
      this.elements.subtitleDropZone.classList.remove('dragover');
    });

    this.elements.subtitleDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.subtitleDropZone.classList.remove('dragover');
      if (e.dataTransfer.files?.length) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.split('.').pop().toLowerCase();
        if (['mp4', 'mkv', 'webm'].includes(ext)) {
          this.handleVideoFile(file);
        } else {
          this.handleSubtitleFile(file);
        }
      }
    });

    // Sample Loaders
    this.elements.btnLoadSample.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadSampleDemoCues();
    });

    if (this.elements.btnLoad100Sample) {
      this.elements.btnLoad100Sample.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadSample100DemoCues();
      });
    }

    // Video Ingestion
    this.elements.videoFileInput.addEventListener('change', (e) => {
      if (e.target.files?.length) this.handleVideoFile(e.target.files[0]);
    });

    this.elements.btnUploadSrtFallback.addEventListener('click', () => {
      this.elements.subtitleFileInput.click();
    });

    this.elements.videoTrackSelect.addEventListener('change', (e) => {
      this.handleVideoTrackSelected(e.target.value);
    });

    // Video playback sync with workspace
    this.elements.videoElement.addEventListener('timeupdate', () => {
      this.handleVideoTimeUpdate();
    });

    // Translation controls
    this.elements.btnStartSubbing.addEventListener('click', () => this.startSubbing());
    this.elements.btnPauseResume.addEventListener('click', () => this.togglePauseResume());
    this.elements.btnStopSubbing.addEventListener('click', () => this.stopSubbing());

    // Dual workspace search and filter
    this.elements.workspaceSearch.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderDualWorkspace();
    });

    this.elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.renderDualWorkspace();
      });
    });

    // Export actions
    this.elements.filenameInput.addEventListener('input', (e) => {
      this.activeFilename = e.target.value.trim() || 'sublingua_hinglish_cues';
    });

    this.elements.exportFormatSelect.addEventListener('change', (e) => {
      this.sourceFileType = e.target.value;
      this.elements.exportFormatExt.textContent = `.${this.sourceFileType}`;
      this.elements.btnDownload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Subtitles (.${this.sourceFileType.toUpperCase()})`;
    });

    this.elements.btnDownload.addEventListener('click', () => this.downloadSubtitles());
    this.elements.btnCopyClipboard.addEventListener('click', () => this.copyAllToClipboard());
    this.elements.btnResetWorkspace.addEventListener('click', () => this.resetWorkspace());
  }

  // =========================================================================
  // API Key & Model Handling
  // =========================================================================
  initApiKeyUI() {
    const savedKey = this.gemini.apiKey;
    if (savedKey) {
      this.elements.apiKeyInput.value = savedKey;
      if (this.elements.modalApiKeyInput) {
        this.elements.modalApiKeyInput.value = savedKey;
      }
      // Auto-test on load if previously saved
      this.handleVerifyKey(true);
    } else {
      this.updateKeyStatusUI('unverified', 'Key required to unlock translation');
      // If user has not set up or verified key yet, show guide modal automatically
      if (!localStorage.getItem('sublingua_api_guide_dismissed')) {
        setTimeout(() => {
          if (!this.gemini.isVerified) {
            this.openApiGuideModal();
          }
        }, 600);
      }
    }
  }

  openApiGuideModal() {
    if (!this.elements.apiSetupGuideOverlay) return;
    if (this.elements.apiKeyInput && this.elements.modalApiKeyInput) {
      this.elements.modalApiKeyInput.value = this.elements.apiKeyInput.value;
    }
    this.elements.apiSetupGuideOverlay.classList.add('active');
  }

  closeApiGuideModal() {
    if (!this.elements.apiSetupGuideOverlay) return;
    this.elements.apiSetupGuideOverlay.classList.remove('active');
  }

  async handleModalVerifyKey() {
    const rawKey = this.elements.modalApiKeyInput?.value || '';
    const key = rawKey.trim().replace(/^["']|["']$/g, '');
    const feedback = this.elements.modalApiFeedback;

    if (!key) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.textContent = 'Kripya apna Google Gemini API Key yahan paste karein.';
      }
      return;
    }

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#fde68a';
      feedback.textContent = 'API Key verify ki ja rahi hai...';
    }

    this.elements.apiKeyInput.value = key;
    this.elements.btnModalVerifyKey.disabled = true;

    const result = await this.gemini.verifyApiKey(key);
    this.elements.btnModalVerifyKey.disabled = false;

    if (result.success) {
      this.updateKeyStatusUI('verified', result.message);
      this.populateModelDropdown(result.models);
      this.updateControlsState();
      
      // Mark setup as permanently completed
      localStorage.setItem('sublingua_api_guide_dismissed', 'true');
      
      if (feedback) {
        feedback.style.color = '#6ee7b7';
        feedback.textContent = '✓ Verified! Setup complete ho gaya hai. Modal close ho raha hai...';
      }

      this.showToast('Google Gemini API Key Verified! All tools unlocked.', 'success');

      setTimeout(() => {
        this.closeApiGuideModal();
      }, 1200);
    } else {
      this.updateKeyStatusUI('unverified', result.message);
      if (feedback) {
        feedback.style.color = '#fda4af';
        feedback.textContent = `❌ ${result.message}`;
      }
      this.showToast(result.message, 'error');
    }
  }

  async handleVerifyKey(isAuto = false) {
    const key = this.elements.apiKeyInput.value.trim().replace(/^["']|["']$/g, '');
    if (!key) {
      this.updateKeyStatusUI('unverified', 'Please provide a valid Gemini API key');
      this.showToast('Please enter your Google Gemini API key.', 'error');
      return;
    }

    this.updateKeyStatusUI('verifying', 'Testing key against Google Gemini API...');
    this.elements.btnVerifyKey.disabled = true;

    const result = await this.gemini.verifyApiKey(key);
    this.elements.btnVerifyKey.disabled = false;

    if (result.success) {
      this.updateKeyStatusUI('verified', result.message);
      this.populateModelDropdown(result.models);
      
      // Mark guide as completed so it never shows up again
      localStorage.setItem('sublingua_api_guide_dismissed', 'true');
      this.closeApiGuideModal();

      if (!isAuto) {
        this.showToast('Google Gemini API Key verified! Models unlocked.', 'success');
      }
    } else {
      this.updateKeyStatusUI('unverified', result.message);
      if (!isAuto) {
        this.showToast(result.message, 'error');
      }
    }

    this.updateControlsState();
  }

  updateKeyStatusUI(status, message) {
    const badge = this.elements.keyStatusBadge;
    const feedback = this.elements.apiFeedback;

    badge.className = `status-badge ${status}`;
    if (status === 'verified') {
      badge.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Verified`;
      feedback.className = 'api-verify-feedback success';
      feedback.textContent = `✓ ${message}`;
    } else if (status === 'verifying') {
      badge.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span> Verifying...`;
      feedback.className = 'api-verify-feedback';
      feedback.textContent = message;
    } else {
      badge.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f43f5e;"></span> Unverified`;
      feedback.className = 'api-verify-feedback error';
      feedback.textContent = message;
    }
  }

  populateModelDropdown(models) {
    const select = this.elements.modelSelect;
    select.innerHTML = '';

    if (!models || models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No models available';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }

    let foundMatch = false;
    models.forEach(modelName => {
      const opt = document.createElement('option');
      opt.value = modelName;
      opt.textContent = modelName;
      if (modelName === this.gemini.selectedModel) {
        opt.selected = true;
        foundMatch = true;
      }
      select.appendChild(opt);
    });

    if (!foundMatch && select.options.length > 0) {
      select.options[0].selected = true;
    }

    this.gemini.setModel(select.value);
    select.disabled = false;
  }

  updateControlsState() {
    const canTranslate = this.gemini.isVerified && this.cues.length > 0 && !this.isTranslating;
    this.elements.btnStartSubbing.disabled = !canTranslate;
    this.elements.vibeSelect.disabled = !this.gemini.isVerified || this.isTranslating;
    this.elements.batchSizeSelect.disabled = !this.gemini.isVerified || this.isTranslating;

    const hasCues = this.cues.length > 0;
    this.elements.btnDownload.disabled = !hasCues;
    this.elements.btnCopyClipboard.disabled = !hasCues;
    this.elements.filenameInput.disabled = !hasCues;
    this.elements.exportFormatSelect.disabled = !hasCues;

    // Update stats
    this.elements.statTotalCues.textContent = this.cues.length;
    const translatedCount = this.cues.filter(c => c.status === 'translated' || c.status === 'edited').length;
    this.elements.statTranslatedCues.textContent = translatedCount;
  }

  // =========================================================================
  // File Ingestion & Container Inspection
  // =========================================================================
  async handleSubtitleFile(file) {
    try {
      const text = await file.text();
      const ext = file.name.split('.').pop().toLowerCase();
      this.sourceFileType = ext === 'vtt' ? 'vtt' : 'srt';
      this.elements.exportFormatSelect.value = this.sourceFileType;
      this.elements.exportFormatExt.textContent = `.${this.sourceFileType}`;

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      this.activeFilename = `${baseName}_genz_hinglish`;
      this.elements.filenameInput.value = this.activeFilename;

      let parsedCues = [];
      if (this.sourceFileType === 'vtt') {
        parsedCues = SubtitleParser.parseVTT(text);
      } else {
        parsedCues = SubtitleParser.parseSRT(text);
      }

      if (!parsedCues.length) {
        throw new Error('No subtitle cues could be detected in this file.');
      }

      this.cues = parsedCues;
      this.showToast(`Loaded ${this.cues.length} cues from ${file.name}`, 'success');
      this.renderDualWorkspace();
      this.updateControlsState();
    } catch (err) {
      console.error(err);
      this.showToast(`Subtitle Parsing Error: ${err.message}`, 'error');
    }
  }

  async handleVideoFile(file) {
    try {
      this.showToast(`Inspecting video container: ${file.name}...`, 'info');
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      this.activeFilename = `${baseName}_genz_hinglish`;
      this.elements.filenameInput.value = this.activeFilename;

      // Set video source
      if (this.videoObjectUrl) {
        URL.revokeObjectURL(this.videoObjectUrl);
      }
      this.videoObjectUrl = URL.createObjectURL(file);
      this.elements.videoElement.src = this.videoObjectUrl;
      this.elements.videoElement.style.display = 'block';
      this.elements.videoPlaceholder.style.display = 'none';

      // Inspect container & tracks
      const inspection = await VideoContainerInspector.inspect(file, this.elements.videoElement);
      
      if (inspection.hasEmbedded && inspection.tracks.length > 0) {
        this.elements.trackSelectorBar.style.display = 'flex';
        this.elements.noTracksAlert.style.display = 'none';
        
        // Populate track select
        this.elements.videoTrackSelect.innerHTML = '';
        inspection.tracks.forEach((t, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `${t.label} [${t.language || 'und'}]`;
          this.elements.videoTrackSelect.appendChild(opt);
        });

        this.showToast(`Detected ${inspection.tracks.length} embedded subtitle track(s)!`, 'success');
      } else {
        // No embedded tracks found
        this.elements.trackSelectorBar.style.display = 'none';
        this.elements.noTracksAlert.style.display = 'flex';
        this.showToast(`No embedded subtitle tracks found in ${file.name}. Please upload a separate .SRT file!`, 'info');
      }
    } catch (err) {
      console.error(err);
      this.showToast(`Video inspection failed: ${err.message}`, 'error');
    }
  }

  handleVideoTrackSelected(trackIndex) {
    // If the browser provides decoded cues on HTML5 track
    const track = this.elements.videoElement.textTracks?.[trackIndex];
    if (track && track.cues && track.cues.length > 0) {
      const extractedCues = [];
      for (let i = 0; i < track.cues.length; i++) {
        const c = track.cues[i];
        extractedCues.push({
          id: i + 1,
          startTime: this.secondsToSRTTime(c.startTime),
          endTime: this.secondsToSRTTime(c.endTime),
          rawTiming: `${this.secondsToSRTTime(c.startTime)} --> ${this.secondsToSRTTime(c.endTime)}`,
          sourceText: c.text,
          targetText: '',
          status: 'pending'
        });
      }
      this.cues = extractedCues;
      this.renderDualWorkspace();
      this.updateControlsState();
      this.showToast(`Extracted ${extractedCues.length} cues from embedded track!`, 'success');
    } else {
      this.showToast('Embedded subtitle track selected. For direct extraction or if text is multiplexed, drop the matching .srt file for instant 100% fidelity.', 'info');
    }
  }

  secondsToSRTTime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  loadSampleDemoCues() {
    const sampleSRT = `1
00:00:01,200 --> 00:00:04,150
Bro, what is even happening right now? This makes zero sense.

2
00:00:04,500 --> 00:00:07,800
I swear, this party's vibe is completely dead. We should bounce.

3
00:00:08,200 --> 00:00:11,400
No cap, did you see how he looked at her? Total main character energy.

4
00:00:11,900 --> 00:00:14,600
Honestly, that was pure cringe. I can't even look.

5
00:00:15,000 --> 00:00:18,250
Don't gatekeep the tea! Tell me what happened yesterday.

6
00:00:18,700 --> 00:00:22,100
He tried to flex his new kicks, but honestly, it was an epic fail.

7
00:00:22,500 --> 00:00:25,900
Just let him cook, okay? Maybe he actually pulls this off.

8
00:00:26,300 --> 00:00:29,800
Bro is definitely in his villain arc right now.

9
00:00:30,200 --> 00:00:33,600
I'm not gonna lie, the exam tomorrow has got me stressed out.

10
00:00:34,000 --> 00:00:37,500
Chill out yaar, we'll pull an all-nighter and ace it easily.

11
00:00:38,000 --> 00:00:41,200
Are you ghosting me again, or did your phone actually die?

12
00:00:41,600 --> 00:00:45,000
That plot twist was insane! My mind is totally blown.

13
00:00:45,400 --> 00:00:48,900
Bro, trust the process. Everything will fall into place.

14
00:00:49,300 --> 00:00:52,800
She literally gave the biggest side eye I have ever witnessed.

15
00:00:53,200 --> 00:00:56,500
Say less, I'm booking the tickets right this second.`;

    this.cues = SubtitleParser.parseSRT(sampleSRT);
    this.sourceFileType = 'srt';
    this.activeFilename = 'sample_demo_genz_hinglish';
    this.elements.filenameInput.value = this.activeFilename;
    this.elements.exportFormatSelect.value = 'srt';
    this.elements.exportFormatExt.textContent = '.srt';
    this.renderDualWorkspace();
    this.updateControlsState();
    this.showToast(`Loaded ${this.cues.length} sample cues! Ready for Gen-Z translation.`, 'success');
  }

  async loadSample100DemoCues() {
    try {
      this.showToast('Loading 100 sample cues...', 'info');
      const response = await fetch('/sample_100_cues.srt');
      if (!response.ok) throw new Error('Could not load sample_100_cues.srt');
      const srtText = await response.text();
      this.cues = SubtitleParser.parseSRT(srtText);
      this.sourceFileType = 'srt';
      this.activeFilename = 'sample_100_lines_genz_hinglish';
      this.elements.filenameInput.value = this.activeFilename;
      this.elements.exportFormatSelect.value = 'srt';
      this.elements.exportFormatExt.textContent = '.srt';
      if (this.elements.batchSizeSelect) {
        this.elements.batchSizeSelect.value = '100';
      }
      this.renderDualWorkspace();
      this.updateControlsState();
      this.showToast(`Loaded 100 cues! Batch size set to 100 lines ek sath.`, 'success');
    } catch (err) {
      console.warn('Fallback loading 100 cues:', err);
      // Fallback: generate 100 cues from base
      const sample100 = [];
      const baseLines = [
        "Bro, what is even happening right now? This makes zero sense.",
        "I swear, this party's vibe is completely dead. We should bounce.",
        "No cap, did you see how he looked at her? Total main character energy.",
        "Honestly, that was pure cringe. I can't even look.",
        "Don't gatekeep the tea! Tell me what happened yesterday.",
        "He tried to flex his new kicks, but honestly, it was an epic fail.",
        "Just let him cook, okay? Maybe he actually pulls this off.",
        "Bro is definitely in his villain arc right now.",
        "I'm not gonna lie, the exam tomorrow has got me stressed out.",
        "Chill out yaar, we'll pull an all-nighter and ace it easily."
      ];
      for (let i = 1; i <= 100; i++) {
        const startSec = (i - 1) * 3;
        const endSec = startSec + 2.5;
        sample100.push({
          id: i,
          startTime: this.secondsToSRTTime(startSec),
          endTime: this.secondsToSRTTime(endSec),
          rawTiming: `${this.secondsToSRTTime(startSec)} --> ${this.secondsToSRTTime(endSec)}`,
          sourceText: baseLines[(i - 1) % baseLines.length] + ` (Line ${i})`,
          targetText: '',
          status: 'pending'
        });
      }
      this.cues = sample100;
      this.sourceFileType = 'srt';
      this.activeFilename = 'sample_100_lines_genz_hinglish';
      this.elements.filenameInput.value = this.activeFilename;
      this.elements.exportFormatSelect.value = 'srt';
      this.elements.exportFormatExt.textContent = '.srt';
      if (this.elements.batchSizeSelect) {
        this.elements.batchSizeSelect.value = '100';
      }
      this.renderDualWorkspace();
      this.updateControlsState();
      this.showToast(`Loaded 100 cues! Batch size set to 100 lines ek sath.`, 'success');
    }
  }

  // =========================================================================
  // Dual Real-Time Workspace Rendering & Inline Editing
  // =========================================================================
  renderDualWorkspace() {
    const grid = this.elements.dualWorkspaceGrid;
    const filteredCues = this.getFilteredCues();

    this.elements.sourceColHeaderCount.textContent = `(${filteredCues.length} cues)`;
    this.elements.targetColHeaderCount.textContent = `(${filteredCues.length} cues)`;

    if (this.cues.length === 0) {
      grid.innerHTML = `
        <div class="workspace-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <h3>Workspace Ready</h3>
          <p>Drop a .srt / .vtt file, load the demo sample, or upload a video file to begin.</p>
        </div>
      `;
      return;
    }

    if (filteredCues.length === 0) {
      grid.innerHTML = `
        <div class="workspace-empty-state">
          <h3>No matching cues</h3>
          <p>No cues match the filter "${this.activeFilter}" or search "${this.searchQuery}".</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const cue of filteredCues) {
      html += this.buildCueRowHTML(cue);
    }
    grid.innerHTML = html;

    // Attach inline editing listeners
    grid.querySelectorAll('.target-editable-text').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const cueId = parseInt(e.target.dataset.cueId, 10);
        const cue = this.cues.find(c => c.id === cueId);
        if (cue) {
          cue.targetText = e.target.value;
          cue.status = 'edited';
          this.updateControlsState();
          
          // Update status badge dynamically
          const badge = document.getElementById(`statusBadge_${cueId}`);
          if (badge) {
            badge.className = 'cue-status-badge edited';
            badge.textContent = 'Edited';
          }
        }
      });
    });

    // Attach individual cue copy listeners
    grid.querySelectorAll('.cue-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cueId = parseInt(e.currentTarget.dataset.cueId, 10);
        const cue = this.cues.find(c => c.id === cueId);
        if (cue) {
          const textToCopy = cue.targetText || cue.sourceText;
          navigator.clipboard.writeText(textToCopy);
          this.showToast(`Cue #${cue.id} copied!`, 'info');
        }
      });
    });

    // Jump to video time if user clicks timestamp
    grid.querySelectorAll('.timestamp-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        const timeStr = e.currentTarget.dataset.startTime;
        if (timeStr && this.elements.videoElement.src) {
          const sec = SubtitleParser.timecodeToSeconds(timeStr);
          this.elements.videoElement.currentTime = sec;
          this.elements.videoElement.play();
        }
      });
    });
  }

  buildCueRowHTML(cue) {
    const statusLabel = cue.status.charAt(0).toUpperCase() + cue.status.slice(1);
    const targetPlaceholder = cue.status === 'translating' ? 'Translating via Gemini...' : 'Type Hinglish translation here...';

    return `
      <div class="cue-pair-row" id="cueRow_${cue.id}">
        <!-- Left: Source Cell -->
        <div class="cue-source-cell">
          <div class="cue-meta-line">
            <span class="cue-index-badge">#${cue.id}</span>
            <span class="timestamp-badge" data-start-time="${cue.startTime}" title="Locked Zero-Desync Timestamp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              ${cue.rawTiming}
            </span>
          </div>
          <div class="cue-source-text">${this.escapeHTML(cue.sourceText)}</div>
        </div>

        <!-- Right: Target Cell (Hinglish Inline Editable) -->
        <div class="cue-target-cell">
          <div class="cue-meta-line">
            <span class="cue-status-badge ${cue.status}" id="statusBadge_${cue.id}">${statusLabel}</span>
            <button class="cue-copy-btn" data-cue-id="${cue.id}" title="Copy Hinglish line">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>
          <div class="target-input-wrap">
            <textarea
              class="target-editable-text"
              data-cue-id="${cue.id}"
              placeholder="${targetPlaceholder}"
              rows="2"
            >${this.escapeHTML(cue.targetText || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  getFilteredCues() {
    return this.cues.filter(c => {
      // Filter tab
      if (this.activeFilter !== 'all' && c.status !== this.activeFilter) {
        return false;
      }
      // Search
      if (this.searchQuery) {
        const inSource = c.sourceText.toLowerCase().includes(this.searchQuery);
        const inTarget = (c.targetText || '').toLowerCase().includes(this.searchQuery);
        const inTiming = c.rawTiming.toLowerCase().includes(this.searchQuery);
        return inSource || inTarget || inTiming;
      }
      return true;
    });
  }

  // Real-time batch update directly in DOM without rebuilding entire tree
  updateBatchInDOM(batchCues) {
    batchCues.forEach(cue => {
      const textarea = document.querySelector(`.target-editable-text[data-cue-id="${cue.id}"]`);
      if (textarea) {
        textarea.value = cue.targetText;
      }
      const badge = document.getElementById(`statusBadge_${cue.id}`);
      if (badge) {
        badge.className = `cue-status-badge ${cue.status}`;
        badge.textContent = cue.status.charAt(0).toUpperCase() + cue.status.slice(1);
      }
    });
    this.updateControlsState();
  }

  handleVideoTimeUpdate() {
    if (!this.elements.videoElement.src || !this.cues.length) return;
    const currentTime = this.elements.videoElement.currentTime;

    // Find active cue
    const activeCue = this.cues.find(c => {
      const start = SubtitleParser.timecodeToSeconds(c.startTime);
      const end = SubtitleParser.timecodeToSeconds(c.endTime);
      return currentTime >= start && currentTime <= end;
    });

    // Remove previous highlights
    document.querySelectorAll('.cue-source-cell.active-playing, .cue-target-cell.active-playing').forEach(el => {
      el.classList.remove('active-playing');
      el.style.borderColor = '';
    });

    if (activeCue) {
      const row = document.getElementById(`cueRow_${activeCue.id}`);
      if (row) {
        const cells = row.querySelectorAll('.cue-source-cell, .cue-target-cell');
        cells.forEach(c => {
          c.classList.add('active-playing');
          c.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
        });
      }
    }
  }

  // =========================================================================
  // Translation Runner & Sticky Progress Bar
  // =========================================================================
  async startSubbing() {
    const inputKey = (this.elements.apiKeyInput.value || '').trim().replace(/^["']|["']$/g, '');
    
    // Auto-verify if user entered key but didn't click verify
    if (!this.gemini.isVerified && inputKey) {
      this.showToast('Verifying API key before starting...', 'info');
      await this.handleVerifyKey(true);
    }

    if (!this.gemini.isVerified) {
      this.showToast('Please enter & verify your Gemini API key first.', 'error');
      return;
    }
    if (this.cues.length === 0) {
      this.showToast('Please upload or load subtitle cues first.', 'error');
      return;
    }

    this.isTranslating = true;
    this.updateControlsState();

    // Show sticky top progress bar
    this.elements.stickyProgressWrap.classList.remove('is-hidden');
    this.elements.btnPauseResume.textContent = 'Pause';
    this.elements.progressBarFill.style.width = '0%';
    this.elements.progressPercentagePill.textContent = '0%';
    this.elements.progressTitle.innerHTML = `Translating to Roman Gen-Z Hinglish <span class="progress-percentage-pill">0%</span>`;
    this.elements.progressSubtitle.textContent = `Connecting to Google Gemini (${this.gemini.selectedModel})...`;

    const vibeLevel = this.elements.vibeSelect.value || 'chill';
    const batchSize = parseInt(this.elements.batchSizeSelect.value, 10) || 100;

    try {
      await this.gemini.translateAll({
        cues: this.cues,
        batchSize,
        vibeLevel,
        onProgress: (prog) => {
          this.elements.progressBarFill.style.width = `${prog.percent}%`;
          this.elements.progressPercentagePill.textContent = `${prog.percent}%`;
          this.elements.progressTitle.innerHTML = `Translating to Roman Gen-Z Hinglish <span class="progress-percentage-pill">${prog.percent}%</span>`;
          this.elements.progressSubtitle.textContent = `${prog.completed}/${prog.total} cues translated • Batch ${prog.currentBatch}/${prog.totalBatches} (${batchSize} cues ek sath)`;
          
          this.elements.statTranslatedCues.textContent = prog.completed;
        },
        onBatchDone: (result) => {
          this.updateBatchInDOM(result.batchCues);
        }
      });

      this.showToast('Translation completed successfully! Subtitles ready for export.', 'success');
      this.elements.progressTitle.innerHTML = `Translation 100% Complete! <span class="progress-percentage-pill">Done</span>`;
      this.elements.progressSubtitle.textContent = `All ${this.cues.length} cues converted to authentic Roman Gen-Z Hinglish.`;
      this.elements.progressBarFill.style.width = '100%';
    } catch (err) {
      console.error('Translation error:', err);
      if (err.message?.includes('stopped') || err.message?.includes('aborted')) {
        this.showToast('Translation stopped by user.', 'info');
      } else {
        this.elements.progressTitle.innerHTML = `<span style="color:#f43f5e;">Translation Failed</span>`;
        this.elements.progressSubtitle.innerHTML = `<span style="color:#fda4af;">${this.escapeHTML(err.message || 'API call failed')}</span>`;
        this.showToast(`Translation error: ${err.message}`, 'error');
      }
    } finally {
      this.isTranslating = false;
      this.updateControlsState();
      // Auto-hide progress bar after 8 seconds if completed
      setTimeout(() => {
        if (!this.isTranslating && this.elements.progressBarFill.style.width === '100%') {
          this.elements.stickyProgressWrap.classList.add('is-hidden');
        }
      }, 7000);
    }
  }

  togglePauseResume() {
    if (this.gemini.isPaused) {
      this.gemini.resume();
      this.elements.btnPauseResume.textContent = 'Pause';
      this.showToast('Translation resumed.', 'info');
    } else {
      this.gemini.pause();
      this.elements.btnPauseResume.textContent = 'Resume';
      this.showToast('Translation paused.', 'info');
    }
  }

  stopSubbing() {
    this.gemini.abort();
    this.isTranslating = false;
    this.elements.stickyProgressWrap.classList.add('is-hidden');
    this.updateControlsState();
    this.showToast('Translation stopped.', 'info');
  }

  // =========================================================================
  // Export & Download Controls
  // =========================================================================
  downloadSubtitles() {
    if (!this.cues.length) {
      this.showToast('No cues available to export.', 'error');
      return;
    }

    const format = this.elements.exportFormatSelect.value;
    let content = '';
    let mimeType = '';
    let fileExtension = '';

    if (format === 'vtt') {
      content = SubtitleParser.serializeToVTT(this.cues, true);
      mimeType = 'text/vtt;charset=utf-8';
      fileExtension = '.vtt';
    } else {
      content = SubtitleParser.serializeToSRT(this.cues, true);
      mimeType = 'application/x-subrip;charset=utf-8';
      fileExtension = '.srt';
    }

    // Strict format enforcement: output file MUST strictly be .srt or .vtt, never .txt
    const filenameClean = (this.elements.filenameInput.value.trim() || 'sublingua_hinglish_cues')
      .replace(/\.(srt|vtt|txt)$/i, '');
    const finalFilename = `${filenameClean}${fileExtension}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showToast(`Exported "${finalFilename}" successfully!`, 'success');
  }

  copyAllToClipboard() {
    if (!this.cues.length) return;
    const format = this.elements.exportFormatSelect.value;
    const content = format === 'vtt' 
      ? SubtitleParser.serializeToVTT(this.cues, true)
      : SubtitleParser.serializeToSRT(this.cues, true);

    navigator.clipboard.writeText(content).then(() => {
      this.showToast(`All ${this.cues.length} cues copied to clipboard in .${format.toUpperCase()} format!`, 'success');
    }).catch(err => {
      this.showToast(`Copy failed: ${err.message}`, 'error');
    });
  }

  resetWorkspace() {
    if (this.cues.length > 0) {
      if (!confirm('Are you sure you want to reset the workspace? Current subtitle edits will be cleared.')) {
        return;
      }
    }
    this.stopSubbing();
    this.cues = [];
    this.elements.subtitleFileInput.value = '';
    this.elements.videoFileInput.value = '';
    this.elements.videoElement.src = '';
    this.elements.videoElement.style.display = 'none';
    this.elements.videoPlaceholder.style.display = 'flex';
    this.elements.trackSelectorBar.style.display = 'none';
    this.elements.noTracksAlert.style.display = 'none';
    this.renderDualWorkspace();
    this.updateControlsState();
    this.showToast('Workspace reset.', 'info');
  }

  // =========================================================================
  // Utilities
  // =========================================================================
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${this.escapeHTML(message)}</span>`;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.subLinguaApp = new SubLinguaApp();
});
