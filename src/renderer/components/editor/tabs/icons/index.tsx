import React from 'react';
import {
  IconAlertTriangleFilled as TablerIconAlertTriangleFilled,
  IconArrowBack as TablerIconArrowBack,
  IconArrowNarrowLeftDashed as TablerIconArrowNarrowLeftDashed,
  IconAugmentedReality as TablerIconAugmentedReality,
  IconBucketDroplet as TablerIconBucketDroplet,
  IconCheck as TablerIconCheck,
  IconClef as TablerIconClef,
  IconConeFilled as TablerIconConeFilled,
  IconDirectionArrows as TablerIconDirectionArrows,
  IconEye as TablerIconEye,
  IconEyeClosed as TablerIconEyeClosed,
  IconFileCodeFilled as TablerIconFileCodeFilled,
  IconFileText as TablerIconFileText,
  IconFocus as TablerIconFocus,
  IconGrid3x3 as TablerIconGrid3x3,
  IconHeadphonesFilled as TablerIconHeadphonesFilled,
  IconHome2Filled as TablerIconHome2Filled,
  IconLayersIntersect as TablerIconLayersIntersect,
  IconLink as TablerIconLink,
  IconLoader2 as TablerIconLoader2,
  IconMapPin as TablerIconMapPin,
  IconMessage as TablerIconMessage,
  IconMessageFilled as TablerIconMessageFilled,
  IconPalette as TablerIconPalette,
  IconPhotoPentagon as TablerIconPhotoPentagon,
  IconPlayerPause as TablerIconPlayerPause,
  IconPlayerSkipBack as TablerIconPlayerSkipBack,
  IconPlayerSkipForward as TablerIconPlayerSkipForward,
  IconPlug as TablerIconPlug,
  IconPlus as TablerIconPlus,
  IconPuzzle as TablerIconPuzzle,
  IconSettingsFilled as TablerIconSettingsFilled,
  IconShield as TablerIconShield,
  IconSquare as TablerIconSquare,
  IconSquareRotatedFilled as TablerIconSquareRotatedFilled,
  IconStack2 as TablerIconStack2,
  IconTrash as TablerIconTrash,
  IconUser as TablerIconUser,
  IconUserFilled as TablerIconUserFilled,
  IconVolume as TablerIconVolume,
  IconVolumeOff as TablerIconVolumeOff,
  IconWand as TablerIconWand,
  IconX as TablerIconX,
  IconXFilled as TablerIconXFilled,
} from '@tabler/icons-react';
import { tabler } from './tabler';

type IconProps = { size?: number; strokeWidth?: number };

// Migración a Tabler: cuando elijas el icono de tabler.io, quitamos el SVG de
// abajo y dejamos solo la línea del wrapper. Los call sites no cambian
// (siguen usando size/strokeWidth).
//   import { IconPlus as TablerIconPlus } from '@tabler/icons-react';
//   export const PlusIcon = tabler(TablerIconPlus, 'IconPlus');

// Iconos del árbol de jerarquía (andamiaje con Tabler, pendientes de que los
// apruebes en ICONOS.md)
export const BotIcon = tabler(TablerIconUserFilled, 'IconUserFilled');
export function UserCodeIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="4" fill="currentColor" stroke="none" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h3.5" />
      <path d="M20 21l2 -2l-2 -2" />
      <path d="M17 17l-2 2l2 2" />
    </svg>
  );
}
export const PuzzleIcon = tabler(TablerIconPuzzle, 'IconPuzzle');
export const AdvanceCodeIcon = tabler(TablerIconFileCodeFilled, 'IconFileCodeFilled');
export const TriangleAlertIcon = tabler(TablerIconAlertTriangleFilled, 'IconAlertTriangleFilled');
export const LoaderIcon = tabler(TablerIconLoader2, 'IconLoader2');
export const RotateCcwIcon = tabler(TablerIconArrowBack, 'IconArrowBack');
export const SettingsIcon = tabler(TablerIconSettingsFilled, 'IconSettingsFilled');
export const ArrowLeftIcon = tabler(TablerIconArrowNarrowLeftDashed, 'IconArrowNarrowLeftDashed');
export const MessageSquareIcon = tabler(TablerIconMessage, 'IconMessage');
export const FileTextIcon = tabler(TablerIconFileText, 'IconFileText');
export const PaletteIcon = tabler(TablerIconPalette, 'IconPalette');

