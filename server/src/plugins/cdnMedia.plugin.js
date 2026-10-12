import { expandCdnUrl, stripCdnBase } from "../utils/cdnUrl.js";

/**
 * Mongoose plugin that transparently strips CDN domains on write (saving only relative paths)
 * and expands relative paths back to full, bandwidth-optimized CDN URLs on read.
 *
 * @param {import("mongoose").Schema} schema
 * @param {Object} options
 * @param {Array<string | { field: string, preset: string }>} [options.fields] - Top-level string or string-array field configs
 * @param {Array<{array: string, field: string, preset?: string}>} [options.subdocFields] - Subdocument array field configs
 */
export function cdnMediaPlugin(schema, options = {}) {
  const { fields = [], subdocFields = [] } = options;

  const normalizedFields = fields.map((f) =>
    typeof f === "string" ? { field: f, preset: "default" } : { preset: "default", ...f }
  );

  const normalizedSubdocs = subdocFields.map((s) => ({
    preset: "default",
    ...s,
  }));

  function expandItem(doc) {
    if (!doc || typeof doc !== "object") return;

    for (const { field, preset } of normalizedFields) {
      if (Array.isArray(doc[field])) {
        doc[field] = doc[field].map((val) =>
          typeof val === "string" ? expandCdnUrl(val, preset) : val
        );
      } else if (typeof doc[field] === "string") {
        doc[field] = expandCdnUrl(doc[field], preset);
      }
    }

    for (const { array, field, preset } of normalizedSubdocs) {
      if (Array.isArray(doc[array])) {
        doc[array].forEach((item) => {
          if (item && typeof item[field] === "string") {
            item[field] = expandCdnUrl(item[field], preset);
          }
        });
      }
    }
  }

  function stripItem(doc) {
    if (!doc || typeof doc !== "object") return;

    for (const { field } of normalizedFields) {
      if (Array.isArray(doc[field])) {
        doc[field] = doc[field].map((val) => (typeof val === "string" ? stripCdnBase(val) : val));
      } else if (typeof doc[field] === "string") {
        doc[field] = stripCdnBase(doc[field]);
      }
    }

    for (const { array, field } of normalizedSubdocs) {
      if (Array.isArray(doc[array])) {
        doc[array].forEach((item) => {
          if (item && typeof item[field] === "string") {
            item[field] = stripCdnBase(item[field]);
          }
        });
      }
    }
  }

  // Pre-save: strip full CDN URLs down to relative paths before saving to DB
  schema.pre("save", function (next) {
    stripItem(this);
    next();
  });

  // Pre-update hooks: strip when updating via findOneAndUpdate / updateOne
  schema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function (next) {
    const update = this.getUpdate();
    if (update) {
      if (update.$set) {
        stripItem(update.$set);
      }
      stripItem(update);
    }
    next();
  });

  // Post-init: expands relative paths when hydrating Mongoose documents
  schema.post("init", function (doc) {
    expandItem(doc);
  });

  // Post-query: expands relative paths for all queries (including .lean() plain objects)
  schema.post(["find", "findOne", "findOneAndUpdate"], function (res) {
    if (Array.isArray(res)) {
      res.forEach(expandItem);
    } else if (res) {
      expandItem(res);
    }
  });

  // Post-aggregate: expands relative paths for aggregation pipelines
  schema.post("aggregate", function (docs) {
    if (Array.isArray(docs)) {
      docs.forEach(expandItem);
    }
  });
}
