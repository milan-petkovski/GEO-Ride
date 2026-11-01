/**
 * @file profile-ui.js
 * @description Pilot hub integrated into Settings: stats, leaderboards, challenges, achievements and share cards.
 */

import './profile.css';
import { state, saveState } from './state.js';
import { trackEvent } from './analytics.js';
import { openProModal, showToast, openSettings, closeSettings } from './ui.js';
import { ACHIEVEMENT_GROUPS, COUNTRIES, evaluate, formatNumber, getSnapshot, setCountry } from './progress.js';
import {
    BOARDS,
    FREE_ROWS,
    PRO_ROWS,
    SCOPES,
    fetchLeaderboard,
    isLeaderboardAvailable,
    submitProgress
} from './leaderboard.js';
import { shareCard } from './share-card.js';

const ICONS = {
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 3l3.5 6 3.5-6M9 10l-2-7M15 10l2-7"/>',
    crown: '<path d="M2 20h20M5 20L3 8l5 4 4-7 4 7 5-4-2 12z"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-7 0-3-1.6-5-3.5-7-.4 1.6-1.4 2.6-2.5 3 .5-3-.8-6-3.5-8-.2 3-2 4.4-3.2 6.2C5.2 11.1 5 12.9 5 15c0 4.2 3 7 7 7z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a10 10 0 1 1 17.4 0"/>',
    road: '<path d="M4 22L8 2M20 22L16 2M12 4v3M12 11v3M12 18v3"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    radio: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
};

const GROUP_ICON = {
    drift: 'flame',
    speed: 'gauge',
    distance: 'road',
    explore: 'pin',
    habit: 'target',
    elite: 'crown'
};

const SUBTABS = [
    { id: 'profile', label: 'PROFILE & STATS', icon: 'user' },
    { id: 'ranks', label: 'LEADERBOARD', icon: 'trophy' },
    { id: 'challenges', label: 'CHALLENGES', icon: 'target' },
    { id: 'achievements', label: 'ACHIEVEMENTS', icon: 'medal' }
];

const ROADMAP_MILESTONES = [
    [5, 'Web Radio Stations', 'Live Synthwave, Lo-Fi & Tokyo Phonk streams', 'radio'],
    [10, 'Live City Radar', 'Real-time global city detection & arrival banners', 'pin'],
    [25, '3D Satellite Terrain Elevation', 'True-to-life 3D mountain topography & elevation', 'road'],
    [50, 'Grand Master', 'Prestigious golden title & elite leaderboard prestige', 'crown'],
    [75, 'Supreme Pilot', 'Mythic pilot rank recognized worldwide', 'medal'],
    [100, 'GEO Immortal', 'Max pilot ascension & permanent legend status', 'flame']
];

const ui = {
    subtab: 'profile',
    board: 'daily',
    scope: 'global',
    achFilter: 'all',
    boardData: null,
    boardKey: '',
    boardToken: 0,
    settingsPanel: null,
    countdownTimer: null,
    bound: false
};

function icon(name, cls = '') {
    return `<svg class="pf-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function esc(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
    );
}

function formatDuration(ms) {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatPlayTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function countryName(code) {
    return COUNTRIES.find(([cc]) => cc === code)?.[1] || '';
}

function bar(pct, cls = '') {
    return `<div class="pf-bar ${cls}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
}

/* --------------------------------------------------------------------------
   Subtab views
   -------------------------------------------------------------------------- */

