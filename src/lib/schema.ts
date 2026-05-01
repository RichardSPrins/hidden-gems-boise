// src/lib/schema.ts
// Schema factory functions for Hidden Gems Boise
// Each function returns a WithContext<T> object ready to be serialized as JSON-LD
// Pass arrays of these into BaseLayout via the `schemas` prop

import type {
  WebSite,
  Organization,
  LocalBusiness,
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Event,
  ItemList,
  WithContext,
  SearchAction,
  DayOfWeek,
} from "schema-dts";

export const SITE_URL = "https://hiddengemsboise.com";
export const SITE_NAME = "Hidden Gems Boise";
const SITE_DESCRIPTION =
  "A curated directory of independently owned businesses across the Treasure Valley, Boise Idaho.";
const LOGO_URL = `${SITE_URL}/logo.png`;
const OG_IMAGE = `${SITE_URL}/images/og-default.jpg`;

// ─────────────────────────────────────────────────────────
// WEBSITE — used on every page via BaseLayout
// ─────────────────────────────────────────────────────────
export function createWebsiteSchema(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/explore?q={search_term_string}`,
      },
      "query-input": {
        "@type": "PropertyValueSpecification",
        valueRequired: true,
        valueName: "search_term_string",
      },
    } as SearchAction,
  };
}

// ─────────────────────────────────────────────────────────
// ORGANIZATION — used on homepage and about page
// ─────────────────────────────────────────────────────────
export function createOrganizationSchema(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
    },
    sameAs: [
      "https://www.instagram.com/hiddengemsboise",
      "https://www.facebook.com/hiddengemsboise",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@hiddengemsboise.com",
      contactType: "customer service",
    },
  };
}

// ─────────────────────────────────────────────────────────
// LOCAL BUSINESS — used on listing detail pages
// ─────────────────────────────────────────────────────────

// Map our category names to schema.org LocalBusiness subtypes
const CATEGORY_TYPE_MAP: Record<string, string> = {
  "Food & Drink": "FoodEstablishment",
  "Health & Wellness": "HealthAndBeautyBusiness",
  Shopping: "Store",
  "Home Services": "HomeAndConstructionBusiness",
  "Arts & Entertainment": "EntertainmentBusiness",
  "Professional Services": "ProfessionalService",
  Education: "EducationalOrganization",
  Automotive: "AutoRepair",
};

/** Index 0 = Sunday … 6 = Saturday; matches schema.org DayOfWeek URLs */
const SCHEMA_DAY_OF_WEEK: DayOfWeek[] = [
  "https://schema.org/Sunday",
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
];

export function createLocalBusinessSchema(biz: {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  pricePoint?: string | null;
  averageRating?: number;
  reviewCount?: number;
  categoryName?: string;
  hours?: Array<{
    dayOfWeek: number;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }>;
  socials?: Array<{ url: string }>;
}): WithContext<LocalBusiness> {
  const schemaType = biz.categoryName
    ? (CATEGORY_TYPE_MAP[biz.categoryName] ?? "LocalBusiness")
    : "LocalBusiness";

  const priceMap: Record<string, string> = {
    ONE: "$",
    TWO: "$$",
    THREE: "$$$",
    FOUR: "$$$$",
  };

  const openingHoursSpec = biz.hours
    ?.filter((h) => !h.isClosed && h.openTime && h.closeTime)
    .map((h) => ({
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: SCHEMA_DAY_OF_WEEK[h.dayOfWeek]!,
      opens: h.openTime!,
      closes: h.closeTime!,
    }));

  const sameAs = [
    biz.websiteUrl,
    ...(biz.socials?.map((s) => s.url) ?? []),
  ].filter(Boolean) as string[];

  return {
    "@context": "https://schema.org",
    "@type": schemaType as any,
    name: biz.name,
    url: `${SITE_URL}/listings/${biz.slug}`,
    ...(biz.description && { description: biz.description }),
    ...(biz.image && { image: biz.image }),
    ...(biz.phone && { telephone: biz.phone }),
    ...(biz.email && { email: biz.email }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(biz.pricePoint && { priceRange: priceMap[biz.pricePoint] }),
    ...(biz.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: biz.address,
        addressLocality: biz.city ?? "Boise",
        addressRegion: biz.state ?? "ID",
        postalCode: biz.zip ?? "",
        addressCountry: "US",
      },
    }),
    ...(biz.lat &&
      biz.lng && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: biz.lat,
          longitude: biz.lng,
        },
      }),
    ...(openingHoursSpec?.length && {
      openingHoursSpecification: openingHoursSpec,
    }),
    ...(biz.averageRating &&
      biz.reviewCount &&
      biz.reviewCount > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: biz.averageRating.toFixed(1),
          reviewCount: biz.reviewCount,
          bestRating: "5",
          worstRating: "1",
        },
      }),
  };
}

// ─────────────────────────────────────────────────────────
// BLOG POSTING — used on blog post detail pages
// ─────────────────────────────────────────────────────────
export function createBlogPostSchema(post: {
  title: string;
  description: string;
  slug: string;
  image?: string | null;
  pubDate: Date;
  updatedDate?: Date | null;
  author?: string;
  category?: string;
}): WithContext<BlogPosting> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    ...(post.image && { image: post.image }),
    datePublished: post.pubDate.toISOString(),
    dateModified: (post.updatedDate ?? post.pubDate).toISOString(),
    author: {
      "@type": "Person",
      name: post.author ?? "Richard Prins Jr.",
      url: `${SITE_URL}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: LOGO_URL,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    ...(post.category && { articleSection: post.category }),
  };
}