export const WandIcon = tabler(TablerIconWand, 'IconWand');
export function PencilIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 7a1 1 0 0 1 -1 1h-1a1 1 0 0 0 -1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1 -1v-1a1 1 0 0 1 2 0v1a3 3 0 0 1 -3 3h-9a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3h1a1 1 0 0 1 1 1" />
      <path d="M14.596 5.011l4.392 4.392l-6.28 6.303a1 1 0 0 1 -.708 .294h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 .294 -.708zm6.496 -2.103a3.097 3.097 0 0 1 .165 4.203l-.164 .18l-.693 .694l-4.387 -4.387l.695 -.69a3.1 3.1 0 0 1 4.384 0" />
    </svg>
  );
}

export const SquareIcon = tabler(TablerIconSquare, 'IconSquare');
export const HomeIcon = tabler(TablerIconHome2Filled, 'IconHome2Filled');
export const GlobeIcon = tabler(TablerIconSquareRotatedFilled, 'IconSquareRotatedFilled');
export function MoreVerticalIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.707 3.293l3 3q .054 .053 .097 .112l.071 .11l.054 .114l.035 .105l.03 .148l.006 .118l-.003 .075l-.017 .126l-.03 .111l-.044 .111l-.052 .098l-.067 .096l-.08 .09l-3 3a1 1 0 0 1 -1.414 -1.414l1.292 -1.293h-4.585a1 1 0 0 0 -1 1v8a3 3 0 0 1 -3 3h-2.171a3.001 3.001 0 0 1 -5.829 -1l.005 -.176a3 3 0 0 1 5.825 -.824h2.17a1 1 0 0 0 1 -1v-8a3 3 0 0 1 3 -3h4.585l-1.292 -1.293a1 1 0 0 1 -.083 -1.32l.083 -.094a1 1 0 0 1 1.414 0" />
    </svg>
  );
}

export const PaintBucketIcon = tabler(TablerIconBucketDroplet, 'IconBucketDroplet');
export const MoveIcon = tabler(TablerIconDirectionArrows, 'IconDirectionArrows');
export const PlusIcon = tabler(TablerIconPlus, 'IconPlus');
export function MinusIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

export const Link2Icon = tabler(TablerIconPlug, 'IconPlug');
export const Grid3x3Icon = tabler(TablerIconGrid3x3, 'IconGrid3x3');
export function Grid2x2Icon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
    </svg>
  );
}

export function SaveIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3a1 1 0 0 1 .707 .293l4 4a1 1 0 0 1 .293 .707v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h1v4a1 1 0 0 0 .883 .993l.117 .007h6a1 1 0 0 0 1 -1v-4zm-4 8a2.995 2.995 0 0 0 -2.995 2.898a1 1 0 0 0 -.005 .102a3 3 0 1 0 3 -3m1 -8v3h-4v-3z" />
    </svg>
  );
}

export function PlayIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" />
    </svg>
  );
}

export function StopIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 4h-10a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z" />
    </svg>
  );
}

export function EraserIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
      <path d="M18 13.3l-6.3 -6.3" />
    </svg>
  );
}

export function MousePointerIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.039 4.277l3.904 13.563c.185 .837 .92 1.516 1.831 1.642l.17 .016a2.2 2.2 0 0 0 1.982 -1.006l.045 -.078l1.4 -2.072l4.05 4.05a2.067 2.067 0 0 0 2.924 0l1.047 -1.047c.388 -.388 .606 -.913 .606 -1.461l-.008 -.182a2.067 2.067 0 0 0 -.598 -1.28l-4.047 -4.048l2.103 -1.412c.726 -.385 1.18 -1.278 1.053 -2.189a2.2 2.2 0 0 0 -1.701 -1.845l-13.524 -3.89a1 1 0 0 0 -1.236 1.24z" />
    </svg>
  );
}

export function MusicIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 12a4.16 4.16 0 0 1 -5.62 3.89a3.78 3.78 0 0 1 -2.38 -3.39a3.42 3.42 0 0 1 2.34 -3.38l3.79 -1.42a2.89 2.89 0 0 0 1.87 -2.7a2 2 0 1 0 -4 0v14a2 2 0 1 1 -4 0" />
    </svg>
  );
}

