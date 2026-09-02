import { Eye, EyeOff, Volume2, VolumeX, Lock, Unlock, Headphones, Trash2 } from 'lucide-react';
import { Track } from '@/types/models';
import { useProjectStore } from '@/stores/projectStore';

export function TrackHeader({ track }: { track: Track }) {
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);

  return (
    <div className="track-header" style={{ ['--track-h' as any]: `${track.height}px` }}>
      <input
        className="track-header__name"
        value={track.name}
        onChange={(e) => updateTrack(track.id, { name: e.target.value })}
        spellCheck={false}
      />
      <div className="track-header__btns">
        <button
          className={track.hidden ? '' : 'active'}
          title={track.hidden ? 'Show' : 'Hide'}
          onClick={() => updateTrack(track.id, { hidden: !track.hidden })}
        >
          {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          className={track.muted ? '' : 'active'}
          title={track.muted ? 'Unmute' : 'Mute'}
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
        >
          {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <button className={track.solo ? 'active' : ''} title="Solo" onClick={() => updateTrack(track.id, { solo: !track.solo })}>
          <Headphones size={12} />
        </button>
        <button className={track.locked ? 'active' : ''} title={track.locked ? 'Unlock' : 'Lock'} onClick={() => updateTrack(track.id, { locked: !track.locked })}>
          {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button title="Delete track" onClick={() => { if (confirm(`Delete track "${track.name}"? This removes its clips too.`)) removeTrack(track.id); }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