// ─────────────────────────────────────────────────────────
// BREADCRUMB — used on listing, blog, event, category pages
// ─────────────────────────────────────────────────────────
export function createBreadcrumbSchema(
  items: Array<{ name: string; url: string }>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─────────────────────────────────────────────────────────
// FAQ — used on homepage and any page with FAQs
// ─────────────────────────────────────────────────────────
export function createFAQSchema(
  faqs: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ─────────────────────────────────────────────────────────
// EVENT — used on event detail pages
// ─────────────────────────────────────────────────────────
export function createEventSchema(evt: {
  title: string;
  id: string;
  description?: string | null;
  startDateTime: Date;
  endDateTime?: Date | null;
  image?: string | null;
  ticketUrl?: string | null;
  isRecurring?: boolean;
  businessName?: string;
  businessSlug?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): WithContext<Event> {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evt.title,
    url: `${SITE_URL}/events/${evt.id}`,
    ...(evt.description && { description: evt.description }),
    ...(evt.image && { image: evt.image }),
    startDate: evt.startDateTime.toISOString(),
    ...(evt.endDateTime && { endDate: evt.endDateTime.toISOString() }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(evt.address && {
      location: {
        "@type": "Place",
        name: evt.businessName ?? "Boise, ID",
        address: {
          "@type": "PostalAddress",
          streetAddress: evt.address,
          addressLocality: evt.city ?? "Boise",
          addressRegion: evt.state ?? "ID",
          addressCountry: "US",
        },
      },
    }),
    ...(evt.businessName &&
      evt.businessSlug && {
        organizer: {
          "@type": "Organization",
          name: evt.businessName,
          url: `${SITE_URL}/listings/${evt.businessSlug}`,
        },
      }),
    ...(evt.ticketUrl && {
      offers: {
        "@type": "Offer",
        url: evt.ticketUrl,
        availability: "https://schema.org/InStock",
      },
    }),
  };
}

// ─────────────────────────────────────────────────────────
// ITEM LIST — used on category/explore pages
// ─────────────────────────────────────────────────────────
export function createItemListSchema(
  items: Array<{
    name: string;
    slug: string;
    position: number;
  }>,
): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: `${SITE_URL}/listings/${item.slug}`,
    })),
  };
}
