import {
  pgTable,
  text,
  timestamp,
  boolean,
  unique,
  integer,
  decimal,
  index
} from 'drizzle-orm/pg-core';
import { defineRelations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

////////////////////////////////////////////////////////////////////////
// KOSTNAD - Expense tracking tables
////////////////////////////////////////////////////////////////////////
export const category = pgTable(
  'category',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    isDefault: boolean('isDefault').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  t => [unique().on(t.name)]
);
export type Category = typeof category.$inferSelect;
export type InsertCategory = typeof category.$inferInsert;

////////////////////////////////////////////////////////////////////////
// AUTH - Better-auth expects singular model names
// (Defined before upload table since upload.uploadedBy references user.id)
////////////////////////////////////////////////////////////////////////
export const user = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Better Auth
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),

  role: text('role', {
    enum: ['USER', 'ADMIN']
  })
    .notNull()
    .default('USER'),

  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});
export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;

////////////////////////////////////////////////////////////////////////
// KOSTNAD - Upload tracking
////////////////////////////////////////////////////////////////////////
export const upload = pgTable('upload', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  fileName: text('fileName').notNull(),
  uploadedBy: text('uploadedBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  transactionCount: integer('transactionCount').notNull().default(0),
  dateRangeStart: timestamp('dateRangeStart'),
  dateRangeEnd: timestamp('dateRangeEnd'),
  createdAt: timestamp('createdAt').notNull().defaultNow()
});
export type Upload = typeof upload.$inferSelect;
export type InsertUpload = typeof upload.$inferInsert;

////////////////////////////////////////////////////////////////////////
// KOSTNAD - Transaction records
////////////////////////////////////////////////////////////////////////
export const transaction = pgTable(
  'transaction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    date: timestamp('date').notNull(),
    merchant: text('merchant').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    balance: decimal('balance', { precision: 12, scale: 2 }),
    categoryId: text('categoryId').references(() => category.id),
    // Nullable for manually created transactions
    uploadId: text('uploadId').references(() => upload.id, { onDelete: 'cascade' }),
    // Hash of original values (date|amount|merchant) for duplicate detection
    // Original values preserved even when user edits date/merchant/amount
    originalHash: text('originalHash').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  t => [index('transaction_date_idx').on(t.date), index('transaction_hash_idx').on(t.originalHash)]
);
export type Transaction = typeof transaction.$inferSelect;
export type InsertTransaction = typeof transaction.$inferInsert;

////////////////////////////////////////////////////////////////////////
// KOSTNAD - Merchant to category mappings
////////////////////////////////////////////////////////////////////////
export const merchantMapping = pgTable(
  'merchant_mapping',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    merchantPattern: text('merchantPattern').notNull(),
    categoryId: text('categoryId').references(() => category.id),
    // Multi-merchants (umbrella merchants) always require manual review
    isMultiMerchant: boolean('isMultiMerchant').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  t => [unique().on(t.merchantPattern)]
);
export type MerchantMapping = typeof merchantMapping.$inferSelect;
export type InsertMerchantMapping = typeof merchantMapping.$inferInsert;

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

////////////////////////////////////////////////////////////////////////
// RELATIONS - Drizzle v1.0 RQB v2 API
////////////////////////////////////////////////////////////////////////
export const relations = defineRelations(
  { user, session, account, verification, upload, transaction, category, merchantMapping },
  r => ({
    user: {
      uploads: r.many.upload({
        from: r.user.id,
        to: r.upload.uploadedBy
      })
    },
    upload: {
      user: r.one.user({
        from: r.upload.uploadedBy,
        to: r.user.id,
        optional: false
      }),
      transactions: r.many.transaction({
        from: r.upload.id,
        to: r.transaction.uploadId
      })
    },
    transaction: {
      upload: r.one.upload({
        from: r.transaction.uploadId,
        to: r.upload.id,
        optional: true
      }),
      category: r.one.category({
        from: r.transaction.categoryId,
        to: r.category.id,
        optional: true
      })
    },
    category: {
      transactions: r.many.transaction({
        from: r.category.id,
        to: r.transaction.categoryId
      }),
      merchantMappings: r.many.merchantMapping({
        from: r.category.id,
        to: r.merchantMapping.categoryId
      })
    },
    merchantMapping: {
      category: r.one.category({
        from: r.merchantMapping.categoryId,
        to: r.category.id,
        optional: false
      })
    }
  })
);
