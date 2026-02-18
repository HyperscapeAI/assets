# Game Manifests

This directory contains JSON manifest files that define all game content. These files are the **source of truth** for items, NPCs, resources, recipes, stores, world areas, biomes, and music. The game loads these manifests via `DataManager` at startup, applying defaults and validation.

## Directory Structure

```
manifests/
├── items/                    # Item definitions (split by type)
│   ├── weapons.json          # Combat weapons
│   ├── tools.json            # Skilling tools (hatchets, pickaxes, etc.)
│   ├── resources.json        # Gathered materials (ores, logs, bars, raw fish)
│   ├── food.json             # Cooked consumables
│   └── misc.json             # Burnt food, currency, junk items
├── gathering/                # Harvestable resource nodes
│   ├── woodcutting.json      # Trees and log yields
│   ├── mining.json           # Rocks and ore yields
│   └── fishing.json          # Fishing spots and catch rates
├── recipes/                  # Processing recipes
│   ├── smelting.json         # Furnace: ores → bars
│   ├── smithing.json         # Anvil: bars → equipment
│   ├── cooking.json          # Fire/range: raw → cooked food
│   └── firemaking.json       # Logs → fires (XP data)
├── tier-requirements.json    # Centralized tier-based level requirements
├── skill-unlocks.json        # Skill progression milestones
├── npcs.json                 # All NPCs (mobs, neutral, bosses)
├── stores.json               # Shop inventories
├── world-areas.json          # World zones with spawns
├── biomes.json               # Biome definitions
├── vegetation.json           # Procedural vegetation assets
├── music.json                # Music tracks
└── buildings.json            # Building definitions (future use)
```

## Quick Reference

| Manifest | Purpose | Key Fields |
|----------|---------|------------|
| `items/*.json` | All game items | `id`, `type`, `tier`, `tool` |
| `gathering/*.json` | Harvestable resource nodes | `levelRequired`, `harvestYield`, `respawnTicks` |
| `recipes/*.json` | Processing recipes | `level`, `xp`, `ticks`, inputs/outputs |
| `tier-requirements.json` | Equipment level requirements | tier → skill requirements |
| `skill-unlocks.json` | Skill milestones | skill → level → unlocks |
| `npcs.json` | NPCs (mobs, neutral) | `category`, `stats`, `combat`, `drops` |
| `stores.json` | Shop inventories | `items`, `buybackRate` |
| `world-areas.json` | World zones | `npcs`, `resources`, `mobSpawns` |
| `biomes.json` | Biome settings | `terrain`, `mobs`, `colorScheme` |
| `vegetation.json` | Procedural assets | `category`, `weight`, `scaleVariation` |

---

## tier-requirements.json

**Single source of truth** for OSRS-accurate tier-based level requirements. Items reference their `tier` (e.g., "bronze", "steel") and the system looks up requirements here.

### Schema

```typescript
interface TierRequirements {
  melee: Record<MeleeTier, { attack: number; defence: number }>;
  tools: Record<MeleeTier, { attack: number; woodcutting: number; mining: number }>;
  ranged: Record<RangedTier, { ranged: number; defence: number }>;
  magic: Record<MagicTier, { magic: number; defence?: number }>;
}

type MeleeTier = "bronze" | "iron" | "steel" | "black" | "mithril" | "adamant" | "rune" | "dragon";
type RangedTier = "leather" | "studded" | "green_dhide" | "blue_dhide" | "red_dhide" | "black_dhide";
type MagicTier = "wizard" | "mystic" | "infinity" | "ahrims";
```

### Melee Tiers (Attack/Defence)

| Tier | Attack | Defence |
|------|--------|---------|
| Bronze/Iron | 1 | 1 |
| Steel | 5 | 5 |
| Black | 10 | 10 |
| Mithril | 20 | 20 |
| Adamant | 30 | 30 |
| Rune | 40 | 40 |
| Dragon | 60 | 60 |

### Tool Tiers (Woodcutting/Mining)

| Tier | Attack | Woodcutting | Mining |
|------|--------|-------------|--------|
| Bronze/Iron | 1 | 1 | 1 |
| Steel | 5 | 6 | 6 |
| Black | 10 | 6 | 6 |
| Mithril | 20 | 21 | 21 |
| Adamant | 30 | 31 | 31 |
| Rune | 40 | 41 | 41 |
| Dragon | 60 | 61 | 61 |

### Ranged Tiers

| Tier | Ranged | Defence |
|------|--------|---------|
| Leather | 1 | 1 |
| Studded | 20 | 20 |
| Green D'hide | 40 | 40 |
| Blue D'hide | 50 | 50 |
| Red D'hide | 60 | 60 |
| Black D'hide | 70 | 70 |

### Magic Tiers

