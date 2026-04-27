import { relations, sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  websiteUrl: text('website_url'),
  instagramUrl: text('instagram_url'),
  etsyUrl: text('etsy_url'),
  ravelryUrl: text('ravelry_url'),
  tiktokUrl: text('tiktok_url'),
  youtubeUrl: text('youtube_url'),
  role: text('role').notNull().default('member'),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('users_email_unique').on(table.email)])

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('sessions_token_hash_unique').on(table.tokenHash)])

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  ...timestamps,
}, (table) => [uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash)])

export const manufacturers = sqliteTable('manufacturers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  websiteUrl: text('website_url'),
  scrapeRootUrl: text('scrape_root_url'),
  ...timestamps,
}, (table) => [uniqueIndex('manufacturers_slug_unique').on(table.slug)])

export const yarnLines = sqliteTable('yarn_lines', {
  id: text('id').primaryKey(),
  manufacturerId: text('manufacturer_id').notNull().references(() => manufacturers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  weightClass: text('weight_class'),
  fiberContent: text('fiber_content'),
  yardageMeters: integer('yardage_meters'),
  needleOrHookRange: text('needle_or_hook_range'),
  productUrl: text('product_url'),
  ...timestamps,
}, (table) => [uniqueIndex('yarn_lines_slug_unique').on(table.slug)])

export const yarnColorways = sqliteTable('yarn_colorways', {
  id: text('id').primaryKey(),
  yarnLineId: text('yarn_line_id').notNull().references(() => yarnLines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  colorCode: text('color_code'),
  hexReference: text('hex_reference'),
  ...timestamps,
}, (table) => [uniqueIndex('yarn_colorways_line_color_unique').on(table.yarnLineId, table.name)])

export const barcodes = sqliteTable('barcodes', {
  id: text('id').primaryKey(),
  barcodeValue: text('barcode_value').notNull(),
  format: text('format').notNull().default('unknown'),
  yarnLineId: text('yarn_line_id').references(() => yarnLines.id, { onDelete: 'set null' }),
  yarnColorwayId: text('yarn_colorway_id').references(() => yarnColorways.id, { onDelete: 'set null' }),
  ...timestamps,
}, (table) => [uniqueIndex('barcodes_value_unique').on(table.barcodeValue)])

export const inventoryYarn = sqliteTable('inventory_yarn', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  yarnLineId: text('yarn_line_id').references(() => yarnLines.id, { onDelete: 'set null' }),
  yarnColorwayId: text('yarn_colorway_id').references(() => yarnColorways.id, { onDelete: 'set null' }),
  nickname: text('nickname'),
  quantity: integer('quantity').notNull().default(1),
  isLowStock: integer('is_low_stock', { mode: 'boolean' }).notNull().default(false),
  isProjectReserved: integer('is_project_reserved', { mode: 'boolean' }).notNull().default(false),
  storageLocation: text('storage_location'),
  notes: text('notes'),
  ...timestamps,
})

export const hooks = sqliteTable('hooks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sizeLabel: text('size_label').notNull(),
  metricSizeMm: text('metric_size_mm'),
  material: text('material'),
  quantity: integer('quantity').notNull().default(1),
  ...timestamps,
})

export const patterns = sqliteTable('patterns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  sourceUrl: text('source_url'),
  difficulty: text('difficulty'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  publicShareConfirmed: integer('public_share_confirmed', { mode: 'boolean' }).notNull().default(false),
  pdfR2Key: text('pdf_r2_key'),
  pdfMimeType: text('pdf_mime_type'),
  pdfFileName: text('pdf_file_name'),
  coverR2Key: text('cover_r2_key'),
  coverMimeType: text('cover_mime_type'),
  moderationStatus: text('moderation_status').notNull().default('active'),
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: integer('moderated_at'),
  notes: text('notes'),
  ...timestamps,
})

export const creations = sqliteTable('creations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').references(() => patterns.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  moderationStatus: text('moderation_status').notNull().default('active'),
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: integer('moderated_at'),
  notes: text('notes'),
  finishedAt: integer('finished_at'),
  ...timestamps,
})

export const creationYarn = sqliteTable('creation_yarn', {
  creationId: text('creation_id').notNull().references(() => creations.id, { onDelete: 'cascade' }),
  inventoryYarnId: text('inventory_yarn_id').notNull().references(() => inventoryYarn.id, { onDelete: 'cascade' }),
  skeinsUsed: integer('skeins_used').notNull().default(1),
}, (table) => [primaryKey({ columns: [table.creationId, table.inventoryYarnId] })])

export const creationHooks = sqliteTable('creation_hooks', {
  creationId: text('creation_id').notNull().references(() => creations.id, { onDelete: 'cascade' }),
  hookId: text('hook_id').notNull().references(() => hooks.id, { onDelete: 'cascade' }),
}, (table) => [primaryKey({ columns: [table.creationId, table.hookId] })])

export const creationImages = sqliteTable('creation_images', {
  id: text('id').primaryKey(),
  creationId: text('creation_id').notNull().references(() => creations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  ...timestamps,
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  body: text('body').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  moderationStatus: text('moderation_status').notNull().default('active'),
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: integer('moderated_at'),
  ...timestamps,
})

export const postImages = sqliteTable('post_images', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  ...timestamps,
})

export const postHearts = sqliteTable('post_hearts', {
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] })])

export const assetFiles = sqliteTable('asset_files', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('creation-photo'),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  ...timestamps,
})

export const communityClaims = sqliteTable('community_claims', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldKey: text('field_key'),
  proposedValue: text('proposed_value'),
  notes: text('notes'),
  status: text('status').notNull().default('open'),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resolvedAt: integer('resolved_at'),
  resolvedByUserId: text('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const communityClaimVotes = sqliteTable(
  'community_claim_votes',
  {
    claimId: text('claim_id').notNull().references(() => communityClaims.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    vote: text('vote').notNull().default('agree'),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.claimId, table.userId] })],
)

export const communityFlags = sqliteTable('community_flags', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resolvedAt: integer('resolved_at'),
  resolvedByUserId: text('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  parentCommentId: text('parent_comment_id').references((): any => comments.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  depth: integer('depth').notNull().default(0),
  ...timestamps,
})

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  yarn: many(inventoryYarn),
  hooks: many(hooks),
  patterns: many(patterns),
  creations: many(creations),
  posts: many(posts),
  comments: many(comments),
}))

export const manufacturerRelations = relations(manufacturers, ({ many }) => ({
  yarnLines: many(yarnLines),
}))

export const yarnLineRelations = relations(yarnLines, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [yarnLines.manufacturerId],
    references: [manufacturers.id],
  }),
  colorways: many(yarnColorways),
  barcodes: many(barcodes),
}))
