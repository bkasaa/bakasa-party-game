import React from 'react';
import { ArcadeGameId, FootballGameId, GameId, SpyIconType } from '../types/game';

export type WatermarkKind =
  | SpyIconType
  | GameId
  | FootballGameId
  | ArcadeGameId;

interface CardWatermarkProps {
  kind: WatermarkKind;
  className?: string;
}

export const CardWatermark: React.FC<CardWatermarkProps> = ({ kind, className = '' }) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 90"
      className={`pointer-events-none absolute inset-0 w-full h-full opacity-[0.20] ${className}`}
      preserveAspectRatio="none"
    >
      {/* Places: Pyramids, Pin & City Skyline */}
      {kind === 'places' && (
        <>
          <polygon points="18,76 46,28 74,76" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="56,76 76,42 96,76" fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <path
            d="M126 16 C116 16 110 24 110 33 C110 47 126 62 126 62 C126 62 142 47 142 33 C142 24 136 16 126 16 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
          <circle cx="126" cy="33" r="5" fill="none" stroke="white" strokeWidth="2" />
          <path
            d="M162 76 V34 H178 V22 H196 V46 H212 V30 H226 V76"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="12" y1="76" x2="232" y2="76" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* Food & Fruits: Burger, Pizza Slice & Drink Cup */}
      {(kind === 'food' || kind === 'fruits') && (
        <>
          {/* Burger */}
          <path d="M22 42 C22 27 64 27 64 42 Z" fill="none" stroke="white" strokeWidth="2" />
          <path d="M20 49 Q31 44 43 49 Q54 54 66 49" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <rect x="23" y="55" width="40" height="10" rx="5" fill="none" stroke="white" strokeWidth="2" />
          {/* Pizza slice */}
          <path d="M104 20 L138 30 L110 68 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="116" cy="40" r="3" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="124" cy="48" r="2.5" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Drink cup + straw */}
          <path d="M180 34 H212 L206 72 H186 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <line x1="176" y1="34" x2="216" y2="34" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M196 34 L201 16 L213 13" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Movies: Clapperboard, Film Reel & Popcorn */}
      {kind === 'movies' && (
        <>
          {/* Clapperboard */}
          <rect x="20" y="34" width="48" height="36" rx="4" fill="none" stroke="white" strokeWidth="2" />
          <path d="M20 34 L68 20 L65 12 L17 26 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <line x1="34" y1="21" x2="40" y2="29" stroke="white" strokeWidth="1.8" />
          <line x1="49" y1="17" x2="55" y2="25" stroke="white" strokeWidth="1.8" />
          {/* Film reel */}
          <circle cx="122" cy="45" r="22" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="122" cy="45" r="5" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="122" cy="31" r="4" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="122" cy="59" r="4" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="108" cy="45" r="4" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="136" cy="45" r="4" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Popcorn box */}
          <path d="M180 36 H214 L208 72 H186 Z" fill="none" stroke="white" strokeWidth="2" />
          <path d="M182 36 C180 26 190 22 197 26 C203 20 214 25 212 36" fill="none" stroke="white" strokeWidth="2" />
          <line x1="191" y1="36" x2="193" y2="72" stroke="white" strokeWidth="1.5" />
          <line x1="203" y1="36" x2="201" y2="72" stroke="white" strokeWidth="1.5" />
        </>
      )}

      {/* Sports / Football Categories: Stadium Arch, Trophy & Football */}
      {kind === 'sports' && (
        <>
          <rect x="16" y="24" width="52" height="44" rx="8" fill="none" stroke="white" strokeWidth="2" />
          <line x1="42" y1="24" x2="42" y2="68" stroke="white" strokeWidth="1.8" />
          <circle cx="42" cy="46" r="10" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Trophy */}
          <path d="M108 22 H138 V38 C138 48 131 54 123 54 C115 54 108 48 108 38 Z" fill="none" stroke="white" strokeWidth="2" />
          <path d="M108 28 H100 C97 28 97 40 105 42" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M138 28 H146 C149 28 149 40 141 42" fill="none" stroke="white" strokeWidth="1.8" />
          <line x1="123" y1="54" x2="123" y2="66" stroke="white" strokeWidth="2" />
          <rect x="111" y="66" width="24" height="6" rx="2" fill="none" stroke="white" strokeWidth="2" />
          {/* Football */}
          <circle cx="198" cy="45" r="20" fill="none" stroke="white" strokeWidth="2" />
          <polygon points="198,35 206,41 203,51 193,51 190,41" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {/* Jobs: Briefcase, Hard Hat & Wrench */}
      {kind === 'jobs' && (
        <>
          <rect x="20" y="34" width="48" height="34" rx="6" fill="none" stroke="white" strokeWidth="2" />
          <path d="M35 34 V26 H53 V34" fill="none" stroke="white" strokeWidth="2" />
          <line x1="20" y1="48" x2="68" y2="48" stroke="white" strokeWidth="1.8" />
          {/* Hard Hat */}
          <path d="M100 54 C100 32 140 32 140 54 Z" fill="none" stroke="white" strokeWidth="2" />
          <line x1="94" y1="54" x2="146" y2="54" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M116 34 V46 M124 34 V46" stroke="white" strokeWidth="1.6" />
          {/* Wrench / tool */}
          <path
            d="M180 62 L204 38 A10 10 0 1 1 214 28 L206 36 L212 42 L220 34 A10 10 0 0 1 208 44 L184 68 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Animals: Paw Prints & Cat/Bird Silhouettes */}
      {kind === 'animals' && (
        <>
          {/* Paw print */}
          <ellipse cx="42" cy="54" rx="13" ry="10" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="28" cy="36" r="4.5" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="38" cy="29" r="4.5" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="49" cy="29" r="4.5" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="58" cy="37" r="4.5" fill="none" stroke="white" strokeWidth="2" />
          {/* Cat head */}
          <path d="M102 36 L108 20 L118 32 H130 L140 20 L146 36 C149 52 138 66 124 66 C110 66 99 52 102 36 Z" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="116" cy="45" r="2.2" fill="white" />
          <circle cx="132" cy="45" r="2.2" fill="white" />
          {/* Bird wing */}
          <path d="M178 44 Q194 22 214 34 Q202 54 178 44 Z" fill="none" stroke="white" strokeWidth="2" />
          <path d="M214 34 L224 38 L212 43" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {/* Countries: Globe, Plane & Compass */}
      {kind === 'countries' && (
        <>
          <circle cx="46" cy="45" r="23" fill="none" stroke="white" strokeWidth="2" />
          <ellipse cx="46" cy="45" rx="11" ry="23" fill="none" stroke="white" strokeWidth="1.8" />
          <line x1="23" y1="45" x2="69" y2="45" stroke="white" strokeWidth="1.8" />
          <path d="M27 33 H65 M27 57 H65" stroke="white" strokeWidth="1.5" />
          {/* Plane trail */}
          <path d="M96 58 Q130 24 166 36" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M164 36 L178 30 L170 43 L166 38 Z" fill="none" stroke="white" strokeWidth="2" />
          {/* Compass */}
          <circle cx="204" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
          <polygon points="204,31 209,45 204,59 199,45" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {/* Cars & Transport: Car Silhouette, Wheel & Plane */}
      {(kind === 'cars' || kind === 'transport') && (
        <>
          <path d="M20 56 L28 38 H60 L72 52 H84 V64 H20 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="35" cy="64" r="7" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="68" cy="64" r="7" fill="none" stroke="white" strokeWidth="2" />
          {/* Steering wheel */}
          <circle cx="128" cy="45" r="20" fill="none" stroke="white" strokeWidth="2.2" />
          <circle cx="128" cy="45" r="5" fill="none" stroke="white" strokeWidth="2" />
          <line x1="108" y1="45" x2="123" y2="45" stroke="white" strokeWidth="2" />
          <line x1="133" y1="45" x2="148" y2="45" stroke="white" strokeWidth="2" />
          <line x1="128" y1="50" x2="128" y2="65" stroke="white" strokeWidth="2" />
          {/* Speed streaks */}
          <line x1="176" y1="34" x2="222" y2="34" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="168" y1="46" x2="210" y2="46" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="184" y1="58" x2="226" y2="58" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Home & Daily Life: House Roof, Lamp & Coffee Mug */}
      {(kind === 'home' || kind === 'daily_life') && (
        <>
          <path d="M20 44 L44 22 L68 44 V70 H20 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <rect x="37" y="50" width="14" height="20" rx="2" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Lamp */}
          <polygon points="108,24 134,24 142,42 100,42" fill="none" stroke="white" strokeWidth="2" />
          <line x1="121" y1="42" x2="121" y2="68" stroke="white" strokeWidth="2" />
          <line x1="109" y1="68" x2="133" y2="68" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Coffee mug */}
          <rect x="178" y="36" width="28" height="30" rx="5" fill="none" stroke="white" strokeWidth="2" />
          <path d="M206 42 H214 C218 42 218 56 214 56 H206" fill="none" stroke="white" strokeWidth="2" />
          <path d="M188 26 Q191 20 188 16 M198 26 Q201 20 198 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* Gaming & Arcade: Gamepad, Headset & Stars */}
      {kind === 'gaming' && (
        <>
          <path
            d="M22 36 Q32 24 52 28 H76 Q96 24 106 36 L112 60 Q110 70 96 68 L84 54 H44 L32 68 Q18 70 16 60 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
          <line x1="40" y1="38" x2="40" y2="48" stroke="white" strokeWidth="2.2" />
          <line x1="35" y1="43" x2="45" y2="43" stroke="white" strokeWidth="2.2" />
          <circle cx="88" cy="40" r="2.8" fill="none" stroke="white" strokeWidth="1.8" />
          <circle cx="96" cy="46" r="2.8" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Headset */}
          <path d="M174 52 V42 C174 26 214 26 214 42 V52" fill="none" stroke="white" strokeWidth="2.2" />
          <rect x="168" y="48" width="10" height="18" rx="4" fill="none" stroke="white" strokeWidth="2" />
          <rect x="210" y="48" width="10" height="18" rx="4" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {/* Party Hub: Spy */}
      {(kind === 'spy' || kind === 'football_spy') && (
        <>
          <ellipse cx="44" cy="42" rx="26" ry="6" fill="none" stroke="white" strokeWidth="2" />
          <path d="M28 40 L33 20 Q44 16 55 20 L60 40" fill="none" stroke="white" strokeWidth="2" />
          <rect x="24" y="49" width="16" height="10" rx="3.5" fill="none" stroke="white" strokeWidth="2" />
          <rect x="48" y="49" width="16" height="10" rx="3.5" fill="none" stroke="white" strokeWidth="2" />
          <line x1="40" y1="54" x2="48" y2="54" stroke="white" strokeWidth="2" />
          {/* Magnifier */}
          <circle cx="128" cy="40" r="16" fill="none" stroke="white" strokeWidth="2.2" />
          <line x1="139" y1="52" x2="152" y2="66" stroke="white" strokeWidth="3" strokeLinecap="round" />
          {/* Fingerprint arcs */}
          <path d="M186 58 C182 40 192 26 206 26 C220 26 226 40 222 58" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M193 58 C191 45 196 34 206 34 C215 34 218 45 215 58" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M200 58 C199 49 202 42 206 42 C210 42 211 49 209 58" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {/* Party Hub: Bomb Questions & Bomb Classic */}
      {(kind === 'bomb_questions' || kind === 'bomb_classic') && (
        <>
          <circle cx="48" cy="52" r="20" fill="none" stroke="white" strokeWidth="2.2" />
          <rect x="42" y="28" width="12" height="6" rx="2" fill="none" stroke="white" strokeWidth="2" />
          <path d="M48 28 Q56 15 68 18" fill="none" stroke="white" strokeWidth="2" />
          <path d="M72 12 L75 18 L81 20 L75 22 L72 28 L69 22 L63 20 L69 18 Z" fill="none" stroke="white" strokeWidth="1.6" />
          {/* Shockwave rings */}
          <circle cx="132" cy="45" r="14" fill="none" stroke="white" strokeWidth="1.8" strokeDasharray="4 4" />
          <circle cx="132" cy="45" r="26" fill="none" stroke="white" strokeWidth="1.6" strokeDasharray="6 5" />
          {/* Timer / Question spark */}
          <circle cx="200" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
          <line x1="200" y1="45" x2="200" y2="33" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="200" y1="45" x2="210" y2="49" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Party Hub: Draw */}
      {kind === 'draw' && (
        <>
          <path
            d="M36 22 C54 20 68 32 68 46 C68 58 58 66 44 66 C34 66 32 58 36 53 C39 49 34 45 28 45 C20 45 18 32 36 22 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
          <circle cx="38" cy="34" r="3" fill="white" />
          <circle cx="52" cy="36" r="3" fill="white" />
          <circle cx="55" cy="50" r="3" fill="white" />
          {/* Squiggle doodle */}
          <path d="M96 54 Q112 22 128 46 T158 34" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          {/* Brush */}
          <line x1="184" y1="64" x2="212" y2="26" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M210 28 C216 18 225 18 223 27 C220 33 213 33 210 28 Z" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {/* Party Hub: Forger */}
      {kind === 'forger' && (
        <>
          <rect x="20" y="20" width="46" height="50" rx="5" fill="none" stroke="white" strokeWidth="2" />
          <path d="M28 58 Q38 30 48 44 T58 32" fill="none" stroke="white" strokeWidth="2" />
          {/* Mask glasses */}
          <circle cx="114" cy="45" r="10" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="142" cy="45" r="10" fill="none" stroke="white" strokeWidth="2" />
          <line x1="124" y1="45" x2="132" y2="45" stroke="white" strokeWidth="2" />
          {/* Pencil */}
          <path d="M184 62 L212 26 L220 32 L192 68 L180 70 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}

      {/* Party Hub: Court */}
      {kind === 'court' && (
        <>
          {/* Scales of Justice */}
          <line x1="48" y1="20" x2="48" y2="68" stroke="white" strokeWidth="2.2" />
          <line x1="22" y1="30" x2="74" y2="30" stroke="white" strokeWidth="2.2" />
          <path d="M22 30 L14 50 H30 Z" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M74 30 L66 50 H82 Z" fill="none" stroke="white" strokeWidth="1.8" />
          <line x1="36" y1="68" x2="60" y2="68" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          {/* Gavel */}
          <rect x="114" y="24" width="28" height="14" rx="3" fill="none" stroke="white" strokeWidth="2" transform="rotate(-25 128 31)" />
          <line x1="130" y1="37" x2="148" y2="64" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          {/* Speech bubble */}
          <path d="M174 26 H218 Q224 26 224 32 V52 Q224 58 218 58 H194 L182 68 V58 H174 Q168 58 168 52 V32 Q168 26 174 26 Z" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {/* Football Hub Mini-games */}
      {kind === 'football_password' && (
        <>
          {/* Jersey */}
          <path d="M24 24 L36 20 H54 L66 24 L72 38 L62 42 V68 H28 V42 L18 38 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          {/* Key & Padlock */}
          <circle cx="116" cy="44" r="10" fill="none" stroke="white" strokeWidth="2" />
          <line x1="126" y1="44" x2="152" y2="44" stroke="white" strokeWidth="2.2" />
          <line x1="142" y1="44" x2="142" y2="52" stroke="white" strokeWidth="2" />
          <line x1="149" y1="44" x2="149" y2="52" stroke="white" strokeWidth="2" />
          <rect x="182" y="40" width="32" height="26" rx="5" fill="none" stroke="white" strokeWidth="2" />
          <path d="M189 40 V31 C189 23 207 23 207 31 V40" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'football_chain' && (
        <>
          <rect x="18" y="34" width="34" height="18" rx="9" fill="none" stroke="white" strokeWidth="2.2" />
          <rect x="44" y="34" width="34" height="18" rx="9" fill="none" stroke="white" strokeWidth="2.2" />
          <rect x="70" y="34" width="34" height="18" rx="9" fill="none" stroke="white" strokeWidth="2.2" />
          <circle cx="144" cy="45" r="20" fill="none" stroke="white" strokeWidth="2" />
          <line x1="144" y1="45" x2="144" y2="31" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="144" y1="45" x2="154" y2="48" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="202" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
          <polygon points="202,36 209,41 206,50 198,50 195,41" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {kind === 'football_three' && (
        <>
          <path d="M36 26 L39 34 L48 34 L41 39 L44 48 L36 43 L28 48 L31 39 L24 34 L33 34 Z" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M74 18 L78 28 L88 28 L80 34 L83 44 L74 38 L65 44 L68 34 L60 28 L70 28 Z" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M112 26 L115 34 L124 34 L117 39 L120 48 L112 43 L104 48 L107 39 L100 34 L109 34 Z" fill="none" stroke="white" strokeWidth="1.8" />
          {/* Whistle */}
          <circle cx="192" cy="48" r="16" fill="none" stroke="white" strokeWidth="2" />
          <path d="M192 32 H222 V42 L206 46" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'football_charades' && (
        <>
          <rect x="34" y="20" width="18" height="30" rx="9" fill="none" stroke="white" strokeWidth="2" />
          <path d="M26 42 C26 57 60 57 60 42" fill="none" stroke="white" strokeWidth="2" />
          <line x1="43" y1="54" x2="43" y2="68" stroke="white" strokeWidth="2" />
          <line x1="32" y1="68" x2="54" y2="68" stroke="white" strokeWidth="2" />
          {/* Pitch tactic */}
          <rect x="98" y="22" width="52" height="44" rx="6" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M108 54 Q124 26 140 42" fill="none" stroke="white" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="198" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
          <polygon points="198,36 205,41 202,50 194,50 191,41" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {kind === 'football_penalty' && (
        <>
          {/* Goal net */}
          <rect x="18" y="20" width="76" height="46" rx="4" fill="none" stroke="white" strokeWidth="2.2" />
          <line x1="36" y1="20" x2="36" y2="66" stroke="white" strokeWidth="1.2" />
          <line x1="56" y1="20" x2="56" y2="66" stroke="white" strokeWidth="1.2" />
          <line x1="76" y1="20" x2="76" y2="66" stroke="white" strokeWidth="1.2" />
          <line x1="18" y1="36" x2="94" y2="36" stroke="white" strokeWidth="1.2" />
          <line x1="18" y1="52" x2="94" y2="52" stroke="white" strokeWidth="1.2" />
          {/* Shot arc */}
          <path d="M126 62 Q156 26 196 42" fill="none" stroke="white" strokeWidth="2" strokeDasharray="5 4" />
          <circle cx="204" cy="45" r="14" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'headsup' && (
        <>
          {/* Theatre masks & forehead phone card */}
          <path d="M24 26 Q42 18 60 26 V46 C60 60 42 68 42 68 C42 68 24 60 24 46 Z" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="35" cy="39" r="2.2" fill="white" />
          <circle cx="49" cy="39" r="2.2" fill="white" />
          <path d="M35 49 Q42 56 49 49" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Tilt phone */}
          <rect x="104" y="22" width="44" height="28" rx="6" fill="none" stroke="white" strokeWidth="2" transform="rotate(-10 126 36)" />
          <path d="M174 54 Q192 22 214 38" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="206" cy="44" r="10" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'football_auction' && (
        <>
          {/* Gavel & Bid Numbers */}
          <rect x="26" y="24" width="32" height="16" rx="4" fill="none" stroke="white" strokeWidth="2" transform="rotate(-24 42 32)" />
          <line x1="46" y1="39" x2="68" y2="68" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="20" y1="68" x2="54" y2="68" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          {/* Rising bid bars */}
          <rect x="106" y="48" width="14" height="20" rx="3" fill="none" stroke="white" strokeWidth="2" />
          <rect x="128" y="34" width="14" height="34" rx="3" fill="none" stroke="white" strokeWidth="2" />
          <rect x="150" y="20" width="14" height="48" rx="3" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="200" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'football_tictactoe' && (
        <>
          {/* 3x3 Grid */}
          <line x1="42" y1="16" x2="42" y2="74" stroke="white" strokeWidth="2" />
          <line x1="68" y1="16" x2="68" y2="74" stroke="white" strokeWidth="2" />
          <line x1="18" y1="35" x2="92" y2="35" stroke="white" strokeWidth="2" />
          <line x1="18" y1="55" x2="92" y2="55" stroke="white" strokeWidth="2" />
          {/* X and O marks */}
          <line x1="24" y1="20" x2="34" y2="30" stroke="white" strokeWidth="2" />
          <line x1="34" y1="20" x2="24" y2="30" stroke="white" strokeWidth="2" />
          <circle cx="55" cy="45" r="6" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="196" cy="45" r="18" fill="none" stroke="white" strokeWidth="2" />
          <polygon points="196,36 203,41 200,50 192,50 189,41" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {/* 2D Arcade Hub Games */}
      {kind === 'paint' && (
        <>
          <rect x="24" y="22" width="38" height="16" rx="4" fill="none" stroke="white" strokeWidth="2" />
          <path d="M62 30 H72 V44 H43 V66" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          <path d="M98 62 Q126 20 158 54 T218 32" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="198" cy="58" r="8" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'knife' && (
        <>
          <circle cx="52" cy="45" r="22" fill="none" stroke="white" strokeWidth="2.2" />
          <circle cx="52" cy="45" r="12" fill="none" stroke="white" strokeWidth="1.6" />
          <line x1="74" y1="45" x2="104" y2="45" stroke="white" strokeWidth="2.4" />
          <line x1="52" y1="67" x2="52" y2="84" stroke="white" strokeWidth="2.4" />
          <path d="M168 62 L212 22 L218 28 L182 64 Z" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'frog' && (
        <>
          <circle cx="48" cy="52" r="22" fill="none" stroke="white" strokeWidth="2" />
          <path d="M48 52 L66 39" stroke="white" strokeWidth="2" />
          <path d="M110 48 Q144 36 178 32" fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="4 4" />
          <circle cx="192" cy="30" r="8" fill="none" stroke="white" strokeWidth="2" />
          <ellipse cx="188" cy="20" rx="5" ry="3" fill="none" stroke="white" strokeWidth="1.6" />
          <ellipse cx="198" cy="20" rx="5" ry="3" fill="none" stroke="white" strokeWidth="1.6" />
        </>
      )}

      {kind === 'birds' && (
        <>
          <circle cx="48" cy="44" r="15" fill="none" stroke="white" strokeWidth="2" />
          <path d="M62 42 L74 46 L62 50" fill="none" stroke="white" strokeWidth="2" />
          <path d="M104 34 Q120 20 138 32 Q150 24 160 38" fill="none" stroke="white" strokeWidth="2" />
          <path d="M198 22 L202 32 L212 34 L204 40 L206 50 L198 44 L190 50 L192 40 L184 34 L194 32 Z" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'racing' && (
        <>
          <path d="M16 66 C48 18 96 72 134 26 C162 -4 188 68 226 30" fill="none" stroke="white" strokeWidth="2.2" />
          <path d="M20 74 C52 26 100 80 138 34" fill="none" stroke="white" strokeWidth="1.6" strokeDasharray="5 5" />
          <line x1="192" y1="22" x2="192" y2="70" stroke="white" strokeWidth="2.2" />
          <path d="M192 22 H222 V42 H192" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'chicken' && (
        <>
          <ellipse cx="48" cy="48" rx="18" ry="14" fill="none" stroke="white" strokeWidth="2" />
          <path d="M65 44 L75 48 L65 52" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="48" cy="31" r="5" fill="none" stroke="white" strokeWidth="1.8" />
          <rect x="114" y="28" width="52" height="40" rx="6" fill="none" stroke="white" strokeWidth="2" strokeDasharray="5 4" />
          <path d="M190 66 V40 L208 26 L226 40 V66 Z" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'soccer' && (
        <>
          <line x1="120" y1="0" x2="120" y2="90" stroke="white" strokeWidth="2" />
          <circle cx="120" cy="45" r="24" fill="none" stroke="white" strokeWidth="2" />
          <rect x="0" y="20" width="24" height="50" fill="none" stroke="white" strokeWidth="2" />
          <rect x="216" y="20" width="24" height="50" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}

      {kind === 'stickman' && (
        <>
          <circle cx="46" cy="24" r="8" fill="none" stroke="white" strokeWidth="2" />
          <line x1="46" y1="32" x2="46" y2="54" stroke="white" strokeWidth="2.2" />
          <line x1="46" y1="54" x2="34" y2="72" stroke="white" strokeWidth="2.2" />
          <line x1="46" y1="54" x2="58" y2="72" stroke="white" strokeWidth="2.2" />
          <line x1="46" y1="38" x2="78" y2="22" stroke="white" strokeWidth="2.4" />
          {/* Crossed Sabers */}
          <line x1="156" y1="68" x2="206" y2="18" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="206" y1="68" x2="156" y2="18" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}

      {kind === 'balance' && (
        <>
          {/* Suspended plank */}
          <line x1="58" y1="8" x2="42" y2="48" stroke="white" strokeWidth="1.8" />
          <line x1="176" y1="8" x2="192" y2="60" stroke="white" strokeWidth="1.8" />
          <rect x="34" y="48" width="168" height="10" rx="4" fill="none" stroke="white" strokeWidth="2.2" transform="rotate(-5 118 53)" />
          <ellipse cx="116" cy="36" rx="22" ry="13" fill="none" stroke="white" strokeWidth="2" />
          <path d="M10 78 Q30 72 50 78 T90 78 T130 78 T170 78 T210 78 T240 78" fill="none" stroke="white" strokeWidth="1.8" />
        </>
      )}

      {kind === 'khlawis' && (
        <>
          {/* Maze walls */}
          <path d="M18 18 H88 V44 H48 V70 H108" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M126 16 V54 H168 V24 H218 V72 H152" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Flashlight cone */}
          <polygon points="74,45 128,20 128,70" fill="none" stroke="white" strokeWidth="1.8" strokeDasharray="4 4" />
          {/* Hidden player circles */}
          <circle cx="34" cy="56" r="8" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="196" cy="48" r="8" fill="none" stroke="white" strokeWidth="2" />
        </>
      )}
    </svg>
  );
};