| Tier | Magic | Defence |
|------|-------|---------|
| Wizard | 1 | - |
| Mystic | 40 | 20 |
| Infinity | 50 | 25 |
| Ahrim's | 70 | 70 |

---

## skill-unlocks.json

Documents what players unlock at each skill level. Used for UI display and progression tracking.

### Schema

```typescript
interface SkillUnlocks {
  skills: Record<SkillName, SkillUnlock[]>;
}

interface SkillUnlock {
  level: number;
  description: string;
  type: "item" | "ability";
}
```

### Example

```json
{
  "skills": {
    "woodcutting": [
      { "level": 1, "description": "Normal trees", "type": "item" },
      { "level": 15, "description": "Oak trees", "type": "item" },
      { "level": 30, "description": "Willow trees", "type": "item" }
    ],
    "smithing": [
      { "level": 1, "description": "Bronze bar", "type": "item" },
      { "level": 15, "description": "Iron bar (50% success rate)", "type": "item" },
      { "level": 30, "description": "Steel bar", "type": "item" }
    ]
  }
}
```

---

## items/ Directory

Items are split by type into separate files for organization. All files use array format.

### Common Item Schema

```typescript
interface Item {
  // REQUIRED
  id: string;                    // Unique ID (e.g., "bronze_sword", "logs")
  name: string;                  // Display name
  type: ItemType;                // See Item Types below
  description: string;           // Item description
  examine: string;               // Examine text
  tradeable: boolean;            // Can be traded
  rarity: ItemRarity;            // "common" | "uncommon" | "rare" | "epic" | "always"

  // OPTIONAL - Inventory
  stackable?: boolean;           // Default: false
  maxStackSize?: number;         // Default: 1
  value?: number;                // Default: 0 (gold value)
  weight?: number;               // Default: 0.1 (kg)

  // OPTIONAL - Tier-based equipment (weapons/tools)
  tier?: TierName;               // References tier-requirements.json

  // OPTIONAL - Equipment
  equipSlot?: EquipmentSlotName; // "weapon" | "shield" | "helmet" | etc.
  weaponType?: WeaponType;       // "SWORD" | "AXE" | "MACE" | etc.
  attackType?: AttackType;       // "MELEE" | "RANGED" | "MAGIC"
  attackSpeed?: number;          // Ticks between attacks (4 = 2.4s)
  attackRange?: number;          // Range in tiles (1 = melee)
  bonuses?: CombatBonuses;       // { attack, strength, defense, ranged }

  // OPTIONAL - Tools
  tool?: {
    skill: string;               // "woodcutting" | "mining" | "fishing"
    priority: number;            // Higher = better tool
    rollTicks?: number;          // Mining: ticks between roll attempts
  };

  // OPTIONAL - Consumables
  healAmount?: number;           // HP restored when consumed

  // OPTIONAL - Assets
  modelPath: string | null;      // 3D model for ground items
  equippedModelPath?: string;    // 3D model when equipped
  iconPath: string;              // UI inventory icon
}
```

### Item Types

| Type | Description | File |
|------|-------------|------|
| `weapon` | Combat weapons | `weapons.json` |
| `tool` | Skilling tools | `tools.json` |
| `resource` | Gathered materials | `resources.json` |
| `consumable` | Food that heals | `food.json` |
| `currency` | Coins | `misc.json` |
| `junk` | Burnt food, worthless items | `misc.json` |
| `misc` | Everything else | `misc.json` |

### items/weapons.json

```json
[
  {
    "id": "bronze_sword",
    "name": "Bronze Sword",
    "type": "weapon",
    "tier": "bronze",
    "value": 100,
    "weight": 2,
    "equipSlot": "weapon",
    "weaponType": "SWORD",
    "attackType": "MELEE",
    "attackSpeed": 4,
    "attackRange": 1,
    "description": "A basic sword made of bronze",
    "examine": "A basic sword made of bronze",
    "tradeable": true,
    "rarity": "common",
    "modelPath": "asset://models/sword-bronze/sword-bronze.glb",
    "equippedModelPath": "asset://models/sword-bronze/sword-bronze-aligned.glb",
    "iconPath": "asset://models/sword-bronze/concept-art.png",
    "bonuses": { "attack": 4, "strength": 3, "defense": 0, "ranged": 0 }
  }
]
```

### items/tools.json

Tools have an optional `tool` object specifying the skill they're used for and their priority (higher = better). Tiered tools (hatchets, pickaxes) include this object; simple tools (fishing rods, nets) may omit it.