function renderRoadmap(snap) {
    const userLv = snap.level.level;
    const isPro = snap.isPro;

    const cards = ROADMAP_MILESTONES.map(([levelReq, title, desc, ic]) => {
        const unlocked = isPro || userLv >= levelReq;
        const progressPct = unlocked ? 100 : Math.min(100, Math.floor((userLv / levelReq) * 100));
        const badge = isPro
            ? `<span class="pf-rm-pill is-pro">${icon('crown')}PRO UNLOCKED</span>`
            : unlocked
              ? `<span class="pf-rm-pill is-unlocked">${icon('check')}UNLOCKED</span>`
              : `<span class="pf-rm-pill is-locked">${icon('lock')}LV ${levelReq} (${userLv}/${levelReq})</span>`;

        return `<div class="pf-rm-card ${unlocked ? 'is-unlocked' : 'is-locked'} ${isPro ? 'is-pro' : ''}">
            <div class="pf-rm-lv"><span class="pf-rm-lv-num">${levelReq}</span><span class="pf-rm-lv-lbl">LV</span></div>
            <div class="pf-rm-main">
                <div class="pf-rm-top">
                    <div class="pf-rm-title-wrap">${icon(ic, 'pf-rm-ic')}<strong>${esc(title)}</strong></div>
                    ${badge}
                </div>
                <div class="pf-rm-desc">${esc(desc)}</div>
                ${unlocked ? '' : bar(progressPct, 'pf-rm-bar')}
            </div>
        </div>`;
    }).join('');

    const proAction = isPro
        ? `<span class="pf-rm-tag">${icon('crown')}All Unlocked</span>`
        : `<button type="button" class="pf-rm-pro-btn" data-action="pro">${icon('crown')}Skip Grind with Pro</button>`;

    return `<section class="pf-roadmap">
        <div class="pf-rm-header">
            <div>
                <span class="pf-rm-kicker">${icon('target')}PILOT PROGRESSION</span>
                <h3 class="pf-rm-heading">PILOT ROADMAP</h3>
                <p class="pf-rm-sub">${isPro ? 'Pro VIP Pass skips the grind and unlocks all features from Level 1.' : 'Level up to unlock radio stations, city radar, 3D terrain, and elite titles.'}</p>
            </div>
            ${proAction}
        </div>
        <div class="pf-rm-list">${cards}</div>
    </section>`;
}

