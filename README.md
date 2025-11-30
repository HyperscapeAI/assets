# HyperScape Assets

Static game assets for the HyperScape 3D RPG. This repo is cloned into the main project and served via CDN.

## Structure

```
audio/
├── music/          # Background tracks (combat, normal, intro)
├── soundeffects/   # SFX (sword clashes, doors, etc.)
└── voice/          # NPC dialogue audio

avatars/            # Player avatar VRM models

emotes/             # Character animation GLBs (walk, run, dance, combat, etc.)

models/             # Game object models
├── weapons/        # Swords, bows, maces, shields (base → dragon tier)
├── tools/          # Pickaxes, hatchets, fishing rods
├── armor/          # Chainbody, helmets
├── npcs/           # Goblin, troll, imp, thug, human
└── resources/      # Trees, logs

grass/              # Grass/foliage models for terrain
rocks/              # Rock formations (pathway, round, tall)
vegetation/         # Bushes, flowers, ferns, ivy, trees
terrain/textures/   # PBR terrain textures (dirt, grass, rock, snow)
textures/           # Noise maps, terrain textures
water/              # Water particles and shader textures

world/              # Environment assets (skybox, base terrain)
web/                # Runtime libs (PhysX WASM, fonts)
manifests/          # Game config JSONs (NPCs, items, zones, biomes)
```

## File Formats

| Type | Format | Notes |
|------|--------|-------|
| 3D Models | `.glb` | GLTF binary |
| Avatars | `.vrm` | VRM format |
| Audio | `.mp3` | |
| Textures | `.png`, `.jpg` | |
| Config | `.json` | |

## Git LFS

Large binary files (`.glb`, `.png`, `.mp3`, `.vrm`) are tracked with Git LFS. Ensure LFS is installed before cloning:

```bash
git lfs install
git clone <repo-url>
```