```json
[
  {
    "id": "bronze_hatchet",
    "name": "Bronze Hatchet",
    "type": "tool",
    "tier": "bronze",
    "tool": {
      "skill": "woodcutting",
      "priority": 1
    },
    "value": 50,
    "weight": 1,
    "equipSlot": "weapon",
    "weaponType": "AXE",
    "attackType": "MELEE",
    "attackSpeed": 5,
    "attackRange": 1,
    "description": "A basic hatchet for chopping trees",
    "examine": "A basic hatchet for chopping trees",
    "tradeable": true,
    "rarity": "common",
    "modelPath": "asset://models/hatchet-bronze/hatchet-bronze.glb",
    "iconPath": "asset://models/hatchet-bronze/concept-art.png",
    "bonuses": { "attack": 4, "strength": 3, "defense": 0, "ranged": 0 }
  },
  {
    "id": "bronze_pickaxe",
    "name": "Bronze Pickaxe",
    "type": "tool",
    "tier": "bronze",
    "tool": {
      "skill": "mining",
      "priority": 1,
      "rollTicks": 8
    },
    "value": 50,
    "weight": 2,
    "description": "A basic pickaxe for mining",
    "tradeable": true,
    "rarity": "common"
  }
]
```

### items/resources.json

Raw materials: ores, logs, bars, raw fish.

```json
[
  {
    "id": "copper_ore",
    "name": "Copper Ore",
    "type": "resource",
    "stackable": false,
    "maxStackSize": 100,
    "value": 5,
    "weight": 2,
    "description": "Copper ore that can be smelted into a bronze bar",
    "examine": "Ore containing copper. Can be combined with tin to make bronze.",
    "tradeable": true,
    "rarity": "common",
    "modelPath": null,
    "iconPath": "asset://icons/ore-copper.png"
  }
]
```

### items/food.json

Cooked consumables with `healAmount`.

```json
[
  {
    "id": "shrimp",
    "name": "Shrimp",
    "type": "consumable",
    "stackable": false,
    "value": 10,
    "weight": 0.2,
    "description": "Some nicely cooked shrimp",
    "examine": "Some nicely cooked shrimp.",
    "tradeable": true,
    "rarity": "common",
    "iconPath": "asset://icons/shrimp.png",
    "healAmount": 3
  }
]
```

### items/misc.json

Currency, burnt food, and other items.

```json
[
  {
    "id": "coins",
    "name": "Coins",
    "type": "currency",
    "stackable": true,
    "maxStackSize": 2147483647,
    "value": 1,
    "weight": 0,
    "description": "The universal currency of Hyperia",
    "tradeable": true,
    "rarity": "always",
    "iconPath": "asset://icons/coins.png"
  },
  {
    "id": "burnt_shrimp",
    "name": "Burnt Shrimp",
    "type": "junk",
    "stackable": false,
    "value": 0,
    "weight": 0.2,
    "description": "Oops! It's ruined",
    "tradeable": false,
    "rarity": "common",
    "iconPath": "asset://icons/burnt-fish.png"
  }
]
```

---

## gathering/ Directory

Harvestable resource nodes split by skill. Each file wraps an array in an object.

### Common Gathering Schema

```typescript
interface GatheringResource {
  id: string;                       // Unique resource ID
  name: string;                     // Display name
  type: string;                     // "tree" | "ore" | "fishing_spot"
  examine: string;                  // Examine text

  // Visual
  modelPath: string | null;         // 3D model
  depletedModelPath: string | null; // Model when depleted
  scale: number;                    // Model scale
  depletedScale: number;            // Depleted model scale

  // Requirements
  harvestSkill: string;             // "woodcutting" | "mining" | "fishing"
  toolRequired: string;             // Item ID (e.g., "bronze_hatchet")
  secondaryRequired?: string;       // Consumable (e.g., "fishing_bait")
  levelRequired: number;            // Minimum skill level

  // Timing (OSRS ticks, 1 tick = 600ms)
  baseCycleTicks: number;           // Ticks between harvest attempts
  depleteChance: number;            // 0-1 chance to deplete per success
  respawnTicks: number;             // Ticks until respawn

  // Yields
  harvestYield: HarvestYield[];
}

interface HarvestYield {
  itemId: string;
  itemName: string;
  quantity: number;
  chance: number;                   // 0-1 success chance
  xpAmount: number;
  stackable: boolean;

  // Fishing-specific (OSRS catch formula)
  levelRequired?: number;           // Level to catch this fish
  catchLow?: number;                // Low roll threshold
  catchHigh?: number;               // High roll threshold
}
```

### gathering/woodcutting.json

