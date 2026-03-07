import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { createEntryVariants, panelItemVariants, panelListVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'

type MotionPanelListProps<T> = {
  items: readonly T[]
  getItemKey: (item: T) => string
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  itemClassName?: string
  highlightedKeys?: readonly string[]
  highlightOnMount?: boolean
  stagger?: boolean
}

export function MotionPanelList<T>({
  items,
  getItemKey,
  renderItem,
  className,
  itemClassName,
  highlightedKeys = [],
  highlightOnMount = false,
  stagger = true,
}: MotionPanelListProps<T>) {
  const [detectedKeys, setDetectedKeys] = React.useState<string[]>([])
  const previousKeysRef = React.useRef<string[] | null>(null)

  const itemKeys = React.useMemo(() => items.map((item) => getItemKey(item)), [getItemKey, items])

  React.useEffect(() => {
    const previousKeys = previousKeysRef.current
    previousKeysRef.current = itemKeys

    if (previousKeys === null) {
      if (highlightOnMount) {
        setDetectedKeys(itemKeys)
      }

      return
    }

    const previousKeySet = new Set(previousKeys)
    const newKeys = itemKeys.filter((key) => !previousKeySet.has(key))

    if (newKeys.length === 0) {
      return
    }

    setDetectedKeys(newKeys)

    const timeoutId = window.setTimeout(() => {
      setDetectedKeys([])
    }, 650)

    return () => window.clearTimeout(timeoutId)
  }, [highlightOnMount, itemKeys])

  const highlightKeySet = React.useMemo(() => {
    return new Set([...highlightedKeys, ...detectedKeys])
  }, [detectedKeys, highlightedKeys])

  return (
    <motion.div
      layout
      className={className}
      initial={false}
      animate="animate"
      variants={stagger ? panelListVariants : undefined}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => {
          const key = getItemKey(item)
          const isHighlighted = highlightKeySet.has(key)

          return (
            <motion.div
              key={key}
              layout
              className={cn('relative will-change-transform', itemClassName)}
              initial="initial"
              animate={isHighlighted ? 'highlight' : 'animate'}
              exit="exit"
              variants={isHighlighted ? panelItemVariants : createEntryVariants}
            >
              {renderItem(item, index)}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
