import { z } from 'zod';
export const documentationPriceSchema = z.object({
  fixedPerBottle: z.number().finite().min(0).max(100000).nullable().optional(),
  productKey: z.string().trim().min(1).max(200),
  priceWithVat: z.number().finite().min(0).max(100000),
  saleWithoutVat: z.number().finite().min(0).max(100000),
  purchaseWithoutVat: z.number().finite().min(0).max(100000),
});
export type DocumentationPrice = z.infer<typeof documentationPriceSchema>;
export type DocumentationCatalog = Record<string, Omit<DocumentationPrice, 'productKey'>>;
