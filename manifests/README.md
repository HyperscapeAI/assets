# Game Manifests

This directory contains JSON manifest files that define all game content. These files are the **source of truth** for items, NPCs, resources, stores, world areas, biomes, and music. The game loads these manifests via `DataManager` at startup, applying defaults and validation.

## Quick Reference

| Manifest | Purpose | Loaded By |
|----------|---------|-----------|
| `items.json` | All game items (weapons, tools, resources, currency) | `DataManager.normalizeItem()` |
| `npcs.json` | All NPCs (mobs, neutral, bosses, quest givers) | `DataManager.normalizeNPC()` |
| `stores.json` | Shop inventories and buyback rates | `DataManager` |
| `resources.json` | Harvestable resources (trees, fishing spots, ores) | `EXTERNAL_RESOURCES` global |
| `world-areas.json` | World zones with NPC/mob/resource spawns | `ALL_WORLD_AREAS` |
| `biomes.json` | Biome definitions (terrain, colors, mob spawns) | `BIOMES` |
| `music.json` | Music tracks for different game states | Music system |
| `buildings.json` | Building definitions (currently empty) | Future use |

---

## items.json

Defines all items in the game. Items can be weapons, tools, armor, consumables, resources, or currency.

### Schema

```typescript
interface Item {
  // REQUIRED - Core identity
  id: string;                    // Unique ID (e.g., "bronze_sword", "logs")
  name: string;                  // Display name
  type: ItemType;                // "weapon" | "tool" | "resource" | "currency" | "food" | "armor" | "misc" | "consumable" | "ammunition"
  description: string;           // Item description
  examine: string;               // Examine text (shown on right-click examine)
  tradeable: boolean;            // Can be traded between players
  rarity: ItemRarity;            // "common" | "uncommon" | "rare" | "very_rare" | "always"

  // OPTIONAL - Inventory properties (DataManager provides defaults)
  quantity?: number;             // Default: 1
  stackable?: boolean;           // Default: false - Can stack in inventory
  maxStackSize?: number;         // Default: 1 - Max stack size (only for stackable items)
  value?: number;                // Default: 0 - Base gold value
  weight?: number;               // Default: 0.1 - Weight in kg

  // OPTIONAL - Equipment properties (for equipable items)
  equipSlot?: EquipmentSlotName; // "weapon" | "shield" | "helmet" | "body" | "legs" | "boots" | "gloves" | "cape" | "amulet" | "ring" | "arrows"
  weaponType?: WeaponType;       // "sword" | "axe" | "mace" | "dagger" | "bow" | "staff" | "none" | etc.
  attackType?: AttackType;       // "melee" | "ranged" | "magic"
  attackSpeed?: number;          // Attack speed in game TICKS (4 = standard sword at 2.4s)
  attackRange?: number;          // Range in TILES (1 = melee adjacent, 2 = halberd, 7 = bow)
  equipable?: boolean;           // Derived from equipSlot if not specified

  // OPTIONAL - Visual assets
  modelPath: string | null;      // 3D model for DROPPED items (ground loot)
  equippedModelPath?: string;    // 3D model for EQUIPPED items (held weapons)
  iconPath: string;              // UI inventory icon

  // OPTIONAL - Combat bonuses (for equipment)
  bonuses?: {
    attack?: number;             // Attack bonus (accuracy)
    strength?: number;           // Strength bonus (max hit)
    defense?: number;            // Defense bonus
    ranged?: number;             // Ranged attack bonus
  };

  // OPTIONAL - Requirements to equip/use
  requirements?: {
    level: number;               // Overall level requirement
    skills: {                    // Skill-specific requirements
      attack?: number;
      strength?: number;
      defense?: number;
      woodcutting?: number;
      mining?: number;
      fishing?: number;
      // ... other skills
    };
  };

  // OPTIONAL - Consumable properties
  healAmount?: number;           // HP restored when consumed (food items)
}
```

### Item Types

