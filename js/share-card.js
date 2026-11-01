/**
 * @file share-card.js
 * @description Renders shareable result cards on a canvas and shares them via the Web Share API,
 * with download and clipboard fallbacks.
 */

import { formatNumber } from './progress.js';

const SHARE_URL = 'https://playgeoride.com/?utm_source=share&utm_medium=card&utm_campaign=results';
const SIZE = 1080;

const FREE_THEME = { accent: '#00f2ff', accent2: '#0a84ff', frame: '#00f2ff', badge: null };
const PRO_THEME = { accent: '#d980fa', accent2: '#ffd166', frame: '#ffd166', badge: 'PRO' };

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function fitText(ctx, text, maxWidth, startSize, weight = '800') {
    let size = startSize;
    do {
        ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        size -= 2;
    } while (ctx.measureText(text).width > maxWidth && size > 18);
}

function drawBackground(ctx, theme) {
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bg.addColorStop(0, '#05060f');
    bg.addColorStop(0.55, '#0b1024');
    bg.addColorStop(1, '#14061f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    for (let i = -SIZE; i < SIZE * 2; i += 54) {
        ctx.beginPath();
        ctx.moveTo(i, SIZE);
        ctx.lineTo(i + SIZE * 0.6, 0);
        ctx.stroke();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(SIZE * 0.78, SIZE * 0.18, 10, SIZE * 0.78, SIZE * 0.18, SIZE * 0.6);
    glow.addColorStop(0, `${theme.accent}55`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.lineWidth = 6;
    const frame = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    frame.addColorStop(0, theme.frame);
    frame.addColorStop(1, theme.accent2);
    ctx.strokeStyle = frame;
    roundRect(ctx, 24, 24, SIZE - 48, SIZE - 48, 36);
    ctx.stroke();
}

function drawHeader(ctx, theme, name, subtitle) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GEO', 84, 128);
    const w = ctx.measureText('GEO ').width;
    ctx.fillStyle = theme.accent;
    ctx.fillText('RIDE', 84 + w, 128);

    if (theme.badge) {
        ctx.fillStyle = theme.frame;
        roundRect(ctx, SIZE - 214, 82, 130, 56, 28);
        ctx.fill();
        ctx.fillStyle = '#16091f';
        ctx.font = '900 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(theme.badge, SIZE - 149, 121);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    fitText(ctx, name, SIZE - 168, 84, '900');
    ctx.fillText(name, 84, 250);
    ctx.fillStyle = theme.accent;
    ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subtitle.toUpperCase(), 84, 304);
}

function drawTile(ctx, theme, x, y, w, h, label, value) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y, w, h, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x + 30, y + 52);
    ctx.fillStyle = '#ffffff';
    fitText(ctx, value, w - 60, 58, '900');
    ctx.fillText(value, x + 30, y + h - 34);
}

function drawFooter(ctx, theme, isPro) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('Beat me on GEO Ride', 84, SIZE - 96);
    ctx.fillStyle = theme.accent;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText('playgeoride.com', 84, SIZE - 52);
    if (!isPro) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.fillText('Free to play in your browser', SIZE - 84, SIZE - 52);
    }
}

/**
 * Draws a share card.
 * @param {{kind: 'profile'|'rank'|'challenge', snap: object, name: string, rank: object|null}} data
 * @returns {HTMLCanvasElement}
 */
