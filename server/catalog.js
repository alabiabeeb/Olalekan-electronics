// Fixed product categories. Order here is the order shown in the shop.
const CATEGORIES = [
  { slug: 'televisions', name: 'Televisions', icon: 'fa-tv', blurb: 'Smart, LED, 4K & OLED' },
  { slug: 'refrigerators', name: 'Fridges & freezers', icon: 'fa-snowflake', blurb: 'Side-by-side, double door & chest' },
  { slug: 'kitchen', name: 'Kitchen & laundry', icon: 'fa-kitchen-set', blurb: 'Cookers, washers, air fryers & more' },
  { slug: 'sound-systems', name: 'Sound systems', icon: 'fa-volume-high', blurb: 'Speakers, soundbars & home theatre' },
  { slug: 'fans', name: 'Fans', icon: 'fa-fan', blurb: 'Standing, ceiling & rechargeable' },
  { slug: 'power', name: 'Power & generators', icon: 'fa-bolt', blurb: 'Generators, stabilizers & solar' },
];

const ORDER_STATUSES = ['pending', 'confirmed', 'delivered', 'cancelled'];

const isCategory = (slug) => CATEGORIES.some((c) => c.slug === slug);

module.exports = { CATEGORIES, ORDER_STATUSES, isCategory };