| Type | Description | Example |
|------|-------------|---------|
| `weapon` | Combat weapons, equippable | Bronze Sword, Steel Sword |
| `tool` | Skilling tools, may be equippable | Bronze Hatchet, Fishing Rod |
| `resource` | Gathered materials | Logs, Ores |
| `currency` | Money | Coins |
| `food` | Consumables that restore HP | Cooked Fish |
| `armor` | Defensive equipment | Bronze Helmet |
| `consumable` | Single-use items | Potions |
| `ammunition` | Projectiles for ranged | Arrows |
| `misc` | Everything else | Quest items |

### Attack Speed & Range

Attack speed uses OSRS-style **game ticks** (1 tick = 600ms):

| Weapon Type | Typical Speed | Real Time |
|-------------|---------------|-----------|
| Dagger | 4 ticks | 2.4s |
| Sword | 4 ticks | 2.4s |
| Scimitar | 4 ticks | 2.4s |
| Battleaxe | 6 ticks | 3.6s |
| 2H Sword | 7 ticks | 4.2s |
| Shortbow | 3 ticks | 1.8s |
| Longbow | 6 ticks | 3.6s |

Attack range uses **tiles** (1 tile = 2 world units):

| Range | Weapon Type |
|-------|-------------|
| 1 | Melee (adjacent tiles only) |
| 2 | Halberd (1 tile gap) |
| 7 | Standard ranged weapons |

### Example

```json
{
  "id": "bronze_sword",
  "name": "Bronze Sword",
  "type": "weapon",
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
  "bonuses": {
    "attack": 4,
    "strength": 3,
    "defense": 0,
    "ranged": 0
  },
  "requirements": {
    "level": 1,
    "skills": { "attack": 1 }
  }
}
```

---

## npcs.json

Defines all NPCs using a **unified structure**. NPCs are categorized by their role, and DataManager fills in defaults for optional fields via `normalizeNPC()`.

### Schema

```typescript
// Input type (what you write in JSON) - most fields optional
interface NPCDataInput {
  // REQUIRED - Core identity
  id: string;                    // Unique NPC ID (e.g., "goblin", "bank_clerk")
  name: string;                  // Display name
  description: string;           // NPC description
  category: NPCCategory;         // "mob" | "boss" | "neutral" | "quest"

  // OPTIONAL - All below have defaults from normalizeNPC()
  faction?: string;              // Default: "unknown"
  stats?: Partial<NPCStats>;
  combat?: Partial<NPCCombatConfig>;
  movement?: Partial<NPCMovementConfig>;
  drops?: Partial<NPCDrops>;
  services?: Partial<NPCServicesConfig>;
  behavior?: Partial<NPCBehaviorConfig>;
  appearance?: Partial<NPCAppearanceConfig>;
  position?: { x: number; y: number; z: number };
  spawnBiomes?: string[];
  dialogue?: NPCDialogueTree;
}
```

### NPC Categories

| Category | Purpose | Combat | Services |
|----------|---------|--------|----------|
| `mob` | Combat enemies | Attackable, may be aggressive | None |
| `boss` | Powerful encounters | Attackable, special mechanics | None |
| `neutral` | Service NPCs | Not attackable | Bank, shop, etc. |
| `quest` | Quest givers/objectives | Varies | Quest dialogues |

### Stats (Default Values)

```typescript
interface NPCStats {
  level: number;      // Default: 1
  health: number;     // Default: 10 (this IS the max HP, OSRS-style)
  attack: number;     // Default: 1
  strength: number;   // Default: 1
  defense: number;    // Default: 1
  ranged: number;     // Default: 1
  magic: number;      // Default: 1
}
```

### Combat Configuration

```typescript
interface NPCCombatConfig {
  attackable: boolean;      // Default: true - Can players attack?
  aggressive: boolean;      // Default: false - Attacks on sight?
  retaliates: boolean;      // Default: true - Fights back when attacked?
  aggroRange: number;       // Default: 0 - Detection range for aggressive mobs (tiles)
  combatRange: number;      // Default: 1.5 - Attack range (tiles)
  attackSpeed: number;      // Default: 2400 - Milliseconds between attacks
  respawnTime: number;      // Default: 60000 - Milliseconds to respawn
  xpReward: number;         // Default: 0 - XP on kill
  poisonous: boolean;       // Default: false
  immuneToPoison: boolean;  // Default: false
}
```

