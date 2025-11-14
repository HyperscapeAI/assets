#!/usr/bin/env node
/**
 * Transform characters.json to npcs.json with standardized NPCData structure
 *
 * This script converts the old character data format to the new unified NPC system:
 * - All NPCs have the same structure with flags to enable/disable features
 * - RuneScape-style drop system with default drops (bones/ashes)
 * - Tiered loot tables (always, common, uncommon, rare, very_rare)
 * - Category-based system (mob, boss, neutral)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, 'characters.json');
const outputFile = path.join(__dirname, 'npcs.json');

// Read characters.json
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

/**
 * Determine NPC category based on properties
 */
function determineCategory(char) {
  if (char.services && char.services.length > 0 && char.canBeAttacked === false) {
    return 'neutral';
  } else if (char.canBeAttacked === true) {
    // Boss indicators: high level, high health
    const isBoss = char.level >= 20 || char.maxHealth >= 60;
    return isBoss ? 'boss' : 'mob';
  } else {
    return 'neutral';
  }
}

/**
 * Get default drop item based on NPC type and category
 */
function getDefaultDrop(char, category) {
  // Neutral NPCs don't drop default items
  if (category === 'neutral') {
    return {
      itemId: 'bones',
      quantity: 0,
      enabled: false
    };
  }

  // Bosses drop big_bones
  if (category === 'boss') {
    return {
      itemId: 'big_bones',
      quantity: 1,
      enabled: true
    };
  }

  // Regular mobs drop bones
  return {
    itemId: 'bones',
    quantity: 1,
    enabled: true
  };
}

/**
 * Convert old lootTable format to new DropTableEntry format with rarity tiers
 */
function convertLootTable(lootTable) {
  if (!lootTable || lootTable.length === 0) {
    return {
      always: [],
      common: [],
      uncommon: [],
      rare: [],
      veryRare: []
    };
  }

  const drops = {
    always: [],
    common: [],
    uncommon: [],
    rare: [],
    veryRare: []
  };

  // Convert each loot item to new format with rarity classification
  for (const item of lootTable) {
    const entry = {
      itemId: item.itemId,
      minQuantity: item.minQuantity || item.quantity || 1,
      maxQuantity: item.maxQuantity || item.quantity || 1,
      chance: item.chance,
      rarity: 'common', // Default, will be determined below
      noted: false
    };

    // Classify rarity based on drop chance
    if (item.chance >= 1.0) {
      entry.rarity = 'always';
      drops.always.push(entry);
    } else if (item.chance >= 0.25) {
      entry.rarity = 'common';
      drops.common.push(entry);
    } else if (item.chance >= 0.1) {
      entry.rarity = 'uncommon';
      drops.uncommon.push(entry);
    } else if (item.chance >= 0.02) {
      entry.rarity = 'rare';
      drops.rare.push(entry);
    } else {
      entry.rarity = 'very_rare';
      drops.veryRare.push(entry);
    }
  }

  return drops;
}

// Transform each character to standardized NPCData
const npcs = data.characters.map(char => {
  const category = determineCategory(char);
  const defaultDrop = getDefaultDrop(char, category);
  const lootDrops = convertLootTable(char.lootTable);

  return {
    // ========== CORE IDENTITY ==========
    id: char.characterId,
    name: char.name,
    description: char.description,
    category,
    faction: char.faction || 'neutral',

    // ========== STATS (ALL NPCs) ==========
    stats: {
      level: char.level || 1,
      health: char.maxHealth || 100,
      attack: char.attackPower || 1,
      strength: char.attackPower || 1, // Use attackPower for strength too
      defense: char.defense || 1,
      constitution: char.maxHealth || 100,
      ranged: 1, // Default ranged level
      magic: 1   // Default magic level
    },

    // ========== COMBAT (ALL NPCs - use flags to disable) ==========
    combat: {
      attackable: char.canBeAttacked !== false, // Default true
      aggressive: category === 'mob' || category === 'boss',
      retaliates: char.retaliates !== false,
      aggroRange: char.aggroRange || 0,
      combatRange: char.combatRange || 1.5,
      attackSpeed: char.attackSpeed || 2.0,
      respawnTime: char.respawnTime || 30000,
      xpReward: char.xpReward || 0,
      poisonous: false,
      immuneToPoison: false
    },

    // ========== MOVEMENT (ALL NPCs - use flags to disable) ==========
    movement: {
      type: char.movementType || 'stationary',
      speed: char.moveSpeed || 0,
      wanderRadius: char.wanderRadius || 0,
      patrolPath: [],
      roaming: char.movementType === 'wander' || char.movementType === 'patrol'
    },

    // ========== DROPS (ALL NPCs - everyone drops something) ==========
    drops: {
      defaultDrop,
      always: lootDrops.always,
      common: lootDrops.common,
      uncommon: lootDrops.uncommon,
      rare: lootDrops.rare,
      veryRare: lootDrops.veryRare,
      rareDropTable: category === 'boss', // Bosses access rare drop table
      rareDropTableChance: category === 'boss' ? 0.1 : 0
    },

    // ========== SERVICES (Optional - mainly for neutral NPCs) ==========
    services: {
      enabled: char.services && char.services.length > 0,
      types: char.services || [],
      shopInventory: char.shopInventory || [],
      dialogue: char.dialogueTree || null,
      questIds: []
    },

    // ========== BEHAVIOR AI (Optional - for complex behaviors) ==========
    behavior: {
      enabled: !!char.behaviorConfig,
      config: char.behaviorConfig || null
    },

    // ========== APPEARANCE ==========
    appearance: {
      modelPath: char.modelPath,
      iconPath: char.iconPath || null,
      scale: 1.0,
      tint: null
    },

    // ========== SPAWN INFO ==========
    position: char.position || { x: 0, y: 0, z: 0 },
    spawnBiomes: char.spawnBiomes || []
  };
});

// Write npcs.json with metadata
const output = {
  npcs,
  metadata: {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    totalCount: npcs.length,
    categories: {
      mob: npcs.filter(n => n.category === 'mob').length,
      boss: npcs.filter(n => n.category === 'boss').length,
      neutral: npcs.filter(n => n.category === 'neutral').length
    },
    structure: 'Standardized NPCData with unified structure for all NPCs'
  }
};

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

console.log('✅ Successfully created npcs.json with standardized NPCData structure');
console.log(`   Version: ${output.metadata.version}`);
console.log(`   Total NPCs: ${output.metadata.totalCount}`);
console.log(`   - Mobs: ${output.metadata.categories.mob}`);
console.log(`   - Bosses: ${output.metadata.categories.boss}`);
console.log(`   - Neutral: ${output.metadata.categories.neutral}`);
console.log('');
console.log('Key features:');
console.log('   ✓ Unified structure with flags for all NPCs');
console.log('   ✓ Default drops (bones/big_bones) for combat NPCs');
console.log('   ✓ RuneScape-style tiered loot tables');
console.log('   ✓ Category-based classification (mob/boss/neutral)');