function renderProfile(snap) {
    const s = snap.stats;
    const initial = esc((state.playerName || 'P').trim().charAt(0).toUpperCase() || 'P');
    const proBoost = snap.isPro
        ? `<span class="pf-chip pf-chip-pro">${icon('crown')}PRO XP x${snap.multiplier.toFixed(2)}</span>`
        : `<button type="button" class="pf-chip pf-chip-lock" data-action="pro">${icon('lock')}Pro earns 1.5x XP</button>`;
    const countryOptions = [`<option value="">Select country</option>`]
        .concat(
            [...COUNTRIES]
                .sort((x, y) => x[1].localeCompare(y[1]))
                .map(
                    ([cc, name]) =>
                        `<option value="${cc}"${cc === snap.country ? ' selected' : ''}>${esc(name)}</option>`
                )
        )
        .join('');
    const proReady = snap.achievements.filter((x) => x.status === 'pro_ready').length;
    const freezeNote = snap.isPro
        ? 'Pro streak freeze: one missed day per week is forgiven.'
        : 'Pro streak freeze forgives one missed day per week.';

    const tiles = [
        ['Total Drift', `${formatNumber(s.totalDrift)} PTS`, 'flame'],
        ['Best Drift', `${formatNumber(s.bestCombo)} PTS`, 'bolt'],
        ['Top Speed', `${formatNumber(Math.max(s.topSpeed || 0, s.godTopSpeed || 0))} KM/H`, 'gauge'],
        ['Distance', `${s.distanceKm.toFixed(1)} KM`, 'road'],
        ['Drive Time', formatPlayTime(s.playSeconds), 'clock'],
        ['Drifts Banked', formatNumber(s.banks), 'target'],
        ['Locations', formatNumber(s.spots.length), 'pin'],
        ['Photos', formatNumber(s.photos), 'camera']
    ]
        .map(
            ([label, value, ic]) =>
                `<div class="pf-tile">${icon(ic)}<span class="pf-tile-label">${label}</span><span class="pf-tile-value">${value}</span></div>`
        )
        .join('');

    return `
    <section class="pf-hero ${snap.isPro ? 'is-pro' : ''}">
        <div class="pf-ring" style="--pf-pct:${snap.level.pct}">
            <div class="pf-avatar">${initial}</div>
            <span class="pf-lv">LV ${snap.level.level}</span>
        </div>
        <div class="pf-hero-main">
            <label class="pf-name-wrap">
                <span class="pf-sr">Pilot name</span>
                <input id="pf-name" class="pf-name" type="text" maxlength="16" value="${esc(state.playerName || 'Pilot')}" autocomplete="off" spellcheck="false" />
            </label>
            <div class="pf-title">${esc(snap.title)}${snap.isPro ? ` <span class="pf-pro-pill">${icon('crown')}PRO</span>` : ''}</div>
            <div class="pf-xp-row">
                ${bar(snap.level.pct, 'pf-bar-xp')}
                <span class="pf-xp-text">${formatNumber(snap.level.into)} / ${formatNumber(snap.level.needed)} XP</span>
            </div>
            <div class="pf-chips">${proBoost}
                <select id="pf-country" class="pf-select" aria-label="Country">${countryOptions}</select>
            </div>
        </div>
    </section>

    <section class="pf-streak">
        <div class="pf-streak-flame ${snap.streak > 0 ? 'on' : ''}">${icon('flame')}</div>
        <div class="pf-streak-text">
            <strong>${snap.streak} day streak</strong>
            <span>Best ${snap.bestStreak} days. Clear one daily challenge to keep it alive. ${freezeNote}</span>
        </div>
    </section>

    <section class="pf-tiles">${tiles}</section>

    ${renderRoadmap(snap)}

    <section class="pf-summary">
        <div><strong>${snap.unlockedCount}</strong><span>of ${snap.achievements.length} awards</span></div>
        <div><strong>${s.dailyDone}</strong><span>daily cleared</span></div>
        <div><strong>${s.weeklyDone}</strong><span>weekly cleared</span></div>
    </section>

    <div class="pf-actions">
        <button type="button" class="pf-btn pf-btn-primary" data-action="share-profile">${icon('share')}Share profile</button>
        <button type="button" class="pf-btn" data-action="download-profile">${icon('download')}Save card</button>
    </div>

    ${
        snap.isPro
            ? ''
            : `<section class="pf-upsell">
        <div class="pf-upsell-header">
            <span class="pf-pro-pill">${icon('crown')}VIP PASS</span>
            <h4 class="pf-upsell-title">Level Up Faster &amp; Dominate Ranks</h4>
            <p class="pf-upsell-desc">Instant Complete Roadmap unlock, God Mode, 1.5x XP Boost, and elite cosmetics.</p>
        </div>
        <div class="pf-upsell-grid">
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('bolt')}</div>
                <div class="pf-feat-text">
                    <strong>1.5x XP Boost</strong>
                    <span>50% extra XP on every drift &amp; challenge</span>
                </div>
            </div>
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('crown')}</div>
                <div class="pf-feat-text">
                    <strong>VIP Challenges</strong>
                    <span>Bonus daily &amp; weekly challenges with huge XP</span>
                </div>
            </div>
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('medal')}</div>
                <div class="pf-feat-text">
                    <strong>12 Pro Achievements</strong>
                    <span>${proReady ? `<strong class="pf-glow-text">${proReady} completed &amp; waiting!</strong>` : 'Exclusive rewards and prestige badges'}</span>
                </div>
            </div>
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('flame')}</div>
                <div class="pf-feat-text">
                    <strong>Streak Freeze</strong>
                    <span>Protects your streak if you miss a day</span>
                </div>
            </div>
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('trophy')}</div>
                <div class="pf-feat-text">
                    <strong>Top 100 Ranks</strong>
                    <span>Full leaderboard depth &amp; rival tracker</span>
                </div>
            </div>
            <div class="pf-upsell-feat">
                <div class="pf-feat-icon">${icon('gauge')}</div>
                <div class="pf-feat-text">
                    <strong>God Mode 1,000+ km/h</strong>
                    <span>Ghost vehicle &amp; purple tire smoke</span>
                </div>
            </div>
        </div>
        ${
            proReady
                ? `<div class="pf-upsell-callout">${icon('crown')}<span>You have <strong>${proReady} Pro Achievement${proReady > 1 ? 's' : ''}</strong> completed and waiting to claim!</span></div>`
                : ''
        }
        <button type="button" class="pf-btn pf-btn-pro" data-action="pro">${icon('crown')}<span>Unlock GEO Ride Pro</span></button>
        <div class="pf-upsell-sub">Instant activation &bull; One-time purchase &bull; Lifetime access</div>
    </section>`
    }`;
}

