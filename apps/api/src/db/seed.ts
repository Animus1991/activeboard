import 'dotenv/config';
import { db } from './index.js';
import { gameSystems, factions, unitTypes } from './schema.js';

async function seed() {
  console.log('Seeding database...');

  // Clear existing data
  await db.delete(unitTypes);
  await db.delete(factions);
  await db.delete(gameSystems);

  // Insert One Page Rules: Grimdark Future
  const [grimdarkFuture] = await db.insert(gameSystems).values({
    slug: 'grimdark-future',
    name: 'Grimdark Future',
    publisher: 'One Page Rules',
    description: 'A fast-paced sci-fi skirmish game set in a dark future where there is only war. Simple rules, deep tactics.',
    minPlayers: 2,
    maxPlayers: 4,
    avgPlayTimeMinutes: 90,
    complexity: 'medium',
    rulesUrl: 'https://onepagerules.com/games/grimdark-future/',
    isActive: true,
    isFeatured: true,
    releasePhase: 'alpha',
  }).returning();

  console.log('Created game system:', grimdarkFuture.name);

  // Insert factions
  const factionData = [
    {
      gameSystemId: grimdarkFuture.id,
      slug: 'battle-brothers',
      name: 'Battle Brothers',
      description: 'Elite genetically-enhanced warriors clad in power armor. Few in number but devastating in combat.',
      playstyle: 'Elite, durable units with powerful weapons. Quality over quantity.',
      colorPrimary: '#1E40AF',
      colorSecondary: '#FBBF24',
    },
    {
      gameSystemId: grimdarkFuture.id,
      slug: 'hive-city-gangs',
      name: 'Hive City Gangs',
      description: 'Ruthless criminal organizations from the underhives. Cheap, numerous, and cunning.',
      playstyle: 'Swarm tactics with cheap units. Overwhelm with numbers.',
      colorPrimary: '#7C3AED',
      colorSecondary: '#10B981',
    },
    {
      gameSystemId: grimdarkFuture.id,
      slug: 'robot-legions',
      name: 'Robot Legions',
      description: 'Ancient mechanical warriors awakened from eons of slumber. Implacable and self-repairing.',
      playstyle: 'Resilient units with regeneration. Slow but unstoppable.',
      colorPrimary: '#059669',
      colorSecondary: '#F59E0B',
    },
    {
      gameSystemId: grimdarkFuture.id,
      slug: 'alien-hives',
      name: 'Alien Hives',
      description: 'A ravenous swarm of bio-engineered creatures driven by a hive mind. Consume all in their path.',
      playstyle: 'Fast, aggressive melee units. Close quickly and overwhelm.',
      colorPrimary: '#7C2D12',
      colorSecondary: '#A855F7',
    },
    {
      gameSystemId: grimdarkFuture.id,
      slug: 'orc-marauders',
      name: 'Orc Marauders',
      description: 'Brutal green-skinned warriors who live for battle. Loud, violent, and surprisingly effective.',
      playstyle: 'Aggressive assault with unreliable but powerful weapons.',
      colorPrimary: '#15803D',
      colorSecondary: '#DC2626',
    },
  ];

  const insertedFactions = await db.insert(factions).values(factionData).returning();
  console.log(`Created ${insertedFactions.length} factions`);

  // Insert unit types for Battle Brothers
  const battleBrothers = insertedFactions.find(f => f.slug === 'battle-brothers')!;
  
  const battleBrothersUnits = [
    {
      factionId: battleBrothers.id,
      slug: 'battle-brother-infantry',
      name: 'Battle Brother Infantry',
      description: 'Standard power-armored warriors forming the backbone of any force.',
      pointsCost: 100,
      quality: 3,
      defense: 2,
      modelCount: 5,
      equipment: ['Assault Rifle', 'Combat Knife'],
      specialRules: ['Fearless'],
    },
    {
      factionId: battleBrothers.id,
      slug: 'assault-brothers',
      name: 'Assault Brothers',
      description: 'Close combat specialists equipped with jump packs.',
      pointsCost: 150,
      quality: 3,
      defense: 2,
      modelCount: 5,
      equipment: ['Chainsword', 'Pistol', 'Jump Pack'],
      specialRules: ['Fearless', 'Flying'],
    },
    {
      factionId: battleBrothers.id,
      slug: 'heavy-weapons-team',
      name: 'Heavy Weapons Team',
      description: 'Devastators armed with the heaviest weapons available.',
      pointsCost: 200,
      quality: 3,
      defense: 2,
      modelCount: 5,
      equipment: ['Heavy Machinegun', 'Missile Launcher'],
      specialRules: ['Fearless', 'Slow'],
    },
    {
      factionId: battleBrothers.id,
      slug: 'captain',
      name: 'Captain',
      description: 'Veteran commander leading from the front.',
      pointsCost: 120,
      quality: 2,
      defense: 2,
      modelCount: 1,
      equipment: ['Power Sword', 'Plasma Pistol', 'Iron Halo'],
      specialRules: ['Fearless', 'Hero', 'Tough(3)'],
    },
  ];

  // Insert unit types for Alien Hives
  const alienHives = insertedFactions.find(f => f.slug === 'alien-hives')!;
  
  const alienHivesUnits = [
    {
      factionId: alienHives.id,
      slug: 'swarm-warriors',
      name: 'Swarm Warriors',
      description: 'Basic bioforms serving as the endless tide of the hive.',
      pointsCost: 60,
      quality: 5,
      defense: 6,
      modelCount: 10,
      equipment: ['Claws', 'Fangs'],
      specialRules: ['Swarm'],
    },
    {
      factionId: alienHives.id,
      slug: 'hunter-beasts',
      name: 'Hunter Beasts',
      description: 'Fast-moving predators designed to run down prey.',
      pointsCost: 100,
      quality: 4,
      defense: 5,
      modelCount: 5,
      equipment: ['Rending Claws', 'Scything Talons'],
      specialRules: ['Fast', 'Scout'],
    },
    {
      factionId: alienHives.id,
      slug: 'hive-tyrant',
      name: 'Hive Tyrant',
      description: 'Massive synapse creature directing the swarm.',
      pointsCost: 250,
      quality: 3,
      defense: 3,
      modelCount: 1,
      equipment: ['Bonesword', 'Lash Whip', 'Bio-Cannon'],
      specialRules: ['Hero', 'Tough(6)', 'Synapse'],
    },
  ];

  await db.insert(unitTypes).values([...battleBrothersUnits, ...alienHivesUnits]);
  console.log('Created unit types');

  console.log('Seeding completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
