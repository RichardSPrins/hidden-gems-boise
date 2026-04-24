// src/db/schema.ts
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  real,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "BUSINESS_OWNER"]);

export const businessStatusEnum = pgEnum("business_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "NEEDS_INFO",
]);

export const socialPlatformEnum = pgEnum("social_platform", [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "TWITTER",
  "YOUTUBE",
  "LINKEDIN",
  "YELP",
  "TRIPADVISOR",
  "OTHER",
]);

export const pricePointEnum = pgEnum("price_point", [
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
]);

export const eventCategoryEnum = pgEnum("event_category", [
  "GRAND_OPENING",
  "SALE_AND_PROMOTION",
  "WORKSHOP_AND_CLASS",
  "LIVE_MUSIC_AND_ENTERTAINMENT",
  "COMMUNITY_AND_NETWORKING",
  "FOOD_AND_DRINK_SPECIAL",
  "SEASONAL_AND_HOLIDAY",
  "CHARITY_AND_FUNDRAISER",
  "OTHER",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
]);

// ─────────────────────────────────────────────────────────────
// AUTH — Better Auth managed tables
// ─────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("BUSINESS_OWNER"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// TAXONOMY
// ─────────────────────────────────────────────────────────────

export const category = pgTable("category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subcategory = pgTable(
  "subcategory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subcategory_category_slug_idx").on(t.categoryId, t.slug)]
);

export const feature = pgTable("feature", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  label: text("label").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const amenity = pgTable(
  "amenity",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("amenity_category_slug_idx").on(t.categoryId, t.slug)]
);

// ─────────────────────────────────────────────────────────────
// BUSINESS
// ─────────────────────────────────────────────────────────────

export const business = pgTable("business", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => category.id),
  subcategoryId: text("subcategory_id").references(() => subcategory.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  websiteUrl: text("website_url"),
  bookingUrl: text("booking_url"),
  keywords: text("keywords").array().notNull().default([]),
  pricePoint: pricePointEnum("price_point"),
  averageRating: real("average_rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  status: businessStatusEnum("status").notNull().default("DRAFT"),
  isVerified: boolean("is_verified").notNull().default(false),
  isGemOfWeek: boolean("is_gem_of_week").notNull().default(false),
  gemWeekDate: timestamp("gem_week_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// JOIN TABLES
// ─────────────────────────────────────────────────────────────

export const businessFeature = pgTable(
  "business_feature",
  {
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => feature.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.featureId] })]
);

export const businessAmenity = pgTable(
  "business_amenity",
  {
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    amenityId: text("amenity_id")
      .notNull()
      .references(() => amenity.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.amenityId] })]
);

// ─────────────────────────────────────────────────────────────
// LOCATION & HOURS
// ─────────────────────────────────────────────────────────────

export const location = pgTable("location", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("ID"),
  zip: text("zip").notNull(),
  neighborhood: text("neighborhood"),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const operatingHours = pgTable(
  "operating_hours",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
    openTime: text("open_time"), // "09:00"
    closeTime: text("close_time"), // "17:00"
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => [uniqueIndex("hours_location_day_idx").on(t.locationId, t.dayOfWeek)]
);

// ─────────────────────────────────────────────────────────────
// CONTACT & SOCIALS
// ─────────────────────────────────────────────────────────────

export const contactInfo = pgTable("contact_info", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .unique()
    .references(() => business.id, { onDelete: "cascade" }),
  phone: text("phone"),
  email: text("email"),
});

export const socialLink = pgTable(
  "social_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    platform: socialPlatformEnum("platform").notNull(),
    url: text("url").notNull(),
  },
  (t) => [
    uniqueIndex("social_link_business_platform_idx").on(
      t.businessId,
      t.platform
    ),
  ]
);

// ─────────────────────────────────────────────────────────────
// MEDIA
// ─────────────────────────────────────────────────────────────

