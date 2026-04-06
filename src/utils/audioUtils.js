/**
 * Audio Utilities - نظام الأصوات
 * يوفر تأثيرات صوتية للواجهة
 */

let uiAudioContext = null;

const getUiAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!uiAudioContext) uiAudioContext = new AudioCtx();
  return uiAudioContext;
};

export const playUiSound = async (type = 'input') => {
  try {
    const ctx = getUiAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const playTone = (freq, start, duration, volume = 0.03, wave = 'sine') => {
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      toneGain.gain.setValueAtTime(0.0001, start);
      toneGain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(toneGain);
      toneGain.connect(gain);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    };

    if (type === 'save') {
      playTone(660, now, 0.08, 0.04, 'triangle');
      playTone(880, now + 0.09, 0.1, 0.045, 'triangle');
      return;
    }

    if (type === 'error') {
      playTone(220, now, 0.12, 0.04, 'sawtooth');
      playTone(180, now + 0.08, 0.14, 0.03, 'sawtooth');
      return;
    }

    playTone(520, now, 0.05, 0.02, 'triangle');
  } catch {
    // Ignore audio errors silently to avoid blocking UX.
  }
};

export const speakSaveSuccess = (lang = 'ar') => {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const text = lang === 'ar' ? 'تم حفظ الفاتورة بنجاح' : 'Invoice saved successfully';
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    utter.rate = 0.9;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    // silent
  }
};
