import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameSystems, factions, unitTypes } from '../db/schema.js';

const games = new Hono();

// GET /games/systems - List all game systems
games.get('/systems', async (c) => {
  const systems = await db.query.gameSystems.findMany({
    where: eq(gameSystems.isActive, true),
    orderBy: (systems, { desc }) => [desc(systems.isFeatured), systems.name],
  });

  return c.json({
    success: true,
    data: systems,
  });
});

// GET /games/systems/:slug - Get game system with factions
games.get('/systems/:slug', async (c) => {
  const slug = c.req.param('slug');

  const system = await db.query.gameSystems.findFirst({
    where: eq(gameSystems.slug, slug),
    with: {
      factions: {
        where: eq(factions.isActive, true),
      },
    },
  });

  if (!system) {
    return c.json({ success: false, error: 'Game system not found' }, 404);
  }

  return c.json({
    success: true,
    data: system,
  });
});

// GET /games/factions/:id - Get faction with unit types
games.get('/factions/:id', async (c) => {
  const id = c.req.param('id');

  const faction = await db.query.factions.findFirst({
    where: eq(factions.id, id),
    with: {
      gameSystem: true,
      unitTypes: {
        where: eq(unitTypes.isActive, true),
      },
    },
  });

  if (!faction) {
    return c.json({ success: false, error: 'Faction not found' }, 404);
  }

  return c.json({
    success: true,
    data: faction,
  });
});

// GET /games/units/:id - Get unit type details
games.get('/units/:id', async (c) => {
  const id = c.req.param('id');

  const unit = await db.query.unitTypes.findFirst({
    where: eq(unitTypes.id, id),
    with: {
      faction: {
        with: {
          gameSystem: true,
        },
      },
    },
  });

  if (!unit) {
    return c.json({ success: false, error: 'Unit type not found' }, 404);
  }

  return c.json({
    success: true,
    data: unit,
  });
});

export default games;
