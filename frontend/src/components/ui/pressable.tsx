import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

import { motionSpring, pressScale } from '@/lib/motion'
import { cn } from '@/lib/utils'

type PressableProps = HTMLMotionProps<'div'>

const Pressable = React.forwardRef<HTMLDivElement, PressableProps>(function Pressable(
  { children, className, transition, whileTap, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn('inline-flex max-w-full', className)}
      transition={transition ?? motionSpring}
      whileTap={whileTap ?? { scale: pressScale }}
      {...props}
    >
      {children}
    </motion.div>
  )
})

export { Pressable }