### Movement Configuration

```typescript
interface NPCMovementConfig {
  type: "stationary" | "wander" | "patrol";  // Default: "stationary"
  speed: number;                              // Default: 1
  wanderRadius: number;                       // Default: 0 - For wander behavior
  patrolPath?: Position3D[];                  // Waypoints for patrol
  roaming: boolean;                           // Default: false - Can leave spawn?
}
```

### Drop Tables (OSRS-Style)

```typescript
interface NPCDrops {
  defaultDrop: {
    enabled: boolean;     // Default: false
    itemId: string;       // e.g., "bones"
    quantity: number;
  };
  always: DropTableEntry[];      // 100% drops
  common: DropTableEntry[];      // ~1/4 to 1/10
  uncommon: DropTableEntry[];    // ~1/10 to 1/50
  rare: DropTableEntry[];        // ~1/50 to 1/500
  veryRare: DropTableEntry[];    // ~1/500+
  rareDropTable: boolean;        // Default: false - Access to global RDT
}

interface DropTableEntry {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  chance: number;        // 0-1 probability (1.0 = 100%, 0.01 = 1%)
  rarity: DropRarity;    // For UI display
  noted?: boolean;       // Drop in noted form
}
```

### Services Configuration

```typescript
interface NPCServicesConfig {
  enabled: boolean;      // Default: false
  types: ServiceType[];  // "bank" | "shop" | "quest" | "skill_trainer" | "teleport"
  shopInventory?: ShopItem[];
  questIds?: string[];
}
```

### Dialogue System

NPCs can have dialogue trees that drive conversations and trigger effects:

```typescript
interface NPCDialogueTree {
  entryNodeId: string;          // Starting node ID
  nodes: NPCDialogueNode[];
}

interface NPCDialogueNode {
  id: string;                   // Unique node ID
  text: string;                 // NPC's dialogue text
  responses?: NPCDialogueResponse[];  // Player choices (empty = conversation ends)
}

interface NPCDialogueResponse {
  text: string;                 // Display text for player choice
  nextNodeId: string;           // Next node to show
  condition?: string;           // Optional condition (e.g., "hasItem:coins:100")
  effect?: string;              // Optional effect when selected
}
```

### Dialogue Effects

Effects are string-based commands processed by `DialogueSystem.executeEffect()`:

| Effect | Description |
|--------|-------------|
| `openBank` | Opens bank interface for player |
| `openShop` / `openStore` | Opens store interface |
| `startQuest:questId` | Starts a quest (future) |

### Example: Combat Mob

```json
{
  "id": "goblin",
  "name": "Goblin",
  "description": "A weak goblin creature",
  "category": "mob",
  "faction": "monster",
  "stats": {
    "level": 2,
    "health": 5,
    "attack": 1,
    "strength": 1,
    "defense": 1
  },
  "combat": {
    "attackable": true,
    "aggressive": false,
    "retaliates": true,
    "aggroRange": 8,
    "combatRange": 5,
    "attackSpeed": 2400,
    "respawnTime": 15000
  },
  "movement": {
    "type": "wander",
    "speed": 3.33,
    "wanderRadius": 10
  },
  "drops": {
    "defaultDrop": { "enabled": true, "itemId": "bones", "quantity": 1 },
    "common": [
      { "itemId": "coins", "minQuantity": 5, "maxQuantity": 15, "chance": 1.0, "rarity": "common" }
    ],
    "rare": [
      { "itemId": "bronze_sword", "minQuantity": 1, "maxQuantity": 1, "chance": 0.1, "rarity": "rare" }
    ]
  },
  "appearance": {
    "modelPath": "asset://models/goblin/goblin.vrm",
    "scale": 0.75
  },
  "spawnBiomes": ["forest", "plains"]
}
```

### Example: Neutral NPC with Dialogue