function renderRanksShell(snap) {
    const boardTabs = BOARDS.map(
        (b) =>
            `<button type="button" class="pf-seg ${ui.board === b.id ? 'active' : ''}" data-board="${b.id}">${b.label}</button>`
    ).join('');
    const scopeTabs = SCOPES.map((sc) => {
        const label = sc.id === 'country' && snap.country ? `${sc.label} (${snap.country})` : sc.label;
        return `<button type="button" class="pf-chipbtn ${ui.scope === sc.id ? 'active' : ''}" data-scope="${sc.id}">${esc(label)}</button>`;
    }).join('');
    const hint = BOARDS.find((b) => b.id === ui.board)?.hint || '';
    return `
    <div class="pf-segs" role="tablist">${boardTabs}</div>
    <div class="pf-scopes">${scopeTabs}</div>
    <p class="pf-hint">${esc(hint)}</p>
    <div id="pf-board-list" class="pf-board-list" aria-live="polite">${renderBoardList(snap)}</div>`;
}

function renderBoardList(snap) {
    const data = ui.boardData;
    if (!data) {
        return `<div class="pf-skeleton"></div><div class="pf-skeleton"></div><div class="pf-skeleton"></div>`;
    }
    if (data.offline) {
        return `<div class="pf-empty">${icon('trophy')}<strong>Leaderboard unavailable</strong><span>${
            isLeaderboardAvailable()
                ? 'Could not reach the server. Try again in a moment.'
                : 'Online ranking is not configured in this build.'
        }</span></div>`;
    }
    const board = BOARDS.find((b) => b.id === ui.board);
    const unit = board?.unit || '';
    if (!data.entries.length) {
        const own = snap.stats.bestCombo > 0 || snap.stats.topSpeed > 0 || snap.stats.godTopSpeed > 0;
        return `<div class="pf-empty">${icon('trophy')}<strong>No scores on this board yet</strong><span>${
            own ? 'Your scores sync automatically. Drive on and claim rank 1.' : 'Bank a drift to claim rank 1.'
        }</span></div>`;
    }

    const maxRows = snap.isPro ? PRO_ROWS : FREE_ROWS;
    const rows = data.entries
        .map((e) => {
            const medal = e.rank <= 3 ? `pf-rank-${e.rank}` : '';
            return `<div class="pf-row ${e.is_me ? 'is-me' : ''} ${e.is_pro ? 'is-pro' : ''}">
                <span class="pf-rank ${medal}">${e.rank}</span>
                <span class="pf-row-name">
                    <span class="pf-row-pilot-line">${esc(e.name)}${e.is_pro ? `<span class="pf-pro-pill">${icon('crown')}PRO</span>` : ''}</span>
                    <small>LV ${esc(e.level)}${e.country ? ` &middot; ${esc(e.country)}` : ''}</small>
                </span>
                <span class="pf-row-score">${formatNumber(e.score)}<small>${unit}</small></span>
            </div>`;
        })
        .join('');

    let meBlock = '';
    if (data.me) {
        const rank = data.me.rank;
        let gap = '';
        const above = data.entries.find((e) => e.rank === rank - 1);
        if (rank > 1 && above) {
            gap = snap.isPro
                ? `<span class="pf-gap">${formatNumber(above.score - data.me.score)} ${unit} to pass #${rank - 1}</span>`
                : `<button type="button" class="pf-gap pf-gap-lock" data-action="pro">${icon('lock')}Rival gap is a Pro feature</button>`;
        }
        meBlock = `<div class="pf-me">
            <div><span class="pf-me-label">Your rank</span><strong>#${formatNumber(rank)}</strong><span class="pf-me-total">of ${formatNumber(data.total)}</span></div>
            <div class="pf-me-score">${formatNumber(data.me.score)} ${unit}</div>
            ${gap}
        </div>`;
    } else {
        meBlock = `<div class="pf-me pf-me-none"><span>You are not ranked here yet. Bank a score to appear on this board.</span></div>`;
    }

    const lock =
        !snap.isPro && data.total > FREE_ROWS
            ? `<button type="button" class="pf-lockrow" data-action="pro">${icon('lock')}<span>Pro unlocks the full top ${maxRows}. ${formatNumber(
                  data.total - FREE_ROWS
              )} more pilots ranked here.</span></button>`
            : '';

    return `${meBlock}<div class="pf-rows">${rows}</div>${lock}
    <div class="pf-actions">
        <button type="button" class="pf-btn pf-btn-primary" data-action="share-rank" ${data.me ? '' : 'disabled'}>${icon('share')}Share my rank</button>
    </div>`;
}