```json
{
  "$schema": "../schemas/gathering-woodcutting.schema.json",
  "_comment": "Woodcutting resource data. Trees and their log yields.",
  "trees": [
    {
      "id": "tree_normal",
      "name": "Tree",
      "type": "tree",
      "examine": "A commonly found tree. I can chop it down with a hatchet.",
      "modelPath": "asset://models/basic-reg-tree/basic-tree.glb",
      "depletedModelPath": "asset://models/basic-reg-tree-stump/basic-tree-stump.glb",
      "scale": 3.0,
      "depletedScale": 0.3,
      "harvestSkill": "woodcutting",
      "toolRequired": "bronze_hatchet",
      "levelRequired": 1,
      "baseCycleTicks": 4,
      "depleteChance": 0.125,
      "respawnTicks": 80,
      "harvestYield": [
        { "itemId": "logs", "itemName": "Logs", "quantity": 1, "chance": 1.0, "xpAmount": 25, "stackable": true }
      ]
    }
  ]
}
```

### gathering/mining.json

```json
{
  "$schema": "../schemas/gathering-mining.schema.json",
  "_comment": "Mining resource data. Rocks and their ore yields.",
  "rocks": [
    {
      "id": "ore_copper",
      "name": "Copper Rock",
      "type": "ore",
      "examine": "A rock containing copper ore.",
      "modelPath": "asset://models/ore-copper/copper.glb",
      "depletedModelPath": "asset://models/rocks/med_rock_v2.glb",
      "scale": 1.0,
      "depletedScale": 0.4,
      "harvestSkill": "mining",
      "toolRequired": "pickaxe",
      "levelRequired": 1,
      "baseCycleTicks": 4,
      "depleteChance": 0.125,
      "respawnTicks": 4,
      "harvestYield": [
        { "itemId": "copper_ore", "itemName": "Copper Ore", "quantity": 1, "chance": 1.0, "xpAmount": 17.5, "stackable": true }
      ]
    }
  ]
}
```

### gathering/fishing.json

Fishing spots use OSRS-accurate catch rates with `catchLow`/`catchHigh` thresholds.

```json
{
  "$schema": "../schemas/gathering-fishing.schema.json",
  "_comment": "Fishing resource data. Spots with OSRS-accurate catch rates.",
  "spots": [
    {
      "id": "fishing_spot_fly",
      "name": "Lure Fishing Spot",
      "type": "fishing_spot",
      "examine": "A river spot good for fly fishing.",
      "harvestSkill": "fishing",
      "toolRequired": "fly_fishing_rod",
      "secondaryRequired": "feathers",
      "levelRequired": 20,
      "baseCycleTicks": 4,
      "depleteChance": 0.0,
      "respawnTicks": 200,
      "harvestYield": [
        {
          "itemId": "raw_salmon",
          "itemName": "Raw Salmon",
          "quantity": 1,
          "chance": 1.0,
          "xpAmount": 70,
          "levelRequired": 30,
          "catchLow": 24,
          "catchHigh": 115,
          "stackable": false
        },
        {
          "itemId": "raw_trout",
          "itemName": "Raw Trout",
          "quantity": 1,
          "chance": 1.0,
          "xpAmount": 50,
          "levelRequired": 20,
          "catchLow": 32,
          "catchHigh": 120,
          "stackable": false
        }
      ]
    }
  ]
}
```

---

## recipes/ Directory

Processing recipes for skills. All use OSRS-accurate tick timing.

### recipes/smelting.json

Furnace recipes: ores → bars.

```typescript
interface SmeltingRecipe {
  output: string;                   // Bar item ID
  inputs: { item: string; amount: number }[];
  level: number;                    // Smithing level required
  xp: number;                       // XP per successful smelt
  ticks: number;                    // Ticks per action (4 = 2.4s)
  successRate: number;              // 0-1 (iron = 0.5, others = 1.0)
}
```

```json
{
  "recipes": [
    {
      "output": "bronze_bar",
      "inputs": [
        { "item": "copper_ore", "amount": 1 },
        { "item": "tin_ore", "amount": 1 }
      ],
      "level": 1,
      "xp": 6.2,
      "ticks": 4,
      "successRate": 1.0
    },
    {
      "output": "iron_bar",
      "inputs": [{ "item": "iron_ore", "amount": 1 }],
      "level": 15,
      "xp": 12.5,
      "ticks": 4,
      "successRate": 0.5
    },
    {
      "output": "steel_bar",
      "inputs": [
        { "item": "iron_ore", "amount": 1 },
        { "item": "coal", "amount": 2 }
      ],
      "level": 30,
      "xp": 17.5,
      "ticks": 4,
      "successRate": 1.0
    }
  ]
}
```

### recipes/smithing.json

Anvil recipes: bars → equipment.

```typescript
interface SmithingRecipe {
  output: string;                   // Output item ID
  bar: string;                      // Bar item ID
  barsRequired: number;             // Bars consumed per craft
  level: number;                    // Smithing level required
  xp: number;                       // XP per item
  ticks: number;                    // Ticks per action
  category: string;                 // "sword" | "hatchet" | "pickaxe" | etc.
}
```

