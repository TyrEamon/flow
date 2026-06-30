import { useEffect } from 'react'

// https://github.com/excalidraw/excalidraw/blob/7eaf47c9d41a33a6230d8c3a16b5087fc720dcfb/src/packages/excalidraw/index.tsx#L66
export function useDisablePinchZooming(win?: Window) {
  useEffect(() => {
    const _win = win ?? window
    // Block pinch-zooming without disabling one-finger page scrolling.
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault()
    }
    const handleGesture = (event: Event) => {
      event.preventDefault()
    }

    _win.document.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    })
    _win.document.addEventListener('gesturestart', handleGesture, {
      passive: false,
    })

    return () => {
      _win.document.removeEventListener('touchmove', handleTouchMove)
      _win.document.removeEventListener('gesturestart', handleGesture)
    }
  }, [win])
}
