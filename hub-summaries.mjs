// Pure, read-only summaries. Missing data is not evidence that everybody left.
export const MUSIC_ORIGIN = 'https://musique.olycity.fr';
export const values = data => data && typeof data === 'object' ? Object.values(data).filter(v => v && typeof v === 'object') : [];
export const text = (value, limit = 100) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export function stamp(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n < 10_000_000_000 ? n * 1000 : n : 0; }
export function fresh(record, now, ttl) {
  const ts = Math.max(stamp(record?.ts), stamp(record?.heartbeatAt), stamp(record?.updatedAt));
  return ts > 0 && ts <= now + 60_000 && now - ts < ttl;
}
export function safeImage(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
}
const joinPeople = list => list.length > 2 ? `${list.slice(0, 2).join(' et ')} +${list.length - 2}` : list.join(' et ');
export function trackerSummary(valorant, league, now = Date.now(), maps = []) {
  const sessions = [...values(valorant).map(s => ({...s, family:'valorant'})), ...values(league).map(s => ({...s, family:'lol'}))]
    .filter(s => s.active === true && fresh(s, now, 180_000));
  const groups = new Map();
  for (const s of sessions) {
    const map = text(s.mapDisplay || s.mapClean || s.map);
    const key = `${s.family}:${text(s.matchId) || [map, text(s.mode || s.phase), text(s.memberId || s.member)].join(':')}`;
    const group = groups.get(key) || [];
    group.push(s); groups.set(key, group);
  }
  const group = [...groups.values()].sort((a,b) => b.length - a.length || Math.max(...b.map(s => stamp(s.ts))) - Math.max(...a.map(s => stamp(s.ts))))[0];
  if (!group) return null;
  const s = group[0];
  const names = [...new Set(group.map(s => text(s.member || s.memberName)).filter(Boolean))];
  const members = [...new Set(group.map(s => text(s.memberId)).filter(Boolean))];
  const isVal = s.family === 'valorant';
  const isTft = !isVal && /tft|teamfight/i.test(String(s.game || s.mode || s.modeLabel || ''));
  const rawMap = text(s.mapDisplay || s.mapClean || s.map);
  const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapped = maps.find(m => norm(m.displayName) === norm(rawMap) || norm(m.mapUrl?.split('/').pop()) === norm(rawMap));
  const pregame = s.phase === 'pregame' || s.mode === 'agent-select' || s.phase === 'ChampSelect';
  return {
    title:isVal ? text(mapped?.displayName || rawMap) || 'Partie Valorant' : isTft ? 'Teamfight Tactics' : 'League of Legends',
    detail:names.length ? `${joinPeople(names)} · ${pregame ? 'En sélection' : 'En partie'}` : `${group.length} membre${group.length > 1 ? 's' : ''} · ${pregame ? 'En sélection' : 'En partie'}`,
    label:pregame ? 'En sélection' : 'En partie',
    kicker:isVal ? 'Valorant' : isTft ? 'TFT' : 'League of Legends',
    image:isVal ? safeImage(mapped?.splash) : '',
    family:isVal ? 'valorant' : 'lol', members,
    recovering:group.every(s => !fresh(s, now, 60_000)),
    extra:groups.size > 1 ? `${groups.size} parties suivies` : text(s.server || s.modeLabel),
  };
}
export function nightSummary(plan, now = Date.now()) {
  if (!plan || typeof plan !== 'object') return null;
  const options = values(plan.options).length ? values(plan.options) : plan.date ? [{id:'slot-1',date:plan.date,time:plan.time}] : [];
  const candidates = options.map(o => ({...o, startsAt:Date.parse(`${text(o.date)}T${/^\d{2}:\d{2}$/.test(o.time) ? o.time : '21:30'}:00`)}))
    .filter(o => Number.isFinite(o.startsAt) && o.startsAt >= now - 3 * 3600_000);
  if (!candidates.length) return null;
  // Never silently substitute a different slot when the chosen one expired.
  const slot = plan.final?.optionId ? candidates.find(o => o.id === plan.final.optionId) : candidates.sort((a,b) => a.startsAt - b.startsAt)[0];
  if (!slot) return null;
  const games = values(plan.games);
  const game = games.find(g => g.id === plan.final?.gameId) || games[0];
  const confirmed = values(plan.responses).filter(r => r.availability ? r.availability[slot.id] === 'yes' : r.status === 'yes');
  const d = new Date(slot.startsAt);
  const day = d.toLocaleDateString('fr-FR', {timeZone:'Europe/Paris',day:'numeric',month:'short'});
  return {
    title:text(game?.title || plan.gameTitle) || 'Soirée OLYCITY',
    detail:`${day} · ${text(slot.time) || '21:30'} · ${confirmed.length} confirmé${confirmed.length > 1 ? 's' : ''}`,
    label:plan.final ? 'Prévue' : 'À décider',
    image:safeImage(game?.coverUrl),
    members:confirmed.map(p => text(p.memberId)).filter(Boolean),
    kicker:plan.final ? 'Prochaine soirée' : 'Vote en cours',
  };
}
export function receiverSummary(receivers, now = Date.now()) {
  const count = values(receivers).filter(r => r.enabled !== false && fresh(r, now, 300_000)).length;
  return {count,title:count ? `${count} écran${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}` : 'Un mème bien placé.',
    detail:count ? 'Images, GIF et extraits vidéo, directement en jeu.' : 'La réception se lance avec OLYCITY Live.',label:count ? `${count} connecté${count > 1 ? 's' : ''}` : 'Au calme'};
}
export function musicSummaryMessage(event, frameWindow, origin = MUSIC_ORIGIN) {
  if (!frameWindow || event.source !== frameWindow || event.origin !== origin || event.data?.type !== 'olycity:music-summary') return null;
  const data = event.data;
  if (!['loading','login','ready','offline'].includes(data.status)) return null;
  const ready = data.status === 'ready';
  return {status:data.status,title:ready ? text(data.title,160) : '',author:ready ? text(data.author) : '',artwork:ready ? safeImage(data.artwork) : '',paused:data.paused === true};
}
