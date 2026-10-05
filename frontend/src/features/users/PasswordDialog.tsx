import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useToast } from '@/context/ToastContext';
import { changeUserPassword } from '@/services/users';
import type { ApiError } from '@/services/http';
import type { AppUser } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  user: AppUser | null;
}

export function PasswordDialog({ open, onClose, user }: Props) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirm('');
    setErrors({});
  }, [open, user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrors({});
    if (password !== confirm) {
      setErrors({ confirm: ['Passwords do not match'] });
      return;
    }
    setSaving(true);
    try {
      await changeUserPassword(user.id, password);
      toast.success(`Password updated for ${user.name}`);
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change Password"
      description={user ? `Set a new password for ${user.name}` : undefined}
      size="md"
    >
      {user && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="np">New Password *</Label>
            <Input
              id="np"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters with a letter and a digit"
              autoFocus
            />
            {errors.password?.[0] && <p className="text-xs text-destructive">{errors.password[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cp">Confirm Password *</Label>
            <Input
              id="cp"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm?.[0] && <p className="text-xs text-destructive">{errors.confirm[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Update Password'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}