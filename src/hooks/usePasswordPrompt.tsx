import { useState } from 'react';
import { PasswordPrompt } from '@/components/wallet/PasswordPrompt';

export const usePasswordPrompt = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((password: string | null) => void) | null>(null);

  const promptForPassword = (): Promise<string | null> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = (password: string) => {
    if (resolvePromise) {
      resolvePromise(password);
      setResolvePromise(null);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolvePromise) {
      resolvePromise(null);
      setResolvePromise(null);
    }
    setIsOpen(false);
  };

  const PasswordPromptComponent = (
    <PasswordPrompt
      open={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={handleConfirm}
      loading={false}
    />
  );

  return {
    promptForPassword,
    PasswordPromptComponent,
  };
};
