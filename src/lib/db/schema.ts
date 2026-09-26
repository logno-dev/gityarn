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
  patternType: text('pattern_type').notNull().default('pdf'),
  nativeStyleJson: text('native_style_json'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  publicShareConfirmed: integer('public_share_confirmed', { mode: 'boolean' }).notNull().default(false),
  pdfR2Key: text('pdf_r2_key'),
  pdfMimeType: text('pdf_mime_type'),
  pdfFileName: text('pdf_file_name'),
  pdfPreviewR2Key: text('pdf_preview_r2_key'),
  pdfPreviewMimeType: text('pdf_preview_mime_type'),
  coverR2Key: text('cover_r2_key'),
  coverMimeType: text('cover_mime_type'),
  moderationStatus: text('moderation_status').notNull().default('active'),
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: integer('moderated_at'),
  notes: text('notes'),
  ...timestamps,
})

export const nativePatternSections = sqliteTable('native_pattern_sections', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  sectionType: text('section_type').notNull().default('pattern'),
  title: text('title').notNull(),
  notes: text('notes'),
  designStyleJson: text('design_style_json'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const nativePatternRows = sqliteTable('native_pattern_rows', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  sectionId: text('section_id').notNull().references(() => nativePatternSections.id, { onDelete: 'cascade' }),
  blockType: text('block_type').notNull().default('row'),
  rowType: text('row_type').notNull().default('round'),
  rowNumber: integer('row_number').notNull(),
  instruction: text('instruction').notNull(),
  structuredJson: text('structured_json'),
  computedStitchCount: integer('computed_stitch_count'),
  colorKey: text('color_key'),
  imageR2Key: text('image_r2_key'),
  imageMimeType: text('image_mime_type'),
  imageByteSize: integer('image_byte_size'),
  imageAltText: text('image_alt_text'),
  imageCaption: text('image_caption'),
  blockHeading: text('block_heading'),
  designStyleJson: text('design_style_json'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const nativePatternColors = sqliteTable('native_pattern_colors', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  label: text('label').notNull(),
  hexColor: text('hex_color'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, (table) => [uniqueIndex('native_pattern_colors_pattern_key_unique').on(table.patternId, table.key)])

export const nativePatternRowProgress = sqliteTable('native_pattern_row_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  rowId: text('row_id').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.patternId, table.rowId] })])

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('planned'),
  notes: text('notes'),
  startDate: text('start_date'),
  dueDate: text('due_date'),
  completedAt: integer('completed_at'),
  ...timestamps,
})

export const projectSteps = sqliteTable('project_steps', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  dueDate: text('due_date'),
  completedAt: integer('completed_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const projectStepPatterns = sqliteTable('project_step_patterns', {
  stepId: text('step_id').notNull().references(() => projectSteps.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [primaryKey({ columns: [table.stepId, table.patternId] })])

export const projectYarn = sqliteTable('project_yarn', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  inventoryYarnId: text('inventory_yarn_id').notNull().references(() => inventoryYarn.id, { onDelete: 'cascade' }),
  skeinsPlanned: integer('skeins_planned').notNull().default(1),
}, (table) => [primaryKey({ columns: [table.projectId, table.inventoryYarnId] })])

export const projectHooks = sqliteTable('project_hooks', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  hookId: text('hook_id').notNull().references(() => hooks.id, { onDelete: 'cascade' }),
}, (table) => [primaryKey({ columns: [table.projectId, table.hookId] })])

export const creations = sqliteTable('creations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  patternId: text('pattern_id').references(() => patterns.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  postType: text('post_type').notNull().default('standalone'),
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

export const creationPatterns = sqliteTable('creation_patterns', {
  creationId: text('creation_id').notNull().references(() => creations.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [primaryKey({ columns: [table.creationId, table.patternId] })])

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

export const shareInboxItems = sqliteTable('share_inbox_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  text: text('text'),
  url: text('url'),
  consumedAt: integer('consumed_at'),
  consumedEntityType: text('consumed_entity_type'),
  consumedEntityId: text('consumed_entity_id'),
  ...timestamps,
})

export const shareInboxFiles = sqliteTable('share_inbox_files', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => shareInboxItems.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('image'),
  originalFileName: text('original_file_name'),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  ...timestamps,
})

export const carouselItems = sqliteTable('carousel_items', {
  id: text('id').primaryKey(),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  imageR2Key: text('image_r2_key').notNull(),
  imageMimeType: text('image_mime_type'),
  imageByteSize: integer('image_byte_size'),
  altText: text('alt_text'),
  linkUrl: text('link_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
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
  moderationStatus: text('moderation_status').notNull().default('active'),
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: integer('moderated_at'),
  ...timestamps,
})

export const commentHearts = sqliteTable('comment_hearts', {
  commentId: text('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.commentId, table.userId] })])

export const creationHearts = sqliteTable('creation_hearts', {
  creationId: text('creation_id').notNull().references(() => creations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.creationId, table.userId] })])

export const patternHearts = sqliteTable('pattern_hearts', {
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.patternId, table.userId] })])

export const patternLibraryLinks = sqliteTable('pattern_library_links', {
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.patternId, table.userId] })])

export const patternFileVariants = sqliteTable('pattern_file_variants', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull(),
  languageLabel: text('language_label').notNull(),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type').notNull().default('application/pdf'),
  fileName: text('file_name'),
  ...timestamps,
})

export const patternReaderStates = sqliteTable('pattern_reader_states', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull().default('en-US'),
  lastReadPage: integer('last_read_page').notNull().default(1),
  pageCount: integer('page_count'),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.patternId, table.languageCode] })])

export const patternPageMetadata = sqliteTable('pattern_page_metadata', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull().default('en-US'),
  pageNumber: integer('page_number').notNull(),
  isBookmarked: integer('is_bookmarked', { mode: 'boolean' }).notNull().default(false),
  bookmarkLabel: text('bookmark_label'),
  note: text('note'),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.patternId, table.languageCode, table.pageNumber] })])

export const patternPdfHighlights = sqliteTable('pattern_pdf_highlights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patternId: text('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull().default('en-US'),
  pageNumber: integer('page_number').notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  color: text('color').notNull().default('yellow'),
  note: text('note'),
  ...timestamps,
})

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  message: text('message').notNull(),
  targetPath: text('target_path'),
  readAt: integer('read_at'),
  ...timestamps,
})

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  yarn: many(inventoryYarn),
  hooks: many(hooks),
  patterns: many(patterns),
  projects: many(projects),
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
