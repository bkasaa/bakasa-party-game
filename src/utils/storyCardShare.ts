import { COURT_DARES } from '../data/courtData';
import { resolvePoolWithCustom } from './customContentStorage';

export interface StoryRankingEntry {
  name: string;
  score: number;
  accentHex?: string;
}

export interface StoryShareOptions {
  headline: string;
  entries: StoryRankingEntry[];
  loserName?: string | null;
  dareText?: string | null;
  subtitle?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapArabicLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function loadAppIcon(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 1200);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = '/app-icon.png';
  });
}

export async function generateStoryCardBlob(options: StoryShareOptions): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const fontStack = '"Cairo", "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif';

  // Rich evening party gradient backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, '#131C31');
  bgGrad.addColorStop(0.5, '#1B2542');
  bgGrad.addColorStop(1, '#261436');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative glowing ambient blobs
  const coralGlow = ctx.createRadialGradient(180, 260, 20, 180, 260, 440);
  coralGlow.addColorStop(0, 'rgba(255, 107, 74, 0.32)');
  coralGlow.addColorStop(1, 'rgba(255, 107, 74, 0)');
  ctx.fillStyle = coralGlow;
  ctx.fillRect(0, 0, 1080, 900);

  const tealGlow = ctx.createRadialGradient(900, 1520, 20, 900, 1520, 480);
  tealGlow.addColorStop(0, 'rgba(20, 184, 166, 0.28)');
  tealGlow.addColorStop(1, 'rgba(20, 184, 166, 0)');
  ctx.fillStyle = tealGlow;
  ctx.fillRect(0, 900, 1080, 1020);

  // Subtle decorative confetti dots
  const dotColors = ['#FBBF24', '#FF6B4A', '#2DD4BF', '#EC4899', '#A78BFA'];
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = dotColors[i % dotColors.length];
    ctx.globalAlpha = 0.28;
    const dx = ((i * 197) % 980) + 50;
    const dy = ((i * 313) % 1760) + 80;
    const dr = 5 + (i % 4) * 3;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Outer Glass Card Frame
  drawRoundedRect(ctx, 56, 72, 968, 1776, 52);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  // Logo + Brand Header
  const iconImg = await loadAppIcon();
  if (iconImg) {
    ctx.save();
    drawRoundedRect(ctx, 456, 120, 168, 168, 38);
    ctx.clip();
    ctx.drawImage(iconImg, 456, 120, 168, 168);
    ctx.restore();

    drawRoundedRect(ctx, 456, 120, 168, 168, 38);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 62px ${fontStack}`;
  ctx.fillText('قعدة الشلة 🏆', 540, 344);

  if (options.subtitle) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = `700 28px ${fontStack}`;
    ctx.fillText(options.subtitle, 540, 404);
  }

  // Headline Pill
  const headlineY = options.subtitle ? 470 : 440;
  drawRoundedRect(ctx, 110, headlineY - 40, 860, 80, 28);
  ctx.fillStyle = 'rgba(255, 107, 74, 0.2)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 107, 74, 0.6)';
  ctx.stroke();

  ctx.fillStyle = '#FFE4D6';
  ctx.font = `800 32px ${fontStack}`;
  const cleanHeadline =
    options.headline.length > 42 ? `${options.headline.slice(0, 40)}...` : options.headline;
  ctx.fillText(cleanHeadline, 540, headlineY);

  // Top 3 Winners
  const top3 = options.entries.slice(0, 3);
  const rankStyles = [
    {
      medal: '🥇 المركز الأول',
      bg: 'rgba(245, 158, 11, 0.22)',
      border: '#FBBF24',
      scoreColor: '#FDE68A',
      h: 170,
    },
    {
      medal: '🥈 المركز الثاني',
      bg: 'rgba(148, 163, 184, 0.16)',
      border: '#CBD5E1',
      scoreColor: '#E2E8F0',
      h: 148,
    },
    {
      medal: '🥉 المركز الثالث',
      bg: 'rgba(217, 119, 6, 0.16)',
      border: '#FB923C',
      scoreColor: '#FED7AA',
      h: 148,
    },
  ];

  let cursorY = headlineY + 95;
  top3.forEach((entry, idx) => {
    const st = rankStyles[idx] ?? rankStyles[2];
    drawRoundedRect(ctx, 104, cursorY, 872, st.h, 34);
    ctx.fillStyle = st.bg;
    ctx.fill();
    ctx.lineWidth = idx === 0 ? 4 : 2.5;
    ctx.strokeStyle = st.border;
    ctx.stroke();

    // Rank badge (Right side in RTL layout)
    ctx.textAlign = 'right';
    ctx.fillStyle = st.scoreColor;
    ctx.font = `800 26px ${fontStack}`;
    ctx.fillText(st.medal, 934, cursorY + 46);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = idx === 0 ? `900 46px ${fontStack}` : `900 40px ${fontStack}`;
    const displayName = entry.name.length > 18 ? `${entry.name.slice(0, 17)}…` : entry.name;
    ctx.fillText(displayName, 934, cursorY + st.h - 52);

    // Score on Left
    ctx.textAlign = 'left';
    ctx.fillStyle = st.scoreColor;
    ctx.font = `900 54px ${fontStack}`;
    ctx.fillText(`${entry.score}`, 148, cursorY + st.h / 2 - 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = `700 24px ${fontStack}`;
    ctx.fillText('نقطة', 148, cursorY + st.h / 2 + 34);

    cursorY += st.h + 26;
  });

  // Loser & Dare Spotlight Box (if distinct loser exists)
  const effectiveLoser =
    options.loserName ??
    (options.entries.length >= 2 &&
    options.entries[0].score > options.entries[options.entries.length - 1].score
      ? options.entries[options.entries.length - 1].name
      : null);

  if (effectiveLoser) {
    const darePool = resolvePoolWithCustom(COURT_DARES, 'dares');
    const finalDare =
      options.dareText ||
      darePool[Math.floor(Math.random() * Math.max(1, darePool.length))] ||
      'اعمل تحدي مضحك للشلة!';

    const boxTop = Math.max(cursorY + 24, 1180);
    const boxH = 380;

    drawRoundedRect(ctx, 104, boxTop, 872, boxH, 38);
    ctx.fillStyle = 'rgba(225, 29, 72, 0.18)';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.8)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDA4AF';
    ctx.font = `900 32px ${fontStack}`;
    ctx.fillText(`😈 المركز الأخير: ${effectiveLoser}`, 540, boxTop + 62);

    ctx.fillStyle = '#FECDD3';
    ctx.font = `800 26px ${fontStack}`;
    ctx.fillText('عقاب الخسران من القعدة:', 540, boxTop + 114);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 34px ${fontStack}`;
    const dareLines = wrapArabicLines(ctx, finalDare, 780, 4);
    dareLines.forEach((line, i) => {
      ctx.fillText(line, 540, boxTop + 178 + i * 48);
    });
  }

  // Footer Watermark
  drawRoundedRect(ctx, 120, 1684, 840, 110, 30);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#5EEAD4';
  ctx.font = `800 26px ${fontStack}`;
  ctx.fillText('العبها مع شلتك مجاناً:', 540, 1718);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 28px ${fontStack}`;
  ctx.fillText('qa3det-el-shella.vercel.app', 540, 1762);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

export async function shareStoryCardImage(
  options: StoryShareOptions
): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    const blob = await generateStoryCardBlob(options);
    if (!blob) return 'error';

    const file = new File([blob], 'qa3det-el-shella-result.png', { type: 'image/png' });
    const shareData: ShareData = {
      title: 'نتيجة قعدة الشلة 🏆',
      text: `${options.headline} — العبها مع شلتك: qa3det-el-shella.vercel.app`,
      files: [file],
    };

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return 'shared';
        }
        // Fallback to download if Web Share rejects
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qa3det-el-shella-result.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch {
    return 'error';
  }
}