```json
{
  "id": "bank_clerk",
  "name": "Bank Clerk",
  "description": "A helpful bank clerk",
  "category": "neutral",
  "faction": "town",
  "combat": { "attackable": false },
  "movement": { "type": "stationary" },
  "services": {
    "enabled": true,
    "types": ["bank"]
  },
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
  "appearance": {
    "modelPath": "asset://models/human/human_rigged.glb",
    "scale": 1.0
  }
}
```

---

## stores.json

Defines shop inventories for shopkeeper NPCs.

### Schema

```typescript
interface StoreData {
  id: string;                    // Unique store ID (referenced by NPC storeId)
  name: string;                  // Store display name
  description: string;           // Store description
  location: {
    zone: string;                // Zone ID
    position: { x: number; y: number; z: number };
  };
  buyback: boolean;              // Does store buy items from players?
  buybackRate: number;           // 0-1, percentage of item value (0.5 = 50%)
  items: StoreItem[];
}

interface StoreItem {
  id: string;                    // Unique slot ID
  itemId: string;                // References items.json ID
  name: string;                  // Display name
  price: number;                 // Buy price in coins
  description: string;
  category: StoreItemCategory;   // "weapons" | "tools" | "armor" | "consumables" | "ammunition" | "resources"
  stockQuantity: number;         // -1 for unlimited stock
  restockTime: number;           // Milliseconds, 0 for no restock
}
```

### Example

```json
{
  "id": "central_store",
  "name": "Central General Store",
  "location": {
    "zone": "town_central",
    "position": { "x": -5, "y": 0, "z": 8 }
  },
  "buyback": true,
  "buybackRate": 0.5,
  "description": "General supplies for adventurers.",
  "items": [
    {
      "id": "bronze_sword",
      "itemId": "bronze_sword",
      "name": "Bronze Sword",
      "price": 100,
      "stockQuantity": -1,
      "restockTime": 0,
      "description": "A basic bronze sword",
      "category": "weapons"
    }
  ]
}
```

---

## resources.json

Defines harvestable resources like trees, fishing spots, and ore veins.

### Schema

```typescript
interface ExternalResourceData {
  id: string;                    // Unique resource variant ID (e.g., "tree_normal", "tree_oak")
  name: string;                  // Display name
  type: string;                  // "tree" | "fishing_spot" | "ore_vein"

  // Visual
  modelPath: string | null;      // 3D model when available
  stumpModelPath: string | null; // Model shown when depleted (trees)
  scale: number;                 // Model scale
  stumpScale: number;            // Depleted model scale

  // Harvesting
  harvestSkill: string;          // "woodcutting" | "fishing" | "mining"
  toolRequired: string | null;   // Item ID of required tool (e.g., "bronze_hatchet")
  levelRequired: number;         // Minimum skill level

  // Timing (OSRS-style ticks, 1 tick = 600ms)
  baseCycleTicks: number;        // Ticks between harvest attempts
  depleteChance: number;         // 0-1 chance to deplete per successful harvest
  respawnTicks: number;          // Ticks until resource respawns after depletion

  // Yields
  harvestYield: HarvestYield[];
}

interface HarvestYield {
  itemId: string;                // Item given on success
  itemName: string;              // Display name
  quantity: number;              // Amount per harvest
  chance: number;                // 0-1 success chance
  xpAmount: number;              // XP awarded
  stackable: boolean;
}
```

### Tick Timing

Resources use OSRS-style game ticks (1 tick = 600ms):

| Field | Description | Example |
|-------|-------------|---------|
| `baseCycleTicks` | Ticks between harvest attempts | 4 ticks = 2.4s |
| `respawnTicks` | Ticks until respawn | 80 ticks = 48s |

Higher skill levels reduce cycle time (up to ~30% faster).

### Example

```json
{
  "id": "tree_normal",
  "name": "Tree",
  "type": "tree",
  "modelPath": "asset://models/basic-reg-tree/basic-tree.glb",
  "stumpModelPath": "asset://models/basic-reg-tree-stump/basic-tree-stump.glb",
  "scale": 3.0,
  "stumpScale": 0.3,
  "harvestSkill": "woodcutting",
  "toolRequired": "bronze_hatchet",
  "levelRequired": 1,
  "baseCycleTicks": 4,
  "depleteChance": 0.125,
  "respawnTicks": 80,
  "harvestYield": [
    {
      "itemId": "logs",
      "itemName": "Logs",
      "quantity": 1,
      "chance": 1.0,
      "xpAmount": 25,
      "stackable": true
    }
  ]
}
```

