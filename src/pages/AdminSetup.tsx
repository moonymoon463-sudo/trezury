import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AurumLogo from '@/components/AurumLogo';

const AdminSetup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const makeUserAdmin = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // First find the user by email
      const { data: profiles, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (findError || !profiles) {
        toast.error('User not found with that email address');
        return;
      }

      // Assign admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: profiles.id,
          role: 'admin'
        });

      if (roleError) {
        console.error('Error assigning admin role:', roleError);
        toast.error('Failed to assign admin role');
        return;
      }

      toast.success('Admin role assigned successfully!');
      navigate('/admin');
    } catch (error) {
      console.error('Error making user admin:', error);
      toast.error('Failed to assign admin role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AurumLogo className="w-12 h-12" />
          </div>
          <CardTitle className="flex items-center gap-2 justify-center">
            <Crown className="w-6 h-6 text-amber-500" />
            Admin Setup
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Make a user an administrator
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user email to make admin"
              className="mt-1"
            />
          </div>
          
          <Button 
            onClick={makeUserAdmin}
            disabled={loading || !email}
            className="w-full"
          >
            {loading ? 'Assigning...' : 'Make Admin'}
          </Button>

          <Button 
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;