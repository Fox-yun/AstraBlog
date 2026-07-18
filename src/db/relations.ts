import { relations } from "drizzle-orm";
import { user, session, account } from "./schema/auth";
import { profiles } from "./schema/profiles";
import { posts, postVersions, postTags } from "./schema/posts";
import { categories, tags } from "./schema/taxonomy";
import { comments, commentReports } from "./schema/comments";
import { media } from "./schema/media";
import { notifications } from "./schema/notifications";
import { auditLogs } from "./schema/audit";

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profiles, { fields: [user.id], references: [profiles.userId] }),
  sessions: many(session),
  accounts: many(account),
  posts: many(posts),
  comments: many(comments),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  media: many(media),
}));

export const profileRelations = relations(profiles, ({ one }) => ({
  user: one(user, { fields: [profiles.userId], references: [user.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(user, { fields: [posts.createdBy], references: [user.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  coverMedia: one(media, { fields: [posts.coverMediaId], references: [media.id] }),
  versions: many(postVersions),
  tags: many(postTags),
  comments: many(comments),
}));

export const postVersionsRelations = relations(postVersions, ({ one }) => ({
  post: one(posts, { fields: [postVersions.postId], references: [posts.id] }),
  creator: one(user, { fields: [postVersions.createdBy], references: [user.id] }),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(user, { fields: [comments.authorId], references: [user.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_parent",
  }),
  replies: many(comments, { relationName: "comment_parent" }),
  root: one(comments, {
    fields: [comments.rootId],
    references: [comments.id],
    relationName: "comment_root",
  }),
  reports: many(commentReports),
}));

export const commentReportsRelations = relations(commentReports, ({ one }) => ({
  comment: one(comments, { fields: [commentReports.commentId], references: [comments.id] }),
  reporter: one(user, { fields: [commentReports.reporterId], references: [user.id] }),
  reviewer: one(user, { fields: [commentReports.reviewedBy], references: [user.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  actor: one(user, { fields: [notifications.actorId], references: [user.id] }),
  comment: one(comments, { fields: [notifications.commentId], references: [comments.id] }),
  post: one(posts, { fields: [notifications.postId], references: [posts.id] }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  owner: one(user, { fields: [media.ownerId], references: [user.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}));
