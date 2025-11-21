import { useState, useEffect } from 'react';

interface TimelineControlProps {
  maxStep: number;
  currentStep: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export function TimelineControl({
  maxStep,
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPause
}: TimelineControlProps) {
  const [playbackSpeed, setPlaybackSpeed] = useState(100);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onStepChange(Math.min(currentStep + 1, maxStep));
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, currentStep, maxStep, playbackSpeed, onStepChange]);

  return (
    <div style={{
      padding: '6px 8px',
      background: '#f5f5f5',
      borderRadius: '6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <h4 style={{ margin: 0, fontSize: '11px', minWidth: '60px', fontWeight: 'bold' }}>Timeline</h4>
        <button
          onClick={onPlayPause}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            background: isPlaying ? '#e74c3c' : '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '3px'
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span style={{ fontSize: '11px', fontWeight: 'bold', minWidth: '60px' }}>
          {currentStep} / {maxStep}
        </span>
      </div>

      <div>
        <input
          type="range"
          min="0"
          max={maxStep}
          value={currentStep}
          onChange={(e) => onStepChange(Number(e.target.value))}
          style={{ width: '100%', height: '5px' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '10px', minWidth: '60px' }}>
          Speed: {playbackSpeed}x
        </label>
        <input
          type="range"
          min="1"
          max="200"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          style={{ width: '100%', height: '4px' }}
        />
      </div>
    </div>
  );
}
