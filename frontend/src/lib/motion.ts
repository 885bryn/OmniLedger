import type { Transition, Variants } from 'framer-motion'

export const motionSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} satisfies Transition

export const pressScale = 0.97

export const listStagger = {
  delayChildren: 0.02,
  staggerChildren: 0.04,
} satisfies Transition

export const createEntryOffset = 10

export const createEntryVariants = {
  initial: {
    opacity: 0,
    y: createEntryOffset,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: motionSpring,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: motionSpring,
  },
} satisfies Variants

export const subtleHighlightTint = [
  'rgba(148, 163, 184, 0.18)',
  'rgba(148, 163, 184, 0.08)',
  'rgba(148, 163, 184, 0)',
]

export const panelItemVariants = {
  ...createEntryVariants,
  highlight: {
    opacity: 1,
    y: 0,
    backgroundColor: subtleHighlightTint,
    transition: {
      opacity: motionSpring,
      y: motionSpring,
      backgroundColor: {
        duration: 0.55,
        ease: 'easeOut',
        times: [0, 0.4, 1],
      },
    },
  },
} satisfies Variants

export const panelListVariants = {
  animate: {
    transition: listStagger,
  },
} satisfies Variants

export const subtlePageShiftVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: motionSpring,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: motionSpring,
  },
} satisfies Variants
