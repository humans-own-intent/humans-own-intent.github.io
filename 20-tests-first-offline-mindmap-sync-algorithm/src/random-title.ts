export const ADJECTIVES = [
  'Abundant', 'Amber', 'Ancient', 'Aromatic', 'Autumn',
  'Azure', 'Blooming', 'Botanical', 'Bountiful', 'Breezy',
  'Bright', 'Budding', 'Calm', 'Cheerful', 'Coastal',
  'Cozy', 'Crisp', 'Crimson', 'Dappled', 'Deep',
  'Delicate', 'Dense', 'Dewy', 'Early', 'Earthy',
  'Emerald', 'Evergreen', 'Fertile', 'Floral', 'Forest',
  'Fragrant', 'Fresh', 'Frosty', 'Gentle', 'Glowing',
  'Golden', 'Grassy', 'Green', 'Hardy', 'Harmonious',
  'Healthy', 'Herbal', 'Highland', 'Humble', 'Joyful',
  'Keen', 'Lively', 'Lunar', 'Lush', 'Meadow',
  'Mellow', 'Mellowed', 'Morning', 'Mossy', 'Mystic',
  'Native', 'Natural', 'Noble', 'Nurturing', 'Orchard',
  'Organic', 'Pastoral', 'Peaceful', 'Perennial', 'Plentiful',
  'Pure', 'Quiet', 'Radiant', 'Rich', 'Ripe',
  'Rustic', 'Serene', 'Shady', 'Silent', 'Simple',
  'Slender', 'Smooth', 'Soft', 'Solar', 'Spring',
  'Sprouting', 'Sturdy', 'Subtle', 'Summer', 'Sunny',
  'Sweet', 'Tender', 'Thriving', 'Tranquil', 'Verdant',
  'Vibrant', 'Vital', 'Warm', 'Wild', 'Winding',
  'Winter', 'Woodland', 'Yielding', 'Zealous', 'Zesty',
] as const;

export const NOUNS = [
  'Acorn', 'Arbor', 'Bark', 'Basil', 'Bean',
  'Berry', 'Birch', 'Blossom', 'Bough', 'Branch',
  'Breeze', 'Briar', 'Brook', 'Bud', 'Canopy',
  'Cedar', 'Clover', 'Compost', 'Creek', 'Daisy',
  'Dawn', 'Dew', 'Dewdrop', 'Fern', 'Flora',
  'Flower', 'Forest', 'Garden', 'Glade', 'Grass',
  'Grove', 'Harvest', 'Hedge', 'Herb', 'Hill',
  'Hive', 'Ivy', 'Jasmine', 'Juniper', 'Laurel',
  'Leaf', 'Lily', 'Meadow', 'Mint', 'Moss',
  'Mulch', 'Nectar', 'Oak', 'Orchard', 'Orchid',
  'Path', 'Petal', 'Pine', 'Pinecone', 'Plant',
  'Plot', 'Pollen', 'Pond', 'Prairie', 'Rain',
  'Reed', 'River', 'Root', 'Rose', 'Rosehip',
  'Sage', 'Sapling', 'Seed', 'Seedling', 'Shrub',
  'Soil', 'Sprout', 'Stem', 'Stone', 'Stream',
  'Sun', 'Sunlight', 'Thicket', 'Thyme', 'Timber',
  'Trellis', 'Tree', 'Tulip', 'Twig', 'Valley',
  'Vine', 'Violet', 'Walnut', 'Water', 'Willow',
  'Wind', 'Wood', 'Woodland', 'Wren', 'Yarrow',
  'Amber', 'Brooklet', 'Fernery', 'Meadowland', 'Seedpod',
] as const;

/**
 * Returns a random title formatted as "[Adjective] [Noun]".
 */
export function generateRandomNodeTitle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}