---

## world-areas.json

Defines world zones with NPC placements, resource spawns, and mob spawn points.

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
  difficultyLevel: 0 | 1 | 2 | 3;  // 0 = safe, 1-3 = danger levels
  bounds: {
    minX: number; maxX: number;
    minZ: number; maxZ: number;
  };
  biomeType: string;               // References biomes.json
  safeZone: boolean;               // No PvP/mob aggro

  // NPC placements
  npcs: NPCLocation[];

  // Resource spawn points
  resources: ResourceSpawn[];

  // Mob spawn points
  mobSpawns: MobSpawnPoint[];
}

interface NPCLocation {
  id: string;                      // References npcs.json ID
  type: "bank" | "general_store" | "skill_trainer" | "quest_giver";
  position: { x: number; y: number; z: number };
  storeId?: string;                // For shopkeepers, references stores.json
}

interface ResourceSpawn {
  type: "tree" | "fishing_spot" | "mine";
  position: { x: number; y: number; z: number };
  resourceId: string;              // References resources.json ID
}

interface MobSpawnPoint {
  mobId: string;                   // References npcs.json ID
  position: { x: number; y: number; z: number };
  spawnRadius: number;             // Random spawn within radius
  maxCount: number;                // Max simultaneous spawns
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
      "bounds": { "minX": -20, "maxX": 20, "minZ": -20, "maxZ": 20 },
      "biomeType": "starter_town",
      "safeZone": true,
      "npcs": [
        { "id": "bank_clerk", "type": "bank", "position": { "x": 5, "y": 0, "z": -5 } },
        { "id": "shopkeeper", "type": "general_store", "storeId": "central_store", "position": { "x": -5, "y": 0, "z": -5 } }
      ],
      "resources": [
        { "type": "tree", "position": { "x": 15, "y": 0, "z": -10 }, "resourceId": "tree_normal" }
      ],
      "mobSpawns": [
        { "mobId": "goblin", "position": { "x": 5, "y": 0, "z": 5 }, "spawnRadius": 0, "maxCount": 3 }
      ]
    }
  }
}
```

---

## biomes.json

Defines biome types with terrain generation, visual settings, and spawn rules.

### Schema

```typescript
interface BiomeData {
  id: string;
  name: string;
  description: string;
  difficultyLevel: 0 | 1 | 2 | 3;
  terrain: "forest" | "plains" | "mountains" | "desert" | "swamp" | "frozen" | "lake";

  // Spawns
  resources: string[];           // Resource types that spawn
  mobs: string[];                // Mob IDs that spawn
  mobTypes: string[];            // Alias for mobs
  resourceTypes: string[];       // Alias for resources

  // Visual
  fogIntensity: number;          // 0-1 fog density
  ambientSound: string;          // Background audio ID
  colorScheme: {
    primary: string;             // Hex color
    secondary: string;
    fog: string;
  };
  color: number;                 // Terrain vertex color (decimal)

