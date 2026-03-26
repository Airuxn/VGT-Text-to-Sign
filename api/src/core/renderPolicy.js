const MIN_AVATAR_CONFIDENCE = 0.8;

export function chooseRenderMode(segment) {
  const hasManual = Boolean(segment.manual?.left?.pose && segment.manual?.right?.pose);
  const hasNonManual = Boolean(segment.nonManual?.mouth && segment.nonManual?.brows && segment.nonManual?.head);
  if (segment.signId === 'FINGERSPELL') return 'human_video';
  if (segment.confidence < MIN_AVATAR_CONFIDENCE) return 'human_video';
  if (!hasManual || !hasNonManual) return 'human_video';
  return 'avatar3d';
}