export function ActivityIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h5v8h4v-16h4v8h5" />
    </svg>
  );
}

export function WaveIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12h-2c-.894 0 -1.662 -.857 -1.761 -2c-.296 -3.45 -.749 -6 -2.749 -6s-2.5 3.582 -2.5 8s-.5 8 -2.5 8s-2.452 -2.547 -2.749 -6c-.1 -1.147 -.867 -2 -1.763 -2h-2" />
    </svg>
  );
}

export function Pencil2Icon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12.085 6.5l5.415 5.415l-8.793 8.792a1 1 0 0 1 -.707 .293h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 .293 -.707zm5.406 -2.698a3.828 3.828 0 0 1 1.716 6.405l-.292 .293l-5.415 -5.415l.293 -.292a3.83 3.83 0 0 1 3.698 -.991" />
    </svg>
  );
}

export function NoiseIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6l2 4l2 -4l2 4l2 -4l2 4l2 -4l2 8l2 -4l2 4" />
    </svg>
  );
}

export function ConstructionIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 21a1 1 0 0 1 0 -2h1v-2h-8v2h1a1 1 0 0 1 0 2h-4a1 1 0 0 1 0 -2h1v-2h-1a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2h1v-1a1 1 0 1 1 2 0v1h8v-1a1 1 0 0 1 2 0v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-1v2h1a1 1 0 0 1 0 2zm-2.086 -13l-7 7h4.17l6.916 -7zm6.086 2.914l-4.086 4.086h4.086zm-10.916 -2.914h-3.084v3.084z" />
    </svg>
  );
}

export function CodeIcon({ size = 14, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 6 -6 6 6 6" />
      <path d="m16 6 6 6 -6 6" />
      <path d="m13 5 -2 14" />
    </svg>
  );
}

// Iconos del panel de jerarquía (component-list) y del radial menu
export const EyeIcon = tabler(TablerIconEye, 'IconEye');
export const EyeOffIcon = tabler(TablerIconEyeClosed, 'IconEyeClosed');
export const VolumeIcon = tabler(TablerIconVolume, 'IconVolume');
export const VolumeOffIcon = tabler(TablerIconVolumeOff, 'IconVolumeOff');
export const FocusIcon = tabler(TablerIconFocus, 'IconFocus');
export const XIcon = tabler(TablerIconXFilled, 'IconXFilled');
export const CheckIcon = tabler(TablerIconCheck, 'IconCheck');
export const ChevronDownIcon = tabler(TablerIconConeFilled, 'IconConeFilled');
export const LayersIcon = tabler(TablerIconStack2, 'IconStack2');
export const MapPinIcon = tabler(TablerIconMapPin, 'IconMapPin');
export const UserIcon = tabler(TablerIconUser, 'IconUser');
export const LinkIcon = tabler(TablerIconLink, 'IconLink');
export const ShieldIcon = tabler(TablerIconShield, 'IconShield');

// ── Iconos reutilizables (los usan varias pestañas) ────────────────────────────
export const PauseIcon = tabler(TablerIconPlayerPause, 'IconPlayerPause');
export const SkipBackIcon = tabler(TablerIconPlayerSkipBack, 'IconPlayerSkipBack');
export const SkipForwardIcon = tabler(TablerIconPlayerSkipForward, 'IconPlayerSkipForward');
export const TrashIcon = tabler(TablerIconTrash, 'IconTrash');
export const OnionSkinIcon = tabler(TablerIconLayersIntersect, 'IconLayersIntersect');

// ── Estados vacíos (elegidos en ICONOS.md) ────────────────────────────────────
// Son iconos SOLO del lienzo sin selección: los wrappers genéricos de arriba
// (PencilIcon, Grid3x3Icon, MusicIcon…) siguen intactos para los botones.
export const MessageFilledIcon = tabler(TablerIconMessageFilled, 'IconMessageFilled');
export const PhotoPentagonIcon = tabler(TablerIconPhotoPentagon, 'IconPhotoPentagon');
export const ClefIcon = tabler(TablerIconClef, 'IconClef');
export const HeadphonesFilledIcon = tabler(TablerIconHeadphonesFilled, 'IconHeadphonesFilled');
export const AugmentedRealityIcon = tabler(TablerIconAugmentedReality, 'IconAugmentedReality');
