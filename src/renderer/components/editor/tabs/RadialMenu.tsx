import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls, type Variants } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export interface RadialMenuItem {
  label: string
  Icon: LucideIcon
  iconName: string
  color: string
}

export interface RadialMenuProps {
  /** número de opciones; entre 1 y 6 */
  count?: number
  /** color del botón central */
  centerColor?: string
  /** efecto brillo en opciones y centro */
  glow?: boolean
  /** discos sin degradado */
  solid?: boolean
  /** sin sombras */
  noShadow?: boolean
  /** temblor al hacer hover */
  wobble?: boolean
  items?: RadialMenuItem[]
  onPick?: (item: RadialMenuItem, index: number) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Abanico angular (radianes) donde aparecen las opciones. Ej. [-π/2, π/2] = hacia la derecha, [π/2, 3π/2] = izquierda */
  fan?: [number, number]
}

const R = 112
const iconSize = 52
const labelOffset = iconSize / 2 + 4
const spring = { type: 'spring', stiffness: 260, damping: 20 } as const

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function labelPos(a: number) {
  return { x: Math.cos(a) * labelOffset, y: Math.sin(a) * labelOffset }
}

function itemPos(index: number, count: number, fan: [number, number]) {
  const a = lerp(fan[0], fan[1], count === 1 ? 0.5 : index / (count - 1))
  return { x: Math.cos(a) * R, y: Math.sin(a) * R }
}

interface OptionProps {
  item: RadialMenuItem
  index: number
  count: number
  angle: number
  variants: Variants
  active: boolean
  dimmed: boolean
  solid: boolean
  glow: boolean
  wobble: boolean
  noShadow: boolean
  onEnter: () => void
  onLeave: () => void
  onPick: () => void
}