```json
{
  "recipes": [
    {
      "output": "bronze_sword",
      "bar": "bronze_bar",
      "barsRequired": 1,
      "level": 5,
      "xp": 12.5,
      "ticks": 4,
      "category": "sword"
    },
    {
      "output": "bronze_pickaxe",
      "bar": "bronze_bar",
      "barsRequired": 2,
      "level": 1,
      "xp": 25,
      "ticks": 4,
      "category": "pickaxe"
    }
  ]
}
```

### recipes/cooking.json

Cooking recipes with burn mechanics.

```typescript
interface CookingRecipe {
  raw: string;                      // Raw item ID
  cooked: string;                   // Cooked item ID
  burnt: string;                    // Burnt item ID
  level: number;                    // Cooking level required
  xp: number;                       // XP per successful cook
  ticks: number;                    // Ticks per action
  stopBurnLevel: {
    fire: number;                   // Level to stop burning on fire
    range: number;                  // Level to stop burning on range
  };
}
```

```json
{
  "recipes": [
    {
      "raw": "raw_shrimp",
      "cooked": "shrimp",
      "burnt": "burnt_shrimp",
      "level": 1,
      "xp": 30,
      "ticks": 4,
      "stopBurnLevel": { "fire": 34, "range": 33 }
    },
    {
      "raw": "raw_lobster",
      "cooked": "lobster",
      "burnt": "burnt_lobster",
      "level": 40,
      "xp": 120,
      "ticks": 4,
      "stopBurnLevel": { "fire": 74, "range": 74 }
    }
  ]
}
```

### recipes/firemaking.json

Log burning data.

```typescript
interface FiremakingRecipe {
  log: string;                      // Log item ID
  level: number;                    // Firemaking level required
  xp: number;                       // XP per fire lit
  ticks: number;                    // Ticks per action
}
```

```json
{
  "recipes": [
    { "log": "logs", "level": 1, "xp": 40, "ticks": 4 },
    { "log": "oak_logs", "level": 15, "xp": 60, "ticks": 4 },
    { "log": "willow_logs", "level": 30, "xp": 90, "ticks": 4 },
    { "log": "yew_logs", "level": 60, "xp": 202.5, "ticks": 4 },
    { "log": "magic_logs", "level": 75, "xp": 303.8, "ticks": 4 }
  ]
}
```

---

## npcs.json

All NPCs in array format. NPCs are categorized by their role.

### Schema

```typescript
interface NPCData {
  id: string;
  name: string;
  description: string;
  category: "mob" | "boss" | "neutral" | "quest";
  faction?: string;

  stats?: {
    level: number;
    health: number;
    attack: number;
    strength: number;
    defense: number;
    defenseBonus?: number;
    ranged: number;
    magic: number;
  };

  combat?: {
    attackable: boolean;
    aggressive: boolean;
    retaliates: boolean;
    aggroRange: number;
    combatRange: number;
    leashRange?: number;
    attackSpeedTicks: number;
    respawnTicks: number;
  };

  movement?: {
    type: "stationary" | "wander" | "patrol";
    speed: number;
    wanderRadius: number;
  };

  drops?: {
    defaultDrop: { enabled: boolean; itemId: string; quantity: number };
    always: DropEntry[];
    common: DropEntry[];
    uncommon: DropEntry[];
    rare: DropEntry[];
    veryRare: DropEntry[];
  };

  services?: {
    enabled: boolean;
    types: ("bank" | "shop")[];
  };

  dialogue?: {
    entryNodeId: string;
    nodes: DialogueNode[];
  };

  appearance?: {
    modelPath: string;
    iconPath?: string;
    scale: number;
  };

  spawnBiomes?: string[];
}
```

### Example: Combat Mob

```json
[
  {
    "id": "goblin",
    "name": "Goblin",
    "description": "A weak goblin creature, perfect for beginners",
    "category": "mob",
    "faction": "monster",
    "stats": {
      "level": 2,
      "health": 5,
      "attack": 1,
      "strength": 1,
      "defense": 1,
      "ranged": 1,
      "magic": 1
    },
    "combat": {
      "attackable": true,
      "aggressive": true,
      "retaliates": true,
      "aggroRange": 4,
      "combatRange": 1,
      "leashRange": 7,
      "attackSpeedTicks": 4,
      "respawnTicks": 35
    },
    "movement": { "type": "wander", "speed": 3.33, "wanderRadius": 5 },
    "drops": {
      "defaultDrop": { "enabled": true, "itemId": "bones", "quantity": 1 },
      "common": [{ "itemId": "coins", "minQuantity": 5, "maxQuantity": 15, "chance": 1.0, "rarity": "common" }],
      "rare": [{ "itemId": "steel_sword", "minQuantity": 1, "maxQuantity": 1, "chance": 0.02, "rarity": "rare" }]
    },
    "appearance": { "modelPath": "asset://models/goblin/goblin.vrm", "scale": 0.75 },
    "spawnBiomes": ["forest", "plains"]
  }
]
```