function challengeItemHtml(item, snap) {
    const p = item.progress;
    const done = item.status === 'claimed';
    const ready = item.status === 'ready';
    const bonusLocked = item.bonus && !snap.isPro;
    let state_ = `<span class="pf-reward ${item.bonus ? 'pf-reward-pro' : ''}">${item.bonus ? icon('bolt') : ''}+${formatNumber(item.xp)} XP</span>`;
    if (done) state_ = `<span class="pf-done">${icon('check')}Cleared</span>`;
    else if (ready) {
        state_ = snap.isPro
            ? `<span class="pf-done pf-done-ready">${icon('check')}Ready</span>`
            : `<button type="button" class="pf-claim pf-claim-pro" data-action="pro">${icon('crown')}Pro to claim +${formatNumber(item.xp)}</button>`;
    }

    const tierBadge = item.bonus
        ? `<div class="pf-ch-pro-badge-group">
            <span class="pf-pro-pill">${icon('crown')}PRO BONUS</span>
            <span class="pf-ch-period-label">${item.id.startsWith('w_') ? 'Weekly VIP' : 'Daily VIP'}</span>
          </div>`
        : `<span class="pf-ch-tier">${['Easy', 'Medium', 'Hard', 'Bonus'][item.tier] || ''}</span>`;

    let footExtra = '';
    if (bonusLocked && !ready) {
        footExtra = `<button type="button" class="pf-pro-unlock-pill" data-action="pro">${icon('lock')}<span>Progress counts &bull; Unlock Pro</span></button>`;
    } else if (item.bonus && ready && !snap.isPro) {
        footExtra = `<span class="pf-pro-ready-hint">${icon('crown')}Goal reached! Claim with Pro</span>`;
    }

    return `<div class="pf-challenge ${done ? 'is-done' : ''} ${item.bonus ? 'is-bonus' : ''} ${ready ? 'is-ready' : ''}">
        <div class="pf-ch-top">
            ${tierBadge}
            ${state_}
        </div>
        <div class="pf-ch-label">${esc(item.label)}</div>
        ${bar(done || ready ? 100 : p.pct, item.bonus ? 'pf-bar-pro' : '')}
        <div class="pf-ch-foot">
            <span class="pf-ch-count">${formatNumber(Math.min(p.raw, item.target))} / ${formatNumber(item.target)}</span>
            ${footExtra}
        </div>
    </div>`;
}

function renderChallenges(snap) {
    const dailyDone = snap.daily.items.filter((i) => !i.bonus && i.status === 'claimed').length;
    const allDaily = dailyDone === snap.daily.items.filter((i) => !i.bonus).length;
    return `
    <section class="pf-period">
        <header class="pf-period-head">
            <div><h3>Daily Challenges</h3><span class="pf-sub">${dailyDone} of 3 cleared</span></div>
            <div class="pf-timer">${icon('clock')}<span data-countdown="daily">${formatDuration(snap.daily.resetsInMs)}</span></div>
        </header>
        ${snap.daily.items.map((i) => challengeItemHtml(i, snap)).join('')}
        ${
            allDaily
                ? `<div class="pf-actions"><button type="button" class="pf-btn pf-btn-primary" data-action="share-challenge">${icon('share')}Share daily clear</button></div>`
                : ''
        }
    </section>
    <section class="pf-period">
        <header class="pf-period-head">
            <div><h3>Weekly Challenges</h3><span class="pf-sub">Bigger goals, bigger rewards</span></div>
            <div class="pf-timer">${icon('clock')}<span data-countdown="weekly">${formatDuration(snap.weekly.resetsInMs)}</span></div>
        </header>
        ${snap.weekly.items.map((i) => challengeItemHtml(i, snap)).join('')}
    </section>
    <p class="pf-foot-note">Streak: ${snap.streak} days. XP multiplier x${snap.multiplier.toFixed(2)}${snap.isPro ? ' (Pro active)' : ''}.</p>`;
}

