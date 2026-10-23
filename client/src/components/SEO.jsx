import { Helmet } from "react-helmet-async";

const DEFAULT_SITE_NAME = "NearMySpace";
const DEFAULT_SITE_URL =
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://nearmy-space.vercel.app");
const DEFAULT_IMAGE = `${DEFAULT_SITE_URL}/logo-desktop.png`;
const DEFAULT_DESCRIPTION =
  "NearMySpace is India's social real estate marketplace. Explore verified homes, direct owner connections, smart commute times, and authentic community reviews.";

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  schema = null,
  propertyData = null,
}) {
  const siteUrl = (DEFAULT_SITE_URL || "").replace(/\/$/, "");
  const canonical = path.startsWith("http") ? path : `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const fullTitle = title ? `${title} | ${DEFAULT_SITE_NAME}` : `${DEFAULT_SITE_NAME} | Social Real Estate Marketplace`;
  const metaImage = image?.startsWith("http") ? image : `${siteUrl}${image?.startsWith("/") ? image : `/${image}`}`;

  // Build Real Estate JSON-LD Schema if propertyData is provided
  let structuredData = schema;
  if (!structuredData && propertyData) {
    const price = Number(propertyData.price) || 0;
    const isRent = propertyData.listingType === "rent" || propertyData.type === "rent";
    const propertyType = propertyData.propertyType || "Apartment";

    structuredData = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "name": propertyData.title || title,
      "description": propertyData.description || description,
      "url": canonical,
      "image": propertyData.images?.length ? propertyData.images : [metaImage],
      "datePosted": propertyData.createdAt || new Date().toISOString(),
      "offers": {
        "@type": "Offer",
        "price": price,
        "priceCurrency": "INR",
        "availability": propertyData.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        "businessFunction": isRent ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
      },
      "about": {
        "@type": propertyType === "Apartment" ? "Apartment" : "SingleFamilyResidence",
        "name": propertyData.title || title,
        "numberOfRooms": propertyData.bedrooms || propertyData.bhk || 1,
        "numberOfBathroomsTotal": propertyData.bathrooms || 1,
        ...(propertyData.areaSqFt ? { "floorSize": { "@type": "QuantitativeValue", "value": propertyData.areaSqFt, "unitCode": "FTK" } } : {}),
        "address": {
          "@type": "PostalAddress",
          "streetAddress": propertyData.locality || propertyData.location || "",
          "addressLocality": propertyData.city || "",
          "addressCountry": "IN",
        },
        ...(propertyData.latitude && propertyData.longitude
          ? {
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": propertyData.latitude,
                "longitude": propertyData.longitude,
              },
            }
          : {}),
      },
    };
  }

  return (
    <Helmet>
      {/* Primary HTML Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta
        name="robots"
        content={
          noindex
            ? "noindex, nofollow"
            : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        }
      />

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:site_name" content={DEFAULT_SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={metaImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={metaImage} />

      {/* JSON-LD Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
