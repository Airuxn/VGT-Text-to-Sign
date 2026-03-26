const API_BASE = 'http://localhost:8080/api';

export async function convertText(text) {
  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Conversion failed');
  }
  return res.json();
}

export async function fetchAvatarPoses(segments, fps = 12) {
  const res = await fetch(`${API_BASE}/avatar/poses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      segments: segments.map((s, index) => ({
        index: typeof s.index === 'number' ? s.index : index,
        token: s.token,
        signId: s.signId,
        videoUrl: s.videoUrl,
        durationMs: s.durationMs,
      })),
      options: { fps }
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to extract avatar poses');
  }
  return res.json();
}

export async function sendFeedback(payload) {
  await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function getVideoClips() {
  const res = await fetch(`${API_BASE}/video-clips`);
  if (!res.ok) throw new Error('Failed to load video clips');
  return res.json();
}
