import { z } from 'zod';

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
// eslint-disable-next-line no-control-regex
const controlCharsPattern = /[\x00-\x1F\x7F]/g;

export const sanitizeText = (value: string) =>
  value
    .replace(scriptPattern, '')
    .replace(htmlTagPattern, '')
    .replace(controlCharsPattern, '')
    .trim();

export const safeText = (max: number, field = 'Texte') =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().min(1, `${field} requis`).max(max, `${field} trop long`));

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Nom utilisateur trop court')
  .max(30, 'Nom utilisateur trop long')
  .regex(/^[a-zA-Z0-9_]+$/, 'Uniquement lettres, chiffres et underscore');

export const registerSchema = z
  .object({
    email: z.string().trim().email('Email invalide').optional().or(z.literal('')),
    phone: z.string().trim().min(6, 'Numero mobile invalide').optional(),
    username: usernameSchema.optional(),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
    confirmPassword: z.string().optional(),
  })
  .refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const productSchema = z.object({
  name: safeText(80, 'Nom du produit'),
  description: safeText(1000, 'Description').optional().or(z.literal('')),
  price: z.coerce.number().positive('Le prix doit etre superieur a 0'),
  stock: z.coerce.number().int().min(0, 'Le stock ne peut pas etre negatif'),
  category: safeText(60, 'Categorie').optional().or(z.literal('')),
});

export const commentSchema = z.object({
  content: safeText(500, 'Commentaire'),
});

export const messageSchema = z.object({
  content: safeText(1000, 'Message'),
});

export const reportSchema = z.object({
  contentType: z.enum(['video', 'comment', 'product', 'message', 'profile']),
  contentId: z.string().uuid('Contenu invalide'),
  reason: safeText(80, 'Raison'),
  description: safeText(500, 'Description').optional().or(z.literal('')),
});

export const moderationActionSchema = z.object({
  userId: z.string().uuid('Utilisateur invalide'),
  actionType: z.enum(['warning', 'restrict_24h', 'ban_7days', 'ban_permanent']),
  reason: safeText(300, 'Raison'),
  contentType: z.enum(['video', 'comment', 'product', 'message', 'profile']).optional(),
  contentId: z.string().uuid().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
