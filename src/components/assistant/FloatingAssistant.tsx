import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistant } from '@/contexts/AssistantContext';
import { useAssistantPreferences } from '@/hooks/useAssistantPreferences';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'react-router-dom';

export const FloatingAssistant = () => {
  const location = useLocation();
  const { toggleAssistant, isAssistantOpen, showProactiveTip, dismissProactiveTip, proactiveTipMessage } = useAssistant();
  const { preferences } = useAssistantPreferences();

  // Don't show on auth pages or if disabled
  if (!preferences.enabled || location.pathname.includes('/auth')) {
    return null;
  }

  // Respect assistance level for proactive tips
  const shouldShowTip = showProactiveTip && preferences.showProactiveTips && 
    preferences.assistanceLevel !== 'minimal';

  return (
    <>
      {/* Proactive Tip Popup */}
      <AnimatePresence>
        {shouldShowTip && !isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="fixed bottom-24 right-6 z-40 max-w-xs"
          >
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 relative">
              <button
                onClick={dismissProactiveTip}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-sm text-foreground mb-3 pr-6">{proactiveTipMessage}</p>
              <Button 
                onClick={toggleAssistant}
                size="sm"
                className="w-full"
              >
                Chat with Assistant
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.div
        className="fixed bottom-20 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={toggleAssistant}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg relative group"
          aria-label="Toggle virtual assistant"
        >
          <motion.div
            animate={isAssistantOpen ? { rotate: 90 } : { rotate: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isAssistantOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <MessageCircle className="h-6 w-6" />
            )}
          </motion.div>
          
          {/* Pulse animation when not open */}
          {!isAssistantOpen && shouldShowTip && (
            <motion.span
              className="absolute inset-0 rounded-full bg-primary"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          {/* Badge for new tips */}
          {!isAssistantOpen && shouldShowTip && (
            <Badge className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
              💬
            </Badge>
          )}
        </Button>

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-md">
            {isAssistantOpen ? 'Close Assistant' : 'Need Help?'}
          </div>
        </div>
      </motion.div>
    </>
  );
};