### Example: Neutral NPC with Dialogue

```json
[
  {
    "id": "bank_clerk",
    "name": "Bank Clerk",
    "description": "A helpful bank clerk",
    "category": "neutral",
    "faction": "town",
    "combat": { "attackable": false },
    "movement": { "type": "stationary", "speed": 0, "wanderRadius": 0 },
    "services": { "enabled": true, "types": ["bank"] },
    "dialogue": {
      "entryNodeId": "greeting",
      "nodes": [
        {
          "id": "greeting",
          "text": "Welcome to the bank! How may I help you?",
          "responses": [
            { "text": "I'd like to access my bank.", "nextNodeId": "open_bank", "effect": "openBank" },
            { "text": "Goodbye.", "nextNodeId": "farewell" }
          ]
        },
        { "id": "open_bank", "text": "Of course! Here are your belongings." },
        { "id": "farewell", "text": "Take care, adventurer!" }
      ]
    },
    "appearance": { "modelPath": "asset://avatars/avatar-male-01_optimized.vrm", "scale": 1.0 }
  }
]
```

---

## stores.json

Shop inventories for shopkeeper NPCs. Store location is defined in `world-areas.json` via NPC placement with `storeId`.

### Schema

```typescript
interface StoreData {
  id: string;                       // Referenced by NPCs via storeId
  name: string;
  description: string;
  buyback: boolean;                 // Accept item sell-back
  buybackRate: number;              // 0-1 (0.5 = 50% of value)
  items: StoreItem[];
}

interface StoreItem {
  id: string;                       // Unique ID within store
  itemId: string;                   // References items/*.json
  name: string;
  price: number;
  description: string;
  category: "weapons" | "tools" | "armor" | "consumables" | "ammunition" | "resources";
  stockQuantity: number;            // -1 for unlimited
  restockTime: number;              // Milliseconds (0 = no restock)
}
```

### Example

```json
[
  {
    "id": "central_store",
    "name": "Central General Store",
    "buyback": true,
    "buybackRate": 0.5,
    "description": "General supplies and equipment for adventurers.",
    "items": [
      {
        "id": "bronze_sword",
        "itemId": "bronze_sword",
        "name": "Bronze Sword",
        "price": 100,
        "stockQuantity": -1,
        "restockTime": 0,
        "description": "A basic sword made of bronze",
        "category": "weapons"
      }
    ]
  }
]
```

---

## vegetation.json

Procedural vegetation assets for world generation.

### Schema

```typescript
interface VegetationManifest {
  version: number;
  description: string;
  assets: VegetationAsset[];
}

interface VegetationAsset {
  id: string;
  model: string;                    // Relative path to GLB
  category: "tree" | "bush" | "fern" | "flower" | "grass" | "rock" | "fallen_tree";
  baseScale: number;
  scaleVariation: [number, number]; // [min, max] multiplier
  randomRotation: boolean;
  weight: number;                   // Spawn probability weight
  maxSlope: number;                 // Max terrain slope (0-1)
  minSlope?: number;                // Min terrain slope (for cliff rocks)
  alignToNormal: boolean;           // Align to terrain normal
  yOffset: number;                  // Vertical offset
}
```

### Example

```json
{
  "version": 1,
  "description": "Vegetation asset definitions for procedural world generation",
  "assets": [
    {
      "id": "garden_tree_1_1",
      "model": "vegetation/garden-trees/Tree_1_1.glb",
      "category": "tree",
      "baseScale": 1.0,
      "scaleVariation": [0.8, 1.2],
      "randomRotation": true,
      "weight": 10,
      "maxSlope": 0.4,
      "alignToNormal": false,
      "yOffset": 0
    },
    {
      "id": "tall_rock_1",
      "model": "rocks/tall_rocks/tall_rocks_1.glb",
      "category": "rock",
      "baseScale": 1.0,
      "scaleVariation": [0.7, 1.3],
      "randomRotation": true,
      "weight": 4,
      "minSlope": 0.2,
      "maxSlope": 0.9,
      "alignToNormal": false,
      "yOffset": -0.5
    }
  ]
}
```

---

## world-areas.json

World zones with NPC placements, resource spawns, mob spawn points, and fishing spot configuration.

### Schema

