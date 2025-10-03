import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<{ onNext: () => void; onSkip?: () => void }>;
  required: boolean;
  order: number;
}

export interface OnboardingProgress {
  currentStep: number;
  completedSteps: string[];
  isComplete: boolean;
  canSkip: boolean;
}

export function useOnboardingFlow(steps: OnboardingStep[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState<OnboardingProgress>({
    currentStep: 0,
    completedSteps: [],
    isComplete: false,
    canSkip: false
  });
  const [loading, setLoading] = useState(false);

  // Load user's onboarding progress
  useEffect(() => {
    if (user) {
      loadOnboardingProgress();
    }
  }, [user]);

  const loadOnboardingProgress = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Check if user has completed basic profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Check if user has any transactions or activity
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // Check if user has any balance snapshots (positions)
      const { data: balances } = await supabase
        .from('balance_snapshots')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // Determine completed steps based on user data
      const completedSteps: string[] = [];
      
      if (profile?.first_name && profile?.last_name) {
        completedSteps.push('profile');
      }
      
      if (profile?.kyc_status === 'verified') {
        completedSteps.push('kyc');
      }
      
      if (transactions && transactions.length > 0) {
        completedSteps.push('first-transaction');
      }
      
      if (balances && balances.length > 0) {
        completedSteps.push('first-position');
      }

      // Find current step
      const sortedSteps = steps.sort((a, b) => a.order - b.order);
      let currentStep = 0;
      
      for (let i = 0; i < sortedSteps.length; i++) {
        if (!completedSteps.includes(sortedSteps[i].id)) {
          currentStep = i;
          break;
        }
        if (i === sortedSteps.length - 1) {
          currentStep = sortedSteps.length; // All steps completed
        }
      }

      const isComplete = completedSteps.length === steps.filter(s => s.required).length;

      setProgress({
        currentStep,
        completedSteps,
        isComplete,
        canSkip: !steps[currentStep]?.required
      });

    } catch (error) {
      console.error('Error loading onboarding progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepId: string) => {
    if (!user) return;

    try {
      const newCompletedSteps = [...progress.completedSteps, stepId];
      const nextStepIndex = progress.currentStep + 1;
      const isComplete = nextStepIndex >= steps.length;

      setProgress(prev => ({
        ...prev,
        completedSteps: newCompletedSteps,
        currentStep: nextStepIndex,
        isComplete,
        canSkip: !steps[nextStepIndex]?.required
      }));

      // Save progress to user metadata or separate table
      await supabase
        .from('profiles')
        .update({
          metadata: {
            onboarding: {
              completedSteps: newCompletedSteps,
              currentStep: nextStepIndex,
              isComplete,
              lastUpdated: new Date().toISOString()
            }
          }
        })
        .eq('id', user.id);

      if (isComplete) {
        toast({
          title: "Welcome aboard! 🎉",
          description: "You've completed the onboarding process. Start exploring your DeFi journey!"
        });
      }

    } catch (error) {
      console.error('Error completing onboarding step:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save onboarding progress"
      });
    }
  };

  const skipStep = async (stepId: string) => {
    if (!user) return;

    const step = steps.find(s => s.id === stepId);
    if (step?.required) {
      toast({
        variant: "destructive",
        title: "Cannot skip",
        description: "This step is required to continue"
      });
      return;
    }

    await completeStep(stepId);
  };

  const resetOnboarding = async () => {
    if (!user) return;

    try {
      setProgress({
        currentStep: 0,
        completedSteps: [],
        isComplete: false,
        canSkip: !steps[0]?.required
      });

      await supabase
        .from('profiles')
        .update({
          metadata: {
            onboarding: {
              completedSteps: [],
              currentStep: 0,
              isComplete: false,
              lastUpdated: new Date().toISOString()
            }
          }
        })
        .eq('id', user.id);

      toast({
        title: "Onboarding Reset",
        description: "Your onboarding progress has been reset"
      });

    } catch (error) {
      console.error('Error resetting onboarding:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset onboarding progress"
      });
    }
  };

  const getCurrentStep = () => {
    const sortedSteps = steps.sort((a, b) => a.order - b.order);
    return sortedSteps[progress.currentStep] || null;
  };

  const getStepProgress = () => {
    const totalSteps = steps.length;
    const completedCount = progress.completedSteps.length;
    const progressPercentage = (completedCount / totalSteps) * 100;
    
    return {
      total: totalSteps,
      completed: completedCount,
      remaining: totalSteps - completedCount,
      percentage: progressPercentage
    };
  };

  return {
    progress,
    loading,
    completeStep,
    skipStep,
    resetOnboarding,
    getCurrentStep,
    getStepProgress,
    reload: loadOnboardingProgress
  };
}

// Default onboarding steps for the DeFi lending platform
export const defaultOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Advanced DeFi',
    description: 'Learn about our enterprise-grade lending platform',
    component: ({ onNext }) => <div>Welcome component</div>,
    required: false,
    order: 1
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Add your basic information to get started',
    component: ({ onNext }) => <div>Profile setup component</div>,
    required: true,
    order: 2
  },
  {
    id: 'features',
    title: 'Explore Features',
    description: 'Learn about our advanced DeFi features',
    component: ({ onNext }) => <div>Features overview component</div>,
    required: false,
    order: 3
  },
  {
    id: 'first-transaction',
    title: 'Make Your First Transaction',
    description: 'Try supplying assets or borrowing against collateral',
    component: ({ onNext }) => <div>First transaction guide</div>,
    required: false,
    order: 4
  }
];