function renderAchievements(snap) {
    const filters = [
        ['all', 'All'],
        ['free', 'Free'],
        ['pro', 'Pro']
    ]
        .map(
            ([id, label]) =>
                `<button type="button" class="pf-chipbtn ${ui.achFilter === id ? 'active' : ''}" data-ach="${id}">${label}</button>`
        )
        .join('');
    const list = snap.achievements.filter((x) => ui.achFilter === 'all' || x.tier === ui.achFilter);
    const groups = Object.keys(ACHIEVEMENT_GROUPS)
        .map((gid) => {
            const items = list.filter((x) => x.group === gid);
            if (!items.length) return '';
            const cards = items
                .map((x) => {
                    const unlocked = x.status === 'unlocked';
                    const proReady = x.status === 'pro_ready';
                    const isPro = x.tier === 'pro';
                    const proLocked = isPro && !snap.isPro;
                    let right = `<span class="pf-reward ${isPro ? 'pf-reward-pro' : ''}">${isPro ? icon('bolt') : ''}+${formatNumber(x.xp)} XP</span>`;
                    if (unlocked) right = `<span class="pf-done">${icon('check')}Unlocked</span>`;
                    else if (proReady)
                        right = `<button type="button" class="pf-claim pf-claim-pro" data-action="pro">${icon('crown')}Pro to claim</button>`;
                    return `<div class="pf-ach ${unlocked ? 'is-unlocked' : ''} ${isPro ? 'is-pro' : ''} ${proReady ? 'is-ready' : ''}">
                        <div class="pf-ach-icon ${isPro ? 'is-pro-icon' : ''}">${icon(unlocked || !proLocked ? GROUP_ICON[x.group] : 'lock')}</div>
                        <div class="pf-ach-body">
                            <div class="pf-ach-top">
                                <strong>${esc(x.name)}</strong>
                                ${isPro ? `<span class="pf-pro-pill">${icon('crown')}PRO</span>` : ''}
                            </div>
                            <span class="pf-ach-desc">${esc(x.desc)}</span>
                            ${unlocked ? '' : bar(x.progress.pct, isPro ? 'pf-bar-pro' : '')}
                        </div>
                        <div class="pf-ach-side">${right}</div>
                    </div>`;
                })
                .join('');
            return `<section class="pf-group"><h3>${ACHIEVEMENT_GROUPS[gid]}</h3>${cards}</section>`;
        })
        .join('');
    return `<div class="pf-ach-head"><strong>${snap.unlockedCount} / ${snap.achievements.length}</strong><span>unlocked</span></div>
    <div class="pf-scopes">${filters}</div>${groups}`;
}

/* --------------------------------------------------------------------------
   Subtabs bar and container
   -------------------------------------------------------------------------- */

function renderSubtabsNav() {
    return `
    <div class="pf-header-bar">
        <span class="pf-header-title">PILOT HUB</span>
        <button type="button" class="pf-refresh-btn" data-action="refresh-hub" title="Refresh progress and rankings">
            ${icon('refresh')}
            <span>REFRESH</span>
        </button>
    </div>
    <nav class="pf-subtabs" role="tablist" aria-label="Pilot Hub Navigation">
        ${SUBTABS.map(
            (t) => `
            <button
                type="button"
                role="tab"
                class="pf-subtab ${ui.subtab === t.id ? 'active' : ''}"
                data-subtab="${t.id}"
                aria-selected="${ui.subtab === t.id ? 'true' : 'false'}"
            >
                ${icon(t.icon)}
                <span>${t.label}</span>
            </button>`
        ).join('')}
    </nav>`;
}

function renderSubcontent(snap) {
    switch (ui.subtab) {
        case 'ranks':
            return renderRanksShell(snap);
        case 'challenges':
            return renderChallenges(snap);
        case 'achievements':
            return renderAchievements(snap);
        case 'profile':
        default:
            return renderProfile(snap);
    }
}