```typescript
interface WorldAreasManifest {
  starterTowns: Record<string, WorldArea>;
  level1Areas: Record<string, WorldArea>;
  level2Areas: Record<string, WorldArea>;
  level3Areas: Record<string, WorldArea>;
}

interface WorldArea {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  biomeType: string;
  safeZone: boolean;
  pvpEnabled?: boolean;             // Enable PvP combat in this area
  npcs: NPCPlacement[];
  resources: ResourceSpawn[];
  mobSpawns: MobSpawnPoint[];
  fishing?: FishingConfig;          // Fishing spot configuration
}

interface NPCPlacement {
  id: string;                       // NPC ID from npcs.json
  type: string;                     // "bank" | "general_store" | etc.
  storeId?: string;                 // For shopkeepers - references stores.json
  position: { x: number; y: number; z: number };
}

interface ResourceSpawn {
  type: string;                     // "tree" | "ore"
  resourceId: string;               // ID from gathering/*.json
  position: { x: number; y: number; z: number };
}

interface MobSpawnPoint {
  mobId: string;                    // NPC ID from npcs.json (category: "mob")
  position: { x: number; y: number; z: number };
  spawnRadius: number;              // Spawn area radius
  maxCount: number;                 // Max simultaneous spawns
}

interface FishingConfig {
  enabled: boolean;
  spotCount: number;                // Number of fishing spots to spawn
  spotTypes: string[];              // Spot IDs from gathering/fishing.json
}
```

### Example

```json
{
  "starterTowns": {
    "central_haven": {
      "id": "central_haven",
      "name": "Central Haven",
      "description": "The central hub of Hyperscape",
      "difficultyLevel": 0,
      "bounds": { "minX": -150, "maxX": 150, "minZ": -150, "maxZ": 150 },
      "biomeType": "starter_town",
      "safeZone": true,
      "npcs": [
        { "id": "bank_clerk", "type": "bank", "position": { "x": 5, "y": 0, "z": -5 } },
        { "id": "shopkeeper", "type": "general_store", "storeId": "central_store", "position": { "x": -5, "y": 0, "z": -5 } }
      ],
      "resources": [
        { "type": "tree", "resourceId": "tree_normal", "position": { "x": 15, "y": 0, "z": -10 } },
        { "type": "ore", "resourceId": "ore_copper", "position": { "x": -18, "y": 0, "z": 10 } }
      ],
      "mobSpawns": [
        { "mobId": "goblin", "position": { "x": 5, "y": 0, "z": 5 }, "spawnRadius": 0, "maxCount": 3 }
      ],
      "fishing": {
        "enabled": true,
        "spotCount": 6,
        "spotTypes": ["fishing_spot_net", "fishing_spot_bait", "fishing_spot_fly"]
      }
    }
  },
  "level1Areas": {
    "wilderness_test": {
      "id": "wilderness_test",
      "name": "The Wastes",
      "description": "A dangerous PvP zone",
      "difficultyLevel": 1,
      "bounds": { "minX": 200, "maxX": 300, "minZ": -50, "maxZ": 50 },
      "biomeType": "wastes",
      "safeZone": false,
      "pvpEnabled": true,
      "npcs": [],
      "resources": [],
      "mobSpawns": [],
      "fishing": { "enabled": true, "spotCount": 2, "spotTypes": ["fishing_spot_fly"] }
    }
  },
  "level2Areas": {},
  "level3Areas": {}
}
```

---

## biomes.json

Biome definitions with terrain generation, visual settings, and procedural vegetation layers.

### Schema

```typescript
interface BiomeData {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3;
  difficulty: number;               // Duplicate for compatibility
  terrain: "forest" | "plains" | "mountains" | "desert" | "swamp" | "frozen" | "lake";

  // Resources and mobs
  resources: string[];
  resourceTypes: string[];          // Duplicate for compatibility
  mobs: string[];
  mobTypes: string[];               // Duplicate for compatibility

  // Terrain generation
  color: number;                    // Hex color as number
  heightRange: [number, number];
  terrainMultiplier: number;
  waterLevel: number;
  maxSlope: number;
  baseHeight: number;
  heightVariation: number;
  resourceDensity: number;

  // Visual settings
  fogIntensity: number;
  ambientSound: string;
  colorScheme: { primary: string; secondary: string; fog: string };

  // Procedural vegetation
  vegetation?: VegetationConfig;
}

interface VegetationConfig {
  enabled: boolean;
  layers: VegetationLayer[];
}

interface VegetationLayer {
  category: string;                 // Matches vegetation.json categories
  density: number;                  // Spawn density
  assets: string[];                 // Asset IDs from vegetation.json (empty = all in category)
  minSpacing: number;               // Minimum distance between instances
  clustering: boolean;              // Group assets together
  clusterSize?: number;             // Size of clusters
  noiseScale: number;               // Perlin noise scale for distribution
  noiseThreshold: number;           // Noise threshold for spawning
  avoidWater: boolean;              // Don't spawn in water
  avoidSteepSlopes?: boolean;       // Don't spawn on steep terrain
  minHeight?: number;               // Minimum terrain height
}
```

### Example

