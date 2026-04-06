import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { waitlist } from '@/lib/api';

export default function WaitlistPage() {
  const [searchParams] = useSearchParams();
  const referredBy = searchParams.get('ref') || undefined;
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    primaryInterest: 'wargaming',
    hasVrHeadset: false,
    vrHeadsetType: '',
    playFrequency: 'weekly',
    biggestPainPoint: '',
    willingToPay: 'maybe',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await waitlist.join({
        ...formData,
        referredBy,
      });
      setReferralCode(response.referralCode);
      setIsSubmitted(true);
      toast({
        title: 'Welcome to the waitlist!',
        description: 'Check your email for confirmation.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join waitlist',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/waitlist?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Referral link copied to clipboard.',
    });
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="font-display text-2xl">You're on the list!</CardTitle>
              <CardDescription>
                We'll notify you when TableForge is ready for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">Share to move up the list:</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/waitlist?ref=${referralCode}`}
                    className="text-xs"
                  />
                  <Button size="icon" variant="outline" onClick={copyReferralLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={copyReferralLink}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Link
                </Button>
                <Link to="/" className="flex-1">
                  <Button className="w-full" variant="ghost">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Gamepad2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">TableForge</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Join the Waitlist</CardTitle>
            <CardDescription>
              Be among the first to experience VR wargaming.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label>Do you own a VR headset?</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="hasVr"
                      checked={formData.hasVrHeadset}
                      onChange={() => setFormData({ ...formData, hasVrHeadset: true })}
                      className="accent-primary"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="hasVr"
                      checked={!formData.hasVrHeadset}
                      onChange={() => setFormData({ ...formData, hasVrHeadset: false })}
                      className="accent-primary"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>

              {formData.hasVrHeadset && (
                <div className="space-y-2">
                  <Label htmlFor="vrType">Which headset?</Label>
                  <Input
                    id="vrType"
                    value={formData.vrHeadsetType}
                    onChange={(e) => setFormData({ ...formData, vrHeadsetType: e.target.value })}
                    placeholder="e.g., Quest 3, Quest 3S, PCVR"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="painPoint">What's your biggest challenge with remote wargaming?</Label>
                <Input
                  id="painPoint"
                  value={formData.biggestPainPoint}
                  onChange={(e) => setFormData({ ...formData, biggestPainPoint: e.target.value })}
                  placeholder="e.g., Finding opponents, setup time..."
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Joining...' : 'Join Waitlist'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
