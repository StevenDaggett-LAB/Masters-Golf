'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { NavLinks } from '@/components/nav-links';
import { AdminAccessButton } from '@/components/admin-access-button';

type ThemeAudio = {
  context: AudioContext;
  oscillators: OscillatorNode[];
};

function createThemeAudio(): ThemeAudio {
  const context = new AudioContext();
  const masterGain = context.createGain();
  masterGain.gain.value = 0.03;
  masterGain.connect(context.destination);

  const lowPad = context.createOscillator();
  lowPad.type = 'sine';
  lowPad.frequency.value = 174.61;

  const shimmer = context.createOscillator();
  shimmer.type = 'triangle';
  shimmer.frequency.value = 261.63;

  const tremolo = context.createOscillator();
  tremolo.type = 'sine';
  tremolo.frequency.value = 0.18;

  const tremoloGain = context.createGain();
  tremoloGain.gain.value = 0.35;
  tremolo.connect(tremoloGain);
  tremoloGain.connect(masterGain.gain);

  const lowPadGain = context.createGain();
  lowPadGain.gain.value = 0.8;
  lowPad.connect(lowPadGain);
  lowPadGain.connect(masterGain);

  const shimmerGain = context.createGain();
  shimmerGain.gain.value = 0.35;
  shimmer.connect(shimmerGain);
  shimmerGain.connect(masterGain);

  lowPad.start();
  shimmer.start();
  tremolo.start();

  return {
    context,
    oscillators: [lowPad, shimmer, tremolo],
  };
}

export default function LandingPage() {
  const [isPlayingTheme, setIsPlayingTheme] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const themeRef = useRef<ThemeAudio | null>(null);

  useEffect(() => {
    setIsLoaded(true);

    return () => {
      if (!themeRef.current) {
        return;
      }

      themeRef.current.oscillators.forEach((oscillator) => oscillator.stop());
      void themeRef.current.context.close();
      themeRef.current = null;
    };
  }, []);

  async function toggleTheme() {
    if (isPlayingTheme) {
      if (themeRef.current) {
        themeRef.current.oscillators.forEach((oscillator) => oscillator.stop());
        await themeRef.current.context.close();
        themeRef.current = null;
      }
      setIsPlayingTheme(false);
      return;
    }

    try {
      const themeAudio = createThemeAudio();
      if (themeAudio.context.state === 'suspended') {
        await themeAudio.context.resume();
      }
      themeRef.current = themeAudio;
      setIsPlayingTheme(true);
    } catch {
      setIsPlayingTheme(false);
    }
  }

  return (
    <main className="landing-main">
      <section className={`card landing-card ${isLoaded ? 'landing-card-loaded' : ''}`}>
        <p className="landing-kicker">Augusta Season</p>
        <h1>Masters Golf Pool</h1>
        <p>
          Welcome to your private pool. Set your team, lock in your picks, and step into
          tournament week.
        </p>

        <div className="landing-actions">
          <Link className="button landing-enter-button" href="/join">
            Enter Pool
          </Link>
          <button type="button" className="button landing-theme-button" onClick={toggleTheme}>
            {isPlayingTheme ? 'Mute' : 'Play Theme'}
          </button>
        </div>

        <div className="nav-row">
          <AdminAccessButton mode="enter" />
        </div>
        <NavLinks />
      </section>
    </main>
  );
}