```json
[
  {
    "id": "plains",
    "name": "Plains",
    "description": "Open grasslands with gentle rolling hills.",
    "difficultyLevel": 0,
    "difficulty": 0,
    "terrain": "plains",
    "resources": ["trees", "fishing_spots"],
    "resourceTypes": ["trees", "fishing_spots"],
    "mobs": [],
    "mobTypes": [],
    "fogIntensity": 0.1,
    "ambientSound": "wind_gentle",
    "colorScheme": { "primary": "#66BB6A", "secondary": "#81C784", "fog": "#F1F8E9" },
    "color": 6732650,
    "heightRange": [0.0, 0.2],
    "terrainMultiplier": 1.0,
    "waterLevel": 0.0,
    "maxSlope": 0.8,
    "baseHeight": 0.0,
    "heightVariation": 0.1,
    "resourceDensity": 0.5,
    "vegetation": {
      "enabled": true,
      "layers": [
        {
          "category": "tree",
          "density": 8,
          "assets": ["tree1"],
          "minSpacing": 12,
          "clustering": true,
          "clusterSize": 3,
          "noiseScale": 0.02,
          "noiseThreshold": 0.4,
          "avoidWater": true,
          "avoidSteepSlopes": true,
          "minHeight": 12
        },
        {
          "category": "grass",
          "density": 3000,
          "assets": ["grass_toon", "grass_field"],
          "minSpacing": 0.3,
          "clustering": false,
          "noiseScale": 0.2,
          "noiseThreshold": 0.05,
          "avoidWater": true,
          "avoidSteepSlopes": true,
          "minHeight": 10
        },
        {
          "category": "flower",
          "density": 40,
          "assets": [],
          "minSpacing": 2,
          "clustering": true,
          "clusterSize": 8,
          "noiseScale": 0.08,
          "noiseThreshold": 0.5,
          "avoidWater": true,
          "minHeight": 8
        }
      ]
    }
  }
]
```

---

## music.json

Music tracks for different game states.

### Schema

```typescript
interface MusicTrack {
  id: string;
  name: string;
  type: "theme" | "ambient" | "combat";
  category: "intro" | "normal" | "combat";
  path: string;
  description: string;
  duration: number;
  mood: string;
}
```

---

## Tick Timing Reference

All timing uses OSRS-style game ticks (1 tick = 600ms):

| Action | Typical Ticks | Real Time |
|--------|---------------|-----------|
| Smelting | 4 | 2.4s |
| Smithing | 4 | 2.4s |
| Cooking | 4 | 2.4s |
| Firemaking | 4 | 2.4s |
| Woodcutting cycle | 4 | 2.4s |
| Mining cycle | 4 | 2.4s |
| Fishing cycle | 4 | 2.4s |
| Melee attack | 4 | 2.4s |
| NPC respawn | 25-50 | 15-30s |
| Tree respawn | 14-200 | 8.4s-2min |
| Rock respawn | 4-1200 | 2.4s-12min |

---

## Asset Paths

All asset paths use the `asset://` protocol:

```
asset://models/sword-bronze/sword-bronze.glb
→ http://localhost:8080/models/sword-bronze/sword-bronze.glb (dev)
→ https://cdn.example.com/models/sword-bronze/sword-bronze.glb (prod)
```

| Asset Type | Path Pattern |
|------------|--------------|
| 3D Models | `asset://models/{name}/{name}.glb` |
| VRM Models | `asset://models/{name}/{name}.vrm` |
| Icons | `asset://icons/{name}.png` |
| Audio | `asset://audio/music/{category}/{id}.mp3` |

---

## Adding New Content

### Adding an Item

1. Add entry to appropriate `items/*.json` file
2. For tiered equipment, specify `tier` field
3. For tools, add `tool` object with `skill` and `priority`
4. Create 3D model and icon assets

### Adding a Gathering Resource

1. Add entry to appropriate `gathering/*.json` file
2. Specify `levelRequired`, `harvestYield`, and timing
3. Create model and depleted model assets
4. Add spawn points in `world-areas.json`

### Adding a Recipe

1. Add entry to appropriate `recipes/*.json` file
2. Ensure all referenced item IDs exist in `items/*.json`
3. Set appropriate level, XP, and tick timing

### Adding an NPC

1. Add entry to `npcs.json` array
2. For mobs: define `stats`, `combat`, `drops`
3. For neutral: define `services`, `dialogue`
4. Add spawn point in `world-areas.json`

---

## Validation

DataManager validates:
- All referenced item IDs exist across all manifests
- All mob spawn points reference valid NPC IDs
- Required fields are present
- Tier references are valid

Warnings are logged for:
- Missing assets (models, icons)
- Empty manifests (expected in CI/test environments)

Errors thrown for:
- No world areas defined
- Critical cross-reference failures
