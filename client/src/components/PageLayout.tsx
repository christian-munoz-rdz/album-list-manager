import { useOutlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Wraps matched child routes and animates them on navigation.
 * Uses a pathless parent route in App so the navbar stays static.
 */
export default function PageLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="relative">{outlet}</div>;
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="relative"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 34,
            mass: 0.85,
          }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
