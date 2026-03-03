import React, { useMemo } from 'react'

interface ProgressMotivationCardProps {
    currentProgress: number
    nextProgress?: number | null
    targetMode?: 'percentage' | 'number' | 'none'
    targetMetric?: string
}

type OrbConfig = { cx: number; cy: number; r: number; opacity: number; delay: number }

// Blob configs: top/left as %, size as px, each with unique border-radius morph and drift
type BlobConfig = {
    top: string
    left: string
    size: number
    color: string
    opacity: number
    animDelay: number
    animDuration: number
    br1: string // border-radius keyframe A
    br2: string // border-radius keyframe B
    tx: number  // drift X px
    ty: number  // drift Y px
}

type MotivationStage = {
    phase: string
    headline: string
    sub: string
    accent: string
    accentLight: string
    accentMid: string
    bgGradient: string
    borderColor: string
    orbs: OrbConfig[]
    blobs: BlobConfig[]
    pulseSpeed: number
}

// All blobs are green shades, varying from sage to emerald to lime
const GREEN_BLOBS: BlobConfig[] = [
    {
        top: '-18%', left: '-12%', size: 160,
        color: '#22c55e', opacity: 0.13,
        animDelay: 0, animDuration: 7,
        br1: '60% 40% 55% 45% / 50% 60% 40% 50%',
        br2: '40% 60% 45% 55% / 60% 40% 55% 45%',
        tx: 18, ty: 12,
    },
    {
        top: '55%', left: '-8%', size: 110,
        color: '#16a34a', opacity: 0.11,
        animDelay: 1.2, animDuration: 9,
        br1: '55% 45% 60% 40% / 45% 55% 50% 50%',
        br2: '45% 55% 40% 60% / 55% 45% 60% 40%',
        tx: -10, ty: -14,
    },
    {
        top: '-10%', left: '62%', size: 130,
        color: '#4ade80', opacity: 0.10,
        animDelay: 0.5, animDuration: 8,
        br1: '50% 50% 40% 60% / 60% 40% 55% 45%',
        br2: '60% 40% 55% 45% / 40% 60% 45% 55%',
        tx: 12, ty: 16,
    },
    {
        top: '65%', left: '70%', size: 90,
        color: '#86efac', opacity: 0.14,
        animDelay: 2.0, animDuration: 10,
        br1: '45% 55% 50% 50% / 50% 50% 60% 40%',
        br2: '55% 45% 60% 40% / 40% 60% 50% 50%',
        tx: -8, ty: 10,
    },
    {
        top: '30%', left: '80%', size: 70,
        color: '#15803d', opacity: 0.09,
        animDelay: 3.1, animDuration: 11,
        br1: '60% 40% 50% 50% / 55% 45% 60% 40%',
        br2: '40% 60% 60% 40% / 45% 55% 40% 60%',
        tx: 14, ty: -8,
    },
    {
        top: '20%', left: '-5%', size: 55,
        color: '#34d399', opacity: 0.12,
        animDelay: 1.7, animDuration: 6.5,
        br1: '50% 50% 55% 45% / 60% 40% 50% 50%',
        br2: '60% 40% 45% 55% / 50% 50% 60% 40%',
        tx: -12, ty: 6,
    },
]

const getStage = (current: number, next: number | null | undefined): MotivationStage => {
    const eff = next != null ? next : current
    const blobs = GREEN_BLOBS  // always green blobs across all stages

    if (eff >= 100) return {
        phase: 'done',
        headline: '🎉 Target Reached!',
        sub: 'Outstanding — mission accomplished.',
        accent: '#16a34a', accentLight: '#dcfce7', accentMid: '#bbf7d0',
        bgGradient: 'linear-gradient(155deg, #f0fdf4 0%, #dcfce7 55%, #f0fdf4 100%)',
        borderColor: '#bbf7d0',
        orbs: [], blobs, pulseSpeed: 1.2,
    }
    if (eff >= 85) return {
        phase: 'almost',
        headline: 'So Close Now',
        sub: `Only ${100 - Math.round(eff)}% left — finish strong.`,
        accent: '#ea580c', accentLight: '#ffedd5', accentMid: '#fed7aa',
        bgGradient: 'linear-gradient(155deg, #fff7ed 0%, #ffedd5 55%, #fff7ed 100%)',
        borderColor: '#fed7aa',
        orbs: [], blobs, pulseSpeed: 1.5,
    }
    if (eff >= 65) return {
        phase: 'close',
        headline: 'Keep the Momentum',
        sub: "More than halfway — don't stop now.",
        accent: '#1d4ed8', accentLight: '#dbeafe', accentMid: '#bfdbfe',
        bgGradient: 'linear-gradient(155deg, #eff6ff 0%, #dbeafe 55%, #eff6ff 100%)',
        borderColor: '#bfdbfe',
        orbs: [], blobs, pulseSpeed: 2.0,
    }
    if (eff >= 40) return {
        phase: 'mid',
        headline: 'Building Momentum',
        sub: 'Past the midpoint — stay consistent.',
        accent: '#7c3aed', accentLight: '#ede9fe', accentMid: '#ddd6fe',
        bgGradient: 'linear-gradient(155deg, #f5f3ff 0%, #ede9fe 55%, #f5f3ff 100%)',
        borderColor: '#ddd6fe',
        orbs: [], blobs, pulseSpeed: 2.4,
    }
    if (eff >= 15) return {
        phase: 'early',
        headline: 'Great Start',
        sub: "You've begun — every step counts.",
        accent: '#0891b2', accentLight: '#e0f2fe', accentMid: '#bae6fd',
        bgGradient: 'linear-gradient(155deg, #f0f9ff 0%, #e0f2fe 55%, #f0f9ff 100%)',
        borderColor: '#bae6fd',
        orbs: [], blobs, pulseSpeed: 2.8,
    }
    return {
        phase: 'start',
        headline: "Let's Get Going",
        sub: "Log today's progress to kick things off.",
        accent: '#d97706', accentLight: '#fef3c7', accentMid: '#fde68a',
        bgGradient: 'linear-gradient(155deg, #fffbeb 0%, #fef3c7 55%, #fffbeb 100%)',
        borderColor: '#fde68a',
        orbs: [], blobs, pulseSpeed: 3.2,
    }
}

