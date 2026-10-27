// Annual forest changes need a continuous sequence; other exhibits keep their
// established reading time. This is independent of arrival and year crossfade.
export const climatePlaybackInterval=id=>id==='foresthistory'?1800:6500;