export function renderSettingsCareerTab(subtab = null) {
    if (subtab) {
        if (subtab === 'career') ui.subtab = 'profile';
        else if (SUBTABS.some((t) => t.id === subtab)) ui.subtab = subtab;
    }
    const pane = document.getElementById('sx-pane-career');
    if (!pane) return;

    const snap = getSnapshot();
    pane.innerHTML = `
        ${renderSubtabsNav()}
        <div id="pf-subcontent" class="pf-subcontent">${renderSubcontent(snap)}</div>
    `;

    if (ui.subtab === 'ranks') {
        submitProgress().finally(loadBoard);
    }
}

export function switchSubtab(subtabId) {
    if (!SUBTABS.some((t) => t.id === subtabId)) return;
    ui.subtab = subtabId;
    trackEvent('profile_tab', { tab: subtabId });

    const pane = document.getElementById('sx-pane-career');
    if (pane) {
        pane.querySelectorAll('[data-subtab]').forEach((b) => {
            const on = b.dataset.subtab === subtabId;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        const subcontent = document.getElementById('pf-subcontent');
        if (subcontent) {
            subcontent.innerHTML = renderSubcontent(getSnapshot());
        }
    }

    if (subtabId === 'ranks') {
        submitProgress().finally(loadBoard);
    }
}

async function loadBoard() {
    const snap = getSnapshot();
    const token = ++ui.boardToken;
    const limit = snap.isPro ? PRO_ROWS : FREE_ROWS;
    ui.boardData = null;
    const list = document.getElementById('pf-board-list');
    if (list) list.innerHTML = renderBoardList(snap);
    const data = await fetchLeaderboard({ board: ui.board, scope: ui.scope, limit });
    if (token !== ui.boardToken || ui.subtab !== 'ranks') return;
    ui.boardData = data;
    ui.boardKey = `${ui.board}|${ui.scope}`;
    const target = document.getElementById('pf-board-list');
    if (target) target.innerHTML = renderBoardList(getSnapshot());
}

function rankShareContext() {
    const data = ui.boardData;
    const board = BOARDS.find((b) => b.id === ui.board);
    const scope = SCOPES.find((sc) => sc.id === ui.scope);
    if (!data?.me || !board) return null;
    const snap = getSnapshot();
    const scopeLabel = ui.scope === 'country' ? countryName(snap.country) || 'My Country' : scope.label;
    return {
        rank: data.me.rank,
        total: data.total,
        score: data.me.score,
        board: board.label,
        unit: board.unit,
        scope: scopeLabel
    };
}

async function handleShare(kind, mode) {
    const snap = getSnapshot();
    const context = kind === 'rank' ? rankShareContext() : null;
    if (kind === 'rank' && !context) return;
    const method = await shareCard({ kind, snap, name: state.playerName || 'Pilot', rank: context, mode });
    trackEvent('share_result', { kind, method, pro: snap.isPro });
    if (method === 'saved') showToast('CARD SAVED', 'Image downloaded and caption copied to clipboard.');
    else if (method === 'copied') showToast('CAPTION COPIED', 'Paste it anywhere to challenge your friends.');
}

function onClick(e) {
    const target = e.target.closest('button, [data-action]');
    if (!target) return;
    const { subtab, board, scope, ach, action } = target.dataset;

    if (subtab) {
        return switchSubtab(subtab);
    }
    if (board) {
        ui.board = board;
        const panel = ui.settingsPanel || document.getElementById('settings-panel');
        panel?.querySelectorAll('[data-board]').forEach((b) => b.classList.toggle('active', b.dataset.board === board));
        return loadBoard();
    }
    if (scope) {
        ui.scope = scope;
        const panel = ui.settingsPanel || document.getElementById('settings-panel');
        panel?.querySelectorAll('[data-scope]').forEach((b) => b.classList.toggle('active', b.dataset.scope === scope));
        return loadBoard();
    }
    if (ach) {
        ui.achFilter = ach;
        const subcontent = document.getElementById('pf-subcontent');
        if (subcontent && ui.subtab === 'achievements') {
            subcontent.innerHTML = renderAchievements(getSnapshot());
        }
        return;
    }
    if (action === 'refresh-hub') {
        const btn = target.closest('.pf-refresh-btn');
        if (btn) btn.classList.add('spinning');
        evaluate();
        submitProgress({ force: true }).finally(() => {
            if (ui.subtab === 'ranks') loadBoard();
            const subcontent = document.getElementById('pf-subcontent');
            if (subcontent) {
                subcontent.innerHTML = renderSubcontent(getSnapshot());
            }
            setTimeout(() => btn?.classList.remove('spinning'), 500);
            showToast('SYNCED', 'Progress, challenges and ranks refreshed.');
        });
        return;
    }
    if (action === 'pro') {
        trackEvent('profile_pro_cta', { tab: ui.subtab });
        openProModal();
        return;
    }
    if (action === 'share-profile') return handleShare('profile', 'share');
    if (action === 'download-profile') return handleShare('profile', 'download');
    if (action === 'share-rank') return handleShare('rank', 'share');
    if (action === 'share-challenge') return handleShare('challenge', 'share');
}

function onChange(e) {
    if (e.target.id === 'pf-country') {
        setCountry(e.target.value);
        ui.boardData = null;
        submitProgress({ force: true });
        trackEvent('profile_country', { country: e.target.value || 'none' });
    } else if (e.target.id === 'pf-name') {
        const clean =
            e.target.value
                .replace(/[^\p{L}\p{N} _.-]/gu, '')
                .trim()
                .slice(0, 16) || 'Pilot';
        e.target.value = clean;
        state.playerName = clean;
        const mpInput = document.getElementById('mp-player-name');
        if (mpInput) mpInput.value = clean;
        saveState();
        submitProgress({ force: true });
        // Update avatar initial without interrupting input
        const avatar = document.querySelector('.pf-avatar');
        if (avatar) avatar.textContent = clean.charAt(0).toUpperCase();
    }
}

function onKeyDown(e) {
    if (e.target?.id === 'pf-name' && e.key === 'Enter') e.target.blur();
}

function startCountdown() {
    stopCountdown();
    ui.countdownTimer = setInterval(() => {
        const panel = ui.settingsPanel || document.getElementById('settings-panel');
        if (!panel?.classList.contains('active')) return;
        if (ui.subtab === 'challenges') {
            const snap = getSnapshot();
            const d = panel.querySelector('[data-countdown="daily"]');
            const w = panel.querySelector('[data-countdown="weekly"]');
            if (d) d.textContent = formatDuration(snap.daily.resetsInMs);
            if (w) w.textContent = formatDuration(snap.weekly.resetsInMs);
        }
    }, 30000);
    if (typeof ui.countdownTimer?.unref === 'function') ui.countdownTimer.unref();
}

function stopCountdown() {
    if (ui.countdownTimer) clearInterval(ui.countdownTimer);
    ui.countdownTimer = null;
}

export function initSettingsPilotHub(settingsPanel) {
    if (!settingsPanel) return;
    ui.settingsPanel = settingsPanel;
    if (!ui.bound) {
        ui.bound = true;
        settingsPanel.addEventListener('click', onClick);
        settingsPanel.addEventListener('change', onChange);
        settingsPanel.addEventListener('keydown', onKeyDown);
        startCountdown();
    }
}

export function refreshSettingsPilotHubIfOpen() {
    const panel = ui.settingsPanel || document.getElementById('settings-panel');
    if (!panel || !panel.classList.contains('active')) return;
    const careerPane = document.getElementById('sx-pane-career');
    if (!careerPane || careerPane.hidden) return;
    if (ui.subtab === 'ranks') return;
    const active = document.activeElement;
    if (active && panel.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
    const subcontent = document.getElementById('pf-subcontent');
    if (subcontent) {
        subcontent.innerHTML = renderSubcontent(getSnapshot());
    }
}

/* --------------------------------------------------------------------------
   Backwards compatible exports
   -------------------------------------------------------------------------- */

export function openProfileModal(tab = 'profile') {
    ui.subtab = tab === 'career' ? 'profile' : tab;
    openSettings('career');
    renderSettingsCareerTab(ui.subtab);
}

export function closeProfileModal() {
    closeSettings();
}

export function isProfileOpen() {
    const panel = ui.settingsPanel || document.getElementById('settings-panel');
    const isSettingsActive = panel?.classList.contains('active');
    const careerPane = document.getElementById('sx-pane-career');
    return !!(isSettingsActive && careerPane && !careerPane.hidden);
}

export function refreshProfileIfOpen() {
    refreshSettingsPilotHubIfOpen();
}
