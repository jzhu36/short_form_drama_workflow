import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('HTML Structure', () => {
  let html;

  beforeEach(() => {
    // Read the HTML file
    const htmlPath = join(process.cwd(), 'index.html');
    html = readFileSync(htmlPath, 'utf-8');

    // Parse HTML into DOM
    document.documentElement.innerHTML = html;
  });

  describe('App Container', () => {
    it('should have app container', () => {
      const app = document.getElementById('app');
      expect(app).toBeTruthy();
    });

    it('should have header with title', () => {
      const header = document.querySelector('header');
      expect(header).toBeTruthy();
      expect(header.querySelector('h1')).toBeTruthy();
      expect(header.querySelector('h1').textContent).toContain('Short Form Drama Workflow');
    });

    it('should have main container', () => {
      const main = document.querySelector('.main-container');
      expect(main).toBeTruthy();
    });
  });

  describe('Asset Panel (Left)', () => {
    it('should have asset panel', () => {
      const assetPanel = document.getElementById('asset-panel');
      expect(assetPanel).toBeTruthy();
      expect(assetPanel.classList.contains('panel-left')).toBe(true);
    });

    it('should have drop zone', () => {
      const dropZone = document.getElementById('asset-drop-zone');
      expect(dropZone).toBeTruthy();
      expect(dropZone.classList.contains('drop-zone')).toBe(true);
    });

    it('should have asset grid', () => {
      const assetGrid = document.getElementById('asset-grid');
      expect(assetGrid).toBeTruthy();
      expect(assetGrid.classList.contains('asset-grid')).toBe(true);
    });
  });

  describe('Video Panel (Center)', () => {
    it('should have video panel', () => {
      const videoPanel = document.getElementById('video-panel');
      expect(videoPanel).toBeTruthy();
      expect(videoPanel.classList.contains('panel-center')).toBe(true);
    });

    it('should have video container', () => {
      const videoContainer = document.getElementById('video-container');
      expect(videoContainer).toBeTruthy();
    });

    it('should have video status element', () => {
      const videoStatus = document.getElementById('video-status');
      expect(videoStatus).toBeTruthy();
    });

    it('should have video player element', () => {
      const videoPlayer = document.getElementById('video-player');
      expect(videoPlayer).toBeTruthy();
      expect(videoPlayer.tagName).toBe('VIDEO');
      expect(videoPlayer.hasAttribute('controls')).toBe(true);
    });

    it('should have download button', () => {
      const downloadBtn = document.getElementById('download-btn');
      expect(downloadBtn).toBeTruthy();
      expect(downloadBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Prompt Panel (Bottom)', () => {
    it('should have prompt panel', () => {
      const promptPanel = document.getElementById('prompt-panel');
      expect(promptPanel).toBeTruthy();
      expect(promptPanel.classList.contains('panel-bottom')).toBe(true);
    });

    it('should have prompt input textarea', () => {
      const promptInput = document.getElementById('prompt-input');
      expect(promptInput).toBeTruthy();
      expect(promptInput.tagName).toBe('TEXTAREA');
      expect(promptInput.hasAttribute('placeholder')).toBe(true);
    });

    it('should have generate button', () => {
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();
      expect(generateBtn.classList.contains('btn-primary')).toBe(true);
    });

    it('should have prompt status element', () => {
      const promptStatus = document.getElementById('prompt-status');
      expect(promptStatus).toBeTruthy();
    });
  });

  describe('Script Loading', () => {
    it('should load main.js module', () => {
      const script = document.querySelector('script[src="/src/main.js"]');
      expect(script).toBeTruthy();
      expect(script.getAttribute('type')).toBe('module');
    });

    it('should load CSS stylesheet', () => {
      const link = document.querySelector('link[href="/styles/main.css"]');
      expect(link).toBeTruthy();
      expect(link.getAttribute('rel')).toBe('stylesheet');
    });
  });
});