export function drawShareCard({ kind, snap, name, rank }) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const theme = snap.isPro ? PRO_THEME : FREE_THEME;
    const s = snap.stats;

    drawBackground(ctx, theme);

    if (kind === 'rank' && rank) {
        drawHeader(ctx, theme, name, `${rank.board} / ${rank.scope}`);
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.accent;
        fitText(ctx, `#${formatNumber(rank.rank)}`, SIZE - 200, 300, '900');
        ctx.fillText(`#${formatNumber(rank.rank)}`, SIZE / 2, 640);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '700 40px system-ui, sans-serif';
        ctx.fillText(`of ${formatNumber(rank.total)} pilots`, SIZE / 2, 706);
        drawTile(ctx, theme, 84, 770, 440, 150, 'Score', `${formatNumber(rank.score)} ${rank.unit}`);
        drawTile(ctx, theme, 556, 770, 440, 150, 'Level', `LV ${snap.level.level} ${snap.title}`);
    } else if (kind === 'challenge') {
        drawHeader(ctx, theme, name, 'Daily challenges cleared');
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.accent;
        ctx.font = '900 190px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${snap.streak}`, SIZE / 2, 600);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 54px system-ui, sans-serif';
        ctx.fillText('DAY STREAK', SIZE / 2, 676);
        drawTile(ctx, theme, 84, 760, 440, 150, 'Level', `LV ${snap.level.level}`);
        drawTile(ctx, theme, 556, 760, 440, 150, 'Dailies cleared', formatNumber(s.dailyDone));
    } else {
        drawHeader(ctx, theme, name, `LV ${snap.level.level} ${snap.title}`);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.font = '700 28px system-ui, sans-serif';
        ctx.fillText('BEST DRIFT', 84, 400);
        ctx.fillStyle = theme.accent;
        ctx.font = '900 150px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        fitText(ctx, `${formatNumber(s.bestCombo)}`, SIZE - 168, 150, '900');
        ctx.fillText(formatNumber(s.bestCombo), 84, 540);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 36px system-ui, sans-serif';
        ctx.fillText('POINTS IN A SINGLE DRIFT', 84, 596);

        const tw = 440;
        const topSpeedVal = Math.max(s.topSpeed || 0, s.godTopSpeed || 0);
        drawTile(ctx, theme, 84, 650, tw, 130, 'Top speed', `${formatNumber(topSpeedVal)} KM/H`);
        drawTile(ctx, theme, 556, 650, tw, 130, 'Distance', `${s.distanceKm.toFixed(1)} KM`);
        drawTile(ctx, theme, 84, 800, tw, 130, 'Streak', `${snap.streak} days`);
        drawTile(ctx, theme, 556, 800, tw, 130, 'Awards', `${snap.unlockedCount} / ${snap.achievements.length}`);
    }

    drawFooter(ctx, theme, snap.isPro);
    return canvas;
}

function buildCaption({ kind, snap, rank }) {
    const s = snap.stats;
    if (kind === 'rank' && rank) {
        return `I am ranked #${formatNumber(rank.rank)} of ${formatNumber(rank.total)} on GEO Ride (${rank.board}, ${rank.scope}) with ${formatNumber(rank.score)} ${rank.unit}. Beat me: ${SHARE_URL}`;
    }
    if (kind === 'challenge') {
        return `${snap.streak} day streak on GEO Ride and all daily challenges cleared. Think you can keep up? ${SHARE_URL}`;
    }
    const topSpeedVal = Math.max(s.topSpeed || 0, s.godTopSpeed || 0);
    return `LV ${snap.level.level} ${snap.title} on GEO Ride. Best drift ${formatNumber(s.bestCombo)} pts, top speed ${formatNumber(topSpeedVal)} km/h. Beat me: ${SHARE_URL}`;
}

function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Builds the card and shares it.
 * @param {{kind: string, snap: object, name: string, rank: object|null, mode?: 'share'|'download'}} data
 * @returns {Promise<'shared'|'saved'|'copied'|'cancelled'|'failed'>}
 */
export async function shareCard(data) {
    try {
        const canvas = drawShareCard(data);
        const blob = await toBlob(canvas);
        const caption = buildCaption(data);
        const filename = `geo-ride-${data.kind}.png`;

        if (data.mode !== 'download' && typeof navigator !== 'undefined' && navigator.share && blob) {
            const file = new File([blob], filename, { type: 'image/png' });
            try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], text: caption, title: 'GEO Ride' });
                    return 'shared';
                }
                await navigator.share({ text: caption, title: 'GEO Ride' });
                return 'shared';
            } catch (err) {
                if (err && err.name === 'AbortError') return 'cancelled';
            }
        }

        if (blob) downloadBlob(blob, filename);
        const copied = await copyText(caption);
        if (blob) return 'saved';
        return copied ? 'copied' : 'failed';
    } catch (err) {
        console.warn('Share failed:', err);
        return 'failed';
    }
}
