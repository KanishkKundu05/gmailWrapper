import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface EmailData {
  messageId: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
}

// Query to get emails for the current user
export const getEmails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
});

// Internal mutation to store emails
export const storeEmails = internalMutation({
  args: {
    userId: v.id("users"),
    emails: v.array(
      v.object({
        messageId: v.string(),
        threadId: v.string(),
        from: v.string(),
        fromEmail: v.string(),
        subject: v.string(),
        snippet: v.string(),
        date: v.string(),
        isRead: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get existing email messageIds for this user
    const existingEmails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const existingIds = new Set(existingEmails.map((e) => e.messageId));

    // Only insert new emails
    for (const email of args.emails) {
      if (!existingIds.has(email.messageId)) {
        await ctx.db.insert("emails", {
          userId: args.userId,
          ...email,
        });
      }
    }
  },
});

// Internal query to get user's OAuth token from authAccounts
export const getUserToken = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ accessToken: string } | null> => {
    // Look for OAuth account linked to this user
    const account = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!account) return null;

    // The access token might be stored in different ways
    // Check if there's an access token field
    const accountData = account as Record<string, unknown>;
    if (accountData.accessToken && typeof accountData.accessToken === "string") {
      return { accessToken: accountData.accessToken };
    }

    return null;
  },
});

// Action to fetch emails from Gmail API
export const fetchGmailEmails = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; count: number; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, count: 0, error: "Not authenticated" };
    }

    // Get the user's access token
    const tokenDoc = await ctx.runQuery(internal.gmail.getUserToken, { userId });
    if (!tokenDoc?.accessToken) {
      return {
        success: false,
        count: 0,
        error: "No access token found. Please sign out and sign in again to grant Gmail access."
      };
    }

    const accessToken: string = tokenDoc.accessToken;

    try {
      // Fetch emails from Gmail API
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, count: 0, error: `Failed to fetch emails: ${error}` };
      }

      const data = (await response.json()) as { messages?: GmailMessage[] };
      const messages: GmailMessage[] = data.messages || [];

      // Fetch details for each message
      const emailDetails: (EmailData | null)[] = await Promise.all(
        messages.slice(0, 15).map(async (msg: GmailMessage): Promise<EmailData | null> => {
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!msgResponse.ok) return null;

          const msgData = (await msgResponse.json()) as GmailMessageDetail;
          const headers = msgData.payload?.headers || [];

          const getHeader = (name: string): string =>
            headers.find((h) => h.name === name)?.value || "";

          const fromHeader = getHeader("From");
          const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
          const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : fromHeader;
          const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

          return {
            messageId: msgData.id,
            threadId: msgData.threadId,
            from: fromName,
            fromEmail: fromEmail,
            subject: getHeader("Subject") || "(No Subject)",
            snippet: msgData.snippet || "",
            date: getHeader("Date"),
            isRead: !msgData.labelIds?.includes("UNREAD"),
          };
        })
      );

      const validEmails: EmailData[] = emailDetails.filter((e): e is EmailData => e !== null);

      // Store emails in the database
      await ctx.runMutation(internal.gmail.storeEmails, {
        userId,
        emails: validEmails,
      });

      return { success: true, count: validEmails.length };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});