export const image = pgTable("image", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// FAQs
// ─────────────────────────────────────────────────────────────

export const faq = pgTable("faq", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─────────────────────────────────────────────────────────────
// GEM SPOTLIGHT
// ─────────────────────────────────────────────────────────────

export const gemSpotlight = pgTable("gem_spotlight", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  writeup: text("writeup").notNull(),
  weekLabel: text("week_label").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────

export const review = pgTable("review", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  rating: integer("rating").notNull(), // 1-5
  body: text("body"),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

export const event = pgTable("event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .references(() => business.id, { onDelete: "cascade" }),
  locationId: text("location_id").references(() => location.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  category: eventCategoryEnum("category").notNull(),
  startDateTime: timestamp("start_date_time").notNull(),
  endDateTime: timestamp("end_date_time"),
  ticketUrl: text("ticket_url"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceFrequency: recurrenceFrequencyEnum("recurrence_frequency"),
  recurrenceEndsAt: timestamp("recurrence_ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventComment = pgTable("event_comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  body: text("body").notNull(),
  rating: integer("rating"), // optional 1-5
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// SUBMISSION
// ─────────────────────────────────────────────────────────────

export const submission = pgTable("submission", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  businessId: text("business_id")
    .notNull()
    .unique()
    .references(() => business.id, { onDelete: "cascade" }),
  status: submissionStatusEnum("status").notNull().default("SUBMITTED"),
  notes: text("notes"),
  ghlContactId: text("ghl_contact_id"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const publicSubmission = pgTable("public_submission", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Business info
  businessName: text("business_name").notNull(),
  categoryId: text("category_id").references(() => category.id),
  subcategoryId: text("subcategory_id").references(() => subcategory.id),
  website: text("website"),
  phone: text("phone"),
  email: text("email").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state").default("ID"),
  zip: text("zip"),
  neighborhood: text("neighborhood"),
  bio: text("bio"),
  pricePoint: pricePointEnum("price_point"),
  // Plan selection
  tier: text("tier").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  // Owner info
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  notes: text("notes"),
  // Status
  status: text("status").notNull().default("PENDING"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  businesses: many(business),
  sessions: many(session),
  accounts: many(account),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  subcategories: many(subcategory),
  amenities: many(amenity),
  businesses: many(business),
}));

export const subcategoryRelations = relations(subcategory, ({ one, many }) => ({
  category: one(category, {
    fields: [subcategory.categoryId],
    references: [category.id],
  }),
  businesses: many(business),
}));

export const featureRelations = relations(feature, ({ many }) => ({
  businesses: many(businessFeature),
}));

export const amenityRelations = relations(amenity, ({ one, many }) => ({
  category: one(category, {
    fields: [amenity.categoryId],
    references: [category.id],
  }),
  businesses: many(businessAmenity),
}));

export const businessRelations = relations(business, ({ one, many }) => ({
  owner: one(user, { fields: [business.ownerId], references: [user.id] }),
  category: one(category, {
    fields: [business.categoryId],
    references: [category.id],
  }),
  subcategory: one(subcategory, {
    fields: [business.subcategoryId],
    references: [subcategory.id],
  }),
  locations: many(location),
  contact: one(contactInfo, {
    fields: [business.id],
    references: [contactInfo.businessId],
  }),
  socials: many(socialLink),
  images: many(image),
  faqs: many(faq),
  features: many(businessFeature),
  amenities: many(businessAmenity),
  spotlights: many(gemSpotlight),
  submission: one(submission, {
    fields: [business.id],
    references: [submission.businessId],
  }),
  reviews: many(review),
  events: many(event),
}));

export const businessFeatureRelations = relations(
  businessFeature,
  ({ one }) => ({
    business: one(business, {
      fields: [businessFeature.businessId],
      references: [business.id],
    }),
    feature: one(feature, {
      fields: [businessFeature.featureId],
      references: [feature.id],
    }),
  })
);

export const businessAmenityRelations = relations(
  businessAmenity,
  ({ one }) => ({
    business: one(business, {
      fields: [businessAmenity.businessId],
      references: [business.id],
    }),
    amenity: one(amenity, {
      fields: [businessAmenity.amenityId],
      references: [amenity.id],
    }),
  })
);

export const locationRelations = relations(location, ({ one, many }) => ({
  business: one(business, {
    fields: [location.businessId],
    references: [business.id],
  }),
  hours: many(operatingHours),
  events: many(event),
}));

export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  location: one(location, {
    fields: [operatingHours.locationId],
    references: [location.id],
  }),
}));

export const contactInfoRelations = relations(contactInfo, ({ one }) => ({
  business: one(business, {
    fields: [contactInfo.businessId],
    references: [business.id],
  }),
}));

export const socialLinkRelations = relations(socialLink, ({ one }) => ({
  business: one(business, {
    fields: [socialLink.businessId],
    references: [business.id],
  }),
}));

export const imageRelations = relations(image, ({ one }) => ({
  business: one(business, {
    fields: [image.businessId],
    references: [business.id],
  }),
}));

export const faqRelations = relations(faq, ({ one }) => ({
  business: one(business, {
    fields: [faq.businessId],
    references: [business.id],
  }),
}));

export const gemSpotlightRelations = relations(gemSpotlight, ({ one }) => ({
  business: one(business, {
    fields: [gemSpotlight.businessId],
    references: [business.id],
  }),
}));

export const reviewRelations = relations(review, ({ one }) => ({
  business: one(business, {
    fields: [review.businessId],
    references: [business.id],
  }),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  business: one(business, {
    fields: [event.businessId],
    references: [business.id],
  }),
  location: one(location, {
    fields: [event.locationId],
    references: [location.id],
  }),
  comments: many(eventComment),
}));

export const eventCommentRelations = relations(eventComment, ({ one }) => ({
  event: one(event, { fields: [eventComment.eventId], references: [event.id] }),
}));

export const submissionRelations = relations(submission, ({ one }) => ({
  business: one(business, {
    fields: [submission.businessId],
    references: [business.id],
  }),
}));

export const publicSubmissionRelations = relations(
  publicSubmission,
  ({ one }) => ({
    category: one(category, {
      fields: [publicSubmission.categoryId],
      references: [category.id],
    }),
    subcategory: one(subcategory, {
      fields: [publicSubmission.subcategoryId],
      references: [subcategory.id],
    }),
  })
);
