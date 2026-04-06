import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Users, Glasses, Map, Globe, Landmark, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Map,
    title: 'Settlers of Catan',
    description: 'Trade resources, build settlements, and race to 10 victory points on a hex board.',
  },
  {
    icon: Landmark,
    title: 'Monopoly',
    description: 'Buy properties, build houses & hotels, and bankrupt your opponents.',
  },
  {
    icon: Globe,
    title: 'Risk',
    description: 'Conquer the world by deploying armies, attacking territories, and dominating continents.',
  },
  {
    icon: MessageSquare,
    title: 'Codenames',
    description: 'Team-based word guessing. Spymasters give clues, operatives guess the cards.',
  },
  {
    icon: Glasses,
    title: 'VR-Ready',
    description: 'Immersive 3D tabletop experience designed for Quest 3, PC VR, and desktop.',
  },
  {
    icon: Users,
    title: 'Multiplayer',
    description: 'Play with friends online in real-time with dice physics and turn tracking.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Gamepad2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">TableForge</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/waitlist">
              <Button>Join Waitlist</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Coming Soon to Quest 3
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Classic Board Games,
              <br />
              <span className="text-primary">Reimagined in 3D</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Play Catan, Monopoly, Risk, and Codenames with friends online.
              Full game engines, real rules, dice physics, and immersive VR support.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/waitlist">
                <Button size="lg" className="min-w-[200px]">
                  Join the Waitlist
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="min-w-[200px]" onClick={() => navigate('/games/codenames')}>
                Try a Demo Game
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              4 Classic Games, Fully Playable
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Real game engines with full rules, resource management, dice rolling,
              and turn-based play — not just mockups.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-xl border bg-card p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Ready to Play?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Sign in to access all 4 games, track your stats, and play with friends.
          </p>
          <Link to="/waitlist">
            <Button size="lg" className="mt-8">
              Join the Waitlist
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Gamepad2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">TableForge</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TableForge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
