import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  emails: defineTable({
    userId: v.id("users"),
    messageId: v.string(),
    threadId: v.string(),
    from: v.string(),
    fromEmail: v.string(),
    subject: v.string(),
    snippet: v.string(),
    date: v.string(),
    isRead: v.boolean(),
  }).index("by_user", ["userId"]),
});

export default schema;
