import path from "path";
import { createCanvas, loadImage, registerFont } from "canvas";

registerFont("assets/fonts/Cinzel-ExtraBold.ttf", { family: "Cinzel" });

/** ---------- Helpers ---------- */
function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function fitText(ctx, text, maxWidth, startSize, fontFamily) {
    let size = startSize;
    while (size > 10) {
        ctx.font = `${size}px ${fontFamily}`;
        if (ctx.measureText(text).width <= maxWidth) return size;
        size -= 2;
    }
    return size;
}

function drawGlowText(ctx, text, x, y, opts = {}) {
    const {
        font = "64px Cinzel",
        align = "center",
        baseline = "alphabetic",
        maxWidth,
        stroke = "rgba(0,0,0,0.85)",
        strokeWidth = 10,
        glow = "rgba(255,140,60,0.85)",
        glowBlur = 26,
        gradient = ["#FFF2CC", "#E8C27A", "#C76B1F"],
    } = opts;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    const metrics = ctx.measureText(text);
    const w = Math.min(metrics.width, maxWidth ?? metrics.width);
    const g = ctx.createLinearGradient(x - w / 2, y - 70, x + w / 2, y + 10);
    g.addColorStop(0, gradient[0]);
    g.addColorStop(0.55, gradient[1]);
    g.addColorStop(1, gradient[2]);

    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y, maxWidth);

    ctx.shadowColor = glow;
    ctx.shadowBlur = glowBlur;
    ctx.fillStyle = g;
    ctx.fillText(text, x, y, maxWidth);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.95;
    ctx.fillText(text, x, y, maxWidth);

    ctx.restore();
}

function drawBottomPlate(ctx, width, height, opts = {}) {
    const plateHeight = opts.plateHeight ?? 240;
    const y = height - plateHeight;

    const plate = ctx.createLinearGradient(0, y, 0, height);
    plate.addColorStop(0, "rgba(0,0,0,0)");
    plate.addColorStop(0.22, "rgba(0,0,0,0.45)");
    plate.addColorStop(1, "rgba(0,0,0,0.85)");

    ctx.save();
    ctx.fillStyle = plate;
    ctx.fillRect(0, y, width, plateHeight);
    ctx.restore();

    return { y, plateHeight };
}


function drawSplitDivider(ctx, width, y, gapCenterX, gapWidth) {
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.shadowColor = "rgba(255,120,40,0.7)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255,190,100,0.85)";
    ctx.lineWidth = 2;

    const leftStart = 200;
    const rightEnd = width - 200;

    ctx.beginPath();
    ctx.moveTo(leftStart, y);
    ctx.lineTo(gapCenterX - gapWidth / 2, y);

    ctx.moveTo(gapCenterX + gapWidth / 2, y);
    ctx.lineTo(rightEnd, y);

    ctx.stroke();
    ctx.restore();
}