  // Terrain generation
  heightRange: [number, number]; // Min/max height multipliers
  terrainMultiplier: number;
  waterLevel: number;
  maxSlope: number;              // Max walkable slope
  baseHeight: number;
  heightVariation: number;
  resourceDensity: number;       // 0-1 spawn density
  difficulty: number;            // Alias for difficultyLevel
}
```

### Example

```json
{
  "id": "forest",
  "name": "Forest",
  "description": "Dense woodland with abundant trees",
  "difficultyLevel": 1,
  "terrain": "forest",
  "resources": ["trees", "fishing_spots"],
  "mobs": ["goblin", "bandit"],
  "fogIntensity": 0.4,
  "ambientSound": "forest_mysterious",
  "colorScheme": {
    "primary": "#2E7D32",
    "secondary": "#66BB6A",
    "fog": "#B0BEC5"
  },
  "color": 3046706,
  "heightRange": [0.2, 0.5],
  "terrainMultiplier": 1.0,
  "waterLevel": 0.0,
  "maxSlope": 0.8,
  "mobTypes": ["goblin", "bandit"],
  "difficulty": 1,
  "baseHeight": 0.0,
  "heightVariation": 0.2,
  "resourceDensity": 0.5,
  "resourceTypes": ["trees", "fishing_spots"]
}
```

---

## music.json

Defines music tracks for different game states.

### Schema

```typescript
interface MusicTrack {
  id: string;                    // Unique track ID
  name: string;                  // Track display name
  type: "theme" | "ambient" | "combat";
  category: "intro" | "normal" | "combat";
  path: string;                  // Audio file path
  description: string;
  duration: number;              // Seconds
  mood: string;                  // e.g., "epic", "peaceful", "intense"
}
```

### Categories

| Category | When Played |
|----------|-------------|
| `intro` | Character selection, main menu |
| `normal` | General gameplay, exploration |
| `combat` | During combat encounters |

### Example

```json
{
  "id": "combat_1",
  "name": "Battle Cry",
  "type": "combat",
  "category": "combat",
  "path": "asset://audio/music/combat/1.mp3",
  "description": "Intense combat music",
  "duration": 120,
  "mood": "intense"
}
```

---

## Asset Paths

All asset paths use the `asset://` protocol, which resolves to the CDN URL:

```
asset://models/goblin/goblin.vrm
→ http://localhost:8080/models/goblin/goblin.vrm (dev)
→ https://cdn.example.com/models/goblin/goblin.vrm (prod)
```

### Path Conventions

| Asset Type | Path Pattern | Example |
|------------|--------------|---------|
| 3D Models | `asset://models/{name}/{name}.glb` | `asset://models/sword-bronze/sword-bronze.glb` |
| VRM Models | `asset://models/{name}/{name}.vrm` | `asset://models/goblin/goblin.vrm` |
| Icons | `asset://models/{name}/concept-art.png` | `asset://models/sword-bronze/concept-art.png` |
| Audio | `asset://audio/music/{category}/{id}.mp3` | `asset://audio/music/combat/1.mp3` |

---

## Data Loading Flow

1. **Server Startup**: `DataManager.initialize()` called
2. **CDN Fetch**: Manifests loaded from `PUBLIC_CDN_URL/manifests/*.json`
3. **Normalization**:
   - `normalizeItem()` applies defaults to items
   - `normalizeNPC()` applies defaults to NPCs
4. **Validation**: Cross-references checked (mob spawns → valid NPC IDs, etc.)
5. **Storage**: Data stored in module-level Maps/Objects:
   - `ITEMS`: Map<string, Item>
   - `ALL_NPCS`: Map<string, NPCData>
   - `ALL_WORLD_AREAS`: Record<string, WorldArea>
   - `BIOMES`: Record<string, BiomeData>
   - `GENERAL_STORES`: Record<string, StoreData>
   - `EXTERNAL_RESOURCES`: Map<string, ExternalResourceData>

---

## Adding New Content

### Adding an Item

1. Add entry to `items.json` with unique `id`
2. Create 3D model and icon assets
3. Update `equippedModelPath` for weapons
4. Rebuild/restart server

### Adding an NPC

1. Add entry to `npcs.json` with unique `id` and `category`
2. For mobs: define `stats`, `combat`, `drops`
3. For neutral: define `services`, `dialogue`
4. Create VRM/GLB model
5. Add spawn point in `world-areas.json`

### Adding a Resource

1. Add entry to `resources.json`
2. Create model and stump model (for trees)
3. Add spawn points in `world-areas.json`

### Adding a Store

1. Add store entry to `stores.json`
2. Create shopkeeper NPC in `npcs.json` with `services.types: ["shop"]`
3. Link via `storeId` in `world-areas.json` NPC placement

---

## Validation

DataManager validates:
- All referenced item IDs exist
- All mob spawn points reference valid NPC IDs
- Required fields are present

Warnings are logged for:
- Missing assets (models, icons)
- Empty manifests (expected in CI/test environments)

Errors thrown for:
- No world areas defined
- Critical cross-reference failures