function MenuOption({
  item,
  index,
  count,
  angle,
  variants,
  active,
  dimmed,
  solid,
  glow,
  wobble,
  noShadow,
  onEnter,
  onLeave,
  onPick,
}: OptionProps) {
  const controls = useAnimationControls()
  const lp = labelPos(angle)

  useEffect(() => {
    if (active) {
      controls.start({
        scale: 1.28,
        opacity: 1,
        rotate: wobble ? [0, -11, 11, -6, 0] : 0,
        boxShadow: glow
          ? `0 0 26px ${item.color}99`
          : noShadow
            ? 'none'
            : '0 10px 22px rgba(0,0,0,0.5)',
        transition: {
          scale: spring,
          opacity: { duration: 0.15 },
          boxShadow: { type: 'tween', duration: 0.2 },
          rotate: wobble
            ? { type: 'tween', duration: 0.45, ease: 'easeInOut' }
            : { type: 'tween', duration: 0.15 },
        },
      })
    } else {
      const idleShadow = glow
        ? `0 6px 16px ${item.color}44`
        : noShadow
          ? 'none'
          : '0 4px 10px rgba(0,0,0,0.4)'
      controls.start({
        scale: dimmed ? 0.82 : 1,
        opacity: dimmed ? 0.55 : 1,
        rotate: 0,
        boxShadow: idleShadow,
        transition: {
          scale: spring,
          rotate: { type: 'tween', duration: 0.15 },
          opacity: { duration: 0.15 },
          boxShadow: { duration: 0.2 },
        },
      })
    }
  }, [active, dimmed, wobble, glow, noShadow, item.color, controls])

  return (
    <motion.div
      custom={index}
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onPick}
      role="button"
      tabIndex={0}
      aria-label={item.label}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 112,
        height: 112,
        marginLeft: -56,
        marginTop: -56,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 999,
        cursor: 'pointer',
        zIndex: 10,
      }}
    >
      <motion.div
        className="rm-icon"
        animate={controls}
        initial={{ scale: 0 }}
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: 999,
          background: solid
            ? item.color
            : `linear-gradient(135deg, ${item.color}, ${item.color}99)`,
          display: 'grid',
          placeItems: 'center',
          boxShadow: glow
            ? `0 6px 16px ${item.color}44`
            : noShadow
              ? 'none'
              : '0 4px 10px rgba(0,0,0,0.4)',
          border: '2px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
        }}
      >
        <item.Icon size={22} color="#fff" strokeWidth={2.2} />
      </motion.div>

      <AnimatePresence>
        {active && (
          <motion.div
            key="label"
            className="rm-label"
            initial={{ opacity: 0, y: 5, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${lp.x}px, ${lp.y}px)`,
              background: '#1b1b1b',
              border: `1px solid ${item.color}66`,
              borderRadius: 999,
              padding: '3px 11px',
              fontSize: 12.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: noShadow ? 'none' : '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {item.label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function makeVariants(count: number, fan: [number, number]): Variants {
  return {
    initial: (i: number) => ({
      scale: 0,
      opacity: 0,
      x: 0,
      y: (i === 0 ? -1 : 1) * 14,
    }),
    enter: (i: number) => {
      const p = itemPos(i, count, fan)
      return {
        scale: 1,
        opacity: 1,
        x: p.x,
        y: p.y,
        transition: { ...spring, delay: 0.12 + i * 0.06 },
      }
    },
    exit: (i: number) => {
      const p = itemPos(i, count, fan)
      return {
        scale: 0,
        opacity: 0,
        x: 0,
        y: p.y * 0.35,
        transition: { duration: 0.16, delay: (count - 1 - i) * 0.03 },
      }
    },
  }
}

export default function RadialMenu({
  count = 3,
  centerColor = '#5a3fa0',
  glow = true,
  solid = false,
  noShadow = false,
  wobble = true,
  items: propItems,
  onPick,
  open: openProp,
  onOpenChange,
  fan = [-Math.PI / 2, 0],
}: RadialMenuProps) {
  const visible = (propItems ?? []).slice(0, count)

  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const timer = useRef<number>(0)
  const variants = useMemo(() => makeVariants(count, fan), [count, fan])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const toggleOpen = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const isOpen = openProp ?? open

  const pick = (it: RadialMenuItem, index: number) => {
    toggleOpen(false)
    setHover(null)
    if (onPick) {
      onPick(it, index)
      return
    }
    setToast(`${it.label} seleccionado`)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(''), 1500)
  }

  return (
    <div style={{ position: 'relative', width: 340, height: 340 }}>
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#212121',
              border: '1px solid #353535',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              whiteSpace: 'nowrap',
              zIndex: 30,
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen &&
          visible.map((it, i) => {
            const angle = lerp(fan[0], fan[1], count === 1 ? 0.5 : i / (count - 1))
            return (
              <MenuOption
                key={it.label}
                item={it}
                index={i}
                count={count}
                angle={angle}
                variants={variants}
                active={hover === i}
                dimmed={hover !== null && hover !== i}
                solid={solid}
                glow={glow}
                wobble={wobble}
                noShadow={noShadow}
                onEnter={() => setHover(i)}
                onLeave={() => setHover((h) => (h === i ? null : h))}
                onPick={() => pick(it, i)}
              />
            )
          })}
      </AnimatePresence>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
        }}
      >
        <motion.button
          className="rm-btn"
          onClick={() => toggleOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{
            boxShadow: isOpen
              ? noShadow
                ? 'none'
                : '0 12px 30px rgba(0,0,0,0.5)'
              : noShadow
                ? 'none'
                : '0 12px 30px rgba(0,0,0,0.45)',
          }}
          transition={spring}
          style={{
            width: 68,
            height: 68,
            borderRadius: 999,
            border: isOpen ? `2px solid ${centerColor}` : '1px solid #353535',
            background: centerColor,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
          }}
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isOpen}
        >
          <motion.span
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            style={{ width: 28, height: 28, position: 'relative', display: 'block' }}
          >
            <span
              style={{
                position: 'absolute',
                inset: '12px 0 12px 0',
                height: 3,
                borderRadius: 99,
                background: '#fff',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '12px',
                right: '12px',
                top: 0,
                bottom: 0,
                width: 3,
                margin: '0 auto',
                borderRadius: 99,
                background: '#fff',
              }}
            />
          </motion.span>
        </motion.button>
      </div>
    </div>
  )
}