/** ---------- Main ---------- */
export async function generateWelcomeImage({ user, memberCount }) {
    const templatePath = path.resolve(process.cwd(), "assets", "welcome-template.png");
    const background = await loadImage(templatePath);

    const width = background.width;
    const height = background.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, width, height);

    // Load avatar
    const avatarURL = user.displayAvatarURL({ extension: "png", size: 512 });
    const avatar = await loadImage(avatarURL);

    // Circle mask
    const AVATAR_X = 768;
    const AVATAR_Y = 406;
    const AVATAR_RADIUS = 185;

    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_X, AVATAR_Y, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
        avatar,
        AVATAR_X - AVATAR_RADIUS,
        AVATAR_Y - AVATAR_RADIUS,
        AVATAR_RADIUS * 2,
        AVATAR_RADIUS * 2
    );
    ctx.restore();

    // ---- Username (auto-fit + glow) ----
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const nameMaxWidth = 1100;
    const nameSize = fitText(ctx, user.username, nameMaxWidth, 110, "Cinzel");

    drawGlowText(ctx, user.username, AVATAR_X, AVATAR_Y + 285, {
        font: `${nameSize}px Cinzel`,
        strokeWidth: Math.max(10, Math.floor(nameSize * 0.12)),
        glowBlur: Math.floor(nameSize * 0.28),
        maxWidth: nameMaxWidth,
    });

    // ---- Bottom UI ----
    const { y: plateY } = drawBottomPlate(ctx, width, height, { plateHeight: 240 });

    const pillText = `SURVIVOR #${memberCount}`;
    ctx.font = "45px Cinzel";

    const pillPaddingX = 48;
    const textWidth = ctx.measureText(pillText).width;
    const pillW = Math.min(width - 360, textWidth + pillPaddingX * 2);
    const pillH = 92;

    const pillX = (width - pillW) / 2;
    const pillY = height - 110; // keep this as your anchor


    const statusHeader = "▣ SYSTEM STATUS";
    const statusLine = "ECOSYSTEM LINK ESTABLISHED • YOU ARE BEING OBSERVED";

    // Put message safely above the badge with padding
    const messageY = pillY - 78;      // <- key line
    const dividerY = messageY - 18;
    const headerY = dividerY - 30;

    // (optional safety if your template changes)
    const minY = plateY + 10;
    const safeHeaderY = Math.max(headerY, minY);
    const safeDividerY = safeHeaderY + 30;
    const safeMessageY = safeDividerY + 18;

    drawGlowText(ctx, statusHeader, width / 2, safeHeaderY, {
        font: "28px Cinzel",
        baseline: "top",
        strokeWidth: 5,
        glowBlur: 10,
        maxWidth: width - 520,
        gradient: ["#C9B58A", "#A68A55", "#6B4A22"],
        glow: "rgba(255,110,35,0.45)",
    });

    ctx.save();
    ctx.font = "28px Cinzel";
    const headerW = ctx.measureText(statusHeader).width;
    ctx.restore();

    drawSplitDivider(ctx, width, safeDividerY, width / 2, headerW + 90);

    drawGlowText(ctx, statusLine, width / 2, safeMessageY, {
        font: "38px Cinzel",
        baseline: "top",
        strokeWidth: 7,
        glowBlur: 14,
        maxWidth: width - 280,
        gradient: ["#FFF2CC", "#E8C27A", "#E0661B"],
        glow: "rgba(255,110,35,0.70)",
    });

    // ---- Survivor badge (draw ONCE) ----
    ctx.save();
    roundRect(ctx, pillX, pillY, pillW, pillH, 26);

    // Fill
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fill();

    // Inner shadow (pressed/stamped feel)
    ctx.globalCompositeOperation = "source-atop";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = -3;
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.globalCompositeOperation = "source-over";

    // Outline + glow
    ctx.shadowColor = "rgba(255,120,40,0.7)";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,190,100,0.8)";
    ctx.stroke();

    ctx.restore();

    // Text inside box
    const badgeFontSize = fitText(
        ctx,
        pillText,
        pillW - 40,
        54,
        "Cinzel"
    );

    drawGlowText(ctx, pillText, width / 2, pillY + pillH / 2 + 18, {
        font: `${badgeFontSize}px Cinzel`,
        strokeWidth: Math.max(8, Math.floor(badgeFontSize * 0.18)),
        glowBlur: Math.floor(badgeFontSize * 0.4),
        maxWidth: pillW - 40,
    });


    ctx.save();
    roundRect(ctx, pillX, pillY, pillW, pillH, 26);

    // Fill
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fill();

    // Inner shadow (pressed/stamped feel)
    ctx.globalCompositeOperation = "source-atop";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = -3;
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.globalCompositeOperation = "source-over";

    // Outline + glow
    ctx.shadowColor = "rgba(255,120,40,0.7)";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,190,100,0.8)";
    ctx.stroke();

    ctx.restore();

    // Text inside box
    drawGlowText(ctx, pillText, width / 2, pillY + pillH / 2 + 18, {
        font: "54px Cinzel",
        strokeWidth: 10,
        glowBlur: 22,
        maxWidth: pillW - 40,
    });

    return canvas.toBuffer("image/png");
}
