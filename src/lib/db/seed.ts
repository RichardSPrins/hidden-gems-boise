// src/db/seed.ts
// Run with: npm run db:seed

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import {
  category,
  subcategory,
  feature,
  amenity,
  business,
  location,
  operatingHours,
  contactInfo,
  review,
  faq,
  event,
  gemSpotlight,
} from "./schema";

const db = drizzle(process.env.DATABASE_URL!, { schema });

async function main() {
  console.log("🌱 Seeding Hidden Gems Boise...");

  // ─── CATEGORIES & SUBCATEGORIES ───────────────────────────

  const categoryData = [
    {
      name: "Food & Drink",
      slug: "food-and-drink",
      subcategories: [
        { name: "Coffee & Café", slug: "coffee-cafe" },
        { name: "Restaurant", slug: "restaurant" },
        { name: "Bar & Lounge", slug: "bar-lounge" },
        { name: "Brewery & Taproom", slug: "brewery-taproom" },
        { name: "Bakery & Desserts", slug: "bakery-desserts" },
        { name: "Food Truck", slug: "food-truck" },
        { name: "Juice Bar & Smoothies", slug: "juice-bar-smoothies" },
        {
          name: "Specialty Grocery & Market",
          slug: "specialty-grocery-market",
        },
      ],
    },
    {
      name: "Health & Wellness",
      slug: "health-and-wellness",
      subcategories: [
        { name: "Gym & Fitness", slug: "gym-fitness" },
        { name: "Yoga & Pilates", slug: "yoga-pilates" },
        { name: "Spa & Massage", slug: "spa-massage" },
        { name: "Salon & Beauty", slug: "salon-beauty" },
        { name: "Barbershop", slug: "barbershop" },
        { name: "Mental Health & Therapy", slug: "mental-health-therapy" },
        {
          name: "Chiropractic & Physical Therapy",
          slug: "chiropractic-physical-therapy",
        },
        { name: "Nutrition & Supplements", slug: "nutrition-supplements" },
      ],
    },
    {
      name: "Shopping",
      slug: "shopping",
      subcategories: [
        { name: "Boutique Clothing", slug: "boutique-clothing" },
        { name: "Vintage & Thrift", slug: "vintage-thrift" },
        { name: "Jewelry & Accessories", slug: "jewelry-accessories" },
        { name: "Books & Music", slug: "books-music" },
        { name: "Art & Gifts", slug: "art-gifts" },
        { name: "Pet Supplies & Services", slug: "pet-supplies-services" },
        { name: "Outdoor & Sporting Goods", slug: "outdoor-sporting-goods" },
        {
          name: "Specialty Food & Drink Retail",
          slug: "specialty-food-drink-retail",
        },
      ],
    },
    {
      name: "Home Services",
      slug: "home-services",
      subcategories: [
        { name: "HVAC", slug: "hvac" },
        { name: "Plumbing", slug: "plumbing" },
        { name: "Electrical", slug: "electrical" },
        { name: "Roofing", slug: "roofing" },
        { name: "Landscaping & Lawn Care", slug: "landscaping-lawn-care" },
        { name: "Cleaning Services", slug: "cleaning-services" },
        { name: "General Contractor", slug: "general-contractor" },
        { name: "Painting", slug: "painting" },
      ],
    },
    {
      name: "Arts & Entertainment",
      slug: "arts-and-entertainment",
      subcategories: [
        { name: "Art Gallery", slug: "art-gallery" },
        { name: "Music Venue", slug: "music-venue" },
        { name: "Theater & Performing Arts", slug: "theater-performing-arts" },
        { name: "Photography Studio", slug: "photography-studio" },
        { name: "Escape Room & Gaming", slug: "escape-room-gaming" },
        { name: "Bowling & Recreation", slug: "bowling-recreation" },
      ],
    },
    {
      name: "Professional Services",
      slug: "professional-services",
      subcategories: [
        { name: "Marketing & Design", slug: "marketing-design" },
        { name: "Legal", slug: "legal" },
        { name: "Accounting & Finance", slug: "accounting-finance" },
        { name: "Real Estate", slug: "real-estate" },
        { name: "Insurance", slug: "insurance" },
        { name: "IT & Tech Support", slug: "it-tech-support" },
      ],
    },
    {
      name: "Education",
      slug: "education",
      subcategories: [
        {
          name: "Tutoring & Learning Center",
          slug: "tutoring-learning-center",
        },
        {
          name: "Dance & Performing Arts School",
          slug: "dance-performing-arts-school",
        },
        { name: "Martial Arts", slug: "martial-arts" },
        { name: "Childcare & Daycare", slug: "childcare-daycare" },
        { name: "Music Lessons", slug: "music-lessons" },
      ],
    },
    {
      name: "Automotive",
      slug: "automotive",
      subcategories: [
        { name: "Auto Repair & Maintenance", slug: "auto-repair-maintenance" },
        { name: "Custom & Restoration", slug: "custom-restoration" },
        { name: "Detailing & Wash", slug: "detailing-wash" },
        { name: "Tires & Wheels", slug: "tires-wheels" },
        { name: "Vinyl Wrap & Graphics", slug: "vinyl-wrap-graphics" },
        { name: "Diagnostics & Electrical", slug: "diagnostics-electrical" },
      ],
    },
  ];

  const categoryMap: Record<string, string> = {};
  const subcategoryMap: Record<string, string> = {};

  for (const cat of categoryData) {
    const existing = await db
      .select()
      .from(category)
      .where(eq(category.slug, cat.slug))
      .limit(1);

    let catId: string;

    if (existing.length > 0) {
      catId = existing[0].id;
      await db
        .update(category)
        .set({ name: cat.name })
        .where(eq(category.slug, cat.slug));
    } else {
      const inserted = await db
        .insert(category)
        .values({ name: cat.name, slug: cat.slug })
        .returning();
      catId = inserted[0].id;
    }

    categoryMap[cat.slug] = catId;
    console.log(`  ✓ Category: ${cat.name}`);

    for (const sub of cat.subcategories) {
      const existingSub = await db
        .select()
        .from(subcategory)
        .where(
          and(eq(subcategory.categoryId, catId), eq(subcategory.slug, sub.slug))
        )
        .limit(1);

      if (existingSub.length > 0) {
        subcategoryMap[sub.slug] = existingSub[0].id;
        await db
          .update(subcategory)
          .set({ name: sub.name })
          .where(eq(subcategory.id, existingSub[0].id));
      } else {
        const insertedSub = await db
          .insert(subcategory)
          .values({ name: sub.name, slug: sub.slug, categoryId: catId })
          .returning();
        subcategoryMap[sub.slug] = insertedSub[0].id;
      }
    }
  }

  // ─── FEATURES ─────────────────────────────────────────────

  const features = [
    { label: "Women-Owned", slug: "women-owned" },
    { label: "Minority-Owned", slug: "minority-owned" },
    { label: "Veteran-Owned", slug: "veteran-owned" },
    { label: "LGBTQ+-Owned", slug: "lgbtq-owned" },
    { label: "Locally Owned & Independent", slug: "locally-owned" },
    { label: "Accepts Credit Cards", slug: "accepts-credit-cards" },
    { label: "Accepts Cash Only", slug: "accepts-cash-only" },
    { label: "Contactless Payment", slug: "contactless-payment" },
    { label: "Spanish Speaking Staff", slug: "spanish-speaking" },
    { label: "Multilingual Staff", slug: "multilingual" },
    { label: "Online Booking Available", slug: "online-booking" },
    { label: "Verified Gem", slug: "verified-gem" },
  ];

  for (const f of features) {
    const existing = await db
      .select()
      .from(feature)
      .where(eq(feature.slug, f.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(feature).values(f);
    }
  }

  console.log(`  ✓ ${features.length} features seeded`);

  // ─── AMENITIES ────────────────────────────────────────────

  const amenityData: {
    categorySlug: string;
    amenities: { label: string; slug: string }[];
  }[] = [
    {
      categorySlug: "food-and-drink",
      amenities: [
        { label: "Dine-in", slug: "dine-in" },
        { label: "Takeout", slug: "takeout" },
        { label: "Delivery", slug: "delivery" },
        { label: "Curbside Pickup", slug: "curbside-pickup" },
        { label: "Drive-Through", slug: "drive-through" },
        { label: "Outdoor Seating", slug: "outdoor-seating" },
        { label: "Private Dining", slug: "private-dining" },
        { label: "Reservations Accepted", slug: "reservations" },
        { label: "Walk-ins Welcome", slug: "walk-ins" },
        { label: "Full Bar", slug: "full-bar" },
        { label: "Happy Hour", slug: "happy-hour" },
        { label: "Live Music", slug: "live-music" },
        { label: "Trivia Nights", slug: "trivia-nights" },
        { label: "Pet Friendly", slug: "pet-friendly" },
        { label: "Family Friendly", slug: "family-friendly" },
        { label: "Kid's Menu", slug: "kids-menu" },
        { label: "WiFi", slug: "wifi" },
        { label: "Parking Available", slug: "parking" },
        { label: "ADA Accessible", slug: "ada-accessible" },
        { label: "Loyalty Program", slug: "loyalty-program" },
        { label: "Gift Cards Available", slug: "gift-cards" },
        { label: "Vegan Options", slug: "vegan-options" },
        { label: "Vegetarian Options", slug: "vegetarian-options" },
        { label: "Gluten-Free Options", slug: "gluten-free" },
        { label: "Halal", slug: "halal" },
        { label: "Locally Sourced Ingredients", slug: "locally-sourced" },
        { label: "Dog Friendly", slug: "dog-friendly" },
        { label: "Food Trucks on Site", slug: "food-trucks-on-site" },
        { label: "Cans & Bottles to Go", slug: "cans-to-go" },
        { label: "Tours Available", slug: "tours" },
        { label: "Private Events", slug: "private-events" },
      ],
    },
    {
      categorySlug: "health-and-wellness",
      amenities: [
        { label: "Walk-ins Welcome", slug: "walk-ins" },
        { label: "Appointments Required", slug: "appointments-required" },
        { label: "Same-Day Booking", slug: "same-day-booking" },
        { label: "Drop-In Rates", slug: "drop-in" },
        { label: "Membership Options", slug: "membership" },
        { label: "Group Classes", slug: "group-classes" },
        { label: "Personal Training", slug: "personal-training" },
        { label: "One-on-One Sessions", slug: "one-on-one" },
        { label: "Couples Services", slug: "couples-services" },
        { label: "Locker Rooms", slug: "locker-rooms" },
        { label: "Showers Available", slug: "showers" },
        { label: "Free Consultation", slug: "free-consultation" },
        { label: "Sliding Scale Pricing", slug: "sliding-scale" },
        { label: "Online Booking", slug: "online-booking" },
        { label: "Gift Cards", slug: "gift-cards" },
        { label: "Parking Available", slug: "parking" },
        { label: "ADA Accessible", slug: "ada-accessible" },
        { label: "LGBTQ+ Friendly", slug: "lgbtq-friendly" },
        { label: "Women-Only Options", slug: "women-only" },
      ],
    },
    {
      categorySlug: "shopping",
      amenities: [
        { label: "In-Store Shopping", slug: "in-store" },
        { label: "Online Store", slug: "online-store" },
        { label: "Curbside Pickup", slug: "curbside-pickup" },
        { label: "Gift Wrapping", slug: "gift-wrapping" },
        { label: "Custom Orders", slug: "custom-orders" },
        { label: "Layaway", slug: "layaway" },
        { label: "Alterations Available", slug: "alterations" },
        { label: "Loyalty Program", slug: "loyalty-program" },
        { label: "Gift Cards", slug: "gift-cards" },
        { label: "Pet Friendly", slug: "pet-friendly" },
        { label: "Family Friendly", slug: "family-friendly" },
        { label: "Locally Made Products", slug: "locally-made" },
        { label: "Handmade Items", slug: "handmade" },
        { label: "Parking Available", slug: "parking" },
        { label: "ADA Accessible", slug: "ada-accessible" },
      ],
    },
    {
      categorySlug: "home-services",
      amenities: [
        { label: "Free Estimates", slug: "free-estimates" },
        { label: "Licensed & Insured", slug: "licensed-insured" },
        { label: "Background Checked", slug: "background-checked" },
        { label: "Emergency Services", slug: "emergency-services" },
        { label: "24/7 Availability", slug: "24-7" },
        { label: "Residential", slug: "residential" },
        { label: "Commercial", slug: "commercial" },
        { label: "Financing Available", slug: "financing" },
        { label: "Senior Discount", slug: "senior-discount" },
        { label: "Military Discount", slug: "military-discount" },
        { label: "Service Guarantee", slug: "service-guarantee" },
        { label: "Warranty Offered", slug: "warranty" },
        { label: "Online Booking", slug: "online-booking" },
      ],
    },
    {
      categorySlug: "arts-and-entertainment",
      amenities: [
        { label: "Walk-ins Welcome", slug: "walk-ins" },
        { label: "Reservations Required", slug: "reservations-required" },
        { label: "Ticketed Events", slug: "ticketed-events" },
        { label: "Private Events", slug: "private-events" },
        { label: "Group Bookings", slug: "group-bookings" },
        { label: "All Ages", slug: "all-ages" },
        { label: "21+ Only", slug: "21-plus" },
        { label: "Family Friendly", slug: "family-friendly" },
        { label: "Bar / Drinks Available", slug: "bar-available" },
        { label: "Snacks Available", slug: "snacks" },
        { label: "Full Menu", slug: "full-menu" },
        { label: "Gift Cards", slug: "gift-cards" },
        { label: "Memberships", slug: "memberships" },
        { label: "Parking Available", slug: "parking" },
        { label: "ADA Accessible", slug: "ada-accessible" },
      ],
    },
    {
      categorySlug: "professional-services",
      amenities: [
        { label: "Free Consultation", slug: "free-consultation" },
        { label: "Virtual Appointments", slug: "virtual-appointments" },
        { label: "In-Person Only", slug: "in-person-only" },
        { label: "After Hours Availability", slug: "after-hours" },
        { label: "Weekend Appointments", slug: "weekend-appointments" },
        { label: "Sliding Scale Pricing", slug: "sliding-scale" },
        { label: "Payment Plans", slug: "payment-plans" },
        { label: "Remote Services Available", slug: "remote-services" },
        { label: "NDA Available", slug: "nda" },
      ],
    },
    {
      categorySlug: "education",
      amenities: [
        { label: "Trial Class Available", slug: "trial-class" },
        { label: "Free Consultation", slug: "free-consultation" },
        { label: "Group Classes", slug: "group-classes" },
        { label: "Private Lessons", slug: "private-lessons" },
        { label: "Online Classes Available", slug: "online-classes" },
        { label: "After School Programs", slug: "after-school" },
        { label: "Weekend Classes", slug: "weekend-classes" },
        { label: "Summer Programs", slug: "summer-programs" },
        { label: "Sibling Discount", slug: "sibling-discount" },
        { label: "Military Discount", slug: "military-discount" },
        { label: "Parking Available", slug: "parking" },
        { label: "ADA Accessible", slug: "ada-accessible" },
      ],
    },
    {
      categorySlug: "automotive",
      amenities: [
        { label: "Walk-ins Welcome", slug: "walk-ins" },
        { label: "Appointments Preferred", slug: "appointments-preferred" },
        { label: "Free Estimates", slug: "free-estimates" },
        { label: "Licensed & Insured", slug: "licensed-insured" },
        { label: "Loaner Vehicle", slug: "loaner-vehicle" },
        { label: "Shuttle Service", slug: "shuttle-service" },
        { label: "Waiting Area", slug: "waiting-area" },
        { label: "WiFi in Waiting Area", slug: "wifi-waiting" },
        { label: "Financing Available", slug: "financing" },
        { label: "Military Discount", slug: "military-discount" },
        { label: "Senior Discount", slug: "senior-discount" },
        { label: "Domestic Vehicles", slug: "domestic" },
        { label: "Foreign Vehicles", slug: "foreign" },
        { label: "Certified Technicians", slug: "certified-technicians" },
      ],
    },
  ];

  for (const { categorySlug, amenities } of amenityData) {
    const catId = categoryMap[categorySlug];
    if (!catId) continue;

    for (const a of amenities) {
      const existing = await db
        .select()
        .from(amenity)
        .where(and(eq(amenity.categoryId, catId), eq(amenity.slug, a.slug)))
        .limit(1);

      if (existing.length === 0) {
        await db
          .insert(amenity)
          .values({ label: a.label, slug: a.slug, categoryId: catId });
      }
    }

    console.log(`  ✓ Amenities: ${categorySlug}`);
  }

  // ─── SAMPLE BUSINESSES ────────────────────────────────────

  const businesses = [
    {
      name: "Rook Coffee Roasters",
      slug: "rook-coffee-roasters",
      categorySlug: "food-and-drink",
      subcategorySlug: "coffee-cafe",
      bio: "A beloved Boise institution committed to single-origin specialty coffee and a warm, neighborhood feel. From pour-overs to seasonal lattes, every cup is crafted with intention.",
      websiteUrl: "https://rookcoffeeroasters.com",
      pricePoint: "TWO" as const,
      keywords: ["specialty coffee", "pour over", "local roaster", "latte"],
      status: "APPROVED" as const,
      isVerified: true,
      isGemOfWeek: false,
      averageRating: 4.8,
      reviewCount: 3,
      location: {
        address: "415 S 8th St",
        city: "Boise",
        neighborhood: "Downtown",
        zip: "83702",
        lat: 43.6142,
        lng: -116.2023,
      },
      contact: { phone: "(208) 555-0101", email: "hello@rookcoffee.com" },
      hours: [
        {
          dayOfWeek: 0,
          openTime: "08:00",
          closeTime: "16:00",
          isClosed: false,
        },
        {
          dayOfWeek: 1,
          openTime: "07:00",
          closeTime: "18:00",
          isClosed: false,
        },
        {
          dayOfWeek: 2,
          openTime: "07:00",
          closeTime: "18:00",
          isClosed: false,
        },
        {
          dayOfWeek: 3,
          openTime: "07:00",
          closeTime: "18:00",
          isClosed: false,
        },
        {
          dayOfWeek: 4,
          openTime: "07:00",
          closeTime: "18:00",
          isClosed: false,
        },
        {
          dayOfWeek: 5,
          openTime: "07:00",
          closeTime: "18:00",
          isClosed: false,
        },
        {
          dayOfWeek: 6,
          openTime: "08:00",
          closeTime: "17:00",
          isClosed: false,
        },
      ],
      reviews: [
        {
          authorName: "Sarah M.",
          authorEmail: "sarah@example.com",
          rating: 5,
          body: "Best coffee in Boise. Period. The baristas know their craft and the vibe is unmatched.",
          isApproved: true,
        },
        {
          authorName: "Jake T.",
          authorEmail: "jake@example.com",
          rating: 5,
          body: "Their seasonal lattes are incredible. Always my first stop on weekends.",
          isApproved: true,
        },
        {
          authorName: "Amy L.",
          authorEmail: "amy@example.com",
          rating: 4,
          body: "Great coffee and atmosphere. Can get busy but worth the wait.",
          isApproved: true,
        },
      ],
      faqs: [
        {
          question: "Do you roast your own beans?",
          answer:
            "Yes! All of our coffee is roasted in-house in small batches to ensure peak freshness.",
          sortOrder: 0,
        },
        {
          question: "Do you offer wholesale?",
          answer:
            "We do offer wholesale partnerships for local cafés and restaurants. Reach out via our website.",
          sortOrder: 1,
        },
      ],
    },
    {
      name: "The Wylder",
      slug: "the-wylder",
      categorySlug: "food-and-drink",
      subcategorySlug: "restaurant",
      bio: "Farm-to-table dining at its finest in the heart of Boise. The Wylder sources ingredients from local Idaho farms to create seasonal menus that change with the harvest.",
      websiteUrl: "https://thewylder.com",
      pricePoint: "THREE" as const,
      keywords: [
        "farm to table",
        "local ingredients",
        "seasonal menu",
        "dinner",
        "date night",
      ],
      status: "APPROVED" as const,
      isVerified: true,
      isGemOfWeek: false,
      averageRating: 4.7,
      reviewCount: 2,
      location: {
        address: "800 W Idaho St",
        city: "Boise",
        neighborhood: "Downtown",
        zip: "83702",
        lat: 43.6173,
        lng: -116.2045,
      },
      contact: { phone: "(208) 555-0202", email: "reservations@thewylder.com" },
      hours: [
        {
          dayOfWeek: 0,
          openTime: "10:00",
          closeTime: "15:00",
          isClosed: false,
        },
        { dayOfWeek: 1, openTime: null, closeTime: null, isClosed: true },
        {
          dayOfWeek: 2,
          openTime: "17:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 3,
          openTime: "17:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 4,
          openTime: "17:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 5,
          openTime: "17:00",
          closeTime: "23:00",
          isClosed: false,
        },
        {
          dayOfWeek: 6,
          openTime: "17:00",
          closeTime: "23:00",
          isClosed: false,
        },
      ],
      reviews: [
        {
          authorName: "Marcus R.",
          authorEmail: "marcus@example.com",
          rating: 5,
          body: "Absolutely stunning food. The mushroom risotto was the best thing I've eaten all year.",
          isApproved: true,
        },
        {
          authorName: "Priya K.",
          authorEmail: "priya@example.com",
          rating: 4,
          body: "Beautiful ambiance and thoughtful menu. Pricey but worth it for a special occasion.",
          isApproved: true,
        },
      ],
      faqs: [
        {
          question: "Do you take reservations?",
          answer:
            "Yes, reservations are strongly recommended especially on weekends. Book through our website.",
          sortOrder: 0,
        },
        {
          question: "Do you accommodate dietary restrictions?",
          answer:
            "Absolutely. Please note any dietary needs when booking and our kitchen will accommodate.",
          sortOrder: 1,
        },
      ],
    },
    {
      name: "Bittercreek Alehouse",
      slug: "bittercreek-alehouse",
      categorySlug: "food-and-drink",
      subcategorySlug: "bar-lounge",
      bio: "A Boise landmark since 1996. Bittercreek is the craft beer bar that helped define Boise's local drinking culture — featuring rotating local taps, a thoughtful wine list, and a kitchen that takes pub food seriously.",
      websiteUrl: "https://bittercreek.com",
      pricePoint: "TWO" as const,
      keywords: [
        "craft beer",
        "local tap",
        "pub food",
        "happy hour",
        "boise bar",
      ],
      status: "APPROVED" as const,
      isVerified: true,
      isGemOfWeek: false,
      averageRating: 4.6,
      reviewCount: 2,
      location: {
        address: "246 N 8th St",
        city: "Boise",
        neighborhood: "Downtown",
        zip: "83702",
        lat: 43.6189,
        lng: -116.2012,
      },
      contact: { phone: "(208) 555-0303", email: "info@bittercreek.com" },
      hours: [
        {
          dayOfWeek: 0,
          openTime: "11:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 1,
          openTime: "11:00",
          closeTime: "23:00",
          isClosed: false,
        },
        {
          dayOfWeek: 2,
          openTime: "11:00",
          closeTime: "23:00",
          isClosed: false,
        },
        {
          dayOfWeek: 3,
          openTime: "11:00",
          closeTime: "23:00",
          isClosed: false,
        },
        {
          dayOfWeek: 4,
          openTime: "11:00",
          closeTime: "00:00",
          isClosed: false,
        },
        {
          dayOfWeek: 5,
          openTime: "11:00",
          closeTime: "01:00",
          isClosed: false,
        },
        {
          dayOfWeek: 6,
          openTime: "11:00",
          closeTime: "01:00",
          isClosed: false,
        },
      ],
      reviews: [
        {
          authorName: "Dave H.",
          authorEmail: "dave@example.com",
          rating: 5,
          body: "A Boise staple. The tap list is always rotating with great local options.",
          isApproved: true,
        },
        {
          authorName: "Jen W.",
          authorEmail: "jen@example.com",
          rating: 4,
          body: "Love the vibe, great happy hour deals. Gets crowded on weekends but that's part of the charm.",
          isApproved: true,
        },
      ],
      faqs: [
        {
          question: "Do you have happy hour?",
          answer:
            "Yes! Happy hour runs Monday through Friday from 4pm to 6pm with specials on beer and select cocktails.",
          sortOrder: 0,
        },
      ],
    },
    {
      name: "Payette Brewing Company",
      slug: "payette-brewing-company",
      categorySlug: "food-and-drink",
      subcategorySlug: "brewery-taproom",
      bio: "Named after Idaho's wild Payette River, Payette Brewing has been crafting adventurous beers since 2010. The taproom features a full kitchen, a massive outdoor patio, and year-round events.",
      websiteUrl: "https://payettebrewing.com",
      pricePoint: "TWO" as const,
      keywords: [
        "craft brewery",
        "Idaho beer",
        "taproom",
        "outdoor patio",
        "local brewery",
      ],
      status: "APPROVED" as const,
      isVerified: true,
      isGemOfWeek: true,
      averageRating: 4.9,
      reviewCount: 2,
      location: {
        address: "733 S Pioneer St",
        city: "Boise",
        neighborhood: "Downtown",
        zip: "83702",
        lat: 43.6098,
        lng: -116.2034,
      },
      contact: { phone: "(208) 555-0404", email: "taproom@payettebrewing.com" },
      hours: [
        {
          dayOfWeek: 0,
          openTime: "10:00",
          closeTime: "21:00",
          isClosed: false,
        },
        {
          dayOfWeek: 1,
          openTime: "11:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 2,
          openTime: "11:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 3,
          openTime: "11:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 4,
          openTime: "11:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 5,
          openTime: "11:00",
          closeTime: "23:00",
          isClosed: false,
        },
        {
          dayOfWeek: 6,
          openTime: "10:00",
          closeTime: "23:00",
          isClosed: false,
        },
      ],
      reviews: [
        {
          authorName: "Tom B.",
          authorEmail: "tom@example.com",
          rating: 5,
          body: "The Pale Ale is a classic for a reason. Love the outdoor space in summer.",
          isApproved: true,
        },
        {
          authorName: "Rachel S.",
          authorEmail: "rachel@example.com",
          rating: 5,
          body: "Perfect afternoon spot. Great beer, great food, great atmosphere.",
          isApproved: true,
        },
      ],
      faqs: [
        {
          question: "Are dogs allowed?",
          answer: "Yes! Dogs are welcome in our outdoor patio area.",
          sortOrder: 0,
        },
        {
          question: "Do you offer brewery tours?",
          answer:
            "We offer tours on select weekends. Check our website or social media for the current schedule.",
          sortOrder: 1,
        },
      ],
    },
    {
      name: "Flying M Coffeehouse",
      slug: "flying-m-coffeehouse",
      categorySlug: "food-and-drink",
      subcategorySlug: "coffee-cafe",
      bio: "Boise's most eclectic coffeehouse. Flying M has been a creative community hub for over 30 years — hosting local art, live music, and some of the best espresso drinks in the Treasure Valley.",
      websiteUrl: "https://flyingmcoffee.com",
      pricePoint: "ONE" as const,
      keywords: [
        "coffeehouse",
        "local art",
        "live music",
        "community",
        "espresso",
      ],
      status: "APPROVED" as const,
      isVerified: true,
      isGemOfWeek: false,
      averageRating: 4.7,
      reviewCount: 2,
      location: {
        address: "500 W Idaho St",
        city: "Boise",
        neighborhood: "Downtown",
        zip: "83702",
        lat: 43.6168,
        lng: -116.2067,
      },
      contact: { phone: "(208) 555-0505", email: "hello@flyingmcoffee.com" },
      hours: [
        {
          dayOfWeek: 0,
          openTime: "08:00",
          closeTime: "20:00",
          isClosed: false,
        },
        {
          dayOfWeek: 1,
          openTime: "07:00",
          closeTime: "21:00",
          isClosed: false,
        },
        {
          dayOfWeek: 2,
          openTime: "07:00",
          closeTime: "21:00",
          isClosed: false,
        },
        {
          dayOfWeek: 3,
          openTime: "07:00",
          closeTime: "21:00",
          isClosed: false,
        },
        {
          dayOfWeek: 4,
          openTime: "07:00",
          closeTime: "21:00",
          isClosed: false,
        },
        {
          dayOfWeek: 5,
          openTime: "07:00",
          closeTime: "22:00",
          isClosed: false,
        },
        {
          dayOfWeek: 6,
          openTime: "08:00",
          closeTime: "22:00",
          isClosed: false,
        },
      ],
      reviews: [
        {
          authorName: "Chloe P.",
          authorEmail: "chloe@example.com",
          rating: 5,
          body: "A true Boise original. Love the rotating art shows and the mocha is incredible.",
          isApproved: true,
        },
        {
          authorName: "Ben A.",
          authorEmail: "ben@example.com",
          rating: 4,
          body: "Awesome vibe, great for working or catching up with friends. Always something interesting on the walls.",
          isApproved: true,
        },
      ],
      faqs: [
        {
          question: "Do you host live music?",
          answer:
            "Yes! We host local musicians regularly. Check our Instagram for the current schedule.",
          sortOrder: 0,
        },
      ],
    },
  ];

  for (const biz of businesses) {
    const catId = categoryMap[biz.categorySlug];
    if (!catId) {
      console.warn(`  ⚠ Category not found: ${biz.categorySlug}`);
      continue;
    }

    const subcategoryId = biz.subcategorySlug
      ? subcategoryMap[biz.subcategorySlug] ?? null
      : null;

    // Skip if already exists
    const existingBiz = await db
      .select()
      .from(business)
      .where(eq(business.slug, biz.slug))
      .limit(1);

    if (existingBiz.length > 0) {
      console.log(`  ↩ Skipping existing: ${biz.name}`);
      continue;
    }

    const insertedBiz = await db
      .insert(business)
      .values({
        name: biz.name,
        slug: biz.slug,
        categoryId: catId,
        subcategoryId,
        bio: biz.bio,
        websiteUrl: biz.websiteUrl,
        pricePoint: biz.pricePoint,
        keywords: biz.keywords,
        status: biz.status,
        isVerified: biz.isVerified,
        isGemOfWeek: biz.isGemOfWeek,
        averageRating: biz.averageRating,
        reviewCount: biz.reviewCount,
      })
      .returning();

    const bizId = insertedBiz[0].id;

    // Location
    const insertedLoc = await db
      .insert(location)
      .values({
        businessId: bizId,
        isPrimary: true,
        address: biz.location.address,
        city: biz.location.city,
        state: "ID",
        zip: biz.location.zip,
        neighborhood: biz.location.neighborhood,
        lat: biz.location.lat,
        lng: biz.location.lng,
      })
      .returning();

    const locId = insertedLoc[0].id;

    // Hours
    for (const h of biz.hours) {
      await db.insert(operatingHours).values({
        locationId: locId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.isClosed ? null : h.openTime,
        closeTime: h.isClosed ? null : h.closeTime,
        isClosed: h.isClosed,
      });
    }

    // Contact
    await db.insert(contactInfo).values({
      businessId: bizId,
      phone: biz.contact.phone,
      email: biz.contact.email,
    });

    // Reviews
    for (const r of biz.reviews) {
      await db.insert(review).values({
        businessId: bizId,
        authorName: r.authorName,
        authorEmail: r.authorEmail,
        rating: r.rating,
        body: r.body,
        isApproved: r.isApproved,
      });
    }

    // FAQs
    for (const f of biz.faqs) {
      await db.insert(faq).values({
        businessId: bizId,
        question: f.question,
        answer: f.answer,
        sortOrder: f.sortOrder,
      });
    }

    console.log(`  ✓ Business: ${biz.name}`);
  }

  // ─── EVENTS ───────────────────────────────────────────────

  const payetteBiz = await db
    .select()
    .from(business)
    .where(eq(business.slug, "payette-brewing-company"))
    .limit(1);

  const flyingMBiz = await db
    .select()
    .from(business)
    .where(eq(business.slug, "flying-m-coffeehouse"))
    .limit(1);

  if (payetteBiz.length > 0) {
    const payetteLocation = await db
      .select()
      .from(location)
      .where(eq(location.businessId, payetteBiz[0].id))
      .limit(1);

    await db
      .insert(event)
      .values({
        businessId: payetteBiz[0].id,
        locationId: payetteLocation[0]?.id,
        title: "Summer Patio Opening Party",
        description:
          "Celebrate the return of patio season with live music, food specials, and new seasonal taps. Free to attend — bring your crew.",
        category: "SEASONAL_AND_HOLIDAY",
        startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDateTime: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000
        ),
        isActive: true,
      })
      .catch(() => {});

    await db
      .insert(event)
      .values({
        businessId: payetteBiz[0].id,
        locationId: payetteLocation[0]?.id,
        title: "Trivia Night",
        description:
          "Weekly trivia at the taproom. Teams of up to 6. Winner gets a $50 taproom credit. No registration required.",
        category: "COMMUNITY_AND_NETWORKING",
        startDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endDateTime: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
        ),
        isRecurring: true,
        recurrenceFrequency: "WEEKLY",
        isActive: true,
      })
      .catch(() => {});
  }

  if (flyingMBiz.length > 0) {
    const flyingMLocation = await db
      .select()
      .from(location)
      .where(eq(location.businessId, flyingMBiz[0].id))
      .limit(1);

    await db
      .insert(event)
      .values({
        businessId: flyingMBiz[0].id,
        locationId: flyingMLocation[0]?.id,
        title: "Local Artist Showcase",
        description:
          "An evening celebrating Boise's local visual artists and musicians. New gallery installation opens with live acoustic performances throughout the night.",
        category: "LIVE_MUSIC_AND_ENTERTAINMENT",
        startDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endDateTime: new Date(
          Date.now() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000
        ),
        isActive: true,
      })
      .catch(() => {});
  }

  console.log("  ✓ Events seeded");

  // ─── GEM SPOTLIGHT ────────────────────────────────────────

  if (payetteBiz.length > 0) {
    await db
      .insert(gemSpotlight)
      .values({
        businessId: payetteBiz[0].id,
        headline: "Payette Brewing: The Taproom That Built Boise's Beer Scene",
        weekLabel: "Week of April 20, 2026",
        writeup:
          "When Payette Brewing opened its doors in 2010, Boise's craft beer scene was just finding its footing. Fourteen years later, Payette isn't just part of the scene — it helped define it. Named after the wild Payette River that cuts through the Idaho mountains, the brewery has always been about adventure. Their flagship Pale Ale became a staple at backyard barbecues and river trips across the Treasure Valley. But the real gem is the taproom experience — a cavernous space with a massive patio, rotating seasonal taps, a kitchen that takes pub food seriously, and a team that genuinely loves what they make. If you haven't made Payette part of your regular rotation, this week is your excuse.",
        publishedAt: new Date(),
      })
      .catch(() => {});

    console.log("  ✓ Gem spotlight seeded");
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