export const ProgressMotivationCard: React.FC<ProgressMotivationCardProps> = ({
    currentProgress,
    nextProgress,
}) => {
    const stage = useMemo(() => getStage(currentProgress, nextProgress), [currentProgress, nextProgress])

    const arcProgress = Math.max(0, Math.min(100, nextProgress != null ? nextProgress : currentProgress))
    const progressDelta = nextProgress != null ? nextProgress - currentProgress : null
    const showDelta = progressDelta != null && progressDelta > 0

    const R = 52
    const CIRC = 2 * Math.PI * R
    const dashOffset = CIRC - (arcProgress / 100) * CIRC
    const uid = stage.phase

    return (
        <div style={{
            background: stage.bgGradient,
            borderRadius: 16,
            padding: '20px 18px 18px',
            border: `1.5px solid ${stage.borderColor}`,
            boxShadow: `0 2px 20px ${stage.accent}14, 0 1px 4px rgba(0,0,0,0.05)`,
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.6s ease',
            fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        }}>

            <style>{`
                @keyframes pmcSpin_${uid} {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes pmcFadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pmcPop {
                    0%   { transform: scale(0.85); opacity: 0; }
                    65%  { transform: scale(1.04); }
                    100% { transform: scale(1);    opacity: 1; }
                }
                @keyframes pmcArcIn_${uid} {
                    from { stroke-dashoffset: ${CIRC}; }
                    to   { stroke-dashoffset: ${dashOffset}; }
                }
                ${GREEN_BLOBS.map((b, i) => `
                @keyframes blob${i}morph {
                    0%,100% { border-radius: ${b.br1}; transform: translate(0px, 0px); }
                    50%     { border-radius: ${b.br2}; transform: translate(${b.tx}px, ${b.ty}px); }
                }
                `).join('')}
            `}</style>

            {/* Floating green CSS blobs */}
            {GREEN_BLOBS.map((b, i) => (
                <div
                    key={i}
                    aria-hidden
                    style={{
                        position: 'absolute',
                        top: b.top,
                        left: b.left,
                        width: b.size,
                        height: b.size,
                        borderRadius: b.br1,
                        background: `radial-gradient(circle at 38% 32%, ${b.color}cc, ${b.color}22)`,
                        opacity: b.opacity,
                        pointerEvents: 'none',
                        animation: `blob${i}morph ${b.animDuration}s ease-in-out ${b.animDelay}s infinite`,
                        filter: `blur(${Math.round(b.size * 0.18)}px)`,
                        zIndex: 0,
                    }}
                />
            ))}

            {/* Orbit rings SVG (kept subtle) */}
            <svg
                width="230" height="210" viewBox="0 0 230 210"
                style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 1 }}
                aria-hidden
            >
                <circle cx="115" cy="105" r="90"
                    fill="none" stroke={stage.accent} strokeWidth="0.7"
                    strokeOpacity="0.08" strokeDasharray="3 9"
                    style={{ animation: `pmcSpin_${uid} ${stage.pulseSpeed * 14}s linear infinite`, transformOrigin: '115px 105px' }}
                />
                <circle cx="115" cy="105" r="68"
                    fill="none" stroke="#22c55e" strokeWidth="0.4"
                    strokeOpacity="0.10" strokeDasharray="2 11"
                    style={{ animation: `pmcSpin_${uid} ${stage.pulseSpeed * 9}s linear reverse infinite`, transformOrigin: '115px 105px' }}
                />
            </svg>

            {/* Arc gauge */}
            <div style={{ position: 'relative', zIndex: 2, marginTop: 20, backdropFilter: 'blur(0px)' }}>
                <svg width="136" height="136" viewBox="0 0 136 136">
                    <defs>
                        <linearGradient id={`arc-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={stage.accentMid} />
                            <stop offset="100%" stopColor={stage.accent} />
                        </linearGradient>
                    </defs>

                    {/* Track */}
                    <circle cx="68" cy="68" r={R}
                        fill="none" stroke={stage.accentLight}
                        strokeWidth="9" strokeLinecap="round"
                    />

                    {/* Arc */}
                    <circle cx="68" cy="68" r={R}
                        fill="none"
                        stroke={`url(#arc-${uid})`}
                        strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={CIRC}
                        strokeDashoffset={dashOffset}
                        style={{
                            transformOrigin: '68px 68px',
                            transform: 'rotate(-90deg)',
                            animation: `pmcArcIn_${uid} 1.1s cubic-bezier(.4,0,.2,1) forwards`,
                            filter: `drop-shadow(0 0 4px ${stage.accent}44)`,
                            transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)',
                        }}
                    />

                    {/* Centre: % */}
                    <text x="68" y="63"
                        textAnchor="middle" dominantBaseline="middle"
                        fill={stage.accent} fontSize="22" fontWeight="700"
                        fontFamily="'DM Sans', 'Segoe UI', sans-serif"
                        style={{ animation: 'pmcPop 0.45s ease 0.25s both' }}
                    >
                        {Math.round(arcProgress)}%
                    </text>

                    {/* Centre: label */}
                    <text x="68" y="83"
                        textAnchor="middle" dominantBaseline="middle"
                        fill={stage.accent} fontSize="8.5" letterSpacing="1.8"
                        fontFamily="'DM Sans', 'Segoe UI', sans-serif"
                        opacity="0.5"
                    >
                        PROGRESS
                    </text>
                </svg>
            </div>

            {/* Delta badge */}
            {showDelta && (
                <div style={{
                    position: 'absolute', top: 18, right: 16, zIndex: 3,
                    background: stage.accentLight,
                    border: `1px solid ${stage.accentMid}`,
                    borderRadius: 20,
                    padding: '2px 10px',
                    fontSize: 11, fontWeight: 700,
                    color: stage.accent,
                    animation: 'pmcFadeUp 0.45s ease 0.55s both',
                    boxShadow: `0 1px 6px ${stage.accent}20`,
                }}>
                    +{Math.round(progressDelta!)}%
                </div>
            )}

            {/* Headline + sub */}
            <div style={{
                position: 'relative', zIndex: 2,
                textAlign: 'center',
                marginTop: 10, padding: '0 10px',
                animation: 'pmcFadeUp 0.45s ease 0.15s both',
            }}>
                <div style={{
                    fontSize: 15, fontWeight: 700,
                    color: stage.accent,
                    letterSpacing: '-0.1px', lineHeight: 1.3,
                    marginBottom: 5,
                }}>
                    {stage.headline}
                </div>
                <div style={{
                    fontSize: 12,
                    color: `${stage.accent}bb`,
                    lineHeight: 1.55,
                    maxWidth: 180, margin: '0 auto',
                }}>
                    {stage.sub}
                </div>
            </div>

            {/* Progress strip */}
            <div style={{
                position: 'relative', zIndex: 2,
                width: '100%', marginTop: 18,
                animation: 'pmcFadeUp 0.45s ease 0.35s both',
            }}>
                <div style={{
                    height: 5, borderRadius: 5,
                    background: stage.accentLight,
                    overflow: 'hidden',
                    boxShadow: `inset 0 1px 3px ${stage.accent}14`,
                }}>
                    <div style={{
                        height: '100%',
                        width: `${arcProgress}%`,
                        background: `linear-gradient(90deg, ${stage.accentMid}, ${stage.accent})`,
                        borderRadius: 5,
                        boxShadow: `0 0 6px ${stage.accent}44`,
                        transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                    }} />
                </div>

                {/* Milestone dots */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
                    {[0, 25, 50, 75, 100].map(m => {
                        const hit = arcProgress >= m
                        return (
                            <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: hit ? stage.accent : stage.accentMid,
                                    boxShadow: hit ? `0 0 5px ${stage.accent}77` : 'none',
                                    transition: 'background 0.4s, box-shadow 0.4s',
                                }} />
                                <span style={{
                                    fontSize: 9,
                                    color: `${stage.accent}88`,
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontWeight: 500,
                                }}>
                                    {m}%
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default ProgressMotivationCard
