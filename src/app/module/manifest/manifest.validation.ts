import { z } from "zod";

export const createManifestValidation = z.object({
  body: z.object({
    fromHubId: z.string().min(1),
    toHubId: z.string().min(1),
    vehicleInfo: z.string().optional(),
  }),
});

export const addItemsValidation = z.object({
  body: z.object({
    shipmentIds: z.array(z.string().min(1)).min(1),
  }),
});
