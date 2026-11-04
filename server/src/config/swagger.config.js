import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "InSell API",
      version: "1.0.0",
      description:
        "Real estate marketplace API — property listings, offers, deals, chat, notifications, and admin operations.",
      contact: { name: "InSell Team" },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5001",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "JWT access token stored as an httpOnly cookie",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string" },
            missingFields: { type: "object" },
            errors: { type: "array", items: { type: "object" } },
          },
        },
        Success: {
          type: "object",
          properties: {
            status: { type: "string", example: "success" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        HealthCheck: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            uptime: { type: "number" },
            ts: { type: "number" },
          },
        },
        SystemHealth: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
            uptime: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
            environment: { type: "string" },
            nodeVersion: { type: "string" },
            pid: { type: "integer" },
            memory: {
              type: "object",
              properties: {
                rss: { type: "integer" },
                heapUsed: { type: "integer" },
                heapTotal: { type: "integer" },
              },
            },
            services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: { type: "string" },
                  latencyMs: { type: "integer" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication & registration" },
      { name: "Users", description: "User profiles & settings" },
      { name: "Property Posts", description: "Property listings & feed" },
      { name: "Offers", description: "Price negotiation on listings" },
      { name: "Deals", description: "Deal pipeline after offer acceptance" },
      { name: "Reviews", description: "Post-deal user reviews" },
      { name: "Chat", description: "Real-time messaging" },
      { name: "Notifications", description: "Push & in-app notifications" },
      { name: "Community", description: "Community posts & discussions" },
      { name: "Admin", description: "Admin dashboard operations" },
      { name: "Health", description: "Health checks & readiness probes" },
    ],
  },
  apis: ["./src/routes/*.js", "./src/modules/*/routes.js", "./src/modules/*/*.routes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "InSell API Docs",
    })
  );

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
